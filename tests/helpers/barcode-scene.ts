/** Test pictures of a book's barcode, made to look like real phone photos with real problems. */
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

export function ean13Bits(code: string) {
  const first = Number(code[0]);
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (PARITY[first][i - 1] === 'L' ? L : G)[Number(code[i])];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[Number(code[i])];
  return bits + '101';
}

/** A simple repeatable pseudo-random generator so a failing picture can be reproduced. */
function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export type Scene = {
  code: string;
  width: number;
  height: number;
  /** Width of the barcode itself in pixels. */
  barcodeWidth: number;
  /** Where the middle of the barcode is, as a fraction of the picture. */
  x?: number;
  y?: number;
  /** Turn the whole picture, in degrees. */
  angle?: number;
  /** Soften the picture with a box blur of this radius in pixels. */
  blur?: number;
  /** Random noise strength (grey levels). */
  noise?: number;
  /** Dark and light end of the picture, for dim or dull photos. */
  dark?: number;
  light?: number;
  /** Uneven lighting: how much darker one side is than the other (grey levels). */
  shade?: number;
  seed?: number;
};

export function scene(s: Scene) {
  const bits = ean13Bits(s.code);
  const quiet = 10;
  const modules = bits.length + quiet * 2;
  const moduleWidth = s.barcodeWidth / modules;
  const barHeight = (s.barcodeWidth / modules) * 60;
  const dark = s.dark ?? 0;
  const light = s.light ?? 255;
  const data = new Uint8ClampedArray(s.width * s.height);
  const cx = (s.x ?? 0.5) * s.width;
  const cy = (s.y ?? 0.5) * s.height;
  const rad = ((s.angle ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rnd = random(s.seed ?? 1);
  for (let y = 0; y < s.height; y++)
    for (let x = 0; x < s.width; x++) {
      // Where this picture pixel falls on the (flat) barcode.
      const dx = x - cx;
      const dy = y - cy;
      const bx = cos * dx + sin * dy;
      const by = -sin * dx + cos * dy;
      let value = light;
      if (Math.abs(by) <= barHeight / 2 && Math.abs(bx) <= (s.barcodeWidth - quiet * 2 * moduleWidth) / 2) {
        const m = Math.floor((bx + s.barcodeWidth / 2) / moduleWidth) - quiet;
        if (m >= 0 && m < bits.length && bits[m] === '1') value = dark;
      }
      data[y * s.width + x] = value;
    }
  let out = data;
  if (s.blur) {
    const r = Math.round(s.blur);
    const tmp = new Float32Array(data.length);
    for (let y = 0; y < s.height; y++) {
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += data[y * s.width + Math.min(s.width - 1, Math.max(0, x))];
      for (let x = 0; x < s.width; x++) {
        tmp[y * s.width + x] = sum / (2 * r + 1);
        sum += data[y * s.width + Math.min(s.width - 1, x + r + 1)] - data[y * s.width + Math.max(0, x - r)];
      }
    }
    out = new Uint8ClampedArray(data.length);
    for (let x = 0; x < s.width; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += tmp[Math.min(s.height - 1, Math.max(0, y)) * s.width + x];
      for (let y = 0; y < s.height; y++) {
        out[y * s.width + x] = sum / (2 * r + 1);
        sum += tmp[Math.min(s.height - 1, y + r + 1) * s.width + x] - tmp[Math.max(0, y - r) * s.width + x];
      }
    }
  }
  if (s.noise || s.shade) {
    for (let y = 0; y < s.height; y++)
      for (let x = 0; x < s.width; x++) {
        const i = y * s.width + x;
        out[i] = out[i] + (rnd() - 0.5) * 2 * (s.noise ?? 0) - ((s.shade ?? 0) * x) / s.width;
      }
  }
  return {data: out, width: s.width, height: s.height};
}
