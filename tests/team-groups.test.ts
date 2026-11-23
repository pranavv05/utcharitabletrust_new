import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import team from '../src/lib/team.json';
import {groupTeam, hasPhoto, initials, isLeader, normalizeGroup, teamGroups} from '../src/lib/team';
import {fallbackContent, mapContent, type Entry} from '../src/lib/site-content';
import {createTestDb} from './helpers/test-db';

const counts = (list: {group: string}[]) =>
  Object.fromEntries(
    teamGroups.map((g) => [g.id, list.filter((p) => p.group === g.id).length]).filter(([, n]) => n),
  );

test('the bundled team matches the trust member page: 45 people in four groups, nobody twice', () => {
  assert.equal(team.length, 45);
  assert.equal(new Set(team.map((p) => p.name)).size, 45);
  assert.deepEqual(counts(team), {trustee: 6, advisory: 6, mentor: 11, working: 22});
  for (const person of team)
    assert.ok(existsSync('public' + person.image), person.name + ' has a photograph file');
  const names = team.map((p) => p.name);
  for (const expected of [
    'Dr. Laxman Rohit',
    'Dr. G L Chaudhary',
    'Mr. Priyanksinh I Parmar',
    'Mr. Prem Prakash Singh',
  ])
    assert.ok(names.includes(expected), expected);
  assert.deepEqual(
    team.filter((p) => isLeader(p)).map((p) => p.role),
    ['Chairman', 'Advisory Board Chairman', 'President', 'Raktveer President', 'Narishakti President'],
  );
  assert.equal(fallbackContent.team.length, 45);
  assert.ok(fallbackContent.team.every((p) => p.group !== 'other'));
});

test('people are grouped in the order of the member page and unknown groups are kept apart', () => {
  const groups = groupTeam(fallbackContent.team);
  assert.deepEqual(
    groups.map((g) => [g.group.label, g.people.length]),
    [
      ['Trustees', 6],
      ['Advisory Board', 6],
      ['Our Mentors', 11],
      ['Working Body', 22],
    ],
  );
  assert.equal(normalizeGroup('mentor'), 'mentor');
  assert.equal(normalizeGroup('nonsense'), 'other');
  assert.equal(normalizeGroup(undefined), 'other');
  const mapped = mapContent([
    {
      id: '1',
      kind: 'team',
      slug: 'a',
      name: 'Asha',
      data: {role: 'Mentor', image: '/x.webp', group: 'mentor'},
    },
    {id: '2', kind: 'team', slug: 'b', name: 'Ravi', data: {role: 'Helper', image: '/y.webp'}},
  ] as Entry[]);
  assert.deepEqual(
    mapped.team.map((p) => p.group),
    ['mentor', 'other'],
  );
});

test('placeholder photographs and missing photographs show initials instead', () => {
  assert.equal(hasPhoto('/images/team/blank.webp'), false);
  assert.equal(hasPhoto(''), false);
  assert.equal(hasPhoto('/images/team/dhiraj.webp'), true);
  assert.equal(initials('Mr. Kapil Kanodiya'), 'KK');
  assert.equal(initials('Dr.K.S. Chandrashekhar'), 'KC');
  assert.equal(initials('Ms. Rashmi Nair'), 'RN');
  assert.equal(initials('Adv. Prakashchandra N. Patel'), 'PP');
});

const names = async (db: Awaited<ReturnType<typeof createTestDb>>['db']) =>
  (
    await db.query<{name: string; grp: string; role: string; image: string}>(
      `SELECT name, data->>'group' AS grp, data->>'role' AS role, data->>'image' AS image
         FROM trust_admin.site_content WHERE kind='team' AND status='published' ORDER BY sort_order, slug`,
    )
  ).rows;

test('the migration gives live team entries their group, fixes names and photos and removes duplicates', async () => {
  const {db} = await createTestDb();
  const rows = await names(db);
  assert.equal(rows.length, 45);
  assert.equal(new Set(rows.map((r) => r.name)).size, 45);
  assert.deepEqual(counts(rows.map((r) => ({group: r.grp}))), {
    trustee: 6,
    advisory: 6,
    mentor: 11,
    working: 22,
  });
  assert.deepEqual(
    rows.map((r) => r.name),
    team.map((p) => p.name),
  );
  const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
  assert.equal(byName['Mr. Durgesh Rajpurohit'].image, '/images/team/durgesh.webp');
  assert.equal(byName['Mr. Mohan K.S'].image, '/images/team/Mohan_k.s.webp');
  assert.equal(byName['Mr. Pradip Mishra'].role, 'Chairman');
  assert.equal(byName['Mr. Anil Dixit'].role, 'Advisory Board member');
  assert.equal(byName['Dr. Laxman Rohit'].grp, 'mentor');
});

test('entries an administrator already edited are left alone when the migration runs again', async () => {
  const {db} = await createTestDb();
  await db.query(
    `UPDATE trust_admin.site_content SET name='Mr. Anil Dixit (Convener)', data=data||'{"role":"Convener"}'::jsonb
       WHERE kind='team' AND name='Mr. Anil Dixit'`,
  );
  await db.exec(readFileSync('supabase/migrations/20261123110000_team_groups.sql', 'utf8'));
  const rows = await names(db);
  assert.equal(rows.length, 45);
  const edited = rows.find((r) => r.name === 'Mr. Anil Dixit (Convener)');
  assert.ok(edited);
  assert.equal(edited.role, 'Convener');
  assert.equal(edited.grp, 'advisory');
});
