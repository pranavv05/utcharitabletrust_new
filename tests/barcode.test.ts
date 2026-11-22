import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library';
import {extractIsbn} from '../src/lib/admin/isbn';

const L = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
];
const G = [
  '0100111',
  '0110011',
  '0011011',
  '0100001',
  '0011101',
  '0111001',
  '0000101',
  '0010001',
  '0001001',
  '0010111',
];
const R = [
  '1110010',
  '1100110',
  '1101100',
  '1000010',
  '1011100',
  '1001110',
  '1010000',
  '1000100',
  '1001000',
  '1110100',
];
const PARITY = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLL',
  'LGLGLG',
  'LGLGGL',
  'LGGLGL',
];

/** Draws a grayscale EAN-13 barcode, the kind printed on the back of a book. */
function ean13Pixels(code: string, moduleWidth = 3, height = 70, quiet = 10) {
  const first = Number(code[0]);
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (PARITY[first][i - 1] === 'L' ? L : G)[Number(code[i])];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[Number(code[i])];
  bits += '101';
  const modules = quiet * 2 + bits.length;
  const width = modules * moduleWidth;
  const pixels = new Uint8ClampedArray(width * height).fill(255);
  for (let m = 0; m < bits.length; m++) {
    if (bits[m] !== '1') continue;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < moduleWidth; x++) {
        pixels[y * width + (quiet + m) * moduleWidth + x] = 0;
      }
  }
  return {pixels, width, height};
}

test('the bundled barcode decoder reads an ISBN-13 barcode and the ISBN helper accepts it', () => {
  const {pixels, width, height} = ean13Pixels('9780306406157');
  const reader = new MultiFormatReader();
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);
  const result = reader.decode(
    new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, width, height))),
  );
  assert.equal(result.getText(), '9780306406157');
  assert.equal(extractIsbn(result.getText()), '9780306406157');
});
