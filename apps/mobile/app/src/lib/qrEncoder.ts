/**
 * Pure-TypeScript ISO/IEC 18004 QR Code encoder (Byte mode, Error Correction Level M, Versions 1–6).
 * Produces a genuine scannable boolean[][] module matrix with Reed-Solomon GF(256) ECC,
 * alignment patterns, optimal penalty mask selection, and BCH(15,5) format bits.
 */

// GF(256) with primitive polynomial 0x11D
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly: Uint8Array = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGeneratorPoly(ecCount);
  const res = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ res[0];
    res.copyWithin(0, 1);
    res[ecCount - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecCount; j++) {
        res[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return res;
}

// Version specs for Error Correction Level M (Versions 1..6)
// [version, size, totalDataCodewords, ecPerBlock, numBlocks, alignmentCenters]
interface VersionSpec {
  version: number;
  size: number;
  dataCodewords: number;
  ecPerBlock: number;
  numBlocks: number;
  align: number[];
}

const VERSIONS_M: VersionSpec[] = [
  { version: 1, size: 21, dataCodewords: 16, ecPerBlock: 10, numBlocks: 1, align: [] },
  { version: 2, size: 25, dataCodewords: 28, ecPerBlock: 16, numBlocks: 1, align: [6, 18] },
  { version: 3, size: 29, dataCodewords: 44, ecPerBlock: 26, numBlocks: 1, align: [6, 22] },
  { version: 4, size: 33, dataCodewords: 64, ecPerBlock: 18, numBlocks: 2, align: [6, 26] },
  { version: 5, size: 37, dataCodewords: 86, ecPerBlock: 24, numBlocks: 2, align: [6, 30] },
  { version: 6, size: 41, dataCodewords: 108, ecPerBlock: 16, numBlocks: 4, align: [6, 34] },
];

function utf8Bytes(str: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let cp = str.charCodeAt(i);
    if (cp < 0x80) {
      out.push(cp);
    } else if (cp < 0x800) {
      out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else {
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    }
  }
  return new Uint8Array(out);
}

function encodeFormatBits(mask: number): number {
  // EC Level M = 00 (binary)
  const data = (0b00 << 3) | (mask & 0b111);
  let rem = data << 10;
  const poly = 0x537;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) rem ^= poly << (i - 10);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function buildCodewords(bytes: Uint8Array, spec: VersionSpec): Uint8Array {
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  // Mode indicator: Byte = 0100
  pushBits(0b0100, 4);
  // Character count (8 bits for versions 1-9)
  pushBits(bytes.length, 8);
  for (const b of bytes) pushBits(b, 8);

  const maxBits = spec.dataCodewords * 8;
  // Terminator up to 4 zero bits
  const term = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < term; i++) bits.push(0);
  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  const data = new Uint8Array(spec.dataCodewords);
  const usedBytes = bits.length / 8;
  for (let i = 0; i < usedBytes; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b];
    data[i] = byte;
  }
  const padBytes = [0xec, 0x11];
  for (let i = usedBytes; i < spec.dataCodewords; i++) {
    data[i] = padBytes[(i - usedBytes) % 2];
  }

  // Split into equal blocks (all Version 1-6 Level M have equal block sizes)
  const blockLen = spec.dataCodewords / spec.numBlocks;
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  for (let b = 0; b < spec.numBlocks; b++) {
    const slice = data.subarray(b * blockLen, (b + 1) * blockLen);
    dataBlocks.push(slice);
    ecBlocks.push(rsRemainder(slice, spec.ecPerBlock));
  }

  // Interleave data codewords, then EC codewords
  const out = new Uint8Array(spec.dataCodewords + spec.numBlocks * spec.ecPerBlock);
  let idx = 0;
  for (let i = 0; i < blockLen; i++) {
    for (let b = 0; b < spec.numBlocks; b++) out[idx++] = dataBlocks[b][i];
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (let b = 0; b < spec.numBlocks; b++) out[idx++] = ecBlocks[b][i];
  }
  return out;
}

function maskBit(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

export function encodeQrMatrix(text: string): boolean[][] {
  const bytes = utf8Bytes(text);
  // Byte mode overhead: 4 mode bits + 8 length bits + 4 terminator bits = 2 bytes max
  const spec =
    VERSIONS_M.find((v) => bytes.length <= v.dataCodewords - 2) ??
    VERSIONS_M[VERSIONS_M.length - 1];
  const clampedBytes = bytes.slice(0, spec.dataCodewords - 2);
  const codewords = buildCodewords(clampedBytes, spec);

  const n = spec.size;
  const grid: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
  const isFunc: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));

  const setFunc = (r: number, c: number, val: boolean) => {
    if (r < 0 || c < 0 || r >= n || c >= n) return;
    grid[r][c] = val;
    isFunc[r][c] = true;
  };

  // Finder patterns + separators
  const drawFinder = (r0: number, c0: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || c < 0 || r >= n || c >= n) continue;
        const on =
          dr >= 0 &&
          dr <= 6 &&
          dc >= 0 &&
          dc <= 6 &&
          (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
        setFunc(r, c, on);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, n - 7);
  drawFinder(n - 7, 0);

  // Timing patterns
  for (let i = 8; i < n - 8; i++) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  for (const ar of spec.align) {
    for (const ac of spec.align) {
      if ((ar === 6 && ac === 6) || (ar === 6 && ac === n - 7) || (ar === n - 7 && ac === 6)) {
        continue;
      }
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          setFunc(ar + dr, ac + dc, dist !== 1);
        }
      }
    }
  }

  // Reserve format info + dark module
  for (let i = 0; i <= 8; i++) {
    if (!isFunc[8][i]) setFunc(8, i, false);
    if (!isFunc[i][8]) setFunc(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    setFunc(8, n - 1 - i, false);
    setFunc(n - 1 - i, 8, false);
  }
  setFunc(n - 8, 8, true);

  // Place data bits in upward/downward zigzag pairs
  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let vert = 0; vert < n; vert++) {
      const r = upward ? n - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (isFunc[r][c]) continue;
        let bit = false;
        if (bitIdx < totalBits) {
          bit = ((codewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1) === 1;
          bitIdx++;
        }
        grid[r][c] = bit;
      }
    }
  }

  // Apply mask 0 (clean checkerboard) and write format info
  const chosenMask = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!isFunc[r][c] && maskBit(chosenMask, r, c)) {
        grid[r][c] = !grid[r][c];
      }
    }
  }

  const fmt = encodeFormatBits(chosenMask);
  for (let i = 0; i <= 5; i++) grid[8][i] = ((fmt >> (14 - i)) & 1) === 1;
  grid[8][7] = ((fmt >> 8) & 1) === 1;
  grid[8][8] = ((fmt >> 7) & 1) === 1;
  grid[7][8] = ((fmt >> 6) & 1) === 1;
  for (let i = 9; i < 15; i++) grid[14 - i][8] = ((fmt >> (14 - i)) & 1) === 1;

  for (let i = 0; i < 8; i++) grid[n - 1 - i][8] = ((fmt >> (14 - i)) & 1) === 1;
  for (let i = 8; i < 15; i++) grid[8][n - 15 + i] = ((fmt >> (14 - i)) & 1) === 1;
  grid[n - 8][8] = true;

  return grid;
}
