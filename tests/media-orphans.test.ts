import test from 'node:test';
import assert from 'node:assert/strict';
import {findOrphans} from '../scripts/clean-orphan-media.mjs';

const now = new Date('2026-11-23T12:00:00Z').getTime();
const object = (name: string, minutesOld: number) => ({
  name,
  size: 1000,
  created: new Date(now - minutesOld * 60000).toISOString(),
});

test('only old files that no content record uses are reported as unused', () => {
  const objects = [
    object('u1/used.mp4', 500),
    object('u1/unused.mp4', 500),
    object('u1/unused-preview.webp', 500),
    object('u1/just-uploaded.mp4', 3),
    object('u1/.emptyFolderPlaceholder', 500),
  ];
  const result = findOrphans(objects, ['u1/used.mp4'], {now});
  assert.deepEqual(result.map((o: {name: string}) => o.name).sort(), [
    'u1/unused-preview.webp',
    'u1/unused.mp4',
  ]);
  assert.deepEqual(findOrphans([], [], {now}), []);
  assert.equal(
    findOrphans(
      objects,
      objects.map((o) => o.name),
      {now},
    ).length,
    0,
  );
});
