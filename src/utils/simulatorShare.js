import {
  SHARE_BRAND_LINK,
  SHARE_CARD_EXPORT_PIXEL_RATIO,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH
} from './shareBranding.js';
import { formatOriginiteEquivalent } from './resourceEconomy.js';
import { formatAppNumber, getAppLocale, getMessage, isEnglishLocale } from '../i18n/index.js';
import { localizeEntityName, localizePoolName } from './gameDataI18n.js';

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

function getPoolTypeLabel(poolType, locale = getAppLocale()) {
  const english = isEnglishLocale(locale);
  if (poolType === 'limited') {
    return english ? 'Limited Banner' : '限定寻访';
  }

  if (poolType === 'weapon') {
    return english ? 'Weapon Banner' : '武器寻访';
  }

  return english ? 'Standard Banner' : '常驻寻访';
}

function buildResourceItems(resources, locale = getAppLocale()) {
  const english = isEnglishLocale(locale);
  if (!resources) {
    return [];
  }

  return [
    {
      id: 'jade-spent',
      label: english ? 'Oroberyl Spent' : '耗金玉',
      value: formatAppNumber(normalizeNumber(resources.jadeSpent), locale),
      hint: english ? 'Character banner cost' : '角色池计费'
    },
    {
      id: 'originite-equivalent',
      label: english ? 'Origeometry Equivalent' : '衍质折金玉',
      value: formatOriginiteEquivalent(resources.originiteEquivalent || 0),
      hint: english ? 'Current conversion rate' : '按当前换算比例'
    },
    {
      id: 'arsenal-gained',
      label: english ? 'Arsenal Tickets Gained' : '得武库配额',
      value: formatAppNumber(normalizeNumber(resources.arsenalGained), locale),
      hint: english ? 'Converted from 4★ / 5★ / 6★' : '4★ / 5★ / 6★ 转化'
    },
    {
      id: 'arsenal-spent',
      label: english ? 'Arsenal Tickets Spent' : '耗武库配额',
      value: formatAppNumber(normalizeNumber(resources.arsenalSpent), locale),
      hint: english ? 'Weapon banner cost' : '武器池计费'
    }
  ];
}

function buildGuaranteeProgress(poolType, totalPulls, pityInfoWithGuarantee, locale = getAppLocale()) {
  const english = isEnglishLocale(locale);
  if (poolType === 'limited') {
    const current = Math.min(
      normalizeNumber(pityInfoWithGuarantee?.guaranteedUp?.current, totalPulls),
      120
    );
    const achieved = Boolean(pityInfoWithGuarantee?.guaranteedUp?.hasReceived);

    return {
      label: english ? 'Limited guaranteed within 120 pulls' : '120抽必出限定',
      current,
      target: 120,
      achieved,
      summary: achieved ? (english ? 'Completed' : '已达成') : `${current}/120`,
    };
  }

  if (poolType === 'weapon') {
    const current = Math.min(
      normalizeNumber(pityInfoWithGuarantee?.guaranteedUp?.current, totalPulls),
      80
    );
    const achieved = Boolean(pityInfoWithGuarantee?.guaranteedUp?.hasReceived);

    return {
      label: english ? 'First-round limited guaranteed within 80 pulls' : '80抽首轮限定必出',
      current,
      target: 80,
      achieved,
      summary: achieved ? (english ? 'Completed' : '已达成') : `${current}/80`,
    };
  }

  const current = Math.min(totalPulls, 300);
  const achieved = totalPulls >= 300;

  return {
    label: english ? '300-pull selector progress' : '300抽自选进度',
    current,
    target: 300,
    achieved,
    summary: achieved ? (english ? 'Completed' : '已达成') : `${current}/300`,
  };
}

export function buildSimulatorSharePayload({
  currentPoolObj,
  dashboardStats,
  pityInfoWithGuarantee,
  resourceLedger,
} = {}, locale = getAppLocale()) {
  const poolType = currentPoolObj?.type || 'limited';
  const totalPulls = normalizeNumber(dashboardStats?.total);
  const sixStarCount = normalizeNumber(dashboardStats?.sixStarCount);
  const fiveStarCount = normalizeNumber(dashboardStats?.counts?.[5]);
  const upSixStarCount = normalizeNumber(dashboardStats?.upSixStarCount);
  const sixStarRate = totalPulls > 0 ? roundRate((sixStarCount / totalPulls) * 100) : '0.00';
  const fiveStarRate = totalPulls > 0 ? roundRate((fiveStarCount / totalPulls) * 100) : '0.00';
  const avgPullCost6 = parseFloat(dashboardStats?.avgPullCost?.[6]) || 0;
  const avgPullsPerSixStar = avgPullCost6 > 0 ? roundAverage(avgPullCost6) : '0.00';
  const hasUpMetrics = poolType === 'limited' || poolType === 'weapon';

  return {
    poolType,
    poolTypeLabel: getPoolTypeLabel(poolType, locale),
    poolName: currentPoolObj
      ? localizePoolName(currentPoolObj, { locale, poolType: poolType, upCharacter: currentPoolObj?.up_character })
      : (isEnglishLocale(locale) ? 'No pool selected' : '未选择卡池'),
    upCharacter: localizeEntityName(currentPoolObj?.up_character || null, {
      locale,
      type: poolType === 'weapon' ? 'weapon' : 'character'
    }) || null,
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
    guaranteeProgress: buildGuaranteeProgress(poolType, totalPulls, pityInfoWithGuarantee, locale),
    resourceItems: buildResourceItems(resourceLedger, locale),
  };
}

export function buildSimulatorShareText(payload, locale = getAppLocale()) {
  const english = isEnglishLocale(locale);
  if (!payload) {
    return '';
  }

  const lines = [
    getMessage('share.simulator.scope', { scope: payload.poolTypeLabel }, locale),
    getMessage('share.card.desensitized', {}, locale),
    '',
    `${english ? 'Pool' : '当前卡池'}：${payload.poolName}`,
    `${english ? 'Total Pulls' : '总抽数'}：${payload.totalPulls}`,
    `6★：${payload.sixStarCount} (${payload.sixStarRate}%)`,
    `5★：${payload.fiveStarCount} (${payload.fiveStarRate}%)`,
  ];

  if (payload.upCharacter) {
    lines.push(`${english ? 'Current UP' : '当前UP'}：${payload.upCharacter}`);
  }

  if (payload.upSixStarCount !== null) {
    lines.push(`UP 6★：${payload.upSixStarCount}`);
  }

  if (payload.winRate !== null) {
    lines.push(`${english ? 'Target Rate' : '不歪率'}：${payload.winRate}%`);
  }

  lines.push(`${english ? 'Average' : '平均出货'}：${payload.avgPullsPerSixStar} ${english ? `pulls/${payload.poolType === 'standard' ? '6★' : 'UP'}` : `抽/${payload.poolType === 'standard' ? '6★' : 'UP'}`}`);
  lines.push(`${english ? 'Current Pity' : '当前保底'}：6★ ${payload.currentPity6} / 5★ ${payload.currentPity5}`);
  lines.push(`${payload.guaranteeProgress.label}：${payload.guaranteeProgress.summary}`);

  if (Array.isArray(payload.resourceItems) && payload.resourceItems.length > 0) {
    payload.resourceItems.forEach((item) => {
      lines.push(`${item.label}：${item.value}${item.hint ? `（${item.hint}）` : ''}`);
    });
  }

  lines.push('');
  lines.push(getMessage('share.simulator.from', {}, locale));
  lines.push(getMessage('share.site', { value: SHARE_BRAND_LINK }, locale));
  lines.push(getMessage('share.simulator.noteDesensitized', {}, locale));

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

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('分享卡图片编码失败'));
    reader.readAsDataURL(blob);
  });
}

function absolutizeCssUrls(cssText, baseHref = document.baseURI) {
  return cssText.replace(/url\((['"]?)([^'")]+)\1\)/g, (match, quote, rawUrl) => {
    const trimmedUrl = String(rawUrl || '').trim();
    if (!trimmedUrl || /^(data:|blob:|https?:|#)/i.test(trimmedUrl)) {
      return match;
    }

    try {
      return `url("${new URL(trimmedUrl, baseHref).href}")`;
    } catch {
      return match;
    }
  });
}

const embeddedCssAssetCache = new Map();
const documentFontFaceCssCache = new Map();

async function fetchCssAssetAsDataUrl(url) {
  if (!url) {
    return '';
  }

  const cached = embeddedCssAssetCache.get(url);
  if (cached) {
    return cached;
  }

  const pending = (async () => {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      cache: 'force-cache'
    });

    if (!response.ok) {
      throw new Error(`${response.status}`);
    }

    const blob = await response.blob();
    return blobToDataUrl(blob);
  })();

  embeddedCssAssetCache.set(url, pending);

  try {
    const dataUrl = await pending;
    embeddedCssAssetCache.set(url, dataUrl);
    return dataUrl;
  } catch (error) {
    embeddedCssAssetCache.delete(url);
    throw error;
  }
}

async function inlineCssAssetUrls(cssText, baseHref = document.baseURI) {
  const matches = Array.from(cssText.matchAll(/url\((['"]?)([^'")]+)\1\)/g));
  if (matches.length === 0) {
    return cssText;
  }

  const replacements = await Promise.all(matches.map(async ([match, , rawUrl]) => {
    const trimmedUrl = String(rawUrl || '').trim();
    if (!trimmedUrl || /^(data:|blob:|#)/i.test(trimmedUrl)) {
      return [match, match];
    }

    let absoluteUrl;
    try {
      absoluteUrl = new URL(trimmedUrl, baseHref).href;
    } catch {
      return [match, match];
    }

    try {
      const dataUrl = await fetchCssAssetAsDataUrl(absoluteUrl);
      return [match, `url("${dataUrl}")`];
    } catch {
      return [match, `url("${absoluteUrl}")`];
    }
  }));

  return replacements.reduce((result, [from, to]) => result.replace(from, to), cssText);
}

function normalizeFontFamilyName(value = '') {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '');
}

function extractFontFamilyNames(fontStack = '') {
  return String(fontStack || '')
    .split(',')
    .map((part) => normalizeFontFamilyName(part))
    .filter(Boolean);
}

function collectTextCodePoints(text = '') {
  return Array.from(new Set(Array.from(String(text || '')).map((char) => char.codePointAt(0)).filter(Number.isFinite)));
}

function parseUnicodeRangeSegment(segment = '') {
  const match = String(segment || '').trim().match(/^U\+([0-9A-F?]+)(?:-([0-9A-F?]+))?$/i);
  if (!match) {
    return null;
  }

  const [, startRaw, endRaw] = match;
  if (startRaw.includes('?') || (endRaw && endRaw.includes('?'))) {
    return null;
  }

  const start = Number.parseInt(startRaw, 16);
  const end = Number.parseInt(endRaw || startRaw, 16);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }

  return { start, end };
}

function unicodeRangeMatchesCodePoints(rangeText = '', codePoints = []) {
  if (!rangeText || codePoints.length === 0) {
    return true;
  }

  const ranges = String(rangeText || '')
    .split(',')
    .map(parseUnicodeRangeSegment)
    .filter(Boolean);

  if (ranges.length === 0) {
    return true;
  }

  return codePoints.some((codePoint) => ranges.some((range) => codePoint >= range.start && codePoint <= range.end));
}

async function collectDocumentFontFaceCss({ familyNames = [], textContent = '' } = {}) {
  if (typeof document === 'undefined' || typeof CSSRule === 'undefined') {
    return '';
  }

  const familyNameSet = new Set(familyNames.map(normalizeFontFamilyName).filter(Boolean));
  const textCodePoints = collectTextCodePoints(textContent);
  const fontFaceRules = [];

  for (const sheet of Array.from(document.styleSheets || [])) {
    let cssRules;
    try {
      cssRules = sheet.cssRules;
    } catch {
      continue;
    }

    const baseHref = sheet.href || document.baseURI;
    for (const rule of Array.from(cssRules || [])) {
      if (rule?.type === CSSRule.FONT_FACE_RULE) {
        const familyName = normalizeFontFamilyName(rule.style?.getPropertyValue('font-family'));
        if (familyNameSet.size > 0 && !familyNameSet.has(familyName)) {
          continue;
        }

        const unicodeRange = rule.style?.getPropertyValue('unicode-range') || '';
        if (!unicodeRangeMatchesCodePoints(unicodeRange, textCodePoints)) {
          continue;
        }

        const cssText = absolutizeCssUrls(rule.cssText, baseHref);
        fontFaceRules.push(await inlineCssAssetUrls(cssText, baseHref));
      }
    }
  }

  return fontFaceRules.join('\n');
}

async function collectCachedDocumentFontFaceCss(options = {}) {
  const cacheKey = JSON.stringify({
    familyNames: [...new Set((options.familyNames || []).map(normalizeFontFamilyName).filter(Boolean))].sort(),
    textContent: String(options.textContent || '')
  });
  const cached = documentFontFaceCssCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = collectDocumentFontFaceCss(options).catch((error) => {
    documentFontFaceCssCache.delete(cacheKey);
    throw error;
  });
  documentFontFaceCssCache.set(cacheKey, pending);
  return pending;
}

const TRANSPARENT_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualzQAAAABJRU5ErkJggg==';
const embeddedImageCache = new Map();

async function fetchImageOnce(source) {
  const response = await fetch(source, {
    mode: 'cors',
    credentials: 'omit',
    cache: 'force-cache'
  });
  if (!response.ok) {
    throw new Error(`${response.status}`);
  }
  const blob = await response.blob();
  return blobToDataUrl(blob);
}

async function fetchImageAsDataUrl(source) {
  if (!source || typeof source !== 'string') {
    return TRANSPARENT_PIXEL;
  }

  if (source.startsWith('data:')) {
    return source;
  }

  const cached = embeddedImageCache.get(source);
  if (cached) {
    return cached;
  }

  const pending = (async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const dataUrl = await fetchImageOnce(source);
        embeddedImageCache.set(source, dataUrl);
        return dataUrl;
      } catch {
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 300));
        }
      }
    }
    embeddedImageCache.delete(source);
    return TRANSPARENT_PIXEL;
  })();

  embeddedImageCache.set(source, pending);
  return pending;
}

async function inlineCloneImages(sourceNode, clonedNode) {
  const sourceImages = Array.from(sourceNode.querySelectorAll('img'));
  const clonedImages = Array.from(clonedNode.querySelectorAll('img'));

  await Promise.all(clonedImages.map(async (cloneImage, index) => {
    const sourceImage = sourceImages[index];
    const source = sourceImage?.currentSrc || sourceImage?.src || cloneImage?.src;

    const embeddedSource = await fetchImageAsDataUrl(source);
    cloneImage.src = embeddedSource;
    cloneImage.removeAttribute('srcset');
    cloneImage.setAttribute('loading', 'eager');
    cloneImage.setAttribute('decoding', 'sync');
    cloneImage.setAttribute('crossorigin', 'anonymous');
  }));
}

export async function renderShareCardToBlob(node, options = {}) {
  if (!node || typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('分享卡节点不可用');
  }

  const { width, height } = resolveShareCardSize(node, options);
  const clone = node.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  await inlineCloneImages(node, clone);
  clone.style.width = `${width}px`;
  clone.style.maxWidth = `${width}px`;
  clone.style.height = 'auto';
  clone.style.minHeight = `${height}px`;
  clone.style.overflow = 'visible';

  const serializedNode = new XMLSerializer().serializeToString(clone);
  const fontFamilyNames = [
    ...extractFontFamilyNames(node.style?.getPropertyValue('--share-font-sans')),
    ...extractFontFamilyNames(node.style?.getPropertyValue('--share-font-mono')),
  ];
  const fontFaceCss = await collectCachedDocumentFontFaceCss({
    familyNames: fontFamilyNames,
    textContent: node.textContent || ''
  });
  const svgMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${fontFaceCss ? `<defs><style><![CDATA[${fontFaceCss}]]></style></defs>` : ''}
      <foreignObject width="100%" height="100%">${serializedNode}</foreignObject>
    </svg>
  `;

  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  const image = await loadImageFromUrl(svgUrl);
  const canvas = document.createElement('canvas');
  const pixelRatio = Math.max(
    Number(options.pixelRatio) || SHARE_CARD_EXPORT_PIXEL_RATIO,
    window.devicePixelRatio || 1,
    2
  );

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
    backgroundColor: DEFAULT_SHARE_BACKGROUND,
    pixelRatio: SHARE_CARD_EXPORT_PIXEL_RATIO
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

export function isFirefoxBrowser() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent || '';
  return /firefox\/\d+/i.test(userAgent) && !/seamonkey/i.test(userAgent);
}

export async function copyImageBlobToClipboard(blob) {
  if (!blob || !canCopyImageToClipboard()) {
    return false;
  }

  const mimeType = blob.type || 'image/png';
  const createClipboardItem = () => new ClipboardItem({
    [mimeType]: Promise.resolve(blob)
  });

  try {
    await navigator.clipboard.write([createClipboardItem()]);
    return true;
  } catch (firstError) {
    // Some browsers fail the first clipboard image write right after the
    // user gesture / permission handoff, while an immediate second attempt works.
    await new Promise((resolve) => setTimeout(resolve, 120));
    try {
      await navigator.clipboard.write([createClipboardItem()]);
      return true;
    } catch {
      throw firstError;
    }
  }
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

export async function shareSimulatorShareCardFile(file, payload, locale = getAppLocale()) {
  return shareImageFile(file, {
    title: getMessage('share.simulator.scope', { scope: payload.poolTypeLabel }, locale),
    text: buildSimulatorShareText(payload, locale),
  });
}

export {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
};
