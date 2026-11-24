'use client';
import {extractIsbn} from './isbn';
import type {Reading} from './barcode-core';

type Detector = {detect(image: CanvasImageSource): Promise<{rawValue: string}[]>};
type DetectorCtor = new (options?: {formats?: string[]}) => Detector;

/** The browser's own barcode reader, which is fast and good, where it exists (Chrome on Android). */
export function nativeDetector(): Detector | null {
  const Native = (window as unknown as {BarcodeDetector?: DetectorCtor}).BarcodeDetector;
  if (!Native) return null;
  try {
    return new Native({formats: ['ean_13', 'ean_8', 'upc_a']});
  } catch {
    return null;
  }
}

async function nativeRead(detector: Detector, image: CanvasImageSource): Promise<Reading | null> {
  try {
    let other: string | null = null;
    for (const item of await detector.detect(image)) {
      const isbn = extractIsbn(item.rawValue);
      if (isbn) return {isbn, other};
      other ||= item.rawValue;
    }
    return {isbn: null, other};
  } catch {
    return null;
  }
}

/** Reads the barcode on one frame of the live camera. The browser's reader is used when it has one. */
export async function readFrame(
  canvas: HTMLCanvasElement,
  frame: number,
  detector: Detector | null,
): Promise<Reading> {
  if (detector) {
    const read = await nativeRead(detector, canvas);
    if (read?.isbn) return read;
  }
  const context = canvas.getContext('2d', {willReadFrequently: true})!;
  const {readIsbn, toGray} = await import('./barcode-core');
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  return readIsbn(toGray(pixels.data, canvas.width, canvas.height), {frame});
}

/**
 * Reads an ISBN barcode from a photo. Throws when the file is not a picture the browser can open.
 * A phone photo is huge, so it is shrunk to a sensible size first; then the browser's reader is tried and
 * the bundled reader tries the picture many ways (sizes, sideways, tilted) before giving up.
 */
export async function readBarcode(file: Blob): Promise<Reading> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That file is not a photo this browser can open. Try a JPEG or PNG picture.');
  }
  try {
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', {willReadFrequently: true})!;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const detector = nativeDetector();
    if (detector) {
      const read = await nativeRead(detector, canvas);
      if (read?.isbn) return read;
    }
    const {readIsbn, toGray} = await import('./barcode-core');
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    return readIsbn(toGray(pixels.data, canvas.width, canvas.height), {thorough: true});
  } finally {
    bitmap.close();
  }
}

/** Shrinks a photo to a JPEG data URL so uploads are small and quick on mobile data. */
export async function photoToDataUrl(file: Blob, maxSide = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.82);
}
