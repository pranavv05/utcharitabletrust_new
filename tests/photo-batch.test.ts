import test from 'node:test';
import assert from 'node:assert/strict';
import {captionFromFilename, fitSize, isImageFile, photoSlug} from '../src/lib/admin/photo-batch';

test('captions come from readable file names and fall back for camera names', () => {
  assert.equal(captionFromFilename('blood-camp_2024.jpg'), 'Blood camp 2024');
  assert.equal(captionFromFilename('C:\\Photos\\Annual Day 03.JPEG'), 'Annual Day 03');
  assert.equal(captionFromFilename('book-bank-students-01.webp'), 'Book bank students 01');
  assert.equal(captionFromFilename('IMG_20240315_101500.jpg'), 'Photograph');
  assert.equal(captionFromFilename('DSC00123.JPG'), 'Photograph');
  assert.equal(captionFromFilename('PXL_20240315_101500123.jpg'), 'Photograph');
  assert.equal(captionFromFilename('WhatsApp Image 2024-03-15 at 10.15.00 AM.jpeg'), 'Photograph');
  assert.equal(captionFromFilename('1234.png'), 'Photograph');
  assert.equal(captionFromFilename('x'.repeat(400) + '.jpg').length, 150);
});

test('photos are scaled down to fit but never enlarged', () => {
  assert.deepEqual(fitSize(4000, 3000), {width: 1600, height: 1200});
  assert.deepEqual(fitSize(3000, 4000), {width: 1200, height: 1600});
  assert.deepEqual(fitSize(800, 600), {width: 800, height: 600});
  assert.deepEqual(fitSize(4000, 1, 1600), {width: 1600, height: 1});
});

test('slugs are unique per photograph, URL-safe and never empty', () => {
  assert.equal(photoSlug('Blood camp 2024', 'AB12cd34ef'), 'blood-camp-2024-ab12cd34');
  assert.equal(photoSlug('रक्तदान शिविर', 'x9'), 'photograph-x9');
  assert.notEqual(photoSlug('Same caption', 'aaaa'), photoSlug('Same caption', 'bbbb'));
  assert.match(photoSlug('Caption!! with *symbols*', 'zz'), /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test('only image files are accepted from a selection', () => {
  assert.equal(isImageFile({name: 'a.jpg', type: 'image/jpeg'}), true);
  assert.equal(isImageFile({name: 'a.HEIC', type: ''}), true);
  assert.equal(isImageFile({name: 'notes.pdf', type: 'application/pdf'}), false);
  assert.equal(isImageFile({name: 'video.mp4', type: 'video/mp4'}), false);
});
