/** ISBN helpers shared by the barcode reader and the server lookup. */

const digitsOnly = (value: string) => value.replace(/[\s-]/g, '');

export function isValidIsbn10(value: string) {
  if (!/^\d{9}[\dXx]$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const c = value[i];
    sum += (c === 'X' || c === 'x' ? 10 : Number(c)) * (10 - i);
  }
  return sum % 11 === 0;
}

export function isValidIsbn13(value: string) {
  if (!/^97[89]\d{10}$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(value[i]) * (i % 2 === 0 ? 1 : 3);
  return sum % 10 === 0;
}

/** Returns a clean ISBN-10 or ISBN-13 string, or null if the text is not a valid ISBN. */
export function normalizeIsbn(text: string): string | null {
  const value = digitsOnly(text.replace(/^ISBN(-1[03])?:?/i, ''));
  if (isValidIsbn13(value)) return value;
  if (isValidIsbn10(value)) return value.toUpperCase();
  return null;
}

/** Finds the first valid ISBN inside longer text such as OCR output or a barcode payload. */
export function extractIsbn(text: string): string | null {
  const candidates = text.match(/(?:97[89][\d\s-]{10,16}\d|\d[\d\s-]{8,12}[\dXx])/g) || [];
  for (const candidate of candidates) {
    const found = normalizeIsbn(candidate);
    if (found) return found;
  }
  return null;
}
