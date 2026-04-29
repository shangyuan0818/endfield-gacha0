import { readFile } from 'node:fs/promises';
import path from 'node:path';

const OFFICIAL_SITE_ORIGIN = 'https://endfield.hypergryph.com';
const OFFICIAL_ANNOUNCEMENT_IMAGE_PROXY_PATH = '/api/official-announcement-image';
const DEFAULT_ANNOUNCEMENT_LLM_BASE_URL = 'https://x666.me/';
const DEFAULT_ANNOUNCEMENT_LLM_MODEL = 'gemini-flash-latest';
const DEFAULT_ANNOUNCEMENT_LLM_RATE_LIMIT_MAX_CALLS = 10;
const DEFAULT_ANNOUNCEMENT_LLM_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const SUMMARY_TRIGGER_TEXT_LENGTH = 1400;
const SUMMARY_INPUT_MAX_LENGTH = 7000;
const SUMMARY_OUTPUT_MAX_TOKENS = 1600;
const SUMMARY_IMAGE_LIMIT = 6;
const SUMMARY_CACHE = new Map();
const LLM_REQUEST_TIMESTAMPS = [];
let llmRequestQueue = Promise.resolve();
let announcementSummaryPromptPromise = null;

const DEFAULT_ANNOUNCEMENT_SUMMARY_PROMPT = [
  '你是终末地官网公告整理助手。',
  '任务：把官方长公告改写成站内可读短简报，不搬运原文长段落。',
  '只允许基于给定原文事实输出，不得补充未出现的信息；官方短摘要与正文重复时以正文为准。',
  '不要逐平台复读规则。',
  '> 以下为站内整理版摘要，细节以官方原文为准。',
  '必须包含“## 摘要”和“## 要点”；有明确时间再加“## 时间”，有奖励/补偿/限制再加“## 注意”。',
  '“摘要”写 1 段，80-160 个汉字；“要点”写 2-5 条，每条只表达一个信息点。',
  '不要重复同一句话或同一意思；不要输出半句话；不要使用“…”或“...”省略结尾。',
  '总长度建议 350-700 个汉字，以完整清晰优先；不要输出表格、代码块或额外结尾。',
].join('\n');

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripHtmlToText(value) {
  return decodeHtmlEntities(
    String(value || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function truncateText(value, maxLength) {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue || normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function parseAnnouncementLlmRateLimit(rawValue) {
  const normalizedValue = normalizeText(rawValue).toLowerCase();
  if (!normalizedValue) {
    return {
      maxCalls: DEFAULT_ANNOUNCEMENT_LLM_RATE_LIMIT_MAX_CALLS,
      windowMs: DEFAULT_ANNOUNCEMENT_LLM_RATE_LIMIT_WINDOW_MS,
    };
  }

  const rpmMatch = /^(\d+)\s*rpm$/iu.exec(normalizedValue);
  if (rpmMatch) {
    return {
      maxCalls: Math.max(1, Number(rpmMatch[1])),
      windowMs: 60 * 1000,
    };
  }

  const leadingWindowMatch = /^(\d+)\s*(ms|s|m|min|minute|minutes|h|hour|hours|分钟|秒|小时)\s*[:/]\s*(\d+)/iu.exec(normalizedValue);
  if (leadingWindowMatch) {
    return {
      maxCalls: Math.max(1, Number(leadingWindowMatch[3])),
      windowMs: parseDurationMs(leadingWindowMatch[1], leadingWindowMatch[2]),
    };
  }

  const callsPerWindowMatch = /(\d+)\s*(?:calls?|次|requests?)?.*?(?:per|每|\/|:)\s*(\d+)\s*(ms|s|m|min|minute|minutes|h|hour|hours|分钟|秒|小时)/iu.exec(normalizedValue);
  if (callsPerWindowMatch) {
    return {
      maxCalls: Math.max(1, Number(callsPerWindowMatch[1])),
      windowMs: parseDurationMs(callsPerWindowMatch[2], callsPerWindowMatch[3]),
    };
  }

  return {
    maxCalls: DEFAULT_ANNOUNCEMENT_LLM_RATE_LIMIT_MAX_CALLS,
    windowMs: DEFAULT_ANNOUNCEMENT_LLM_RATE_LIMIT_WINDOW_MS,
  };
}

function parseDurationMs(value, unit) {
  const amount = Math.max(1, Number(value) || 1);
  const normalizedUnit = normalizeText(unit).toLowerCase();

  if (normalizedUnit === 'ms') {
    return amount;
  }

  if (normalizedUnit === 's' || normalizedUnit === '秒') {
    return amount * 1000;
  }

  if (normalizedUnit === 'h' || normalizedUnit === 'hour' || normalizedUnit === 'hours' || normalizedUnit === '小时') {
    return amount * 60 * 60 * 1000;
  }

  return amount * 60 * 1000;
}

function resolveChatCompletionsUrl(rawValue) {
  const normalizedValue = normalizeText(rawValue) || DEFAULT_ANNOUNCEMENT_LLM_BASE_URL;

  try {
    const parsedUrl = new URL(normalizedValue);
    const normalizedPath = parsedUrl.pathname.replace(/\/+$/u, '');

    if (/\/v1\/chat\/completions$/iu.test(normalizedPath)) {
      return parsedUrl.toString();
    }

    parsedUrl.pathname = /\/v1$/iu.test(normalizedPath)
      ? `${normalizedPath}/chat/completions`
      : `${normalizedPath}/v1/chat/completions`;

    return parsedUrl.toString();
  } catch {
    return normalizedValue;
  }
}

async function waitForLlmRateLimit(rateLimit = {}) {
  const maxCalls = Math.max(
    1,
    Number(rateLimit.maxCalls) || DEFAULT_ANNOUNCEMENT_LLM_RATE_LIMIT_MAX_CALLS
  );
  const windowMs = Math.max(
    1000,
    Number(rateLimit.windowMs) || DEFAULT_ANNOUNCEMENT_LLM_RATE_LIMIT_WINDOW_MS
  );
  const now = Date.now();
  while (LLM_REQUEST_TIMESTAMPS.length > 0
    && now - LLM_REQUEST_TIMESTAMPS[0] >= windowMs) {
    LLM_REQUEST_TIMESTAMPS.shift();
  }

  if (LLM_REQUEST_TIMESTAMPS.length < maxCalls) {
    LLM_REQUEST_TIMESTAMPS.push(now);
    return;
  }

  const waitMs = Math.max(
    0,
    windowMs - (now - LLM_REQUEST_TIMESTAMPS[0]) + 50
  );
  await new Promise(resolve => setTimeout(resolve, waitMs));
  await waitForLlmRateLimit(rateLimit);
}

async function scheduleLlmRequest(task, rateLimit) {
  const currentTask = llmRequestQueue.then(async () => {
    await waitForLlmRateLimit(rateLimit);
    return task();
  });

  llmRequestQueue = currentTask.catch(() => {});
  return currentTask;
}

function extractFirstBulletLine(markdownText) {
  const lines = String(markdownText || '')
    .split(/\n+/)
    .map(line => normalizeText(line.replace(/^[-*]\s*/u, '')))
    .filter(Boolean)
    .filter(line => !line.startsWith('> '))
    .filter(line => !/^##\s/u.test(line));

  return lines[0] || '';
}

function getMarkdownSectionBody(markdownText, heading) {
  const lines = String(markdownText || '').split(/\r?\n/u);
  const targetHeading = normalizeText(heading);
  const sectionLines = [];
  let collecting = false;

  for (const line of lines) {
    const headingMatch = /^##\s+(.+?)\s*$/u.exec(line);
    if (headingMatch) {
      if (collecting) {
        break;
      }

      collecting = normalizeText(headingMatch[1]) === targetHeading;
      continue;
    }

    if (collecting) {
      sectionLines.push(line);
    }
  }

  return normalizeText(sectionLines.join('\n'));
}

function hasCompleteMarkdownSection(markdownText, heading) {
  const sectionBody = getMarkdownSectionBody(markdownText, heading);
  if (!sectionBody) {
    return false;
  }

  return sectionBody
    .split(/\n+/u)
    .map(line => normalizeText(line))
    .some(line => /^[-*]\s+\S/u.test(line) || line.includes('原文未明确说明'));
}

function hasNonEmptyMarkdownSection(markdownText, heading) {
  const sectionBody = getMarkdownSectionBody(markdownText, heading);
  if (!sectionBody) {
    return false;
  }

  return sectionBody
    .split(/\n+/u)
    .map(line => normalizeText(line.replace(/^[-*]\s*/u, '')))
    .some(Boolean);
}

function countMarkdownSectionBullets(markdownText, heading) {
  return getMarkdownSectionBody(markdownText, heading)
    .split(/\n+/u)
    .map(line => normalizeText(line))
    .filter(line => /^[-*]\s+\S/u.test(line))
    .length;
}

function isStructuredSummaryComplete(markdownText) {
  const normalizedText = normalizeText(markdownText);
  if (!normalizedText) {
    return false;
  }

  if (!normalizedText.includes('以下为站内整理版摘要')) {
    return false;
  }

  const hasLegacyStructure = ['核心内容', '重要时间', '影响与建议']
    .every(heading => hasCompleteMarkdownSection(normalizedText, heading));
  const hasBriefStructure = hasNonEmptyMarkdownSection(normalizedText, '摘要')
    && countMarkdownSectionBullets(normalizedText, '要点') >= 2;

  return (hasLegacyStructure || hasBriefStructure) && isStructuredSummaryUseful(normalizedText);
}

function extractStructuredSummaryStatements(markdownText) {
  return String(markdownText || '')
    .split(/\r?\n/u)
    .map(line => normalizeText(line))
    .filter(Boolean)
    .filter(line => !line.startsWith('> '))
    .filter(line => !/^##\s/u.test(line))
    .map(line => normalizeText(line.replace(/^[-*]\s+/u, '')))
    .filter(Boolean);
}

function normalizeBulletFingerprint(value) {
  return normalizeText(value)
    .replace(/^管理员[，,:：]\s*/u, '')
    .replace(/[，,。.；;：:！!？?、\s「」『』《》（）()【】[\]]+/gu, '')
    .slice(0, 56);
}

function areSummaryFingerprintsSimilar(a, b) {
  if (!a || !b) {
    return false;
  }

  if (a === b) {
    return true;
  }

  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 24 && longer.includes(shorter);
}

function isStructuredSummaryUseful(markdownText) {
  const statements = extractStructuredSummaryStatements(markdownText);
  if (statements.length < 3) {
    return false;
  }

  if (statements.some(item => item.length > 220
    || /[…]|\.{3}/u.test(item)
    || /^管理员[，,:：]/u.test(item)
    || /^◆/u.test(item))) {
    return false;
  }

  const seenFingerprints = new Set();
  for (const statement of statements) {
    const fingerprint = normalizeBulletFingerprint(statement);
    if (!fingerprint || fingerprint === '原文未明确说明') {
      continue;
    }

    if (Array.from(seenFingerprints).some(existing => areSummaryFingerprintsSimilar(existing, fingerprint))) {
      return false;
    }
    seenFingerprints.add(fingerprint);
  }

  return true;
}

function buildAnnouncementSummaryText({ title, summary, plainText, structuredSummary }) {
  const normalizedSummary = normalizeText(summary);
  if (normalizedSummary) {
    return truncateText(normalizedSummary, 96);
  }

  const bulletSummary = extractFirstBulletLine(structuredSummary);
  if (bulletSummary) {
    return truncateText(bulletSummary, 96);
  }

  const plainLines = String(plainText || '')
    .split(/\n+/)
    .map(line => normalizeText(line))
    .filter(Boolean)
    .filter(line => line !== normalizeText(title));

  return truncateText(plainLines[0] || normalizeText(title), 96);
}

function absolutizeUrl(rawValue, sourceUrl = OFFICIAL_SITE_ORIGIN) {
  const value = normalizeText(rawValue);
  if (!value) {
    return '';
  }

  if (value === OFFICIAL_ANNOUNCEMENT_IMAGE_PROXY_PATH || value.startsWith(`${OFFICIAL_ANNOUNCEMENT_IMAGE_PROXY_PATH}?`)) {
    return value;
  }

  if (/^(data:|blob:|mailto:|tel:)/i.test(value)) {
    return value;
  }

  if (/^javascript:/i.test(value)) {
    return '';
  }

  try {
    if (value.startsWith('//')) {
      return new URL(`https:${value}`).toString();
    }

    return new URL(value, sourceUrl || OFFICIAL_SITE_ORIGIN).toString();
  } catch {
    return value;
  }
}

function shouldProxyAnnouncementImage(url) {
  try {
    const parsedUrl = new URL(url);
    return /^https?:$/i.test(parsedUrl.protocol);
  } catch {
    return false;
  }
}

export function proxifyAnnouncementImageUrl(rawUrl) {
  const normalizedUrl = absolutizeUrl(rawUrl, OFFICIAL_SITE_ORIGIN);
  if (!normalizedUrl || !shouldProxyAnnouncementImage(normalizedUrl)) {
    return normalizedUrl;
  }

  return `${OFFICIAL_ANNOUNCEMENT_IMAGE_PROXY_PATH}?url=${encodeURIComponent(normalizedUrl)}`;
}

function normalizeImgTag(tag) {
  const srcMatch = /\ssrc=(["'])(.*?)\1/i.exec(tag);
  const fallbackSrcMatch = /\s(?:data-src|data-original|data-origin-src)=(["'])(.*?)\1/i.exec(tag);
  const targetSrc = proxifyAnnouncementImageUrl(srcMatch?.[2] || fallbackSrcMatch?.[2] || '');
  if (!targetSrc) {
    return tag;
  }

  let nextTag = tag;

  if (srcMatch) {
    nextTag = nextTag.replace(srcMatch[0], ` src="${escapeHtml(targetSrc)}"`);
  } else if (fallbackSrcMatch) {
    nextTag = nextTag.replace('<img', `<img src="${escapeHtml(targetSrc)}"`);
  }

  if (!/\sloading=/i.test(nextTag)) {
    nextTag = nextTag.replace('<img', '<img loading="lazy"');
  }

  if (!/\sdecoding=/i.test(nextTag)) {
    nextTag = nextTag.replace('<img', '<img decoding="async"');
  }

  return nextTag;
}

export function normalizeOfficialHtml(html, sourceUrl) {
  const normalizedSourceUrl = absolutizeUrl(sourceUrl || OFFICIAL_SITE_ORIGIN);
  return String(html || '')
    .replace(/<img\b[^>]*>/gi, (tag) => normalizeImgTag(tag))
    .replace(/\s(href|src)=(["'])(.*?)\2/gi, (match, attribute, quote, value) => {
      const resolved = absolutizeUrl(value, normalizedSourceUrl);
      return resolved ? ` ${attribute}=${quote}${escapeHtml(resolved)}${quote}` : match;
    });
}

export function extractImageUrlsFromHtml(html, sourceUrl) {
  const normalizedHtml = normalizeOfficialHtml(html, sourceUrl);
  const matches = Array.from(normalizedHtml.matchAll(/<img\b[^>]*\ssrc=(["'])(.*?)\1/gi));
  const urls = matches
    .map((match) => normalizeText(match[2]))
    .filter(Boolean);

  return Array.from(new Set(urls));
}

function buildImageGalleryMarkdown(imageUrls = []) {
  const visibleImages = imageUrls.slice(0, SUMMARY_IMAGE_LIMIT);
  if (visibleImages.length === 0) {
    return '';
  }

  const lines = [
    '## 原公告配图',
    ...visibleImages.map((url, index) => `![公告配图 ${index + 1}](${proxifyAnnouncementImageUrl(url)})`),
  ];

  if (imageUrls.length > visibleImages.length) {
    lines.push(`- 其余 ${imageUrls.length - visibleImages.length} 张图片请查看官方原文。`);
  }

  return lines.join('\n');
}

function normalizeSummaryCandidate(value) {
  return normalizeText(value)
    .replace(/^[-*•◆]\s*/u, '')
    .replace(/^▼\/{2}\s*/u, '')
    .replace(/^■\s*/u, '')
    .replace(/^亲爱的?管理员[：:,，]?\s*/u, '')
    .replace(/^管理员[：:,，]\s*/u, '')
    .replace(/[▼◆■●]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function ensureSentencePunctuation(value) {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) {
    return '';
  }

  return /[。！？；）】]$/u.test(normalizedValue)
    ? normalizedValue
    : `${normalizedValue}。`;
}

function compactSummaryPoint(value, maxLength) {
  const normalizedValue = normalizeSummaryCandidate(value)
    .replace(/[…]|\.{3}/gu, '')
    .trim();
  if (!normalizedValue) {
    return '';
  }

  if (normalizedValue.length <= maxLength) {
    return ensureSentencePunctuation(normalizedValue);
  }

  const punctuationMatches = Array.from(normalizedValue.matchAll(/[。！？；]/gu))
    .map(match => Number(match.index) + 1)
    .filter(index => index >= 28 && index <= maxLength);
  if (punctuationMatches.length > 0) {
    return normalizedValue.slice(0, punctuationMatches.at(-1)).trim();
  }

  const softBreakMatches = Array.from(normalizedValue.matchAll(/[，、：:]/gu))
    .map(match => Number(match.index) + 1)
    .filter(index => index >= 36 && index <= maxLength - 1);
  if (softBreakMatches.length > 0) {
    return ensureSentencePunctuation(normalizedValue.slice(0, softBreakMatches.at(-1)).trim());
  }

  return '';
}

function splitSummaryCandidates(plainText) {
  return String(plainText || '')
    .split(/\n+|(?<=[。！？；])/u)
    .map(normalizeSummaryCandidate)
    .filter(line => line.length >= 8)
    .filter(line => !/^返回|^首页|^更多|^分享|^点击/u.test(line));
}

function collectUniqueSummaryPoints(candidates, limit, maxLength) {
  const points = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const point = compactSummaryPoint(candidate, maxLength);
    const fingerprint = normalizeBulletFingerprint(point);
    if (!fingerprint || seen.has(fingerprint)) {
      continue;
    }

    seen.add(fingerprint);
    points.push(point);
    if (points.length >= limit) {
      break;
    }
  }

  return points;
}

function buildHeuristicStructuredSummary({
  summary,
  plainText,
}) {
  const candidates = splitSummaryCandidates(plainText);
  const normalizedSummary = normalizeSummaryCandidate(summary);

  const coreCandidates = [
    normalizedSummary,
    ...candidates.filter(line => /(活动|公告|版本|寻访|卡池|维护|征集|奖励|补偿|更新)/u.test(line)),
    ...candidates,
  ].filter(Boolean);
  const corePoints = collectUniqueSummaryPoints(coreCandidates, 5, 140);

  const timelineLines = collectUniqueSummaryPoints(
    candidates.filter(line => /(\d{4}[年/-]\d{1,2}|\d{1,2}[月/-]\d{1,2}|\d{1,2}:\d{2}|时间|开放|开启|关闭|截止|结束|维护|版本)/u.test(line)),
    3,
    120
  );

  const actionLines = collectUniqueSummaryPoints(
    candidates.filter(line => /(范围|条件|奖励|补偿|领取|解锁|参与|概率|提升|说明|注意|建议|前往|查看|确认)/u.test(line)),
    3,
    120
  );

  const brief = compactSummaryPoint(corePoints[0] || normalizedSummary || candidates[0], 160)
    || '这是一则官方游戏公告，包含版本、活动或运营相关信息。';
  const keyPoints = corePoints.filter(point => normalizeBulletFingerprint(point) !== normalizeBulletFingerprint(brief));
  let displayKeyPoints = keyPoints.length >= 2
    ? keyPoints.slice(0, 5)
    : [...keyPoints, ...collectUniqueSummaryPoints(candidates, 5, 140)]
      .filter((point, index, list) => list.findIndex(item => normalizeBulletFingerprint(item) === normalizeBulletFingerprint(point)) === index)
      .filter(point => normalizeBulletFingerprint(point) !== normalizeBulletFingerprint(brief))
      .slice(0, 5);
  if (displayKeyPoints.length < 2) {
    displayKeyPoints = [
      ...displayKeyPoints,
      '如需确认完整规则、奖励、限制或后续调整，请以官方原文为准。',
      '站内摘要仅保留关键信息，公告配图与详细条款仍可在原文查看。',
    ].slice(0, 2);
  }

  const sections = [
    '> 以下为站内整理版摘要，细节以官方原文为准。',
    '',
    '## 摘要',
    brief,
    '',
    '## 要点',
    ...(displayKeyPoints.length > 0 ? displayKeyPoints.map(item => `- ${item}`) : ['- 完整规则与细节请以官方原文为准。']),
  ];

  if (timelineLines.length > 0) {
    sections.push('', '## 时间', ...timelineLines.map(item => `- ${item}`));
  }

  if (actionLines.length > 0) {
    sections.push('', '## 注意', ...actionLines.map(item => `- ${item}`));
  }

  return sections.join('\n');
}

async function readFirstExistingFile(filePaths = []) {
  for (const filePath of filePaths) {
    try {
      return await readFile(filePath, 'utf8');
    } catch {
      // ignore
    }
  }

  return '';
}

async function loadAnnouncementSummaryPrompt() {
  if (!announcementSummaryPromptPromise) {
    announcementSummaryPromptPromise = readFirstExistingFile([
      new URL('./announcement-summary-prompt.md', import.meta.url),
      path.resolve(process.cwd(), 'api', '_lib', 'announcement-summary-prompt.md'),
      path.resolve(process.cwd(), 'gacha-analyzer', 'api', '_lib', 'announcement-summary-prompt.md'),
    ]).then(content => normalizeText(content) || DEFAULT_ANNOUNCEMENT_SUMMARY_PROMPT);
  }

  return announcementSummaryPromptPromise;
}

async function loadAnnouncementLlmConfig(env = process.env) {
  const envApiKey = normalizeText(
    env.ANNOUNCEMENT_LLM_API_KEY
    || env.SILICONFLOW_API_KEY
    || env.SILICONFLOW_APIKEY
  );
  const envModel = normalizeText(
    env.ANNOUNCEMENT_LLM_MODEL
    || env.SILICONFLOW_MODEL
    || env.SILICONFLOW_CHAT_MODEL
  );
  const envBaseUrl = normalizeText(
    env.ANNOUNCEMENT_LLM_BASE_URL
    || env.SILICONFLOW_BASE_URL
    || env.SILICONFLOW_API_URL
  );
  const envRateLimit = normalizeText(
    env.ANNOUNCEMENT_LLM_RATE_LIMIT
    || env.SILICONFLOW_RATE_LIMIT
  );

  if (envApiKey) {
    return {
      apiKey: envApiKey,
      model: envModel || DEFAULT_ANNOUNCEMENT_LLM_MODEL,
      url: resolveChatCompletionsUrl(envBaseUrl || DEFAULT_ANNOUNCEMENT_LLM_BASE_URL),
      rateLimit: parseAnnouncementLlmRateLimit(envRateLimit),
    };
  }

  const configText = await readFirstExistingFile([
    path.resolve(process.cwd(), '.secrets', 'siliconflow.local'),
    path.resolve(process.cwd(), '.secrets', 'siliconflow-api-key.local'),
    path.resolve(process.cwd(), '..', 'hybgyz.api.secret'),
  ]);

  const configLines = configText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const configEntries = Object.fromEntries(
    configLines
      .filter(line => !line.startsWith('#'))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        if (separatorIndex <= 0) {
          return [line, ''];
        }

        const key = normalizeText(line.slice(0, separatorIndex));
        const value = normalizeText(line.slice(separatorIndex + 1));
        return [key, value];
      })
  );

  const apiKey = normalizeText(
    configEntries.ANNOUNCEMENT_LLM_API_KEY
    || configEntries.SILICONFLOW_API_KEY
    || configEntries.SILICONFLOW_APIKEY
    || configLines.find(line => /^sk-/i.test(line))
  );
  const model = normalizeText(
    configEntries.ANNOUNCEMENT_LLM_MODEL
    || configEntries.SILICONFLOW_MODEL
    || configEntries.SILICONFLOW_CHAT_MODEL
    || configLines.find(line => line.includes('/'))
  ) || DEFAULT_ANNOUNCEMENT_LLM_MODEL;
  const baseUrl = normalizeText(
    configEntries.ANNOUNCEMENT_LLM_BASE_URL
    || configEntries.SILICONFLOW_BASE_URL
    || configEntries.SILICONFLOW_API_URL
    || configLines.find(line => /^https?:\/\//i.test(line))
  ) || DEFAULT_ANNOUNCEMENT_LLM_BASE_URL;
  const rateLimit = normalizeText(
    configEntries.ANNOUNCEMENT_LLM_RATE_LIMIT
    || configEntries.SILICONFLOW_RATE_LIMIT
  );

  return {
    apiKey,
    model,
    url: resolveChatCompletionsUrl(baseUrl),
    rateLimit: parseAnnouncementLlmRateLimit(rateLimit),
  };
}

async function summarizeWithAnnouncementLlm({
  title,
  summary,
  plainText,
  sourceUrl,
  publishedAt,
  fetchImpl = globalThis.fetch,
  env = process.env,
  bypassCache = false,
}) {
  const config = await loadAnnouncementLlmConfig(env);
  if (!config.apiKey || typeof fetchImpl !== 'function') {
    return null;
  }

  const systemPrompt = await loadAnnouncementSummaryPrompt();
  const cacheKey = JSON.stringify({
    title,
    summary,
    sourceUrl,
    publishedAt,
    model: config.model,
    url: config.url,
    prompt: systemPrompt,
    text: plainText.slice(0, SUMMARY_INPUT_MAX_LENGTH),
  });

  if (!bypassCache && SUMMARY_CACHE.has(cacheKey)) {
    return SUMMARY_CACHE.get(cacheKey);
  }

  const promptText = truncateText(plainText, SUMMARY_INPUT_MAX_LENGTH);
  const response = await scheduleLlmRequest(() => fetchImpl(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      max_tokens: SUMMARY_OUTPUT_MAX_TOKENS,
      stream: false,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            `标题：${title}`,
            `站内摘要：${summary || '无'}`,
            `发布时间：${publishedAt || '未提供'}`,
            `原文链接：${sourceUrl || '未提供'}`,
            '原文正文：',
            promptText || '无正文',
          ].join('\n'),
        },
      ],
    }),
  }), config.rateLimit);

  if (!response.ok) {
    throw new Error(`Announcement LLM returned ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const choice = payload?.choices?.[0];
  const finishReason = normalizeText(choice?.finish_reason || choice?.finishReason).toLowerCase();
  if (finishReason.includes('length') || finishReason.includes('max_token')) {
    SUMMARY_CACHE.set(cacheKey, null);
    return null;
  }

  const content = normalizeText(choice?.message?.content);
  if (!isStructuredSummaryComplete(content)) {
    SUMMARY_CACHE.set(cacheKey, null);
    return null;
  }

  SUMMARY_CACHE.set(cacheKey, content || null);
  return content || null;
}

function shouldSummarizeAnnouncement({ title, plainText }) {
  return normalizeText(plainText).length >= SUMMARY_TRIGGER_TEXT_LENGTH
    || normalizeText(title).includes('版本更新说明');
}

export async function buildAnnouncementDisplayContent({
  title,
  summary,
  rawHtml,
  sourceUrl,
  publishedAt,
  fetchImpl = globalThis.fetch,
  env = process.env,
  allowLlm = false,
  bypassLlmCache = false,
}) {
  const normalizedRawHtml = normalizeOfficialHtml(rawHtml, sourceUrl);
  const plainText = stripHtmlToText(normalizedRawHtml);
  const imageUrls = extractImageUrlsFromHtml(normalizedRawHtml, sourceUrl);

  if (!shouldSummarizeAnnouncement({ title, plainText })) {
    return {
      content: normalizedRawHtml,
      rawContent: normalizedRawHtml,
      imageUrls,
      summaryMode: 'raw',
      summaryText: buildAnnouncementSummaryText({
        title,
        summary,
        plainText,
        structuredSummary: null,
      }),
    };
  }

  let structuredSummary = null;
  if (allowLlm) {
    try {
      structuredSummary = await summarizeWithAnnouncementLlm({
        title,
        summary,
        plainText,
        sourceUrl,
        publishedAt,
        fetchImpl,
        env,
        bypassCache: bypassLlmCache,
      });
    } catch {
      structuredSummary = null;
    }
  }

  const fallbackSummary = buildHeuristicStructuredSummary({
    summary,
    plainText,
  });

  const displayContent = [
    structuredSummary || fallbackSummary,
    buildImageGalleryMarkdown(imageUrls),
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    content: displayContent,
    rawContent: normalizedRawHtml,
    imageUrls,
    summaryMode: structuredSummary ? 'llm' : 'heuristic',
    summaryText: buildAnnouncementSummaryText({
      title,
      summary,
      plainText,
      structuredSummary: structuredSummary || fallbackSummary,
    }),
  };
}

export const __internal = {
  DEFAULT_ANNOUNCEMENT_LLM_RATE_LIMIT_MAX_CALLS,
  DEFAULT_ANNOUNCEMENT_LLM_RATE_LIMIT_WINDOW_MS,
  DEFAULT_ANNOUNCEMENT_LLM_BASE_URL,
  DEFAULT_ANNOUNCEMENT_LLM_MODEL,
  OFFICIAL_SITE_ORIGIN,
  OFFICIAL_ANNOUNCEMENT_IMAGE_PROXY_PATH,
  SUMMARY_TRIGGER_TEXT_LENGTH,
  absolutizeUrl,
  buildHeuristicStructuredSummary,
  extractImageUrlsFromHtml,
  loadAnnouncementLlmConfig,
  loadAnnouncementSummaryPrompt,
  normalizeOfficialHtml,
  parseAnnouncementLlmRateLimit,
  proxifyAnnouncementImageUrl,
  resolveChatCompletionsUrl,
  isStructuredSummaryComplete,
  shouldSummarizeAnnouncement,
  stripHtmlToText,
};
