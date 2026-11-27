import test from 'node:test';
import assert from 'node:assert/strict';
import {friendlyError} from '../src/lib/admin/api-errors';

test('failed requests become readable sentences', () => {
  assert.match(friendlyError(0), /internet connection/);
  assert.match(friendlyError(401, 'Staff access required.'), /sign-in has expired/);
  assert.match(friendlyError(502), /server had a problem/);
  assert.match(friendlyError(500, 'Internal Server Error'), /server had a problem/);
  assert.equal(friendlyError(400, 'Enter a valid email address'), 'Enter a valid email address');
  assert.equal(
    friendlyError(403, 'Only an administrator can delete records.'),
    'Only an administrator can delete records.',
  );
  assert.match(friendlyError(403), /not allowed/);
  assert.match(friendlyError(429), /Too many/);
  assert.match(friendlyError(404), /Something went wrong/);
  assert.equal(friendlyError(400, {weird: true}), 'Something went wrong. Please try again.');
});

import {fallbackSlug, slugify} from '../src/lib/admin/content-kinds';

test('a headline with no Latin letters still gets a valid web address', () => {
  assert.equal(slugify('पुस्तक दान शिविर'), '');
  const slug = fallbackSlug('student_voice', new Date('2026-11-27T10:00:00Z'), 0.5);
  assert.match(slug, /^student-voice-20261127-[a-z0-9]{4}$/);
  assert.match(fallbackSlug('news'), /^news-\d{8}-[a-z0-9]{4}$/);
});
