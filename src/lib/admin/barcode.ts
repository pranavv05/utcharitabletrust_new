'use client';
import {extractIsbn} from './isbn';

type DetectorCtor = new (options?: {formats?: string[]}) => {
  detect(image: ImageBitmap): Promise<{rawValue: string}[]>;
};

/** Reads an ISBN barcode from a photo. Uses the browser's detector when it has one, else a bundled decoder. */
export async function readBarcodeIsbn(file: Blob): Promise<string | null> {
  const Native = (window as unknown as {BarcodeDetector?: DetectorCtor}).BarcodeDetector;
  if (Native) {
    try {
      const bitmap = await createImageBitmap(file);
      const found = await new Native({formats: ['ean_13', 'ean_8', 'upc_a', 'code_128']}).detect(bitmap);
      bitmap.close();
      for (const item of found) {
        const isbn = extractIsbn(item.rawValue);
        if (isbn) return isbn;
      }
    } catch {
      // fall back to the bundled decoder below
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const [{BrowserMultiFormatReader}, {DecodeHintType, BarcodeFormat}] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library'),
    ]);
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
    ]);
    const result = await new BrowserMultiFormatReader(hints).decodeFromImageUrl(url);
    return extractIsbn(result.getText());
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
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
