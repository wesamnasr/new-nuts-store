import React from 'react';

/**
 * ISO/IEC 15417 Code-128 pattern table (values 0..106).
 * Values 0..105 are 11-module bar/space widths (6 digits summing to 11);
 * Value 106 (STOP) is 7 digits summing to 13 modules.
 */
const CODE128_WIDTHS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
];

function appendPatternBits(bits: number[], codeVal: number): void {
  const widths = CODE128_WIDTHS[codeVal];
  if (!widths) return;
  for (let i = 0; i < widths.length; i++) {
    const count = Number(widths[i]);
    const bit = i % 2 === 0 ? 1 : 0;
    for (let k = 0; k < count; k++) {
      bits.push(bit);
    }
  }
}

/**
 * Encodes an ASCII string into Code-128 (Code Set C for pure even-digit runs, Code Set B otherwise)
 * returning an array of 0/1 module bits including 10-module quiet zones.
 */
export function encodeCode128Bits(rawValue: string): number[] {
  const sanitized = (rawValue || '')
    .trim()
    .replace(/[^\x20-\x7E]/g, '')
    .slice(0, 48);

  if (!sanitized) return [];

  const codes: number[] = [];

  // Use compact Code-128C when value is an even number of digits >= 6 (ideal for EAN-13/scale/numeric IDs)
  if (/^\d{6,}$/.test(sanitized) && sanitized.length % 2 === 0) {
    codes.push(105); // Start C
    for (let i = 0; i < sanitized.length; i += 2) {
      codes.push(parseInt(sanitized.slice(i, i + 2), 10));
    }
  } else {
    codes.push(104); // Start B
    for (let i = 0; i < sanitized.length; i++) {
      codes.push(sanitized.charCodeAt(i) - 32);
    }
  }

  let checksum = codes[0];
  for (let i = 1; i < codes.length; i++) {
    checksum += codes[i] * i;
  }
  codes.push(checksum % 103);

  const bits: number[] = new Array(10).fill(0); // Left quiet zone
  for (const c of codes) {
    appendPatternBits(bits, c);
  }
  appendPatternBits(bits, 106); // Stop pattern (13 modules)
  for (let q = 0; q < 10; q++) bits.push(0); // Right quiet zone

  return bits;
}

export interface Code128BarcodeSvgProps {
  value: string;
  height?: number;
  showText?: boolean;
  className?: string;
}

/**
 * Scannable 1D Code-128 SVG Barcode component for 80mm thermal receipts & 58mm scale stickers.
 */
export function Code128BarcodeSvg({
  value,
  height = 38,
  showText = true,
  className = '',
}: Code128BarcodeSvgProps) {
  const bits = encodeCode128Bits(value);
  if (bits.length === 0) return null;

  const rects: Array<{ x: number; w: number }> = [];
  let idx = 0;
  while (idx < bits.length) {
    if (bits[idx] === 1) {
      let run = 1;
      while (idx + run < bits.length && bits[idx + run] === 1) {
        run++;
      }
      rects.push({ x: idx, w: run });
      idx += run;
    } else {
      idx++;
    }
  }

  return (
    <div
      className={`flex flex-col items-center justify-center select-none ${className}`}
      style={{ direction: 'ltr' }}
    >
      <svg
        viewBox={`0 0 ${bits.length} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        style={{ maxWidth: '230px', display: 'block', background: '#ffffff' }}
        aria-label={`Barcode ${value}`}
      >
        <rect x={0} y={0} width={bits.length} height={height} fill="#ffffff" />
        {rects.map((r, i) => (
          <rect key={i} x={r.x} y={0} width={r.w} height={height} fill="#000000" />
        ))}
      </svg>
      {showText && (
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '1.2px',
            marginTop: '2px',
            color: '#000000',
          }}
        >
          {value}
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/* ISO/IEC 18004 QR Code Generator (Byte Mode, EC Level L, Versions 1..12)    */
/* ========================================================================== */

interface QrVersionSpec {
  version: number;
  ecCodewordsPerBlock: number;
  g1Blocks: number;
  g1DataCodewords: number;
  g2Blocks: number;
  g2DataCodewords: number;
  alignCenters: number[];
}

const QR_VERSION_SPECS_L: QrVersionSpec[] = [
  { version: 1, ecCodewordsPerBlock: 7, g1Blocks: 1, g1DataCodewords: 19, g2Blocks: 0, g2DataCodewords: 0, alignCenters: [] },
  { version: 2, ecCodewordsPerBlock: 10, g1Blocks: 1, g1DataCodewords: 34, g2Blocks: 0, g2DataCodewords: 0, alignCenters: [6, 18] },
  { version: 3, ecCodewordsPerBlock: 15, g1Blocks: 1, g1DataCodewords: 55, g2Blocks: 0, g2DataCodewords: 0, alignCenters: [6, 22] },
  { version: 4, ecCodewordsPerBlock: 20, g1Blocks: 1, g1DataCodewords: 80, g2Blocks: 0, g2DataCodewords: 0, alignCenters: [6, 26] },
  { version: 5, ecCodewordsPerBlock: 26, g1Blocks: 1, g1DataCodewords: 108, g2Blocks: 0, g2DataCodewords: 0, alignCenters: [6, 30] },
  { version: 6, ecCodewordsPerBlock: 18, g1Blocks: 2, g1DataCodewords: 68, g2Blocks: 0, g2DataCodewords: 0, alignCenters: [6, 34] },
  { version: 7, ecCodewordsPerBlock: 20, g1Blocks: 2, g1DataCodewords: 78, g2Blocks: 0, g2DataCodewords: 0, alignCenters: [6, 22, 38] },
  { version: 8, ecCodewordsPerBlock: 24, g1Blocks: 2, g1DataCodewords: 97, g2Blocks: 0, g2DataCodewords: 0, alignCenters: [6, 24, 42] },
  { version: 9, ecCodewordsPerBlock: 30, g1Blocks: 2, g1DataCodewords: 116, g2Blocks: 0, g2DataCodewords: 0, alignCenters: [6, 26, 46] },
  { version: 10, ecCodewordsPerBlock: 18, g1Blocks: 2, g1DataCodewords: 68, g2Blocks: 2, g2DataCodewords: 69, alignCenters: [6, 28, 50] },
  { version: 11, ecCodewordsPerBlock: 20, g1Blocks: 4, g1DataCodewords: 81, g2Blocks: 0, g2DataCodewords: 0, alignCenters: [6, 30, 54] },
  { version: 12, ecCodewordsPerBlock: 24, g1Blocks: 2, g1DataCodewords: 92, g2Blocks: 2, g2DataCodewords: 93, alignCenters: [6, 32, 58] },
];

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
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function rsComputeRemainder(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecLen - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecLen; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return rem;
}

function pushBits(buf: number[], val: number, bitCount: number): void {
  for (let i = bitCount - 1; i >= 0; i--) {
    buf.push((val >>> i) & 1);
  }
}

/**
 * Encodes UTF-8 text into a boolean 2D QR Code matrix (true = dark module).
 */
export function encodeQrMatrix(text: string): boolean[][] {
  const utf8 = Array.from(new TextEncoder().encode((text || '').slice(0, 360)));
  if (utf8.length === 0) return [];

  // Select smallest version in L that fits utf8.length
  let spec: QrVersionSpec | undefined;
  for (const s of QR_VERSION_SPECS_L) {
    const totalDataCodewords =
      s.g1Blocks * s.g1DataCodewords + s.g2Blocks * s.g2DataCodewords;
    const countBits = s.version <= 9 ? 8 : 16;
    const neededBits = 4 + countBits + utf8.length * 8;
    if (neededBits <= totalDataCodewords * 8) {
      spec = s;
      break;
    }
  }
  if (!spec) {
    spec = QR_VERSION_SPECS_L[QR_VERSION_SPECS_L.length - 1];
    utf8.length = 360;
  }

  const totalDataCodewords =
    spec.g1Blocks * spec.g1DataCodewords + spec.g2Blocks * spec.g2DataCodewords;
  const countBits = spec.version <= 9 ? 8 : 16;

  const dataBits: number[] = [];
  pushBits(dataBits, 0b0100, 4); // Byte mode
  pushBits(dataBits, utf8.length, countBits);
  for (const b of utf8) pushBits(dataBits, b, 8);

  const capacityBits = totalDataCodewords * 8;
  const termBits = Math.min(4, capacityBits - dataBits.length);
  pushBits(dataBits, 0, termBits);
  while (dataBits.length % 8 !== 0) dataBits.push(0);

  const dataCodewords = new Uint8Array(totalDataCodewords);
  for (let i = 0; i < dataBits.length / 8; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | dataBits[i * 8 + b];
    dataCodewords[i] = byte;
  }
  let padIdx = dataBits.length / 8;
  let toggle = false;
  while (padIdx < totalDataCodewords) {
    dataCodewords[padIdx++] = toggle ? 0x11 : 0xec;
    toggle = !toggle;
  }

  // Split into RS blocks & compute EC
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (let b = 0; b < spec.g1Blocks; b++) {
    const block = dataCodewords.slice(offset, offset + spec.g1DataCodewords);
    offset += spec.g1DataCodewords;
    dataBlocks.push(block);
    ecBlocks.push(rsComputeRemainder(block, spec.ecCodewordsPerBlock));
  }
  for (let b = 0; b < spec.g2Blocks; b++) {
    const block = dataCodewords.slice(offset, offset + spec.g2DataCodewords);
    offset += spec.g2DataCodewords;
    dataBlocks.push(block);
    ecBlocks.push(rsComputeRemainder(block, spec.ecCodewordsPerBlock));
  }

  const interleaved: number[] = [];
  const maxDataLen = Math.max(spec.g1DataCodewords, spec.g2DataCodewords);
  for (let i = 0; i < maxDataLen; i++) {
    for (const blk of dataBlocks) {
      if (i < blk.length) interleaved.push(blk[i]);
    }
  }
  for (let i = 0; i < spec.ecCodewordsPerBlock; i++) {
    for (const blk of ecBlocks) {
      interleaved.push(blk[i]);
    }
  }

  const size = 17 + 4 * spec.version;
  const modules: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false)
  );
  const isFunc: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false)
  );

  const setFunc = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    modules[r][c] = dark;
    isFunc[r][c] = true;
  };

  // Finder patterns + separators
  const drawFinder = (topR: number, leftC: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const dist = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
        const dark = dist !== 2 && dist !== 4;
        setFunc(topR + dr, leftC + dc, dark);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const centers = spec.alignCenters;
  for (let i = 0; i < centers.length; i++) {
    for (let j = 0; j < centers.length; j++) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === centers.length - 1) ||
        (i === centers.length - 1 && j === 0)
      ) {
        continue;
      }
      const cr = centers[i];
      const cc = centers[j];
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          setFunc(cr + dr, cc + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
        }
      }
    }
  }

  // Reserve format info & dark module
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      isFunc[8][i] = true;
      isFunc[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    isFunc[8][size - 1 - i] = true;
    isFunc[size - 1 - i][8] = true;
  }
  setFunc(size - 8, 8, true); // Dark module

  // Version info for V >= 7
  if (spec.version >= 7) {
    let rem = spec.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const verBits = (spec.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((verBits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunc(a, b, bit);
      setFunc(b, a, bit);
    }
  }

  // Zigzag codeword placement
  let bitIdx = 0;
  const totalStreamBits = interleaved.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      const upwards = ((right + 1) & 2) === 0;
      const r = upwards ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (!isFunc[r][c]) {
          let dark = false;
          if (bitIdx < totalStreamBits) {
            const byte = interleaved[bitIdx >>> 3];
            dark = ((byte >>> (7 - (bitIdx & 7))) & 1) === 1;
            bitIdx++;
          }
          // Apply Mask 0: (r + c) % 2 === 0
          if ((r + c) % 2 === 0) dark = !dark;
          modules[r][c] = dark;
        }
      }
    }
  }

  // Format information for EC Level L (01) + Mask 0 (000) -> data = 0b01000 = 8
  const fmtData = (0b01 << 3) | 0;
  let fmtRem = fmtData;
  for (let i = 0; i < 10; i++) fmtRem = (fmtRem << 1) ^ ((fmtRem >>> 9) * 0x537);
  const fmtBits = ((fmtData << 10) | fmtRem) ^ 0x5412;

  const getFmtBit = (i: number) => ((fmtBits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) modules[8][i] = getFmtBit(14 - i);
  modules[8][7] = getFmtBit(8);
  modules[8][8] = getFmtBit(7);
  modules[7][8] = getFmtBit(6);
  for (let i = 9; i < 15; i++) modules[14 - i][8] = getFmtBit(14 - i);

  for (let i = 0; i < 8; i++) modules[8][size - 1 - i] = getFmtBit(i);
  for (let i = 8; i < 15; i++) modules[size - 15 + i][8] = getFmtBit(i);
  modules[size - 8][8] = true;

  return modules;
}

export interface QrCodeSvgProps {
  value: string;
  size?: number;
  caption?: string;
  className?: string;
}

/**
 * Scannable 2D QR Code SVG component for Egyptian Tax E-Receipt (TLV Base64) & order links.
 */
export function QrCodeSvg({
  value,
  size = 96,
  caption,
  className = '',
}: QrCodeSvgProps) {
  const matrix = encodeQrMatrix(value);
  if (matrix.length === 0) return null;

  const quiet = 2;
  const total = matrix.length + quiet * 2;

  return (
    <div
      className={`flex flex-col items-center justify-center select-none ${className}`}
      style={{ direction: 'ltr' }}
    >
      <svg
        viewBox={`0 0 ${total} ${total}`}
        width={size}
        height={size}
        shapeRendering="crispEdges"
        style={{ display: 'block', background: '#ffffff' }}
        aria-label="QR Code"
      >
        <rect x={0} y={0} width={total} height={total} fill="#ffffff" />
        {matrix.map((row, r) =>
          row.map((dark, c) =>
            dark ? (
              <rect
                key={`${r}-${c}`}
                x={c + quiet}
                y={r + quiet}
                width={1}
                height={1}
                fill="#000000"
              />
            ) : null
          )
        )}
      </svg>
      {caption && (
        <div
          style={{
            fontSize: '9px',
            fontWeight: 700,
            marginTop: '2px',
            color: '#000000',
            textAlign: 'center',
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}
