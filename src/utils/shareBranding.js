export const SHARE_BRAND_NAME = '终末地抽卡分析器';
export const SHARE_BRAND_URL = 'ef-gacha.mogujun.icu';
export const SHARE_BRAND_LINK = 'https://ef-gacha.mogujun.icu/';
export const SHARE_BRAND_TAGLINE = '导入 · 统计 · 模拟 · 分享';
export const SHARE_CARD_WIDTH = 760;
export const SHARE_CARD_HEIGHT = 820;
export const SHARE_CARD_EXPORT_PIXEL_RATIO = 3;

const QR_VERSION = 2;
const QR_SIZE = QR_VERSION * 4 + 17;
const QR_DATA_CODEWORDS = 34;
const QR_ECC_CODEWORDS = 10;
const QR_MASK_PATTERN = 0;
const QR_ECL_FORMAT_BITS = 1; // L
const qrDataUrlCache = new Map();

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

let current = 1;
for (let i = 0; i < 255; i++) {
  GF_EXP[i] = current;
  GF_LOG[current] = i;
  current <<= 1;
  if (current & 0x100) {
    current ^= 0x11d;
  }
}
for (let i = 255; i < GF_EXP.length; i++) {
  GF_EXP[i] = GF_EXP[i - 255];
}

function gfMultiply(a, b) {
  if (a === 0 || b === 0) {
    return 0;
  }

  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function buildGeneratorPolynomial(degree) {
  let result = [1];

  for (let i = 0; i < degree; i++) {
    const next = new Array(result.length + 1).fill(0);
    for (let j = 0; j < result.length; j++) {
      next[j] ^= result[j];
      next[j + 1] ^= gfMultiply(result[j], GF_EXP[i]);
    }
    result = next;
  }

  return result;
}

const QR_GENERATOR = buildGeneratorPolynomial(QR_ECC_CODEWORDS);

function appendBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i--) {
    bits.push((value >>> i) & 1);
  }
}

function buildDataCodewords(text) {
  const bytes = Array.from(new TextEncoder().encode(text));
  if (bytes.length > 32) {
    throw new Error('二维码内容超出当前分享卡生成器支持的长度上限');
  }

  const bits = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach(byte => appendBits(bits, byte, 8));

  const totalBitLength = QR_DATA_CODEWORDS * 8;
  const remainingBits = totalBitLength - bits.length;
  appendBits(bits, 0, Math.min(4, remainingBits));

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j++) {
      value = (value << 1) | bits[i + j];
    }
    codewords.push(value);
  }

  const padBytes = [0xec, 0x11];
  while (codewords.length < QR_DATA_CODEWORDS) {
    codewords.push(padBytes[codewords.length % 2]);
  }

  return codewords;
}

function buildErrorCorrectionCodewords(dataCodewords) {
  const remainder = new Array(QR_ECC_CODEWORDS).fill(0);

  dataCodewords.forEach((byte) => {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);

    if (factor === 0) {
      return;
    }

    for (let i = 0; i < QR_ECC_CODEWORDS; i++) {
      remainder[i] ^= gfMultiply(QR_GENERATOR[i + 1], factor);
    }
  });

  return remainder;
}

function createMatrix(value = false) {
  return Array.from({ length: QR_SIZE }, () => Array(QR_SIZE).fill(value));
}

function setFunctionModule(modules, functionModules, x, y, isDark) {
  modules[y][x] = Boolean(isDark);
  functionModules[y][x] = true;
}

function drawFinderPattern(modules, functionModules, left, top) {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const x = left + dx;
      const y = top + dy;
      if (x < 0 || x >= QR_SIZE || y < 0 || y >= QR_SIZE) {
        continue;
      }

      const isOuter = dx >= 0 && dx <= 6 && (dy === 0 || dy === 6)
        || dy >= 0 && dy <= 6 && (dx === 0 || dx === 6);
      const isCenter = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      setFunctionModule(modules, functionModules, x, y, isOuter || isCenter);
    }
  }
}

function drawAlignmentPattern(modules, functionModules, centerX, centerY) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setFunctionModule(modules, functionModules, centerX + dx, centerY + dy, distance !== 1);
    }
  }
}

function drawFunctionPatterns(modules, functionModules) {
  drawFinderPattern(modules, functionModules, 0, 0);
  drawFinderPattern(modules, functionModules, QR_SIZE - 7, 0);
  drawFinderPattern(modules, functionModules, 0, QR_SIZE - 7);
  drawAlignmentPattern(modules, functionModules, 18, 18);

  for (let i = 8; i < QR_SIZE - 8; i++) {
    const value = i % 2 === 0;
    setFunctionModule(modules, functionModules, 6, i, value);
    setFunctionModule(modules, functionModules, i, 6, value);
  }

  setFunctionModule(modules, functionModules, 8, QR_SIZE - 8, true);
}

function drawCodewords(modules, functionModules, codewords) {
  let bitIndex = 0;

  for (let right = QR_SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right--;
    }

    for (let vertical = 0; vertical < QR_SIZE; vertical++) {
      const upward = ((right + 1) & 2) === 0;
      const y = upward ? QR_SIZE - 1 - vertical : vertical;

      for (let columnOffset = 0; columnOffset < 2; columnOffset++) {
        const x = right - columnOffset;
        if (functionModules[y][x]) {
          continue;
        }

        let value = false;
        if (bitIndex < codewords.length * 8) {
          const codeword = codewords[bitIndex >>> 3];
          value = ((codeword >>> (7 - (bitIndex & 7))) & 1) !== 0;
          bitIndex++;
        }
        modules[y][x] = value;
      }
    }
  }
}

function applyMask(modules, functionModules) {
  for (let y = 0; y < QR_SIZE; y++) {
    for (let x = 0; x < QR_SIZE; x++) {
      if (functionModules[y][x]) {
        continue;
      }
      if ((x + y) % 2 === QR_MASK_PATTERN) {
        modules[y][x] = !modules[y][x];
      }
    }
  }
}

function getBit(value, index) {
  return ((value >>> index) & 1) !== 0;
}

function computeFormatBits(mask) {
  const data = (QR_ECL_FORMAT_BITS << 3) | mask;
  let remainder = data;
  for (let i = 0; i < 10; i++) {
    remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
  }
  return ((data << 10) | remainder) ^ 0x5412;
}

function drawFormatBits(modules, functionModules, mask) {
  const bits = computeFormatBits(mask);

  for (let i = 0; i <= 5; i++) {
    setFunctionModule(modules, functionModules, 8, i, getBit(bits, i));
  }
  setFunctionModule(modules, functionModules, 8, 7, getBit(bits, 6));
  setFunctionModule(modules, functionModules, 8, 8, getBit(bits, 7));
  setFunctionModule(modules, functionModules, 7, 8, getBit(bits, 8));
  for (let i = 9; i < 15; i++) {
    setFunctionModule(modules, functionModules, 14 - i, 8, getBit(bits, i));
  }

  for (let i = 0; i < 8; i++) {
    setFunctionModule(modules, functionModules, QR_SIZE - 1 - i, 8, getBit(bits, i));
  }
  for (let i = 8; i < 15; i++) {
    setFunctionModule(modules, functionModules, 8, QR_SIZE - 15 + i, getBit(bits, i));
  }
}

function buildQrMatrix(text) {
  const modules = createMatrix(false);
  const functionModules = createMatrix(false);
  const dataCodewords = buildDataCodewords(text);
  const codewords = dataCodewords.concat(buildErrorCorrectionCodewords(dataCodewords));

  drawFunctionPatterns(modules, functionModules);
  drawCodewords(modules, functionModules, codewords);
  applyMask(modules, functionModules);
  drawFormatBits(modules, functionModules, QR_MASK_PATTERN);

  return modules;
}

export function buildShareQrCodeDataUrl(
  text = SHARE_BRAND_LINK,
  {
    size = 112,
    margin = 4,
    darkColor = '#111827',
    lightColor = '#ffffff'
  } = {}
) {
  const cacheKey = JSON.stringify({ text, size, margin, darkColor, lightColor });
  const cached = qrDataUrlCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const modules = buildQrMatrix(text);
  const viewSize = QR_SIZE + margin * 2;
  const path = [];

  for (let y = 0; y < QR_SIZE; y++) {
    for (let x = 0; x < QR_SIZE; x++) {
      if (!modules[y][x]) {
        continue;
      }
      path.push(`M${x + margin} ${y + margin}h1v1H${x + margin}z`);
    }
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${viewSize} ${viewSize}" shape-rendering="crispEdges">
      <rect width="${viewSize}" height="${viewSize}" fill="${lightColor}" />
      <path d="${path.join(' ')}" fill="${darkColor}" />
    </svg>
  `.trim();

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  qrDataUrlCache.set(cacheKey, dataUrl);
  return dataUrl;
}
