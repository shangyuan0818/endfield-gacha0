/**
 * 森空岛终末地 WIKI 角色/武器图片同步脚本
 *
 * 当前流程：
 *   1. Playwright 打开森空岛图鉴页面，等待 JS 渲染
 *   2. 从 __CHIMERA_STORE__.dataMap 提取图片 name→URL 映射
 *   3. 连接 Supabase，按名称匹配现有角色/武器
 *   4. 下载图片到 public/avatars 站点静态目录
 *   5. 更新 characters.avatar_url 为站点本地静态路径
 *
 * 用法：
 *   node scripts/fetch-skland-images.mjs [--type character|weapon|all] [--dry-run] [--no-write-db] [--output <file>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { normalizeEntityNameForMatch } from '../src/utils/canonicalEntityUtils.js';
import { buildLocalAvatarPath, inferAvatarFileExtension } from '../src/utils/avatarAssetPaths.js';
import {
  buildTeamStardustLookup,
  findTeamStardustAssetMatch,
  loadTeamStardustAssetCatalog
} from './lib/teamStardustAssetCatalog.mjs';
import { loadSklandCatalogRecords } from './lib/sklandCatalogSource.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLIC_AVATAR_DIR = path.join(PROJECT_ROOT, 'public', 'avatars');
const ENV_FILE_CANDIDATES = [
  path.join(PROJECT_ROOT, '.env.local'),
  path.join(PROJECT_ROOT, '.env'),
  path.join(PROJECT_ROOT, 'backend', '.env.local'),
  path.join(PROJECT_ROOT, 'backend', '.env'),
];

const EXCLUDED_NAME_PATTERNS = [/^管理员/];
const STRIP_SUFFIXES = ['-前瞻'];

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    type: 'all',
    dryRun: false,
    writeDb: true,
    output: null
  };

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--type' && args[i + 1]) {
      opts.type = args[i + 1];
      i += 1;
      continue;
    }

    if (args[i] === '--dry-run') {
      opts.dryRun = true;
      continue;
    }

    if (args[i] === '--no-write-db') {
      opts.writeDb = false;
      continue;
    }

    if (args[i] === '--output' && args[i + 1]) {
      opts.output = args[i + 1];
      i += 1;
    }
  }

  if (!['character', 'weapon', 'all'].includes(opts.type)) {
    console.error('错误: --type 必须为 character | weapon | all');
    process.exit(1);
  }

  if (opts.dryRun) {
    opts.writeDb = false;
  }

  return opts;
}

function normalizeName(value) {
  return normalizeEntityNameForMatch(value);
}

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

    if (!dbItem) {
      for (const suffix of STRIP_SUFFIXES) {
        const stripped = normalizeName(record.name.replace(suffix, ''));
        if (stripped && stripped !== key && !duplicateKeys.has(stripped)) {
          dbItem = aliasMap.get(stripped);
          if (dbItem) {
            break;
          }
        }
      }
    }

    if (!dbItem) {
      unmatched.push(record);
      continue;
    }

    matched.push({
      dbId: dbItem.id,
      dbName: dbItem.name,
      sourceUrl: record.cover,
      sourceName: record.name
    });
  }

  return { matched, unmatched };
}

function buildTeamStardustFallbackMatches(itemType, dbItems, matchedDbIds, lookup) {
  const matched = [];
  const unresolved = [];

  dbItems.forEach((item) => {
    if (matchedDbIds.has(item.id)) {
      return;
    }

    const fallback = findTeamStardustAssetMatch(item, lookup);
    if (!fallback?.imageUrl) {
      unresolved.push(item);
      return;
    }

    matched.push({
      dbId: item.id,
      dbName: item.name,
      sourceUrl: fallback.imageUrl,
      sourceName: fallback.name || item.name,
      sourceKind: fallback.id === item.id ? 'team_stardust' : 'team_stardust_name'
    });
  });

  return { matched, unresolved };
}

async function ensureOutputDir(filePath) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
}

async function downloadToLocalAsset(url, outputPath) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8',
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await ensureOutputDir(outputPath);
  await fs.promises.writeFile(outputPath, buffer);
}

function loadEnvironmentFiles() {
  for (const envPath of ENV_FILE_CANDIDATES) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex === -1) {
          continue;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        let value = trimmed.slice(separatorIndex + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"'))
          || (value.startsWith('\'') && value.endsWith('\''))
        ) {
          value = value.slice(1, -1);
        }
        if (typeof process.env[key] === 'undefined') {
          process.env[key] = value;
        }
      }
    } catch {
      // Ignore missing env files.
    }
  }
}

function initSupabase() {
  loadEnvironmentFiles();

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('错误: 需要在 .env 中配置 VITE_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  return createClient(url, serviceKey);
}

async function main() {
  const opts = parseArgs();
  const types = opts.type === 'all' ? ['character', 'weapon'] : [opts.type];

  console.log('\n=== 森空岛终末地 WIKI 图片同步 ===');
  console.log(`类型: ${opts.type}${opts.dryRun ? ' (dry-run)' : ''}${opts.writeDb ? '' : ' (no-write-db)'}\n`);
  const sklandCatalog = await loadSklandCatalogRecords(types, {
    logger: (message) => {
      console.log(`[skland] ${message}`);
    }
  });
  const allRecords = types.flatMap((itemType) => (
    (sklandCatalog[itemType] || [])
      .filter((record) => !EXCLUDED_NAME_PATTERNS.some((pattern) => pattern.test(record.name.trim())))
      .map((record) => ({ ...record, _type: itemType }))
  ));

  if (allRecords.length === 0) {
    console.error('\n未提取到任何记录，退出');
    process.exit(1);
  }

  if (opts.output) {
    const jsonPayload = allRecords.map(({ _type, ...rest }) => rest);
    fs.writeFileSync(opts.output, JSON.stringify(jsonPayload, null, 2), 'utf-8');
    console.log(`\nJSON 已写入 ${opts.output}`);
  }

  if (opts.dryRun) {
    console.log('\n=== dry-run 模式，跳过本地文件写入和数据库更新 ===');
    console.log(`共提取 ${allRecords.length} 条记录`);
    process.exit(0);
  }

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

  let totalMatched = 0;
  let totalUnmatched = 0;
  let assetSuccess = 0;
  let assetFailed = 0;
  let updateSuccess = 0;
  let updateFailed = 0;
  let teamStardustFallbackSuccess = 0;
  let teamStardustCatalog = null;
  let teamStardustLookup = buildTeamStardustLookup();

  for (const itemType of types) {
    const typeRecords = allRecords.filter((record) => record._type === itemType);
    const dbItems = dbCharacters.filter((item) => item.type === itemType);

    const { matched, unmatched } = matchRecordsToDb(typeRecords, dbItems);
    const matchedDbIds = new Set(matched.map((item) => item.dbId));
    const missingDbItems = dbItems.filter((item) => !matchedDbIds.has(item.id));
    let fallbackMatched = [];
    let unresolvedDbItems = missingDbItems;

    if (missingDbItems.length > 0) {
      if (!teamStardustCatalog) {
        try {
          teamStardustCatalog = await loadTeamStardustAssetCatalog(types, {
            logger: (message) => {
              console.log(`[team-stardust] ${message}`);
            }
          });
          teamStardustLookup = buildTeamStardustLookup(teamStardustCatalog);
        } catch (error) {
          console.warn(`[team-stardust] 目录加载失败: ${error.message}`);
          teamStardustCatalog = {
            character: new Map(),
            weapon: new Map()
          };
          teamStardustLookup = buildTeamStardustLookup(teamStardustCatalog);
        }
      }

      const fallbackResult = buildTeamStardustFallbackMatches(itemType, dbItems, matchedDbIds, teamStardustLookup);
      fallbackMatched = fallbackResult.matched;
      unresolvedDbItems = fallbackResult.unresolved;
      teamStardustFallbackSuccess += fallbackMatched.length;
    }

    const mergedMatched = [...matched, ...fallbackMatched];
    totalMatched += mergedMatched.length;
    totalUnmatched += unmatched.length;

    console.log(`\n[${itemType}] 匹配: ${mergedMatched.length}, 未匹配源记录: ${unmatched.length}, 缺失 DB 记录: ${unresolvedDbItems.length}`);
    if (fallbackMatched.length > 0) {
      console.log(`  Team Stardust 兜底: ${fallbackMatched.map((item) => item.dbName).join(', ')}`);
    }
    if (unmatched.length > 0) {
      console.log(`  未匹配源项: ${unmatched.map((item) => item.name).join(', ')}`);
    }
    if (unresolvedDbItems.length > 0) {
      console.log(`  缺失 DB 项: ${unresolvedDbItems.map((item) => item.name).join(', ')}`);
    }

    for (let index = 0; index < mergedMatched.length; index += 1) {
      const item = mergedMatched[index];
      const extension = inferAvatarFileExtension(item.sourceUrl, 'png');
      const localUrl = buildLocalAvatarPath(itemType, item.dbId, extension);
      const outputPath = path.join(PUBLIC_AVATAR_DIR, `${itemType}s`, `${item.dbId}.${extension}`);

      process.stdout.write(`  [${index + 1}/${mergedMatched.length}] ${item.dbName}: 下载+写入本地...`);

      try {
        await downloadToLocalAsset(item.sourceUrl, outputPath);
        assetSuccess += 1;
      } catch (error) {
        assetFailed += 1;
        console.log(` 失败 (${error.message})`);
        continue;
      }

      if (!opts.writeDb) {
        console.log(' 完成（未写库）');
        continue;
      }

      const { data: updateRows, error: updateError } = await supabase
        .from('characters')
        .update({ avatar_url: localUrl })
        .eq('id', item.dbId)
        .select('id');

      if (updateError) {
        updateFailed += 1;
        console.log(` 本地文件已写入但更新失败: ${updateError.message}`);
      } else if (!Array.isArray(updateRows) || updateRows.length === 0) {
        updateFailed += 1;
        console.log(' 本地文件已写入但写库未命中');
      } else {
        updateSuccess += 1;
        console.log(' 完成');
      }

      if (index < mergedMatched.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
  }

  console.log('\n=== 同步完成 ===');
  console.log(`提取: ${allRecords.length}`);
  console.log(`匹配: ${totalMatched}, 未匹配: ${totalUnmatched}`);
  console.log(`Team Stardust 兜底命中: ${teamStardustFallbackSuccess}`);
  console.log(`写入 public/avatars: 成功 ${assetSuccess}, 失败 ${assetFailed}`);
  if (opts.writeDb) {
    console.log(`更新 avatar_url: 成功 ${updateSuccess}, 失败 ${updateFailed}`);
    console.log('下一步：检查 public/avatars 变更，然后提交并推送以触发静态部署');
  } else {
    console.log('未写数据库（dry-run 或 --no-write-db）');
  }
}

main().catch((error) => {
  console.error('\n脚本异常:', error);
  process.exit(1);
});
