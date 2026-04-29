/**
 * 官方游戏公告抓取与摘要脚本
 *
 * 流程：
 *   1. 从鹰角官方新闻 API 获取最新公告列表与详情
 *   2. 对长公告调用 OpenAI 兼容 LLM 生成结构化摘要
 *   3. 输出到 public/game-announcements.json，随前端一起部署
 *
 * 用法：
 *   node scripts/fetch-official-announcements.mjs [--count 10] [--dry-run] [--output <file>]
 *
 * 参数：
 *   --count     获取公告数量，默认 10
 *   --dry-run   只获取和处理，不写入 public/game-announcements.json
 *   --output    额外输出到指定文件
 *
 * 环境变量：
 *   ANNOUNCEMENT_LLM_API_KEY    可选，启用 LLM 摘要
 *   ANNOUNCEMENT_LLM_BASE_URL   可选，默认 https://x666.me/
 *   ANNOUNCEMENT_LLM_MODEL      可选，默认 gemini-flash-latest
 *   ANNOUNCEMENT_LLM_RATE_LIMIT 可选，例如 10/min
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

const OFFICIAL_NEWS_BASE_URL = 'https://web-news.hypergryph.com/api';
const OFFICIAL_SITE_ORIGIN = 'https://endfield.hypergryph.com';
const DEFAULT_OUTPUT_PATH = 'public/game-announcements.json';

// ---------------------------------------------------------------------------
// CLI 参数解析
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { count: 10, dryRun: false, output: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--count' && args[i + 1]) {
      opts.count = Number.parseInt(args[++i], 10) || 10;
    } else if (args[i] === '--dry-run') {
      opts.dryRun = true;
    } else if (args[i] === '--output' && args[i + 1]) {
      opts.output = args[++i];
    }
  }

  return opts;
}

// ---------------------------------------------------------------------------
// .env 加载（脚本环境不走 Vite）
// ---------------------------------------------------------------------------

function loadEnvFiles() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
    const envFiles = [
      join(__dirname, '..', '.env'),
      join(__dirname, '..', 'backend', '.env.local'),
      join(__dirname, '..', '.secrets', 'siliconflow.local'),
      join(__dirname, '..', '..', 'hybgyz.api.secret'),
    ];

  for (const envPath of envFiles) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    } catch {
      // 文件不存在
    }
  }
}

// ---------------------------------------------------------------------------
// 官方新闻 API
// ---------------------------------------------------------------------------

async function fetchOfficialNewsJson(url) {
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`Official API ${resp.status} ${resp.statusText}`);
  const result = await resp.json();
  if (result?.code !== 0) throw new Error(result?.msg || 'Official API non-zero code');
  return result?.data ?? null;
}

async function fetchNewsList(pageSize) {
  const query = new URLSearchParams({
    lang: 'zh-cn',
    code: 'endfield_web',
    page: '1',
    pageSize: String(pageSize),
  });
  return fetchOfficialNewsJson(`${OFFICIAL_NEWS_BASE_URL}/bulletin?${query}`);
}

async function fetchNewsDetail(cid) {
  const query = new URLSearchParams({ lang: 'zh-cn', code: 'endfield_web' });
  return fetchOfficialNewsJson(`${OFFICIAL_NEWS_BASE_URL}/bulletin/${cid}?${query}`);
}

// ---------------------------------------------------------------------------
// HTML 处理
// ---------------------------------------------------------------------------

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripHtmlToText(html) {
  return decodeHtmlEntities(
    String(html || '')
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

function absolutizeUrl(raw) {
  const val = String(raw || '').trim();
  if (!val) return '';
  if (val.startsWith('//')) return `https:${val}`;
  if (val.startsWith('/')) return `${OFFICIAL_SITE_ORIGIN}${val}`;
  return val;
}

function normalizeHtml(html) {
  return String(html || '')
    .replace(/src="(\/\/[^"]+)"/g, (_, url) => `src="${absolutizeUrl(url)}"`)
    .replace(/src="(\/[^"]+)"/g, (_, url) => `src="${absolutizeUrl(url)}"`)
    .replace(/href="(\/[^"]+)"/g, (_, url) => `href="${absolutizeUrl(url)}"`);
}

function extractImageUrls(html) {
  const urls = [];
  const seen = new Set();
  const re = /<img[^>]+src="([^"]+)"[^>]*>/gi;
  let m;
  while ((m = re.exec(html || ''))) {
    const url = absolutizeUrl(m[1]);
    if (url && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  return urls.slice(0, 6);
}

// ---------------------------------------------------------------------------
// LLM 摘要（OpenAI 兼容）
// ---------------------------------------------------------------------------

const DEFAULT_LLM_BASE_URL = 'https://x666.me/';
const DEFAULT_MODEL = 'gemini-flash-latest';
const LLM_RATE_LIMIT_MAX_CALLS = 10;
const LLM_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const SUMMARY_INPUT_MAX = 7000;
const SUMMARY_OUTPUT_MAX_TOKENS = 1600;
const llmRequestTimestamps = [];

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseDurationMs(value, unit) {
  const amount = Math.max(1, Number(value) || 1);
  const normalizedUnit = normalizeText(unit).toLowerCase();

  if (normalizedUnit === 'ms') return amount;
  if (normalizedUnit === 's' || normalizedUnit === '秒') return amount * 1000;
  if (normalizedUnit === 'h' || normalizedUnit === 'hour' || normalizedUnit === 'hours' || normalizedUnit === '小时') {
    return amount * 60 * 60 * 1000;
  }

  return amount * 60 * 1000;
}

function parseLlmRateLimit(rawValue) {
  const normalizedValue = normalizeText(rawValue).toLowerCase();
  if (!normalizedValue) {
    return { maxCalls: LLM_RATE_LIMIT_MAX_CALLS, windowMs: LLM_RATE_LIMIT_WINDOW_MS };
  }

  const rpmMatch = /^(\d+)\s*rpm$/iu.exec(normalizedValue);
  if (rpmMatch) {
    return { maxCalls: Math.max(1, Number(rpmMatch[1])), windowMs: 60 * 1000 };
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

  return { maxCalls: LLM_RATE_LIMIT_MAX_CALLS, windowMs: LLM_RATE_LIMIT_WINDOW_MS };
}

function getMarkdownSectionBody(markdownText, heading) {
  const lines = String(markdownText || '').split(/\r?\n/u);
  const targetHeading = normalizeText(heading);
  const sectionLines = [];
  let collecting = false;

  for (const line of lines) {
    const headingMatch = /^##\s+(.+?)\s*$/u.exec(line);
    if (headingMatch) {
      if (collecting) break;
      collecting = normalizeText(headingMatch[1]) === targetHeading;
      continue;
    }

    if (collecting) sectionLines.push(line);
  }

  return normalizeText(sectionLines.join('\n'));
}

function hasCompleteMarkdownSection(markdownText, heading) {
  const sectionBody = getMarkdownSectionBody(markdownText, heading);
  if (!sectionBody) return false;

  return sectionBody
    .split(/\n+/u)
    .map(line => normalizeText(line))
    .some(line => /^[-*]\s+\S/u.test(line) || line.includes('原文未明确说明'));
}

function isStructuredSummaryComplete(markdownText) {
  const normalizedText = normalizeText(markdownText);
  if (!normalizedText.includes('以下为站内整理版摘要')) return false;

  return ['核心内容', '重要时间', '影响与建议']
    .every(heading => hasCompleteMarkdownSection(normalizedText, heading));
}

function resolveChatCompletionsUrl(rawValue) {
  const normalizedValue = normalizeText(rawValue) || DEFAULT_LLM_BASE_URL;

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
  const maxCalls = Math.max(1, Number(rateLimit.maxCalls) || LLM_RATE_LIMIT_MAX_CALLS);
  const windowMs = Math.max(1000, Number(rateLimit.windowMs) || LLM_RATE_LIMIT_WINDOW_MS);
  const now = Date.now();
  while (llmRequestTimestamps.length > 0
    && now - llmRequestTimestamps[0] >= windowMs) {
    llmRequestTimestamps.shift();
  }

  if (llmRequestTimestamps.length < maxCalls) {
    llmRequestTimestamps.push(now);
    return;
  }

  const waitMs = Math.max(0, windowMs - (now - llmRequestTimestamps[0]) + 50);
  await new Promise(resolve => setTimeout(resolve, waitMs));
  await waitForLlmRateLimit(rateLimit);
}

async function loadPromptTemplate() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const promptPath = join(__dirname, '..', 'api', '_lib', 'announcement-summary-prompt.md');
  try {
    return await fs.promises.readFile(promptPath, 'utf-8');
  } catch {
    return '你是一个游戏公告摘要助手。请用简洁的中文概括以下公告的关键信息，使用 Markdown 格式输出。';
  }
}

async function summarizeWithLlm(title, summary, plainText, config) {
  const apiKey = config?.apiKey;
  if (!apiKey) return null;

  const promptTemplate = await loadPromptTemplate();
  const truncatedText = plainText.length > SUMMARY_INPUT_MAX
    ? plainText.slice(0, SUMMARY_INPUT_MAX) + '…（正文已截断）'
    : plainText;

  const userContent = [
    `## ${title}`,
    summary ? `> ${summary}` : '',
    truncatedText,
  ].filter(Boolean).join('\n\n');

  try {
    await waitForLlmRateLimit(config.rateLimit);
    const resp = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || DEFAULT_MODEL,
        messages: [
          { role: 'system', content: promptTemplate },
          { role: 'user', content: userContent },
        ],
        temperature: 0.3,
        max_tokens: SUMMARY_OUTPUT_MAX_TOKENS,
      }),
    });

    if (!resp.ok) {
      console.error(`  LLM API ${resp.status}: ${await resp.text().catch(() => '')}`);
      return null;
    }

    const result = await resp.json();
    const choice = result?.choices?.[0];
    const finishReason = normalizeText(choice?.finish_reason || choice?.finishReason).toLowerCase();
    if (finishReason.includes('length') || finishReason.includes('max_token')) {
      console.warn('  LLM 摘要被上游截断，回退到启发式摘要');
      return null;
    }

    const content = choice?.message?.content?.trim();
    if (!isStructuredSummaryComplete(content)) {
      console.warn('  LLM 摘要结构不完整，回退到启发式摘要');
      return null;
    }

    return content || null;
  } catch (err) {
    console.error(`  LLM 摘要失败: ${err.message}`);
    return null;
  }
}

function buildHeuristicSummary(summary, plainText) {
  const lines = plainText.split('\n').filter(l => l.trim());
  const meaningful = lines.filter(l => l.length > 10).slice(0, 5);
  if (summary) return `> ${summary}\n\n${meaningful.join('\n')}`;
  return meaningful.join('\n');
}

// ---------------------------------------------------------------------------
// 构建公告记录
// ---------------------------------------------------------------------------

async function buildAnnouncementRecord(detail, llmConfig) {
  const cid = String(detail.cid);
  const title = String(detail.title || '');
  const brief = typeof detail.brief === 'string' ? detail.brief.trim() : null;
  const publishedAt = detail.displayTime
    ? new Date(Number(detail.displayTime) * 1000).toISOString()
    : null;
  const sourceUrl = `${OFFICIAL_SITE_ORIGIN}/news/${cid}`;
  const rawHtml = normalizeHtml(detail.data || '');
  const plainText = stripHtmlToText(rawHtml);
  const imageUrls = extractImageUrls(rawHtml);
  const gallery = imageUrls.length > 0
    ? '\n\n' + imageUrls.map(url => `![](${url})`).join('\n')
    : '';

  // 所有公告都尝试 LLM 总结
  let content;
  let summaryMode;

  const llmSummary = llmConfig?.apiKey
    ? await summarizeWithLlm(title, brief, plainText, llmConfig)
    : null;

  if (llmSummary) {
    content = llmSummary + gallery;
    summaryMode = 'llm';
  } else {
    content = buildHeuristicSummary(brief, plainText) + gallery;
    summaryMode = 'heuristic';
  }

  return {
    source_id: cid,
    title,
    summary: brief,
    content,
    image_urls: imageUrls,
    summary_mode: summaryMode,
    published_at: publishedAt,
    source_url: sourceUrl,
    is_active: true,
  };
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();
  loadEnvFiles();

  const llmConfig = {
    apiKey: process.env.ANNOUNCEMENT_LLM_API_KEY
      || process.env.SILICONFLOW_API_KEY
      || process.env.SILICONFLOW_APIKEY
      || '',
    model: process.env.ANNOUNCEMENT_LLM_MODEL
      || process.env.SILICONFLOW_MODEL
      || process.env.SILICONFLOW_CHAT_MODEL
      || DEFAULT_MODEL,
    url: resolveChatCompletionsUrl(
      process.env.ANNOUNCEMENT_LLM_BASE_URL
      || process.env.SILICONFLOW_BASE_URL
      || process.env.SILICONFLOW_API_URL
      || DEFAULT_LLM_BASE_URL
    ),
    rateLimit: parseLlmRateLimit(
      process.env.ANNOUNCEMENT_LLM_RATE_LIMIT
      || process.env.SILICONFLOW_RATE_LIMIT
    ),
  };

  console.log('\n=== 官方游戏公告抓取 ===');
  console.log(`数量: ${opts.count}${opts.dryRun ? ' (dry-run)' : ''}`);
  console.log(`LLM 摘要: ${llmConfig.apiKey ? '已配置' : '未配置（将使用启发式摘要）'}`);
  console.log(`LLM 模型: ${llmConfig.model}`);
  console.log(`LLM 限流: ${llmConfig.rateLimit.maxCalls} 次 / ${llmConfig.rateLimit.windowMs / 60000} 分钟\n`);

  // 1. 获取公告列表
  console.log('获取公告列表...');
  const listPayload = await fetchNewsList(opts.count);
  const list = Array.isArray(listPayload?.list) ? listPayload.list : [];
  console.log(`获取到 ${list.length} 条公告`);

  if (list.length === 0) {
    console.error('未获取到任何公告，退出');
    process.exit(1);
  }

  // 2. 逐条获取详情并构建记录
  const records = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item?.cid || !item?.title) continue;

    process.stdout.write(`  [${i + 1}/${list.length}] ${item.title}: `);

    try {
      const detail = await fetchNewsDetail(item.cid);
      const merged = { ...item, ...detail };
      const record = await buildAnnouncementRecord(merged, llmConfig);
      records.push(record);
      console.log(`${record.summary_mode}`);
    } catch (err) {
      console.log(`失败 (${err.message})`);
    }

    // 避免请求过快
    if (i < list.length - 1) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  console.log(`\n成功处理 ${records.length} 条公告`);

  // 3. 写入文件
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const defaultPath = join(__dirname, '..', DEFAULT_OUTPUT_PATH);

  if (!opts.dryRun) {
    fs.writeFileSync(defaultPath, JSON.stringify(records, null, 2), 'utf-8');
    console.log(`已写入 ${defaultPath}`);
  } else {
    console.log('dry-run 模式，跳过写入 public/game-announcements.json');
  }

  if (opts.output) {
    fs.writeFileSync(opts.output, JSON.stringify(records, null, 2), 'utf-8');
    console.log(`额外输出到 ${opts.output}`);
  }

  // 4. 与现有文件对比
  try {
    const existing = JSON.parse(fs.readFileSync(defaultPath, 'utf-8'));
    const existingIds = new Set(existing.map(r => r.source_id));
    const newIds = records.filter(r => !existingIds.has(r.source_id));
    if (newIds.length > 0) {
      console.log(`\n新增 ${newIds.length} 条公告: ${newIds.map(r => r.title).join(', ')}`);
    } else {
      console.log('\n无新增公告');
    }
  } catch {
    // 首次运行没有现有文件
  }

  console.log('\n=== 完成 ===');
}

main().catch(err => {
  console.error('\n脚本异常:', err);
  process.exit(1);
});
