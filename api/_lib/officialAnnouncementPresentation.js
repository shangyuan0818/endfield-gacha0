import { readFile } from 'node:fs/promises';
import path from 'node:path';

const OFFICIAL_SITE_ORIGIN = 'https://endfield.hypergryph.com';
const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const DEFAULT_SILICONFLOW_MODEL = 'deepseek-ai/DeepSeek-V3.2';
const SUMMARY_TRIGGER_TEXT_LENGTH = 1400;
const SUMMARY_INPUT_MAX_LENGTH = 7000;
const SUMMARY_IMAGE_LIMIT = 6;
const SUMMARY_CACHE = new Map();

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

function absolutizeUrl(rawValue, sourceUrl = OFFICIAL_SITE_ORIGIN) {
  const value = normalizeText(rawValue);
  if (!value) {
    return '';
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

function normalizeImgTag(tag, sourceUrl) {
  const srcMatch = /\ssrc=(["'])(.*?)\1/i.exec(tag);
  const fallbackSrcMatch = /\s(?:data-src|data-original|data-origin-src)=(["'])(.*?)\1/i.exec(tag);
  const targetSrc = absolutizeUrl(srcMatch?.[2] || fallbackSrcMatch?.[2] || '', sourceUrl);
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
    .replace(/<img\b[^>]*>/gi, (tag) => normalizeImgTag(tag, normalizedSourceUrl))
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
    ...visibleImages.map((url, index) => `![公告配图 ${index + 1}](${url})`),
  ];

  if (imageUrls.length > visibleImages.length) {
    lines.push(`- 其余 ${imageUrls.length - visibleImages.length} 张图片请查看官方原文。`);
  }

  return lines.join('\n');
}

function buildHeuristicStructuredSummary({
  summary,
  plainText,
}) {
  const lines = plainText
    .split(/\n+/)
    .map(line => normalizeText(line))
    .filter(Boolean);

  const corePoints = [];
  if (normalizeText(summary)) {
    corePoints.push(normalizeText(summary));
  }

  lines.forEach((line) => {
    if (corePoints.length >= 4) {
      return;
    }

    if (!corePoints.includes(line)) {
      corePoints.push(truncateText(line, 90));
    }
  });

  const timelineLines = lines
    .filter(line => /(时间|开放|开启|关闭|截止|维护|版本)/.test(line))
    .slice(0, 4)
    .map(line => truncateText(line, 90));

  const actionLines = lines
    .filter(line => /(范围|条件|奖励|补偿|领取|解锁|参与|概率|提升|说明|注意)/.test(line))
    .slice(0, 4)
    .map(line => truncateText(line, 90));

  return [
    '> 以下为站内整理版摘要，细节以官方原文为准。',
    '',
    '## 核心内容',
    ...(corePoints.length > 0 ? corePoints.map(item => `- ${item}`) : ['- 原文未明确说明。']),
    '',
    '## 重要时间',
    ...(timelineLines.length > 0 ? timelineLines.map(item => `- ${item}`) : ['- 原文未明确说明。']),
    '',
    '## 影响与建议',
    ...(actionLines.length > 0 ? actionLines.map(item => `- ${item}`) : ['- 请查看官方原文确认完整细则。']),
  ].join('\n');
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

async function loadSiliconFlowConfig(env = process.env) {
  const envApiKey = normalizeText(env.SILICONFLOW_API_KEY || env.SILICONFLOW_APIKEY);
  const envModel = normalizeText(env.SILICONFLOW_MODEL || env.SILICONFLOW_CHAT_MODEL);

  if (envApiKey) {
    return {
      apiKey: envApiKey,
      model: envModel || DEFAULT_SILICONFLOW_MODEL,
    };
  }

  const configText = await readFirstExistingFile([
    path.resolve(process.cwd(), '.secrets', 'siliconflow.local'),
    path.resolve(process.cwd(), '.secrets', 'siliconflow-api-key.local'),
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
    configEntries.SILICONFLOW_API_KEY
    || configEntries.SILICONFLOW_APIKEY
    || configLines.find(line => /^sk-/i.test(line))
  );
  const model = normalizeText(
    configEntries.SILICONFLOW_MODEL
    || configEntries.SILICONFLOW_CHAT_MODEL
    || configLines.find(line => line.includes('/'))
  ) || DEFAULT_SILICONFLOW_MODEL;

  return {
    apiKey,
    model,
  };
}

async function summarizeWithSiliconFlow({
  title,
  summary,
  plainText,
  sourceUrl,
  publishedAt,
  fetchImpl = globalThis.fetch,
  env = process.env,
}) {
  const cacheKey = JSON.stringify({
    title,
    summary,
    sourceUrl,
    publishedAt,
    text: plainText.slice(0, SUMMARY_INPUT_MAX_LENGTH),
  });

  if (SUMMARY_CACHE.has(cacheKey)) {
    return SUMMARY_CACHE.get(cacheKey);
  }

  const config = await loadSiliconFlowConfig(env);
  if (!config.apiKey || typeof fetchImpl !== 'function') {
    SUMMARY_CACHE.set(cacheKey, null);
    return null;
  }

  const promptText = truncateText(plainText, SUMMARY_INPUT_MAX_LENGTH);
  const response = await fetchImpl(SILICONFLOW_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      max_tokens: 800,
      stream: false,
      messages: [
        {
          role: 'system',
          content: [
            '你是终末地官网公告整理助手。',
            '只允许基于给定原文事实输出，不得补充未出现的信息。',
            '输出必须是中文 Markdown，结构固定：',
            '1. > 一行提示：以下为站内整理版摘要，细节以官方原文为准。',
            '2. ## 核心内容',
            '3. ## 重要时间',
            '4. ## 影响与建议',
            '每个小节使用 2-5 条无序列表；没有信息就写“原文未明确说明”。',
            '不要输出表格，不要输出代码块，不要输出任何额外前言或结尾。'
          ].join('\n'),
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
  });

  if (!response.ok) {
    throw new Error(`SiliconFlow returned ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const content = normalizeText(payload?.choices?.[0]?.message?.content);
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
    };
  }

  let structuredSummary = null;
  try {
    structuredSummary = await summarizeWithSiliconFlow({
      title,
      summary,
      plainText,
      sourceUrl,
      publishedAt,
      fetchImpl,
      env,
    });
  } catch {
    structuredSummary = null;
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
  };
}

export const __internal = {
  DEFAULT_SILICONFLOW_MODEL,
  OFFICIAL_SITE_ORIGIN,
  SUMMARY_TRIGGER_TEXT_LENGTH,
  absolutizeUrl,
  buildHeuristicStructuredSummary,
  extractImageUrlsFromHtml,
  normalizeOfficialHtml,
  shouldSummarizeAnnouncement,
  stripHtmlToText,
};
