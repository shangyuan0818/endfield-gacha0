const SHARE_CARD_WIDTH = 880;
const SHARE_CARD_HEIGHT = 760;
const SHARE_CARD_FILE_PREFIX = '终末地模拟器分享卡';
const DEFAULT_SHARE_BACKGROUND = '#0a0a0b';

function formatShareTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}`;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundRate(value) {
  return normalizeNumber(value).toFixed(2);
}

function roundAverage(value) {
  const parsed = normalizeNumber(value);
  return parsed > 0 ? parsed.toFixed(2) : '0.00';
}

function getPoolTypeLabel(poolType) {
  if (poolType === 'limited') {
    return '限定寻访';
  }

  if (poolType === 'weapon') {
    return '武器寻访';
  }

  return '常驻寻访';
}

function buildGuaranteeProgress(poolType, totalPulls, pityInfoWithGuarantee) {
  if (poolType === 'limited') {
    const current = Math.min(
      normalizeNumber(pityInfoWithGuarantee?.guaranteedUp?.current, totalPulls),
      120
    );
    const achieved = Boolean(pityInfoWithGuarantee?.guaranteedUp?.hasReceived);

    return {
      label: '120抽必出限定',
      current,
      target: 120,
      achieved,
      summary: achieved ? '已达成' : `${current}/120`,
    };
  }

  if (poolType === 'weapon') {
    const current = Math.min(
      normalizeNumber(pityInfoWithGuarantee?.guaranteedUp?.current, totalPulls),
      80
    );
    const achieved = Boolean(pityInfoWithGuarantee?.guaranteedUp?.hasReceived);

    return {
      label: '80抽首轮限定必出',
      current,
      target: 80,
      achieved,
      summary: achieved ? '已达成' : `${current}/80`,
    };
  }

  const current = Math.min(totalPulls, 300);
  const achieved = totalPulls >= 300;

  return {
    label: '300抽自选进度',
    current,
    target: 300,
    achieved,
    summary: achieved ? '已达成' : `${current}/300`,
  };
}

export function buildSimulatorSharePayload({
  currentPoolObj,
  dashboardStats,
  pityInfoWithGuarantee,
} = {}) {
  const poolType = currentPoolObj?.type || 'limited';
  const totalPulls = normalizeNumber(dashboardStats?.total);
  const sixStarCount = normalizeNumber(dashboardStats?.sixStarCount);
  const fiveStarCount = normalizeNumber(dashboardStats?.counts?.[5]);
  const upSixStarCount = normalizeNumber(dashboardStats?.upSixStarCount);
  const sixStarRate = totalPulls > 0 ? roundRate((sixStarCount / totalPulls) * 100) : '0.00';
  const fiveStarRate = totalPulls > 0 ? roundRate((fiveStarCount / totalPulls) * 100) : '0.00';
  const avgPullsPerSixStar = sixStarCount > 0 ? roundAverage(totalPulls / sixStarCount) : '0.00';
  const hasUpMetrics = poolType === 'limited' || poolType === 'weapon';

  return {
    poolType,
    poolTypeLabel: getPoolTypeLabel(poolType),
    poolName: currentPoolObj?.name || '未选择卡池',
    upCharacter: currentPoolObj?.up_character || null,
    totalPulls,
    sixStarCount,
    sixStarRate,
    fiveStarCount,
    fiveStarRate,
    upSixStarCount: hasUpMetrics ? upSixStarCount : null,
    winRate: hasUpMetrics ? roundRate(dashboardStats?.winRate) : null,
    avgPullsPerSixStar,
    currentPity6: normalizeNumber(dashboardStats?.currentPity),
    currentPity5: normalizeNumber(dashboardStats?.currentPity5),
    guaranteeProgress: buildGuaranteeProgress(poolType, totalPulls, pityInfoWithGuarantee),
  };
}

export function buildSimulatorShareText(payload) {
  if (!payload) {
    return '';
  }

  const lines = [
    `【终末地${payload.poolTypeLabel}模拟分享】`,
    '已脱敏分享卡',
    '',
    `当前卡池：${payload.poolName}`,
    `总抽数：${payload.totalPulls}`,
    `6星：${payload.sixStarCount}（${payload.sixStarRate}%）`,
    `5星：${payload.fiveStarCount}（${payload.fiveStarRate}%）`,
  ];

  if (payload.upCharacter) {
    lines.push(`当前UP：${payload.upCharacter}`);
  }

  if (payload.upSixStarCount !== null) {
    lines.push(`UP 6星：${payload.upSixStarCount}`);
  }

  if (payload.winRate !== null) {
    lines.push(`不歪率：${payload.winRate}%`);
  }

  lines.push(`平均出货：${payload.avgPullsPerSixStar} 抽/个`);
  lines.push(`当前保底：6星 ${payload.currentPity6} / 5星 ${payload.currentPity5}`);
  lines.push(`${payload.guaranteeProgress.label}：${payload.guaranteeProgress.summary}`);
  lines.push('');
  lines.push('来自终末地抽卡分析器模拟器');
  lines.push('不含账号、UID、时间戳与资源明细');

  return lines.join('\n');
}

export function buildSimulatorShareCardFileName(payload) {
  const poolLabel = payload?.poolTypeLabel || '模拟器';
  const safePoolLabel = poolLabel.replace(/[\\/:*?"<>|]/g, '');
  return `${SHARE_CARD_FILE_PREFIX}_${safePoolLabel}_${formatShareTimestamp()}.png`;
}

function loadImageFromUrl(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'sync';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('分享卡图片加载失败'));
    image.src = source;
  });
}

function resolveShareCardSize(node, options = {}) {
  const width = Number(options.width) || node?.scrollWidth || node?.offsetWidth || SHARE_CARD_WIDTH;
  const height = Number(options.height) || node?.scrollHeight || node?.offsetHeight || SHARE_CARD_HEIGHT;

  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height))
  };
}

async function measureRenderedShareCard(node, options = {}) {
  if (!node || typeof document === 'undefined') {
    return resolveShareCardSize(node, options);
  }

  const fallbackSize = resolveShareCardSize(node, options);
  const sandbox = document.createElement('div');
  sandbox.setAttribute('aria-hidden', 'true');
  sandbox.style.position = 'fixed';
  sandbox.style.left = '-200vw';
  sandbox.style.top = '0';
  sandbox.style.pointerEvents = 'none';
  sandbox.style.opacity = '0';
  sandbox.style.zIndex = '-1';
  sandbox.style.overflow = 'visible';

  const clone = node.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  await inlineCloneImages(node, clone);

  const explicitWidth = Number(options.width) || fallbackSize.width;
  clone.style.width = `${explicitWidth}px`;
  clone.style.maxWidth = `${explicitWidth}px`;
  clone.style.height = 'auto';
  clone.style.minHeight = clone.style.minHeight || `${fallbackSize.height}px`;
  clone.style.overflow = 'visible';

  sandbox.appendChild(clone);
  document.body.appendChild(sandbox);

  await new Promise((resolve) => requestAnimationFrame(() => resolve()));

  const measuredWidth = Number(options.width)
    || clone.scrollWidth
    || clone.offsetWidth
    || clone.getBoundingClientRect().width
    || fallbackSize.width;
  const measuredHeight = Number(options.height)
    || clone.scrollHeight
    || clone.offsetHeight
    || clone.getBoundingClientRect().height
    || fallbackSize.height;

  document.body.removeChild(sandbox);

  return {
    width: Math.max(1, Math.round(measuredWidth)),
    height: Math.max(1, Math.round(measuredHeight))
  };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('分享卡图片编码失败'));
    reader.readAsDataURL(blob);
  });
}

const embeddedImageCache = new Map();

async function fetchImageAsDataUrl(source) {
  if (!source || typeof source !== 'string') {
    return null;
  }

  if (source.startsWith('data:')) {
    return source;
  }

  if (embeddedImageCache.has(source)) {
    return embeddedImageCache.get(source);
  }

  const pending = fetch(source, {
    mode: 'cors',
    credentials: 'omit',
    cache: 'force-cache'
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`分享卡图片拉取失败: ${response.status}`);
      }

      const blob = await response.blob();
      return blobToDataUrl(blob);
    })
    .catch(() => null);

  embeddedImageCache.set(source, pending);
  return pending;
}

async function inlineCloneImages(sourceNode, clonedNode) {
  const sourceImages = Array.from(sourceNode.querySelectorAll('img'));
  const clonedImages = Array.from(clonedNode.querySelectorAll('img'));

  await Promise.all(clonedImages.map(async (cloneImage, index) => {
    const sourceImage = sourceImages[index];
    const source = sourceImage?.currentSrc || sourceImage?.src || cloneImage?.src;
    if (!source) {
      return;
    }

    const embeddedSource = await fetchImageAsDataUrl(source);
    if (embeddedSource) {
      cloneImage.src = embeddedSource;
      cloneImage.removeAttribute('srcset');
    }

    cloneImage.setAttribute('loading', 'eager');
    cloneImage.setAttribute('decoding', 'sync');
    cloneImage.setAttribute('crossorigin', 'anonymous');
  }));
}

export async function renderShareCardToBlob(node, options = {}) {
  if (!node || typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('分享卡节点不可用');
  }

  const { width, height } = await measureRenderedShareCard(node, options);
  const clone = node.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  await inlineCloneImages(node, clone);
  clone.style.width = `${width}px`;
  clone.style.maxWidth = `${width}px`;
  clone.style.height = 'auto';
  clone.style.minHeight = `${height}px`;
  clone.style.overflow = 'visible';

  const serializedNode = new XMLSerializer().serializeToString(clone);
  const svgMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="100%" height="100%">${serializedNode}</foreignObject>
    </svg>
  `;

  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  const image = await loadImageFromUrl(svgUrl);
  const canvas = document.createElement('canvas');
  const pixelRatio = Math.max(window.devicePixelRatio || 1, 2);

  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('分享卡画布不可用');
  }

  context.scale(pixelRatio, pixelRatio);
  context.fillStyle = options.backgroundColor || DEFAULT_SHARE_BACKGROUND;
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });

  if (!blob) {
    throw new Error('分享卡导出失败');
  }

  return blob;
}

export async function renderSimulatorShareCardToBlob(node) {
  return renderShareCardToBlob(node, {
    width: SHARE_CARD_WIDTH,
    backgroundColor: DEFAULT_SHARE_BACKGROUND
  });
}

export function downloadShareCard(blob, fileName = '分享卡.png') {
  if (typeof document === 'undefined' || !blob) {
    return false;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

export function downloadSimulatorShareCard(blob, payload) {
  return downloadShareCard(blob, buildSimulatorShareCardFileName(payload));
}

export function buildShareFile(blob, fileName = '分享卡.png') {
  if (typeof File === 'undefined' || !blob) {
    return null;
  }

  return new File([blob], fileName, {
    type: 'image/png',
  });
}

export function buildSimulatorShareFile(blob, payload) {
  return buildShareFile(blob, buildSimulatorShareCardFileName(payload));
}

export function canNativeShareFile(file) {
  if (!file || typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }

  if (typeof navigator.canShare !== 'function') {
    return false;
  }

  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function canNativeShareSimulatorFile(file) {
  return canNativeShareFile(file);
}

export function canCopyImageToClipboard() {
  if (typeof navigator === 'undefined' || typeof ClipboardItem === 'undefined') {
    return false;
  }

  return Boolean(navigator.clipboard?.write);
}

export async function copyImageBlobToClipboard(blob) {
  if (!blob || !canCopyImageToClipboard()) {
    return false;
  }

  const mimeType = blob.type || 'image/png';
  const clipboardItem = new ClipboardItem({
    [mimeType]: blob
  });

  await navigator.clipboard.write([clipboardItem]);
  return true;
}

export async function shareImageFile(file, options = {}) {
  if (!canNativeShareFile(file)) {
    return false;
  }

  await navigator.share({
    files: [file],
    title: options.title || '终末地分享卡',
    text: options.text || '',
  });

  return true;
}

export async function shareSimulatorShareCardFile(file, payload) {
  return shareImageFile(file, {
    title: `${payload.poolTypeLabel}模拟分享`,
    text: buildSimulatorShareText(payload),
  });
}

export {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
};
