import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { buildLocalAvatarPath, inferAvatarFileExtension } from '../../src/utils/avatarAssetPaths.js';
import { normalizeEntityNameForMatch } from '../../src/utils/canonicalEntityUtils.js';
import {
  buildTeamStardustLookup,
  findTeamStardustAssetMatch,
  loadTeamStardustAssetCatalog
} from './teamStardustAssetCatalog.mjs';
import { loadSklandCatalogRecords } from './sklandCatalogSource.mjs';
import {
  buildWarfarinWikiLookup,
  findWarfarinWikiAssetMatch,
  loadWarfarinWikiAssetCatalog
} from './warfarinWikiAssetCatalog.mjs';
import {
  resolveSupabaseSecretKey,
  resolveSupabaseUrl
} from './supabaseEnv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC_AVATAR_DIR = path.join(PROJECT_ROOT, 'public', 'avatars');
const AVATAR_BUCKET_ID = 'avatars';
const DEFAULT_PAGE_SIZE = 1000;
const DOWNLOAD_PAUSE_MS = 150;
const STRIP_SUFFIXES = ['-前瞻'];
const VALID_TYPES = new Set(['character', 'weapon', 'all']);
const VALID_MODES = new Set(['incremental', 'full']);
const ENV_FILE_CANDIDATES = [
  path.join(PROJECT_ROOT, '.env.local'),
  path.join(PROJECT_ROOT, '.env'),
  path.join(PROJECT_ROOT, 'backend', '.env.local'),
  path.join(PROJECT_ROOT, 'backend', '.env')
];

function normalizeName(value) {
  return normalizeEntityNameForMatch(value);
}

function normalizeRequestedTypes(type = 'all') {
  return type === 'all' ? ['character', 'weapon'] : [type];
}

function readNextArg(args, index, flag) {
  if (!args[index + 1] || args[index + 1].startsWith('--')) {
    throw new Error(`${flag} 需要一个参数`);
  }
  return args[index + 1];
}

export function printLocalAvatarSyncHelp(commandName = 'sync-local-avatars') {
  console.log(`用法:
  npm run ${commandName} -- [选项]

选项:
  --type character|weapon|all       同步类型，默认 all
  --mode incremental|full           同步模式，默认 incremental
  --incremental                     只补缺失或未写回的头像，等同 --mode incremental
  --full                            重新按当前最高优先级来源刷新全部头像
  --dry-run                         演练模式：只计算队列，不下载、不写数据库
  --no-write-db                     下载到 public/avatars，但不更新 characters.avatar_url
  --output <file>                   写出源站提取记录，便于人工审计
  --no-skland                       跳过森空岛主源
  --no-warfarin                     跳过 warfarin.wiki 兜底
  --no-team-stardust                跳过 Team Stardust 兜底
  --no-legacy-bucket                跳过旧 Supabase avatars bucket 兜底
  --help                            显示帮助

来源优先级:
  森空岛官方 Wiki > warfarin.wiki > Team Stardust > 旧 avatars bucket`);
}

export function parseLocalAvatarSyncArgs(args = process.argv.slice(2), defaults = {}) {
  const options = {
    commandName: defaults.commandName || 'sync-local-avatars',
    type: 'all',
    mode: 'incremental',
    dryRun: false,
    writeDb: true,
    output: null,
    useSkland: true,
    useWarfarin: true,
    useTeamStardust: true,
    useLegacyBucket: true,
    help: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--type') {
      options.type = readNextArg(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--mode') {
      options.mode = readNextArg(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--incremental') {
      options.mode = 'incremental';
      continue;
    }

    if (arg === '--full' || arg === '--force') {
      options.mode = 'full';
      continue;
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--no-write-db') {
      options.writeDb = false;
      continue;
    }

    if (arg === '--output') {
      options.output = readNextArg(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--no-skland') {
      options.useSkland = false;
      continue;
    }

    if (arg === '--no-warfarin') {
      options.useWarfarin = false;
      continue;
    }

    if (arg === '--no-team-stardust') {
      options.useTeamStardust = false;
      continue;
    }

    if (arg === '--no-legacy-bucket') {
      options.useLegacyBucket = false;
      continue;
    }

    throw new Error(`未知参数: ${arg}`);
  }

  if (!VALID_TYPES.has(options.type)) {
    throw new Error('--type 必须为 character | weapon | all');
  }

  if (!VALID_MODES.has(options.mode)) {
    throw new Error('--mode 必须为 incremental 或 full');
  }

  if (options.dryRun) {
    options.writeDb = false;
  }

  if (!options.useSkland && !options.useWarfarin && !options.useTeamStardust && !options.useLegacyBucket) {
    throw new Error('至少需要启用一个头像来源');
  }

  return options;
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
      // Ignore missing env files and continue.
    }
  }
}

function createSupabaseClient() {
  loadEnvironmentFiles();

  const supabaseUrl = resolveSupabaseUrl();
  const serviceRoleKey = resolveSupabaseSecretKey();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('缺少 SUPABASE_URL/VITE_SUPABASE_URL 或 SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY，无法读取和写回头像数据');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

async function loadExistingCharacters(supabase) {
  const { data, error } = await supabase
    .from('characters')
    .select('id, name, type, aliases, avatar_url')
    .order('name');

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

async function listBucketPage(bucket, prefix, pageSize, offset) {
  const { data, error } = await bucket.list(prefix, {
    limit: pageSize,
    offset,
    sortBy: {
      column: 'name',
      order: 'asc'
    }
  });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

async function collectAvatarBucketObjectMap(supabase, pageSize = DEFAULT_PAGE_SIZE) {
  const bucket = supabase.storage.from(AVATAR_BUCKET_ID);
  const queue = [''];
  const objectMap = new Map();

  while (queue.length > 0) {
    const prefix = queue.shift();
    let offset = 0;

    while (true) {
      const page = await listBucketPage(bucket, prefix, pageSize, offset);

      for (const entry of page) {
        const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        const isFolder = !entry.id && !entry.metadata;

        if (isFolder) {
          queue.push(fullPath);
          continue;
        }

        objectMap.set(fullPath, entry);
      }

      if (page.length < pageSize) {
        break;
      }

      offset += pageSize;
    }
  }

  return objectMap;
}

function buildStoragePublicUrl(supabaseUrl, objectPath) {
  return supabaseUrl && objectPath
    ? `${supabaseUrl}/storage/v1/object/public/${AVATAR_BUCKET_ID}/${objectPath}`
    : null;
}

function buildSyncItem({ id, name, type, remoteUrl, source, sourceName = null, sourceId = null, extension = null }) {
  const resolvedExtension = inferAvatarFileExtension(remoteUrl, extension || 'webp');
  return {
    id,
    name,
    type,
    remoteUrl,
    localUrl: buildLocalAvatarPath(type, id, resolvedExtension),
    outputPath: path.join(PUBLIC_AVATAR_DIR, `${type}s`, `${id}.${resolvedExtension}`),
    source,
    sourceName,
    sourceId
  };
}

function buildDbLookup(dbItems) {
  const byId = new Map();
  const byName = new Map();
  const duplicateNames = new Set();

  for (const item of dbItems) {
    if (item?.id) {
      byId.set(item.id, item);
    }

    const keys = new Set([
      normalizeName(item?.name),
      ...(Array.isArray(item?.aliases) ? item.aliases.map(normalizeName) : [])
    ].filter(Boolean));

    for (const key of keys) {
      const existing = byName.get(key);
      if (existing && existing.id !== item.id) {
        duplicateNames.add(key);
        continue;
      }
      byName.set(key, item);
    }
  }

  return { byId, byName, duplicateNames };
}

function matchAssetRecordsToDb(records, dbItems, itemType, source) {
  const lookup = buildDbLookup(dbItems);
  const matched = [];
  const unmatched = [];
  const ambiguous = [];

  for (const record of records) {
    const sourceId = String(record?.sourceId || record?.associateId || record?.itemId || record?.id || '').trim();
    const sourceName = String(record?.name || '').trim();
    const sourceUrl = String(record?.imageUrl || record?.cover || record?.avatar_url || '').trim();

    if (!sourceName || !sourceUrl) {
      unmatched.push(record);
      continue;
    }

    let dbItem = sourceId ? lookup.byId.get(sourceId) : null;
    if (!dbItem) {
      const key = normalizeName(sourceName);
      if (!key) {
        unmatched.push(record);
        continue;
      }

      if (lookup.duplicateNames.has(key)) {
        ambiguous.push(record);
        continue;
      }

      dbItem = lookup.byName.get(key);
      if (!dbItem) {
        for (const suffix of STRIP_SUFFIXES) {
          const stripped = normalizeName(sourceName.replace(suffix, ''));
          if (stripped && stripped !== key && !lookup.duplicateNames.has(stripped)) {
            dbItem = lookup.byName.get(stripped);
            if (dbItem) {
              break;
            }
          }
        }
      }
    }

    if (!dbItem) {
      unmatched.push(record);
      continue;
    }

    matched.push(buildSyncItem({
      id: dbItem.id,
      name: dbItem.name,
      type: itemType,
      remoteUrl: sourceUrl,
      source,
      sourceName,
      sourceId
    }));
  }

  return { matched, unmatched, ambiguous };
}

function addPriorityItems(merged, items, sourceCounts) {
  for (const item of items) {
    if (merged.has(item.id)) {
      continue;
    }
    merged.set(item.id, item);
    sourceCounts[item.source] = (sourceCounts[item.source] || 0) + 1;
  }
}

function resolveWarfarinFallback(record, lookup) {
  const fallback = findWarfarinWikiAssetMatch(record, lookup);
  if (!fallback?.imageUrl) {
    return null;
  }

  return buildSyncItem({
    id: record.id,
    name: record.name,
    type: record.type,
    remoteUrl: fallback.imageUrl,
    source: fallback.id === record.id ? 'warfarin' : 'warfarin_name',
    sourceName: fallback.name || record.name,
    sourceId: fallback.id || null
  });
}

function resolveTeamStardustFallback(record, lookup) {
  const fallback = findTeamStardustAssetMatch(record, lookup);
  if (!fallback?.imageUrl) {
    return null;
  }

  return buildSyncItem({
    id: record.id,
    name: record.name,
    type: record.type,
    remoteUrl: fallback.imageUrl,
    source: fallback.id === record.id ? 'team_stardust' : 'team_stardust_name',
    sourceName: fallback.name || record.name,
    sourceId: fallback.id || null
  });
}

function resolveLegacyBucketFallback(record, bucketObjectMap, supabaseUrl) {
  const folder = record.type === 'weapon' ? 'weapons' : 'characters';
  const extensions = ['webp', 'png', 'jpg', 'jpeg'];

  for (const extension of extensions) {
    const objectPath = `${folder}/${record.id}.${extension}`;
    if (bucketObjectMap.has(objectPath)) {
      return buildSyncItem({
        id: record.id,
        name: record.name,
        type: record.type,
        remoteUrl: buildStoragePublicUrl(supabaseUrl, objectPath),
        source: 'legacy_bucket',
        sourceName: record.name,
        sourceId: record.id,
        extension
      });
    }
  }

  return null;
}

async function ensureOutputDir(filePath) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
}

async function downloadAvatar(item) {
  const response = await fetch(item.remoteUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await ensureOutputDir(item.outputPath);
  await fs.promises.writeFile(item.outputPath, buffer);
}

async function writeAvatarUrlsToDatabase(supabase, items, dbById, logger) {
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    if (String(dbById.get(item.id)?.avatar_url || '').trim() === item.localUrl) {
      skipped += 1;
      continue;
    }

    const { data, error } = await supabase
      .from('characters')
      .update({ avatar_url: item.localUrl })
      .eq('id', item.id)
      .select('id');

    if (error) {
      failed += 1;
      logger(`写库失败 ${item.type}:${item.id} -> ${error.message}`, 'error');
      continue;
    }

    if (!Array.isArray(data) || data.length === 0) {
      failed += 1;
      logger(`写库未命中 ${item.type}:${item.id}`, 'error');
      continue;
    }

    updated += 1;
  }

  return { updated, skipped, failed };
}

function writeSourceOutput(outputPath, sourceRecords) {
  if (!outputPath) {
    return;
  }

  const payload = sourceRecords.map((record) => ({
    source: record.source,
    type: record.type,
    id: record.id || record.itemId || null,
    name: record.name,
    cover: record.cover || record.imageUrl || record.avatar_url || null,
    raw: record.raw || undefined
  }));

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf-8');
}

function buildLogger(prefix) {
  return (message, level = 'log') => {
    const text = `[${prefix}] ${message}`;
    if (level === 'warn') {
      console.warn(text);
      return;
    }
    if (level === 'error') {
      console.error(text);
      return;
    }
    console.log(text);
  };
}

function shouldSkipDownload(item, mode) {
  if (mode === 'full') {
    return false;
  }
  return fs.existsSync(item.outputPath);
}

export async function runLocalAvatarSync(options) {
  const logger = buildLogger(options.commandName || 'sync-local-avatars');
  const requestedTypes = normalizeRequestedTypes(options.type);
  const supabase = createSupabaseClient();
  const existingCharacters = await loadExistingCharacters(supabase);
  const requestedTypeSet = new Set(requestedTypes);
  const scopedExistingCharacters = existingCharacters.filter((record) => requestedTypeSet.has(record.type));
  const dbById = new Map(scopedExistingCharacters.map((record) => [record.id, record]));
  const merged = new Map();
  const sourceCounts = {};
  const sourceRecords = [];

  logger('开始同步站点本地头像资源');
  logger(`类型: ${requestedTypes.join(', ')}`);
  logger(`模式: ${options.mode === 'full' ? '全量刷新' : '增量更新'}${options.dryRun ? ' / 演练模式' : ''}${options.writeDb ? '' : ' / 不写数据库'}`);
  logger('来源优先级: 森空岛官方 Wiki > warfarin.wiki > Team Stardust > 旧 avatars bucket');

  if (options.useSkland) {
    const sklandCatalog = await loadSklandCatalogRecords(requestedTypes, {
      logger: (message) => logger(message)
    });

    for (const itemType of requestedTypes) {
      const dbItems = scopedExistingCharacters.filter((record) => record.type === itemType);
      const records = (sklandCatalog[itemType] || []).map((record) => ({
        ...record,
        source: 'skland',
        type: itemType
      }));
      sourceRecords.push(...records);

      const { matched, unmatched, ambiguous } = matchAssetRecordsToDb(records, dbItems, itemType, 'skland');
      addPriorityItems(merged, matched, sourceCounts);
      logger(`森空岛 ${itemType} 命中 ${matched.length} 条，歧义 ${ambiguous.length} 条，未匹配源项 ${unmatched.length} 条`);
    }
  }

  const getUncoveredRecords = () => scopedExistingCharacters.filter((record) => !merged.has(record.id));

  if (options.useWarfarin && getUncoveredRecords().length > 0) {
    try {
      const warfarinTypes = Array.from(new Set(getUncoveredRecords().map((record) => record.type)));
      const warfarinCatalog = await loadWarfarinWikiAssetCatalog(warfarinTypes, {
        logger: (message) => logger(message)
      });
      const warfarinLookup = buildWarfarinWikiLookup(warfarinCatalog);
      const matched = [];

      for (const record of getUncoveredRecords()) {
        const item = resolveWarfarinFallback(record, warfarinLookup);
        if (item) {
          matched.push(item);
        }
      }

      for (const itemType of requestedTypes) {
        const records = Array.from((warfarinCatalog[itemType] || new Map()).values()).map((record) => ({
          ...record,
          source: 'warfarin',
          type: itemType
        }));
        sourceRecords.push(...records);
      }

      addPriorityItems(merged, matched, sourceCounts);
      logger(`warfarin.wiki 兜底命中 ${matched.length} 条`);
    } catch (error) {
      logger(`warfarin.wiki 兜底加载失败: ${error.message}`, 'warn');
    }
  }

  if (options.useTeamStardust && getUncoveredRecords().length > 0) {
    try {
      const teamStardustTypes = Array.from(new Set(getUncoveredRecords().map((record) => record.type)));
      const teamStardustCatalog = await loadTeamStardustAssetCatalog(teamStardustTypes, {
        logger: (message) => logger(message)
      });
      const teamStardustLookup = buildTeamStardustLookup(teamStardustCatalog);
      const matched = [];

      for (const record of getUncoveredRecords()) {
        const item = resolveTeamStardustFallback(record, teamStardustLookup);
        if (item) {
          matched.push(item);
        }
      }

      addPriorityItems(merged, matched, sourceCounts);
      logger(`Team Stardust 兜底命中 ${matched.length} 条`);
    } catch (error) {
      logger(`Team Stardust 兜底加载失败: ${error.message}`, 'warn');
    }
  }

  if (options.useLegacyBucket && getUncoveredRecords().length > 0) {
    try {
      const bucketObjectMap = await collectAvatarBucketObjectMap(supabase);
      const supabaseUrl = resolveSupabaseUrl();
      const matched = [];

      for (const record of getUncoveredRecords()) {
        const item = resolveLegacyBucketFallback(record, bucketObjectMap, supabaseUrl);
        if (item) {
          matched.push(item);
        }
      }

      addPriorityItems(merged, matched, sourceCounts);
      logger(`旧 avatars bucket 兜底命中 ${matched.length} 条`);
    } catch (error) {
      logger(`旧 avatars bucket 兜底加载失败: ${error.message}`, 'warn');
    }
  }

  writeSourceOutput(options.output, sourceRecords);
  if (options.output) {
    logger(`源站提取记录已写入 ${options.output}`);
  }

  const selectedItems = Array.from(merged.values());
  const unresolvedRecords = getUncoveredRecords();
  const readyItems = [];
  const downloadItems = [];
  let unchangedCount = 0;

  for (const item of selectedItems) {
    const localFileExists = fs.existsSync(item.outputPath);
    const dbAlreadyLocal = String(dbById.get(item.id)?.avatar_url || '').trim() === item.localUrl;

    if (options.mode === 'incremental' && localFileExists && dbAlreadyLocal) {
      unchangedCount += 1;
      continue;
    }

    if (shouldSkipDownload(item, options.mode)) {
      readyItems.push(item);
    } else {
      downloadItems.push(item);
    }
  }

  logger(`覆盖 ${selectedItems.length}/${scopedExistingCharacters.length} 条，未覆盖 ${unresolvedRecords.length} 条`);
  if (unresolvedRecords.length > 0) {
    logger(`仍未覆盖: ${unresolvedRecords.map((record) => `${record.type}:${record.id}(${record.name})`).join(', ')}`);
  }
  logger(`来源命中: ${Object.entries(sourceCounts).map(([source, count]) => `${source}=${count}`).join(', ') || '无'}`);
  logger(`增量跳过 ${unchangedCount} 条，本地文件已存在待写库 ${readyItems.length} 条，待下载 ${downloadItems.length} 条`);

  const processedItems = options.dryRun ? [] : [...readyItems];
  let downloadSuccess = 0;
  let downloadFailed = 0;

  if (options.dryRun) {
    logger(`演练结果: 本地文件已存在待写库 ${readyItems.length} 条，待下载 ${downloadItems.length} 条`);
  } else {
    for (let index = 0; index < downloadItems.length; index += 1) {
      const item = downloadItems[index];
      process.stdout.write(`[${options.commandName}] 下载 ${index + 1}/${downloadItems.length}: ${item.type}:${item.id} (${item.source}) ... `);

      try {
        await downloadAvatar(item);
        processedItems.push(item);
        downloadSuccess += 1;
        console.log('ok');
      } catch (error) {
        downloadFailed += 1;
        console.log(`failed (${error.message})`);
      }

      if (index < downloadItems.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, DOWNLOAD_PAUSE_MS));
      }
    }
  }

  let dbUpdated = 0;
  let dbSkipped = 0;
  let dbFailed = 0;
  if (options.writeDb && processedItems.length > 0 && !options.dryRun) {
    const dbResult = await writeAvatarUrlsToDatabase(supabase, processedItems, dbById, logger);
    dbUpdated = dbResult.updated;
    dbSkipped = dbResult.skipped;
    dbFailed = dbResult.failed;
  }

  logger('完成');
  if (!options.dryRun) {
    logger(`下载成功 ${downloadSuccess}，下载失败 ${downloadFailed}`);
  }
  if (options.writeDb) {
    logger(`写库成功 ${dbUpdated}，写库跳过 ${dbSkipped}，写库失败 ${dbFailed}`);
    logger('下一步：检查 public/avatars 变更，然后提交并推送以触发静态部署');
  } else {
    logger('未写数据库（演练模式或 --no-write-db）');
  }

  return {
    selectedItems,
    unresolvedRecords,
    sourceCounts,
    unchangedCount,
    readyCount: readyItems.length,
    downloadSuccess,
    downloadFailed,
    dbUpdated,
    dbSkipped,
    dbFailed
  };
}

export default {
  parseLocalAvatarSyncArgs,
  printLocalAvatarSyncHelp,
  runLocalAvatarSync
};
