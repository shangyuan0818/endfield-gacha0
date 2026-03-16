const SHARE_CARD_WIDTH = 1200;
const SHARE_CARD_HEIGHT = 630;
const SHARE_CARD_FILE_PREFIX = '终末地模拟器分享卡';

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
  return `${SHARE_CARD_FILE_PREFIX}_${safePoolLabel}.png`;
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

export async function renderSimulatorShareCardToBlob(node) {
  if (!node || typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('分享卡节点不可用');
  }

  const width = SHARE_CARD_WIDTH;
  const height = SHARE_CARD_HEIGHT;
  const clone = node.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

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
  context.fillStyle = '#0a0a0b';
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

export function downloadSimulatorShareCard(blob, payload) {
  if (typeof document === 'undefined' || !blob) {
    return false;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildSimulatorShareCardFileName(payload);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

export function buildSimulatorShareFile(blob, payload) {
  if (typeof File === 'undefined' || !blob) {
    return null;
  }

  return new File([blob], buildSimulatorShareCardFileName(payload), {
    type: 'image/png',
  });
}

export function canNativeShareSimulatorFile(file) {
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

export async function shareSimulatorShareCardFile(file, payload) {
  if (!canNativeShareSimulatorFile(file)) {
    return false;
  }

  await navigator.share({
    files: [file],
    title: `${payload.poolTypeLabel}模拟分享`,
    text: buildSimulatorShareText(payload),
  });

  return true;
}

export {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
};
