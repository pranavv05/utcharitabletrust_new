import test from 'node:test';
import assert from 'node:assert/strict';
import {readIsbn, shrink, toGray} from '../src/lib/admin/barcode-core';
import {scene, type Scene} from './helpers/barcode-scene';

const ISBN = '9780306406157';
const INDIAN_ISBN = '9788126924400';
const base: Scene = {code: ISBN, width: 4000, height: 3000, barcodeWidth: 900};

// A phone photo is big and the barcode is a small part of it, taken in all sorts of conditions.
const photos: [string, Partial<Scene>][] = [
  ['straight on, filling a third of the picture', {}],
  ['off to one side and low', {x: 0.7, y: 0.75}],
  ['smaller (a sixth of the width)', {barcodeWidth: 650}],
  ['small (a tenth of the width)', {barcodeWidth: 420}],
  ['turned sideways (90 degrees)', {angle: 90}],
  ['upside down', {angle: 180}],
  ['turned the other way (270 degrees)', {angle: 270}],
  ['slightly crooked (7 degrees)', {angle: 7}],
  ['crooked the other way (-9 degrees)', {angle: -9}],
  ['quite crooked (15 degrees)', {angle: 15}],
  ['out of focus (blurred by about a bar width)', {blur: 4}],
  ['grainy (noisy)', {noise: 40}],
  ['dim and dull (dark grey to mid grey)', {dark: 70, light: 150}],
  ['unevenly lit (one side shadowed)', {shade: 110}],
  ['crooked, blurred and grainy together', {angle: 6, blur: 4, noise: 25}],
  ['a different ISBN', {code: INDIAN_ISBN}],
];

for (const [name, change] of photos) {
  test(`a still photo is read: ${name}`, () => {
    const s = scene({...base, ...change});
    const result = readIsbn({data: s.data, width: s.width, height: s.height}, {thorough: true});
    assert.equal(result.isbn, change.code ?? ISBN);
  });
}

test('a price barcode that is not an ISBN is reported but never taken as a book', () => {
  const s = scene({...base, code: '8901234567890'});
  const result = readIsbn({data: s.data, width: s.width, height: s.height}, {thorough: true});
  assert.equal(result.isbn, null);
  assert.equal(result.other, '8901234567890');
});

test('pictures with no barcode are refused quickly and without errors', () => {
  const blank = {data: new Uint8ClampedArray(3000 * 2000).fill(200), width: 3000, height: 2000};
  assert.deepEqual(readIsbn(blank, {thorough: true}), {isbn: null, other: null});
  const noise = new Uint8ClampedArray(2000 * 1500);
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 7919) % 256;
  assert.equal(readIsbn({data: noise, width: 2000, height: 1500}, {thorough: true}).isbn, null);
  assert.equal(readIsbn({data: new Uint8ClampedArray(0), width: 0, height: 0}, {thorough: true}).isbn, null);
  assert.equal(readIsbn({data: new Uint8ClampedArray(30 * 30), width: 30, height: 30}).isbn, null);
});

test('colour pixels are converted and shrinking keeps the picture intact', () => {
  const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255]);
  const gray = toGray(rgba, 2, 2);
  assert.deepEqual([...gray.data], [255, 0, 76, 150]);
  const small = shrink({data: new Uint8ClampedArray(16).fill(100), width: 4, height: 4}, 2);
  assert.deepEqual([small.width, small.height, small.data[0]], [2, 2, 100]);
});

test('live camera frames: a clear barcode is read within a few frames, and a blank frame is cheap', () => {
  const s = scene({...base, width: 1280, height: 720, barcodeWidth: 420});
  const frame = {data: s.data, width: s.width, height: s.height};
  let found: string | null = null;
  for (let i = 0; i < 6 && !found; i++) found = readIsbn(frame, {frame: i}).isbn;
  assert.equal(found, ISBN);
  const blank = {data: new Uint8ClampedArray(1280 * 720).fill(180), width: 1280, height: 720};
  const started = Date.now();
  for (let i = 0; i < 12; i++) readIsbn(blank, {frame: i});
  assert.ok(Date.now() - started < 12000, 'twelve empty frames should not take long');
});
