import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDb} from './helpers/test-db';

const today = new Date().toISOString().slice(0, 10);
const later = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

type Db = Awaited<ReturnType<typeof createTestDb>>;
type Result = {
  status: string;
  id?: string;
  customerId?: string;
  matches?: {id: string; reason: string}[];
  person?: {id: string; name: string};
};

const setup = async () => {
  const t = await createTestDb();
  await t.as('admin');
  const save = (data: object) => t.rpc('admin_person_save', [data]) as Promise<Result>;
  const make = async (name: string, phone: string, email: string, extra: object = {}) => {
    const r = await save({name, phone, email, ...extra});
    assert.equal(r.status, 'created', name + ' should be created, got ' + JSON.stringify(r));
    return r.id as string;
  };
  return {...t, save, make};
};

const list = async (t: Db, search = '', filter = '', sort = 'newest', page = 1) =>
  (await t.rpc('admin_list', ['people', search, page, filter, sort])) as {
    rows: {
      id: string;
      name: string;
      customerId: string;
      roles?: unknown;
      donations: number;
      borrowings: number;
      outstanding: number;
    }[];
    total: number;
  };
const names = (r: {rows: {name: string}[]}) => r.rows.map((x) => x.name).sort();

test('the original failure: a donor who borrows is found in the one list and nothing says "already exists"', async () => {
  const t = await setup();
  const asha = await t.make('Asha Verma', '+91 98765 43210', 'asha@example.test');
  await t.rpc('admin_donate', [{person_id: asha, books: [{title: 'Atlas', author: 'A', class_name: 'Geo'}]}]);
  // The old borrower picker only showed borrowers, so Asha was "not there" and adding her again was refused.
  const found = await list(t, 'asha');
  assert.deepEqual(names(found), ['Asha Verma']);
  const copy = (await t.db.query<{id: string}>('SELECT id FROM legacy_trust.book_lists LIMIT 1')).rows[0].id;
  // She can borrow although she was first saved as a donor.
  await t.rpc('admin_issue', [{person_id: asha, book_ids: [copy], issue_date: today, due_date: later}]);
  const row = (await list(t, 'asha')).rows[0];
  assert.equal(row.donations, 1);
  assert.equal(row.borrowings, 1);
  assert.equal(row.outstanding, 1);
  // Adding her again is not an error: the screen is told who she is.
  const again = await t.save({name: 'asha  verma', phone: '09876543210', email: 'other@example.test'});
  assert.equal(again.status, 'exists');
  assert.equal(again.person?.id, asha);
  assert.equal((await list(t)).total, 1);
});

test('reference numbers never repeat an old one, even when the counters are behind the old records', async () => {
  const t = await setup();
  // An old system that already used UTC-P-1 to UTC-P-60, member UTC-M-70 and booking UTC-D-80.
  await t.db.query(
    `INSERT INTO legacy_trust.customers(id,"customerId",name,email,phone,type,status)
       SELECT 'old-'||g,'UTC-P-'||g,'Old Person '||g,'old'||g||'@example.test','90000'||lpad(g::text,5,'0'),'customer','active' FROM generate_series(1,60) g`,
  );
  await t.db.query(
    `INSERT INTO legacy_trust.members(id,"memberId",name,email,phone,bloodgroup,city,purpose,status) VALUES('m1','UTC-M-70','Old Member','m@example.test','9111111111','O+','Silvassa','help','active')`,
  );
  await t.db.query(
    `INSERT INTO legacy_trust.bookings(id,"orderNo","issueDate","endDate",status) VALUES('b1','UTC-D-80',current_date,current_date,'new')`,
  );
  await t.db.query('ALTER SEQUENCE trust_admin.reference_seq RESTART WITH 1');
  const ids = new Set<string>();
  for (let i = 0; i < 25; i++) {
    const r = await t.save({
      name: 'New Person ' + i,
      phone: '8000000' + String(100 + i),
      email: `new${i}@example.test`,
    });
    assert.equal(r.status, 'created');
    assert.ok(!ids.has(r.customerId as string));
    ids.add(r.customerId as string);
    const n = Number((r.customerId as string).replace(/\D/g, ''));
    assert.ok(n > 60 && n !== 70 && n !== 80, 'got ' + r.customerId);
  }
  // Donations and issues skip used numbers too.
  const donor = [...ids][0];
  void donor;
  const person = (await list(t, 'New Person 0')).rows[0].id;
  await t.rpc('admin_donate', [{person_id: person, books: [{title: 'B', author: 'A', class_name: 'C'}]}]);
  const refs = (
    await t.db.query<{o: string}>('SELECT "orderNo" AS o FROM legacy_trust.bookings WHERE id<>$1', ['b1'])
  ).rows;
  assert.equal(refs.length, 1);
  assert.notEqual(refs[0].o, 'UTC-D-80');
});

test('shared phone numbers and emails are allowed after confirming; only an exact repeat is refused', async () => {
  const t = await setup();
  const mother = await t.make('Meena Shah', '98765 43210', 'meena@example.test');
  // A child using the same phone: the screen is told who already has it, nothing is created yet.
  const first = await t.save({name: 'Ravi Shah', phone: '+91 9876543210', email: 'ravi@example.test'});
  assert.equal(first.status, 'similar');
  assert.equal(first.matches?.length, 1);
  assert.equal(first.matches?.[0].id, mother);
  assert.match(first.matches?.[0].reason as string, /same phone number/);
  assert.equal((await list(t)).total, 1);
  // Confirming adds him as a different person with the same phone.
  const second = await t.save({
    name: 'Ravi Shah',
    phone: '+91 9876543210',
    email: 'ravi@example.test',
    confirm_similar: true,
  });
  assert.equal(second.status, 'created');
  assert.equal((await list(t, '9876543210')).total, 2);
  // The same email with another name is also "similar".
  const mail = await t.save({name: 'Kiran Shah', phone: '9123456789', email: 'MEENA@example.test'});
  assert.equal(mail.status, 'similar');
  assert.match(mail.matches?.[0].reason as string, /same email/);
  // The same name with a different phone is flagged too (could be the same person with a new number).
  const sameName = await t.save({name: 'meena  SHAH', phone: '9000011111', email: 'm2@example.test'});
  assert.equal(sameName.status, 'similar');
  assert.match(sameName.matches?.[0].reason as string, /same name/);
  // Confirming a repeat of the same name and phone never creates a second copy.
  const exact = await t.save({
    name: 'Ravi Shah',
    phone: '9876543210',
    email: 'x@example.test',
    confirm_similar: true,
  });
  assert.equal(exact.status, 'exists');
  assert.equal((await list(t)).total, 2);
  // The database itself refuses the exact repeat, whatever route is used.
  await assert.rejects(
    () =>
      t.db.query(
        `INSERT INTO legacy_trust.customers(id,"customerId",name,email,phone,type,status) VALUES('dup','UTC-P-9999','ravi shah','z@example.test','98765-43210','customer','active')`,
      ),
    /already in the list/,
  );
});

test('every field is checked, and strange input is refused politely', async () => {
  const t = await setup();
  const bad = async (data: object, message: RegExp) =>
    assert.rejects(() => t.rpc('admin_person_save', [data]), message);
  const ok = {name: 'Test Person', phone: '9876543210', email: 'test@example.test'};
  await bad({...ok, name: ''}, /full name/);
  await bad({...ok, name: 'A'}, /full name/);
  await bad({...ok, name: '   '}, /full name/);
  await bad({...ok, name: '12345'}, /full name/);
  await bad({...ok, name: '!!!'}, /full name/);
  await bad({...ok, name: 'x'.repeat(121)}, /full name/);
  await bad({...ok, phone: ''}, /valid phone/);
  await bad({...ok, phone: '12345'}, /valid phone/);
  await bad({...ok, phone: 'abcdefghij'}, /valid phone/);
  await bad({...ok, phone: '9876543210 ext 5'}, /valid phone/);
  await bad({...ok, phone: '1'.repeat(21)}, /valid phone/);
  await bad({...ok, email: ''}, /valid email/);
  await bad({...ok, email: 'not-an-email'}, /valid email/);
  await bad({...ok, email: 'a b@example.test'}, /valid email/);
  await bad({...ok, email: 'a@b'}, /valid email/);
  await bad({...ok, address: 'x'.repeat(401)}, /address is too long/);
  await bad({...ok, bloodGroup: 'Z+'}, /blood group/);
  await assert.deepEqual((await list(t)).total, 0);
  // Names in other scripts, apostrophes, markup and odd spacing are stored safely as plain text.
  const hindi = await t.save({
    name: '  रमेश   कुमार ',
    phone: '+91-98765-00001',
    email: ' Ramesh@Example.TEST ',
  });
  assert.equal(hindi.status, 'created');
  const tricky = await t.save({
    name: `Ann O'Neil <b>"x"</b>`,
    phone: '(98765) 00002',
    email: 'ann@example.test',
  });
  assert.equal(tricky.status, 'created');
  const stored = (
    await t.db.query<{name: string; email: string; phone: string}>(
      'SELECT name,email,phone FROM legacy_trust.customers ORDER BY name',
    )
  ).rows;
  assert.ok(stored.some((r) => r.name === 'रमेश कुमार' && r.email === 'ramesh@example.test'));
  assert.ok(stored.some((r) => r.name === `Ann O'Neil <b>"x"</b>`));
  // Only staff who may write can add people.
  await t.as('viewer');
  await assert.rejects(() => t.rpc('admin_person_save', [ok]), /access|permission/i);
  await t.as('operator');
  assert.equal(((await t.rpc('admin_person_save', [ok])) as Result).status, 'created');
});

test('search finds people by name in any order, phone in any format, email or reference number', async () => {
  const t = await setup();
  await t.make('Ramesh Kumar Patel', '+91 98765 43210', 'ramesh.patel@example.test');
  await t.make('Sunita Devi', '0 99887 76655', 'sunita@example.test');
  await t.make('Kumar Sanu', '9000000001', 'sanu@example.test');
  await t.make('Aarti Sharma', '9000000002', 'aarti@example.test');
  const ref = (await list(t, 'sunita')).rows[0].customerId;
  assert.deepEqual(names(await list(t, 'patel ramesh')), ['Ramesh Kumar Patel']);
  assert.deepEqual(names(await list(t, 'KUMAR')), ['Kumar Sanu', 'Ramesh Kumar Patel']);
  assert.deepEqual(names(await list(t, '9876543210')), ['Ramesh Kumar Patel']);
  assert.deepEqual(names(await list(t, '98765 43210')), ['Ramesh Kumar Patel']);
  assert.deepEqual(names(await list(t, '+91-98765-43210')), ['Ramesh Kumar Patel']);
  // A country code typed in the search still finds numbers saved without one, and the other way round.
  await t.make('Mohan Das', '9876543211', 'mohan@example.test');
  assert.deepEqual(names(await list(t, '+91 98765 43211')), ['Mohan Das']);
  assert.deepEqual(names(await list(t, '09876543211')), ['Mohan Das']);
  assert.deepEqual(names(await list(t, '99887')), ['Sunita Devi']);
  assert.deepEqual(names(await list(t, 'RAMESH.PATEL@EXAMPLE')), ['Ramesh Kumar Patel']);
  assert.deepEqual(names(await list(t, ref)), ['Sunita Devi']);
  assert.deepEqual(names(await list(t, ref.toLowerCase())), ['Sunita Devi']);
  assert.equal((await list(t, 'nobody here')).total, 0);
  assert.equal((await list(t, '%')).total, 0);
  assert.equal((await list(t, "'; drop table x; --")).total, 0);
  assert.equal((await list(t, '   ')).total, 5);
  // Sorting and paging.
  assert.deepEqual(
    (await list(t, '', '', 'name')).rows.map((r) => r.name),
    ['Aarti Sharma', 'Kumar Sanu', 'Mohan Das', 'Ramesh Kumar Patel', 'Sunita Devi'],
  );
  for (let i = 0; i < 30; i++)
    await t.make(
      'Bulk Person ' + String(i).padStart(2, '0'),
      '7000000' + String(100 + i),
      `bulk${i}@example.test`,
    );
  const p1 = await list(t, '', '', 'name', 1);
  const p2 = await list(t, '', '', 'name', 2);
  assert.equal(p1.total, 35);
  assert.equal(p1.rows.length, 25);
  assert.equal(p2.rows.length, 10);
  assert.equal(new Set([...p1.rows, ...p2.rows].map((r) => r.id)).size, 35);
});

test('roles come from what people did, filters and dashboard counts follow, archived people are protected', async () => {
  const t = await setup();
  const donor = await t.make('Dina Donor', '9000000010', 'dina@example.test');
  const borrower = await t.make('Bela Borrower', '9000000011', 'bela@example.test');
  const both = await t.make('Bhavin Both', '9000000012', 'bhavin@example.test');
  const idle = await t.make('Ila Idle', '9000000013', 'ila@example.test');
  const give = (id: string, title: string) =>
    t.rpc('admin_donate', [{person_id: id, books: [{title, author: 'A', class_name: 'C'}]}]);
  await give(donor, 'D1');
  await give(both, 'D2');
  const copies = (
    await t.db.query<{id: string; bookName: string}>(
      'SELECT id,"bookName" FROM legacy_trust.book_lists ORDER BY "bookName"',
    )
  ).rows;
  const issue = (id: string, copy: string) =>
    t.rpc('admin_issue', [
      {person_id: id, book_ids: [copy], issue_date: today, due_date: later},
    ]) as Promise<string>;
  await issue(borrower, copies[0].id);
  await issue(both, copies[1].id);
  assert.deepEqual(names(await list(t, '', 'donor')), ['Bhavin Both', 'Dina Donor']);
  assert.deepEqual(names(await list(t, '', 'borrower')), ['Bela Borrower', 'Bhavin Both']);
  assert.deepEqual(names(await list(t, '', 'donar')), ['Bhavin Both', 'Dina Donor']);
  assert.equal((await list(t, '', 'active')).total, 4);
  const overview = (await t.rpc('admin_overview')) as {donors: number; borrowers: number; people: number};
  assert.deepEqual([overview.donors, overview.borrowers, overview.people], [2, 2, 4]);
  // A person with books out cannot be archived; once archived they cannot donate or borrow.
  await assert.rejects(
    () =>
      t.save({
        id: borrower,
        name: 'Bela Borrower',
        phone: '9000000011',
        email: 'bela@example.test',
        status: 'inactive',
      }),
    /outstanding/,
  );
  assert.equal(
    (
      (await t.save({
        id: idle,
        name: 'Ila Idle',
        phone: '9000000013',
        email: 'ila@example.test',
        status: 'inactive',
      })) as Result
    ).status,
    'updated',
  );
  await assert.rejects(() => give(idle, 'Nope'), /Archived people cannot donate/);
  await assert.rejects(() => issue(idle, copies[0].id), /Archived people cannot borrow/);
  await assert.rejects(
    () => give('00000000-0000-4000-8000-000000000000', 'Nope'),
    /Choose a person from the list/,
  );
  // Editing: changing only the address never asks about "similar" people; a clash on contact details does.
  const upd = await t.save({
    id: donor,
    name: 'Dina Donor',
    phone: '9000000010',
    email: 'dina@example.test',
    address: 'Silvassa',
  });
  assert.equal(upd.status, 'updated');
  const clash = await t.save({
    id: donor,
    name: 'Dina Donor',
    phone: '9000000011',
    email: 'dina@example.test',
  });
  assert.equal(clash.status, 'similar');
  const exactClash = await t.save({
    id: donor,
    name: 'Bela Borrower',
    phone: '9000000011',
    email: 'dina@example.test',
  });
  assert.equal(exactClash.status, 'exists');
  assert.equal(((await t.rpc('admin_person', [donor])) as {phone: string}).phone, '9000000010');
});

test('merging two entries keeps all history; only administrators can merge; duplicates are listed', async () => {
  const t = await setup();
  const donorEntry = await t.make('Kavita Rao', '9000000020', 'kavita.donor@example.test', {
    address: 'Silvassa',
  });
  // The same name with another phone is flagged; the user confirms it is a separate entry.
  const borrowerEntry = await t.make('Kavita  Rao', '9000000021', 'kavita.borrower@example.test', {
    confirm_similar: true,
  });
  await t.make('Someone Else', '9000000022', 'else@example.test');
  await t.rpc('admin_donate', [
    {person_id: donorEntry, books: [{title: 'Gift', author: 'A', class_name: 'C'}]},
  ]);
  const copy = (await t.db.query<{id: string}>('SELECT id FROM legacy_trust.book_lists LIMIT 1')).rows[0].id;
  await t.rpc('admin_issue', [
    {person_id: borrowerEntry, book_ids: [copy], issue_date: today, due_date: later},
  ]);
  const groups = (await t.rpc('admin_duplicate_people')) as {reason: string; people: {id: string}[]}[];
  assert.equal(groups.length, 1);
  assert.equal(groups[0].reason, 'same name');
  assert.deepEqual(groups[0].people.map((p) => p.id).sort(), [donorEntry, borrowerEntry].sort());
  const profile = (await t.rpc('admin_person', [borrowerEntry])) as {
    possible_duplicates: {id: string; reason: string}[];
  };
  assert.equal(profile.possible_duplicates[0].id, donorEntry);

  await t.as('operator');
  await assert.rejects(
    () => t.rpc('admin_merge_people', [{keep_id: donorEntry, remove_id: borrowerEntry}]),
    /Administrator access required/,
  );
  await t.as('admin');
  await assert.rejects(
    () => t.rpc('admin_merge_people', [{keep_id: donorEntry, remove_id: donorEntry}]),
    /two different people/,
  );
  await assert.rejects(
    () => t.rpc('admin_merge_people', [{keep_id: donorEntry, remove_id: 'nope'}]),
    /not found/,
  );
  await assert.rejects(
    () => t.rpc('admin_merge_people', [{keep_id: 'nope', remove_id: donorEntry}]),
    /not found/,
  );
  const merged = (await t.rpc('admin_merge_people', [{keep_id: donorEntry, remove_id: borrowerEntry}])) as {
    moved_transactions: number;
    moved_copies: number;
  };
  assert.equal(merged.moved_transactions, 1);
  assert.equal(merged.moved_copies, 0);
  const after = (await list(t, 'kavita')).rows;
  assert.equal(after.length, 1);
  assert.equal(after[0].id, donorEntry);
  assert.equal(after[0].donations, 1);
  assert.equal(after[0].borrowings, 1);
  assert.equal(after[0].outstanding, 1);
  assert.equal(((await t.rpc('admin_duplicate_people')) as unknown[]).length, 0);
  const loanOwner = (
    await t.db.query<{customer_id: string}>(
      `SELECT customer_id FROM legacy_trust.bookings WHERE status='issue'`,
    )
  ).rows[0].customer_id;
  assert.equal(loanOwner, donorEntry);
  // Nothing is lost silently: the log says exactly what was merged.
  const log = (
    await t.db.query<{summary: string}>(`SELECT summary FROM trust_admin.audit WHERE summary LIKE 'Merged %'`)
  ).rows;
  assert.equal(log.length, 1);
  assert.match(log[0].summary, /kavita\.borrower@example\.test/);
  // The removed entry's phone and email are free to use again.
  assert.equal(
    (
      (await t.save({
        name: 'New Owner',
        phone: '9000000021',
        email: 'kavita.borrower@example.test',
      })) as Result
    ).status,
    'created',
  );
});

test('hand-set UTBNs never break a donation', async () => {
  const t = await setup();
  const donor = await t.make('Gita Giver', '9000000030', 'gita@example.test');
  await t.rpc('admin_donate', [{person_id: donor, books: [{title: 'One', author: 'A', class_name: 'C'}]}]);
  // Someone typed a number ahead of the counter by hand (for example while importing).
  const next = (await t.db.query<{n: number}>('SELECT max(utbn)+1 AS n FROM legacy_trust.book_lists')).rows[0]
    .n;
  await t.db.query('ALTER TABLE legacy_trust.book_lists DISABLE TRIGGER book_lists_unique_utbn');
  await t.db.query(
    `INSERT INTO legacy_trust.book_lists(id,"bookName",author,class,utbn,status) VALUES('hand','Hand','A','C',$1,'active')`,
    [next],
  );
  await t.db.query('ALTER TABLE legacy_trust.book_lists ENABLE TRIGGER book_lists_unique_utbn');
  await t.rpc('admin_donate', [
    {
      person_id: donor,
      books: [
        {title: 'Two', author: 'A', class_name: 'C'},
        {title: 'Three', author: 'A', class_name: 'C'},
      ],
    },
  ]);
  const numbers = (await t.db.query<{utbn: number}>('SELECT utbn FROM legacy_trust.book_lists')).rows.map(
    (r) => r.utbn,
  );
  assert.equal(numbers.length, 4);
  assert.equal(new Set(numbers).size, 4);
});

test('editing an older entry that already repeats another is not blocked, and new repeats still are', async () => {
  const t = await setup();
  // Old data from before the check existed: the same name and phone twice (written differently).
  await t.db.exec('ALTER TABLE legacy_trust.customers DISABLE TRIGGER customers_guard_duplicate');
  await t.db.query(
    `INSERT INTO legacy_trust.customers(id,"customerId",name,email,phone,type,status) VALUES
      ('old1','UTC-P-501','Hari Om','hari1@example.test','9000000301','customer','active'),
      ('old2','UTC-P-502','hari  om','hari2@example.test','+91 90000 00301','donar','active')`,
  );
  await t.db.exec('ALTER TABLE legacy_trust.customers ENABLE TRIGGER customers_guard_duplicate');
  const groups = (await t.rpc('admin_duplicate_people')) as {reason: string}[];
  assert.ok(groups.some((g) => g.reason === 'same phone number'));
  // Changing only the address keeps working.
  const edit = await t.save({
    id: 'old1',
    name: 'Hari Om',
    phone: '9000000301',
    email: 'hari1@example.test',
    address: 'Silvassa',
  });
  assert.equal(edit.status, 'updated');
  // Merging them clears it up.
  await t.rpc('admin_merge_people', [{keep_id: 'old1', remove_id: 'old2'}]);
  assert.equal(((await t.rpc('admin_duplicate_people')) as unknown[]).length, 0);
  // A brand-new exact repeat is still refused.
  const again = await t.save({name: 'Hari Om', phone: '9000000301', email: 'new@example.test'});
  assert.equal(again.status, 'exists');
});
