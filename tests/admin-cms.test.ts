import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDb} from './helpers/test-db';

const save = (
  rpc: (n: string, a: unknown[]) => Promise<unknown>,
  kind: string,
  slug: string,
  data: object,
  extra: object = {},
) =>
  rpc('admin_content_save', [
    {kind, slug, name: slug.replaceAll('-', ' '), status: 'draft', data, ...extra},
  ]) as Promise<string>;

test('new content kinds validate their own fields and publishing rules', async () => {
  const {db, rpc, as} = await createTestDb();
  try {
    await as('admin');
    // News: a date is needed to publish; unknown fields and bad links are refused.
    await assert.rejects(
      () => save(rpc, 'news', 'launch', {summary: 'Hi'}, {status: 'published'}),
      /needs: date/,
    );
    await assert.rejects(() => save(rpc, 'news', 'launch', {date: '2026-13-40'}), /date/i);
    await assert.rejects(() => save(rpc, 'news', 'launch', {date: '26-01-2026'}), /YYYY-MM-DD/);
    await assert.rejects(
      () => save(rpc, 'news', 'launch', {date: '2026-01-05', colour: 'red'}),
      /Unknown field/,
    );
    await assert.rejects(
      () => save(rpc, 'news', 'launch', {date: '2026-01-05', video_url: 'https://evil.example/x'}),
      /YouTube or Vimeo/,
    );
    await assert.rejects(
      () => save(rpc, 'news', 'launch', {date: '2026-01-05', image: 'https://evil.example/a.png'}),
      /uploaded image/,
    );
    await assert.rejects(() => save(rpc, 'news', 'launch', {date: '2026-01-05', year: 12}), /must be text/);
    const news = await save(
      rpc,
      'news',
      'launch',
      {date: '2026-01-05', video_url: 'https://youtu.be/dQw4w9WgXcQ', summary: 'We launched.'},
      {status: 'published'},
    );
    assert.ok(news);

    // Partners need a logo and an https website; tiers are limited.
    await assert.rejects(
      () => save(rpc, 'partner', 'acme', {tier: 'gold'}, {status: 'published'}),
      /needs: logo/,
    );
    await assert.rejects(() => save(rpc, 'partner', 'acme', {tier: 'platinum'}), /partner tier/);
    await assert.rejects(() => save(rpc, 'partner', 'acme', {website: 'http://acme.example'}), /https/);
    await save(
      rpc,
      'partner',
      'acme',
      {tier: 'gold', logo: '/images/logo.png', website: 'https://acme.example'},
      {status: 'published'},
    );

    // Legal documents need a file or text to publish; other kinds have their own essentials.
    await assert.rejects(
      () => save(rpc, 'legal', 'policy', {group: 'policy'}, {status: 'published'}),
      /file or text/,
    );
    await assert.rejects(() => save(rpc, 'legal', 'policy', {group: 'secret'}), /document group/);
    await save(rpc, 'legal', 'policy', {group: 'policy', body: 'We respect privacy.'}, {status: 'published'});
    await assert.rejects(
      () => save(rpc, 'testimonial', 'asha', {role: 'Volunteer'}, {status: 'published'}),
      /needs: quote/,
    );
    await save(
      rpc,
      'testimonial',
      'asha',
      {quote: 'It changed our lives.', role: 'Parent', featured: 'yes'},
      {status: 'published'},
    );
    await assert.rejects(() => save(rpc, 'college', 'abc-college', {interns: 'many'}), /number/);
    await save(
      rpc,
      'college',
      'abc-college',
      {city: 'Silvassa', interns: '12', period: '2025'},
      {status: 'published'},
    );
    await assert.rejects(() => save(rpc, 'setting', 'iso-two', {link: 'javascript:alert(1)'}), /link/);
    await save(
      rpc,
      'setting',
      'iso-two',
      {standard: 'ISO 9001:2015', certificate_no: 'X-1', valid_until: '2028-01-31'},
      {status: 'published'},
    );

    // Only published records reach the public function; seeded certificates were moved into legal documents.
    const published = (await rpc('website_content')) as {kind: string; slug: string}[];
    const kinds = (kind: string) => published.filter((r) => r.kind === kind).map((r) => r.slug);
    assert.deepEqual(kinds('news'), ['launch']);
    assert.deepEqual(kinds('partner'), ['acme']);
    assert.equal(kinds('legal').filter((s) => s.startsWith('trust-certificate-')).length, 4);
    assert.ok(kinds('legal').includes('policy'));
    assert.ok(!kinds('setting').includes('iso-certification'), 'the draft ISO record stays hidden');
    assert.deepEqual(kinds('setting'), ['iso-two']);

    // Storage and file rules: a PDF is fine for documents but not for images.
    const pdf = 'https://abc.supabase.co/storage/v1/object/public/trust-media/u/report.pdf';
    await save(
      rpc,
      'legal',
      'annual-2025',
      {group: 'report', year: '2025', file: pdf},
      {status: 'published'},
    );
    await assert.rejects(() => save(rpc, 'partner', 'pdf-logo', {logo: pdf}), /uploaded image/);
    const video = 'https://abc.supabase.co/storage/v1/object/public/trust-media/u/clip.mp4';
    await save(rpc, 'news', 'clip', {date: '2026-02-01', video_file: video});
    await assert.rejects(
      () => save(rpc, 'news', 'clip2', {date: '2026-02-01', video_file: pdf}),
      /MP4 or WebM/,
    );
  } finally {
    await db.close();
  }
});

test('gallery years can be set in bulk, and content can be deleted by administrators only', async () => {
  const {db, rpc, as} = await createTestDb();
  try {
    await as('admin');
    const ids = (
      await db.query<{id: string}>(
        "SELECT id FROM trust_admin.site_content WHERE kind='gallery' ORDER BY id LIMIT 3",
      )
    ).rows.map((r) => r.id);
    assert.equal(await rpc('admin_content_set_year', [ids, '2024']), 3);
    const years = (
      await db.query<{y: string}>(
        "SELECT data->>'year' AS y FROM trust_admin.site_content WHERE id=ANY($1::uuid[])",
        [ids],
      )
    ).rows;
    assert.ok(years.every((r) => r.y === '2024'));
    assert.equal(await rpc('admin_content_set_year', [[ids[0]], '']), 1);
    assert.equal(
      (await db.query("SELECT 1 FROM trust_admin.site_content WHERE id=$1 AND data ? 'year'", [ids[0]])).rows
        .length,
      0,
    );
    await assert.rejects(() => rpc('admin_content_set_year', [ids, '24']), /four-digit/);
    await assert.rejects(() => rpc('admin_content_set_year', [[], '2024']), /between 1 and 500/);
    // The programme id is ignored: only gallery photographs change.
    const programme = (
      await db.query<{id: string}>("SELECT id FROM trust_admin.site_content WHERE kind='programme' LIMIT 1")
    ).rows[0].id;
    assert.equal(await rpc('admin_content_set_year', [[programme], '2020']), 0);

    // Deleting: allowed for content, refused for the Book Bank programme, and recorded in the log.
    const partner = await save(rpc, 'partner', 'gone', {logo: '/images/logo.png'});
    await rpc('admin_content_delete', [partner]);
    assert.equal(
      (await db.query('SELECT 1 FROM trust_admin.site_content WHERE id=$1', [partner])).rows.length,
      0,
    );
    await assert.rejects(() => rpc('admin_content_delete', [partner]), /Content not found/);
    const bookBank = (
      await db.query<{id: string}>("SELECT id FROM trust_admin.site_content WHERE slug='book-bank'")
    ).rows[0].id;
    await assert.rejects(() => rpc('admin_content_delete', [bookBank]), /Archive it instead/);
    assert.equal(
      (
        await db.query(
          "SELECT 1 FROM trust_admin.audit WHERE action='delete' AND summary='Deleted partner: gone'",
        )
      ).rows.length,
      1,
    );

    await as('operator');
    await assert.rejects(() => rpc('admin_content_delete', [ids[0]]), /Administrator access required/);
    await assert.rejects(() => rpc('admin_content_set_year', [ids, '2023']), /Administrator access required/);
    await as('viewer');
    await assert.rejects(() => rpc('admin_content_delete', [ids[0]]), /Staff access required/);
  } finally {
    await db.close();
  }
});

test('existing record kinds keep working with the stricter checks', async () => {
  const {db, rpc, as} = await createTestDb();
  try {
    await as('admin');
    const row = (
      await db.query<{id: string; slug: string; name: string; data: object; updated_at: string}>(
        "SELECT id,slug,name,data,updated_at FROM trust_admin.site_content WHERE kind='programme' AND slug='blood-donation-camp'",
      )
    ).rows[0];
    const updated = (await rpc('admin_content_save', [
      {
        id: row.id,
        expected_updated_at: row.updated_at,
        kind: 'programme',
        slug: row.slug,
        name: row.name,
        status: 'published',
        data: row.data,
        sort_order: 1,
      },
    ])) as string;
    assert.equal(updated, row.id);
    const team = (
      await db.query<{id: string; slug: string; name: string; data: object; updated_at: string}>(
        "SELECT id,slug,name,data,updated_at FROM trust_admin.site_content WHERE kind='team' LIMIT 1",
      )
    ).rows[0];
    await rpc('admin_content_save', [
      {
        id: team.id,
        expected_updated_at: team.updated_at,
        kind: 'team',
        slug: team.slug,
        name: team.name,
        status: 'published',
        data: {...team.data, bio: 'Founder and guide.'},
      },
    ]);
  } finally {
    await db.close();
  }
});
