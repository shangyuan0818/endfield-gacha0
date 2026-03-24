/**
 * 官方游戏公告抓取与摘要脚本
 *
 * 流程：
 *   1. 从鹰角官方新闻 API 获取最新公告列表与详情
 *   2. 对长公告调用 SiliconFlow LLM 生成结构化摘要
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
 *   SILICONFLOW_API_KEY   可选，启用 LLM 摘要
 *   SILICONFLOW_MODEL     可选，覆盖默认模型
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
// LLM 摘要（SiliconFlow）
// ---------------------------------------------------------------------------

const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const DEFAULT_MODEL = 'deepseek-ai/DeepSeek-V3.2';
const SUMMARY_TRIGGER_LENGTH = 1400;
const SUMMARY_INPUT_MAX = 7000;

async function loadPromptTemplate() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const promptPath = join(__dirname, '..', 'api', '_lib', 'announcement-summary-prompt.md');
  try {
    return await fs.promises.readFile(promptPath, 'utf-8');
  } catch {
    return '你是一个游戏公告摘要助手。请用简洁的中文概括以下公告的关键信息，使用 Markdown 格式输出。';
  }
}

async function summarizeWithLlm(title, summary, plainText, apiKey, model) {
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
    const resp = await fetch(SILICONFLOW_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        messages: [
          { role: 'system', content: promptTemplate },
          { role: 'user', content: userContent },
        ],
        temperature: 0.3,
        max_tokens: 1200,
      }),
    });

    if (!resp.ok) {
      console.error(`  LLM API ${resp.status}: ${await resp.text().catch(() => '')}`);
      return null;
    }

    const result = await resp.json();
    const content = result?.choices?.[0]?.message?.content?.trim();
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

async function buildAnnouncementRecord(detail, apiKey, model) {
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

  const llmSummary = apiKey
    ? await summarizeWithLlm(title, brief, plainText, apiKey, model)
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

  const apiKey = process.env.SILICONFLOW_API_KEY || process.env.SILICONFLOW_APIKEY || '';
  const model = process.env.SILICONFLOW_MODEL || process.env.SILICONFLOW_CHAT_MODEL || '';

  console.log('\n=== 官方游戏公告抓取 ===');
  console.log(`数量: ${opts.count}${opts.dryRun ? ' (dry-run)' : ''}`);
  console.log(`LLM 摘要: ${apiKey ? '已配置' : '未配置（将使用启发式摘要）'}\n`);

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
      const record = await buildAnnouncementRecord(merged, apiKey, model);
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
