/**
 * 森空岛终末地WIKI 角色/武器图片自动同步脚本
 *
 * 全自动流程：
 *   1. Playwright 打开森空岛图鉴页面，等待 JS 渲染
 *   2. 从 __CHIMERA_STORE__.dataMap 提取图片 name→URL 映射
 *   3. 连接 Supabase，按名称匹配现有角色/武器
 *   4. 下载图片并上传到 Supabase Storage (avatars bucket)
 *   5. 更新 characters 表的 avatar_url
 *
 * 用法：
 *   node scripts/fetch-skland-images.mjs [--type character|weapon|all] [--dry-run] [--output <file>]
 *
 * 参数：
 *   --type       提取类型，默认 all
 *   --dry-run    只提取和匹配，不写入数据库/Storage
 *   --output     额外输出 JSON 到文件
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

const SKLAND_CATALOG_URLS = {
  character: 'https://wiki.skland.com/endfield/catalog?typeMainId=1&typeSubId=1',
  weapon: 'https://wiki.skland.com/endfield/catalog?typeMainId=1&typeSubId=2',
};

const ASSOCIATE_TYPE_MAP = {
  character: 'char',
  weapon: 'weapon',
};

const STORAGE_BUCKET = 'avatars';
const PAGE_RENDER_WAIT_MS = 8000;

// 提取后排除的角色名称模式（管理员等非抽卡角色）
const EXCLUDED_NAME_PATTERNS = [
  /^管理员/,
];

// 匹配时尝试剥离的名称后缀（如"洛茜-前瞻" → "洛茜"）
const STRIP_SUFFIXES = ['-前瞻'];

// ---------------------------------------------------------------------------
// CLI 参数解析
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { type: 'all', dryRun: false, output: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--type' && args[i + 1]) {
      opts.type = args[++i];
    } else if (args[i] === '--dry-run') {
      opts.dryRun = true;
    } else if (args[i] === '--output' && args[i + 1]) {
      opts.output = args[++i];
    }
  }

  if (!['character', 'weapon', 'all'].includes(opts.type)) {
    console.error('错误: --type 必须为 character | weapon | all');
    process.exit(1);
  }

  return opts;
}

// ---------------------------------------------------------------------------
// Edge 浏览器查找（复用项目 Playwright 模式）
// ---------------------------------------------------------------------------

function findEdgeExecutable() {
  const candidates = [
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return candidates.find((p) => fs.existsSync(p));
}

// ---------------------------------------------------------------------------
// 页面数据提取（复用 sklandCatalogImport.js 的遍历算法）
// ---------------------------------------------------------------------------

async function extractFromPage(page, itemType) {
  const associateType = ASSOCIATE_TYPE_MAP[itemType];

  return page.evaluate((filterType) => {
    const root = window.__CHIMERA_STORE__?.dataMap;
    if (!root || typeof root !== 'object') {
      return { records: [], error: '未找到 __CHIMERA_STORE__.dataMap' };
    }

    const records = [];
    const seenNodes = new WeakSet();
    const seenKeys = new Set();

    const visit = (node, depth = 0) => {
      if (!node || typeof node !== 'object' || seenNodes.has(node) || depth > 20) return;
      seenNodes.add(node);
      if (Array.isArray(node)) {
        for (const item of node) visit(item, depth + 1);
        return;
      }
      if (typeof node.name === 'string' && typeof node.brief?.cover === 'string') {
        const row = {
          itemId: node.itemId || null,
          name: node.name,
          cover: node.brief.cover,
          associateId: node.brief?.associate?.id || null,
          associateType: node.brief?.associate?.type || null,
        };
        const key = [row.itemId || '', row.name, row.cover].join('::');
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          records.push(row);
        }
      }
      for (const value of Object.values(node)) visit(value, depth + 1);
    };

    visit(root);

    const filtered = records.filter(
      (r) => !r.associateType || r.associateType === filterType
    );
    return { records: filtered, error: null };
  }, associateType);
}

// ---------------------------------------------------------------------------
// 名称归一化（复用 sklandCatalogImport.js 的逻辑）
// ---------------------------------------------------------------------------

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·•・]/g, '')
    .replace(/[()（）]/g, '');
}

// ---------------------------------------------------------------------------
// 匹配提取记录与数据库角色
// ---------------------------------------------------------------------------

function matchRecordsToDb(records, dbItems) {
  const aliasMap = new Map();
  const duplicateKeys = new Set();

  for (const item of dbItems) {
    const keys = new Set(
      [
        normalizeName(item.name),
        ...(Array.isArray(item.aliases) ? item.aliases.map(normalizeName) : []),
      ].filter(Boolean)
    );

    for (const key of keys) {
      if (aliasMap.has(key) && aliasMap.get(key).id !== item.id) {
        duplicateKeys.add(key);
      } else {
        aliasMap.set(key, item);
      }
    }
  }

  const matched = [];
  const unmatched = [];

  for (const record of records) {
    const key = normalizeName(record.name);
    if (!key || duplicateKeys.has(key)) {
      unmatched.push(record);
      continue;
    }
    let dbItem = aliasMap.get(key);

    // 如果原名匹配不到，尝试剥离后缀再匹配（如"洛茜-前瞻" → "洛茜"）
    if (!dbItem) {
      for (const suffix of STRIP_SUFFIXES) {
        const stripped = normalizeName(record.name.replace(suffix, ''));
        if (stripped && stripped !== key && !duplicateKeys.has(stripped)) {
          dbItem = aliasMap.get(stripped);
          if (dbItem) break;
        }
      }
    }

    if (!dbItem) {
      unmatched.push(record);
      continue;
    }
    matched.push({ dbId: dbItem.id, dbName: dbItem.name, sourceUrl: record.cover, sourceName: record.name });
  }

  return { matched, unmatched };
}

// ---------------------------------------------------------------------------
// 下载图片并上传到 Supabase Storage
// ---------------------------------------------------------------------------

async function downloadAndUpload(supabase, url, storagePath) {
  const resp = await fetch(url);
  if (!resp.ok) return null;

  const buffer = Buffer.from(await resp.arrayBuffer());
  const contentType = resp.headers.get('content-type') || 'image/png';

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: true });

  if (error) {
    console.error(`  上传失败 ${storagePath}: ${error.message}`);
    return null;
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl || null;
}

// ---------------------------------------------------------------------------
// Supabase 初始化
// ---------------------------------------------------------------------------

function initSupabase() {
  // 加载 .env 文件（脚本环境不走 Vite，需要手动加载）
  // 优先读 .env，再补读 backend/.env.local（SERVICE_ROLE_KEY 通常在后者）
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const envFiles = [
    join(__dirname, '..', '.env'),
    join(__dirname, '..', 'backend', '.env.local'),
  ];

  for (const envPath of envFiles) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        const val = trimmed.slice(eqIndex + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    } catch {
      // 文件不存在，继续
    }
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('错误: 需要在 .env 中配置 VITE_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  return createClient(url, serviceKey);
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();
  const types = opts.type === 'all' ? ['character', 'weapon'] : [opts.type];

  console.log(`\n=== 森空岛终末地WIKI 图片同步 ===`);
  console.log(`类型: ${opts.type}${opts.dryRun ? ' (dry-run)' : ''}\n`);

  // 1. 启动浏览器
  const edgePath = findEdgeExecutable();
  const launchOptions = edgePath ? { executablePath: edgePath } : {};

  console.log(`启动浏览器${edgePath ? ' (Edge)' : ' (Chromium)'}...`);
  const browser = await chromium.launch({ headless: true, ...launchOptions });

  let allRecords = [];

  try {
    const context = await browser.newContext();

    for (const itemType of types) {
      const url = SKLAND_CATALOG_URLS[itemType];
      console.log(`\n[${itemType}] 打开 ${url}`);

      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      console.log(`[${itemType}] 等待页面渲染 (${PAGE_RENDER_WAIT_MS / 1000}s)...`);
      await page.waitForTimeout(PAGE_RENDER_WAIT_MS);

      const { records, error } = await extractFromPage(page, itemType);
      await page.close();

      if (error) {
        console.error(`[${itemType}] 提取失败: ${error}`);
        continue;
      }

      console.log(`[${itemType}] 提取到 ${records.length} 条记录`);

      // 过滤排除项（管理员等非抽卡角色）
      const filtered = records.filter(
        (r) => !EXCLUDED_NAME_PATTERNS.some((pat) => pat.test(r.name.trim()))
      );
      if (filtered.length < records.length) {
        console.log(`[${itemType}] 排除 ${records.length - filtered.length} 条（管理员等）`);
      }

      allRecords.push(...filtered.map((r) => ({ ...r, _type: itemType })));
    }
  } finally {
    await browser.close();
  }

  if (allRecords.length === 0) {
    console.error('\n未提取到任何记录，退出');
    process.exit(1);
  }

  // 2. 输出 JSON（如果指定了 --output）
  if (opts.output) {
    const jsonPayload = allRecords.map(({ _type, ...rest }) => rest);
    fs.writeFileSync(opts.output, JSON.stringify(jsonPayload, null, 2), 'utf-8');
    console.log(`\nJSON 已写入 ${opts.output}`);
  }

  if (opts.dryRun) {
    console.log('\n=== dry-run 模式，跳过数据库操作 ===');
    console.log(`共提取 ${allRecords.length} 条记录`);
    process.exit(0);
  }

  // 3. 连接 Supabase，加载现有角色列表
  const supabase = initSupabase();

  console.log('\n连接 Supabase，加载角色/武器列表...');
  const { data: dbCharacters, error: dbError } = await supabase
    .from('characters')
    .select('id, name, type, aliases, avatar_url')
    .order('name');

  if (dbError) {
    console.error(`数据库查询失败: ${dbError.message}`);
    process.exit(1);
  }

  console.log(`数据库中共 ${dbCharacters.length} 条记录`);

  // 4. 按类型匹配
  let totalMatched = 0;
  let totalUnmatched = 0;
  let uploadSuccess = 0;
  let uploadFailed = 0;
  let updateSuccess = 0;
  let updateFailed = 0;

  for (const itemType of types) {
    const typeRecords = allRecords.filter((r) => r._type === itemType);
    const dbItems = dbCharacters.filter((c) => c.type === itemType);

    const { matched, unmatched } = matchRecordsToDb(typeRecords, dbItems);
    totalMatched += matched.length;
    totalUnmatched += unmatched.length;

    console.log(`\n[${itemType}] 匹配: ${matched.length}, 未匹配: ${unmatched.length}`);
    if (unmatched.length > 0) {
      console.log(`  未匹配项: ${unmatched.map((u) => u.name).join(', ')}`);
    }

    // 5. 下载图片 → 上传 Storage → 更新 avatar_url
    for (let i = 0; i < matched.length; i++) {
      const item = matched[i];
      const ext = item.sourceUrl.includes('.webp') ? 'webp' : 'png';
      const storagePath = `${itemType}s/${item.dbId}.${ext}`;

      process.stdout.write(`  [${i + 1}/${matched.length}] ${item.dbName}: 下载+上传...`);

      const publicUrl = await downloadAndUpload(supabase, item.sourceUrl, storagePath);

      if (!publicUrl) {
        uploadFailed++;
        console.log(' 失败');
        continue;
      }
      uploadSuccess++;

      // 更新 avatar_url
      const { error: updateError } = await supabase
        .from('characters')
        .update({ avatar_url: publicUrl })
        .eq('id', item.dbId);

      if (updateError) {
        updateFailed++;
        console.log(` 上传成功但更新失败: ${updateError.message}`);
      } else {
        updateSuccess++;
        console.log(' 完成');
      }

      // 避免请求过快
      if (i < matched.length - 1) {
        await new Promise((r) => setTimeout(r, 150));
      }
    }
  }

  // 6. 汇总
  console.log('\n=== 同步完成 ===');
  console.log(`提取: ${allRecords.length}`);
  console.log(`匹配: ${totalMatched}, 未匹配: ${totalUnmatched}`);
  console.log(`上传 Storage: 成功 ${uploadSuccess}, 失败 ${uploadFailed}`);
  console.log(`更新 avatar_url: 成功 ${updateSuccess}, 失败 ${updateFailed}`);
}

main().catch((err) => {
  console.error('\n脚本异常:', err);
  process.exit(1);
});
