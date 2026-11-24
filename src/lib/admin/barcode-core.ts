import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library';
import {extractIsbn} from './isbn';

/**
 * Reads an ISBN barcode from raw pixels. No browser APIs are used here, so the same code runs in the page
 * (for photos and live camera frames) and in tests. Photos are tried at several sizes, turned sideways and
 * cropped to the middle band, because a phone photo is usually large, the barcode is small, and people hold
 * the phone any way round.
 */
export type Gray = {data: Uint8ClampedArray; width: number; height: number};
export type Reading = {
  /** A valid ISBN, when one was read. */
  isbn: string | null;
  /** A barcode that was read but is not an ISBN (for example the shop's price barcode). */
  other: string | null;
};

const hints = new Map<DecodeHintType, unknown>();
hints.set(DecodeHintType.TRY_HARDER, true);
hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]);
let reader: MultiFormatReader | null = null;

function decodeOnce(g: Gray): string | null {
  if (g.width < 60 || g.height < 20) return null;
  reader ||= new MultiFormatReader();
  reader.setHints(hints);
  try {
    return reader
      .decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(g.data, g.width, g.height))))
      .getText();
  } catch {
    return null;
  }
}

/** Colour pixels (RGBA, as from a canvas) to one grey value per pixel. */
export function toGray(rgba: ArrayLike<number>, width: number, height: number): Gray {
  const data = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i++, p += 4)
    data[i] = (rgba[p] * 299 + rgba[p + 1] * 587 + rgba[p + 2] * 114) / 1000;
  return {data, width, height};
}

/** Shrinks by a whole number, averaging each block, which also smooths out sensor noise. */
export function shrink(g: Gray, by: number): Gray {
  if (by <= 1) return g;
  const width = Math.floor(g.width / by);
  const height = Math.floor(g.height / by);
  const data = new Uint8ClampedArray(width * height);
  const area = by * by;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let dy = 0; dy < by; dy++) {
        const row = (y * by + dy) * g.width + x * by;
        for (let dx = 0; dx < by; dx++) sum += g.data[row + dx];
      }
      data[y * width + x] = sum / area;
    }
  return {data, width, height};
}

export function rotate90(g: Gray): Gray {
  const data = new Uint8ClampedArray(g.data.length);
  for (let y = 0; y < g.height; y++)
    for (let x = 0; x < g.width; x++) data[x * g.height + (g.height - 1 - y)] = g.data[y * g.width + x];
  return {data, width: g.height, height: g.width};
}

/** The middle band of the picture, where people aim the barcode. */
export function band(g: Gray, fraction: number): Gray {
  const height = Math.max(20, Math.floor(g.height * fraction));
  const top = Math.floor((g.height - height) / 2);
  return {data: g.data.subarray(top * g.width, (top + height) * g.width), width: g.width, height};
}

/** Stretches dull, low-contrast pictures (a dim room, a glossy cover) to the full dark-to-light range. */
export function stretch(g: Gray): Gray {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < g.data.length; i++) histogram[g.data[i]]++;
  const cut = g.data.length * 0.01;
  let low = 0;
  let high = 255;
  for (let sum = 0; low < 255 && (sum += histogram[low]) < cut; low++);
  for (let sum = 0; high > 0 && (sum += histogram[high]) < cut; high--);
  if (high - low < 20) return g;
  const data = new Uint8ClampedArray(g.data.length);
  const scale = 255 / (high - low);
  for (let i = 0; i < data.length; i++) data[i] = (g.data[i] - low) * scale;
  return {data, width: g.width, height: g.height};
}

/** Turns the picture by a small angle (degrees) around its centre, for barcodes held crooked. */
export function tilt(g: Gray, degrees: number): Gray {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const data = new Uint8ClampedArray(g.data.length).fill(255);
  const cx = g.width / 2;
  const cy = g.height / 2;
  for (let y = 0; y < g.height; y++)
    for (let x = 0; x < g.width; x++) {
      const sx = Math.round(cos * (x - cx) + sin * (y - cy) + cx);
      const sy = Math.round(-sin * (x - cx) + cos * (y - cy) + cy);
      if (sx >= 0 && sx < g.width && sy >= 0 && sy < g.height)
        data[y * g.width + x] = g.data[sy * g.width + sx];
    }
  return {data, width: g.width, height: g.height};
}

function* attempts(g: Gray, thorough: boolean, frame: number): Generator<Gray> {
  if (!thorough) {
    // A live camera frame: a quick look every frame, with a few extra tries now and then.
    yield g;
    yield band(g, 0.5);
    if (frame % 3 === 1) yield shrink(g, 2);
    if (frame % 4 === 2) yield stretch(band(g, 0.6));
    if (frame % 6 === 3) yield rotate90(g);
    if (frame % 6 === 5) yield tilt(band(g, 0.7), frame % 12 === 5 ? 8 : -8);
    return;
  }
  for (const by of [1, 2, 3, 4]) {
    const small = shrink(g, by);
    if (small.width < 160) break;
    yield small;
    yield band(small, 0.5);
    yield rotate90(small);
    yield band(rotate90(small), 0.5);
    if (by <= 2) yield stretch(small);
  }
  const mid = shrink(g, g.width > 1600 ? 3 : 1);
  for (const degrees of [8, -8, 15, -15]) yield tilt(mid, degrees);
}

/**
 * Looks for an ISBN barcode. `thorough` is for a still photo (many passes, a second or so at worst); the
 * default is for one frame of a live camera, where speed matters because the next frame is already coming.
 */
export function readIsbn(g: Gray, options: {thorough?: boolean; frame?: number} = {}): Reading {
  let other: string | null = null;
  for (const attempt of attempts(g, options.thorough ?? false, options.frame ?? 0)) {
    const text = decodeOnce(attempt);
    if (!text) continue;
    const isbn = extractIsbn(text);
    if (isbn) return {isbn, other};
    other ||= text;
  }
  return {isbn: null, other};
}
