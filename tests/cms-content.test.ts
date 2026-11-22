import test from 'node:test';
import assert from 'node:assert/strict';
import {kindSpec, kindSpecs, publishIssues, slugify} from '../src/lib/admin/content-kinds';
import {mapContent, fallbackContent, type Entry} from '../src/lib/site-content';
import {byYear, photoList, videoEmbed, yearOf, yearsOf} from '../src/lib/media';

const entry = (kind: string, slug: string, name: string, data: Record<string, string>): Entry => ({
  id: kind + '-' + slug,
  kind,
  slug,
  name,
  data,
});

test('every content kind has a spec with unique field keys', () => {
  assert.deepEqual(
    kindSpecs.map((k) => k.kind),
    [
      'news',
      'gallery',
      'programme',
      'team',
      'testimonial',
      'partner',
      'legal',
      'college',
      'announcement',
      'setting',
    ],
  );
  for (const spec of kindSpecs) {
    const keys = spec.fields.map((f) => f.key);
    assert.equal(new Set(keys).size, keys.length, spec.kind);
  }
});

test('the publish checklist matches what each kind needs', () => {
  assert.deepEqual(publishIssues('news', {}, 'Story'), ['Date']);
  assert.deepEqual(publishIssues('partner', {}, 'Acme'), ['Logo']);
  assert.deepEqual(publishIssues('testimonial', {quote: 'Great'}, 'Asha'), []);
  assert.deepEqual(publishIssues('legal', {}, 'Policy'), ['Document file or text']);
  assert.deepEqual(publishIssues('legal', {body: 'Text'}, 'Policy'), []);
  assert.deepEqual(publishIssues('college', {}, ''), ['Number of interns so far', 'College name']);
  assert.equal(kindSpec('setting').single, true);
});

test('slugs are lower-case, hyphenated and safe', () => {
  assert.equal(slugify('Annual Report 2024–25!'), 'annual-report-2024-25');
  assert.equal(slugify('  Café & Co  '), 'cafe-co');
  assert.equal(slugify('---'), '');
});

test('video links become privacy-friendly embeds and anything else is rejected', () => {
  assert.equal(
    videoEmbed('https://youtu.be/dQw4w9WgXcQ'),
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0',
  );
  assert.equal(
    videoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5'),
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0',
  );
  assert.equal(videoEmbed('https://vimeo.com/123456789'), 'https://player.vimeo.com/video/123456789');
  assert.equal(videoEmbed('https://evil.example/watch?v=abcdefg'), null);
  assert.equal(videoEmbed('javascript:alert(1)'), null);
  assert.equal(videoEmbed(undefined), null);
});

test('years are derived from dates, listed newest first and used for filtering', () => {
  assert.equal(yearOf('2025-03-09'), '2025');
  assert.equal(yearOf('2025'), '2025');
  assert.equal(yearOf(''), '');
  const items = [{year: '2023'}, {year: '2025'}, {year: ''}, {year: '2025'}];
  assert.deepEqual(yearsOf(items), ['2025', '2023']);
  assert.equal(byYear(items, 'all').length, 4);
  assert.equal(byYear(items, '2025').length, 2);
  assert.equal(byYear(items, 'undated').length, 1);
  assert.deepEqual(photoList('a.png\n\n  b.png \n'), ['a.png', 'b.png']);
});

test('published rows are mapped for the public pages with safe defaults', () => {
  const site = mapContent([
    entry('news', 'launch', 'We launched', {
      date: '2025-06-01',
      summary: 'Hello',
      photos: '/images/a.webp\n/images/b.webp',
      video_url: 'https://youtu.be/dQw4w9WgXcQ',
    }),
    entry('partner', 'acme', 'Acme', {tier: 'weird', logo: '/images/logo.png'}),
    entry('testimonial', 'asha', 'Asha', {quote: 'Thank you', featured: 'yes'}),
    entry('legal', 'r24', 'Report 2024', {group: 'report', issued: '2024-04-01', file: '/files/r.pdf'}),
    entry('college', 'abc', 'ABC College', {interns: '12', city: 'Silvassa'}),
    entry('setting', 'iso', 'ISO', {standard: 'ISO 9001:2015', certificate_no: 'X1'}),
    entry('gallery', 'p1', 'Photo', {image: '/images/gallery/gallery4.webp', year: '2024'}),
    entry('team', 't1', 'Asha Rao', {role: 'Chair', image: '/images/team/a.webp', bio: 'Guide'}),
  ]);
  assert.equal(site.news[0].year, '2025');
  assert.deepEqual(site.news[0].photos, ['/images/a.webp', '/images/b.webp']);
  assert.equal(site.partners[0].tier, 'supporter');
  assert.equal(site.testimonials[0].featured, true);
  assert.equal(site.legal[0].year, '2024');
  assert.equal(site.colleges[0].interns, 12);
  assert.equal(site.iso?.standard, 'ISO 9001:2015');
  assert.equal(site.gallery[0].year, '2024');
  assert.equal(site.team[0].bio, 'Guide');
  assert.equal(mapContent([]).iso, null);
  assert.equal(mapContent([]).news.length, 0);
});

test('without a database the site still lists its certificates and no invented content', () => {
  assert.equal(fallbackContent.legal.length, 4);
  assert.equal(
    fallbackContent.news.length + fallbackContent.partners.length + fallbackContent.testimonials.length,
    0,
  );
  assert.equal(fallbackContent.iso, null);
});

test('only files that no other record uses are removed with deleted content', async () => {
  const {mediaPaths, orphanedPaths} = await import('../src/lib/admin/media-cleanup');
  const base = 'https://abc.supabase.co';
  const url = (name: string) => `${base}/storage/v1/object/public/trust-media/u1/${name}`;
  assert.deepEqual(
    mediaPaths(
      {image: url('a.png'), photos: `${url('b.png')}\n${url('c.png')}`, logo: '/images/logo.png', title: 'x'},
      base,
    ).sort(),
    ['u1/a.png', 'u1/b.png', 'u1/c.png'],
  );
  assert.deepEqual(
    mediaPaths({image: 'https://evil.example/storage/v1/object/public/trust-media/u1/a.png'}, base),
    [],
  );
  assert.deepEqual(mediaPaths({image: url('../secret.png')}, base), []);
  assert.deepEqual(mediaPaths({image: url('a.png')}, ''), []);
  assert.deepEqual(
    orphanedPaths({image: url('a.png'), file: url('r.pdf')}, [{image: url('a.png')}, null], base),
    ['u1/r.pdf'],
  );
  assert.deepEqual(orphanedPaths(null, [], base), []);
});
