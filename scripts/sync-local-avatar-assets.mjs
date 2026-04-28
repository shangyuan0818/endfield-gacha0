import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { buildLocalAvatarPath, inferAvatarFileExtension } from '../src/utils/avatarAssetPaths.js';
import { matchSklandImagesToCharacters } from '../src/utils/sklandCatalogImport.js';
import {
  resolveSupabaseSecretKey,
  resolveSupabaseUrl,
} from './lib/supabaseEnv.mjs';
import {
  buildTeamStardustLookup,
  findTeamStardustAssetMatch,
  loadTeamStardustAssetCatalog
} from './lib/teamStardustAssetCatalog.mjs';
import { loadSklandCatalogRecords } from './lib/sklandCatalogSource.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLIC_AVATAR_DIR = path.join(PROJECT_ROOT, 'public', 'avatars');
const AVATAR_BUCKET_ID = 'avatars';
const DEFAULT_PAGE_SIZE = 1000;
const ENV_FILE_CANDIDATES = [
  path.join(PROJECT_ROOT, '.env.local'),
  path.join(PROJECT_ROOT, '.env'),
  path.join(PROJECT_ROOT, 'backend', '.env.local'),
  path.join(PROJECT_ROOT, 'backend', '.env')
];

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    type: 'all',
    dryRun: false,
    writeDb: true
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--type' && args[index + 1]) {
      options.type = args[index + 1];
      index += 1;
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
  }

  if (!['character', 'weapon', 'all'].includes(options.type)) {
    throw new Error('--type 必须为 character | weapon | all');
  }

  if (options.dryRun) {
    options.writeDb = false;
  }

  return options;
}

function buildSyncItems(type, updates) {
  return updates
    .filter((record) => Boolean(record.id && record.avatar_url))
    .map((record) => buildSyncItem({
      id: record.id,
      name: record.name,
      type,
      remoteUrl: record.avatar_url,
      source: 'skland'
    }));
}

function buildStoragePublicUrl(supabaseUrl, objectPath) {
  if (!supabaseUrl || !objectPath) {
    return null;
  }

  return `${supabaseUrl}/storage/v1/object/public/${AVATAR_BUCKET_ID}/${objectPath}`;
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
    throw new Error('缺少 SUPABASE_URL/VITE_SUPABASE_URL 或 SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY，无法写回 characters.avatar_url');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

async function loadExistingCharacters(supabase) {
  const { data, error } = await supabase
    .from('characters')
    .select('id, name, type, aliases, avatar_url');

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

function buildSyncItem({ id, name, type, remoteUrl, source = 'wiki', extension }) {
  const resolvedExtension = inferAvatarFileExtension(remoteUrl, extension || 'webp');
  return {
    id,
    name,
    type,
    remoteUrl,
    localUrl: buildLocalAvatarPath(type, id, resolvedExtension),
    outputPath: path.join(PUBLIC_AVATAR_DIR, `${type}s`, `${id}.${resolvedExtension}`),
    source
  };
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
        extension
      });
    }
  }

  return null;
}

function resolveTeamStardustFallback(record, teamStardustLookup) {
  const fallback = findTeamStardustAssetMatch(record, teamStardustLookup);
  if (!fallback?.imageUrl) {
    return null;
  }

  return buildSyncItem({
    id: record.id,
    name: record.name,
    type: record.type,
    remoteUrl: fallback.imageUrl,
    source: fallback.id === record.id ? 'team_stardust' : 'team_stardust_name'
  });
}

function mergeSyncQueue(sourceItems, existingCharacters, bucketObjectMap, supabaseUrl, teamStardustLookup) {
  const merged = new Map();
  let teamStardustFallbackCount = 0;
  let legacyFallbackCount = 0;

  sourceItems.forEach((item) => {
    merged.set(item.id, {
      ...item,
      source: 'wiki'
    });
  });

  existingCharacters.forEach((record) => {
    if (merged.has(record.id)) {
      return;
    }

    const teamStardustItem = resolveTeamStardustFallback(record, teamStardustLookup);
    if (teamStardustItem) {
      merged.set(record.id, teamStardustItem);
      teamStardustFallbackCount += 1;
      return;
    }

    const fallbackItem = resolveLegacyBucketFallback(record, bucketObjectMap, supabaseUrl);
    if (fallbackItem) {
      merged.set(record.id, fallbackItem);
      legacyFallbackCount += 1;
    }
  });

  return {
    items: Array.from(merged.values()),
    teamStardustFallbackCount,
    legacyFallbackCount
  };
}

async function writeAvatarUrlsToDatabase(items) {
  const supabase = createSupabaseClient();
  let updated = 0;
  let failed = 0;

  for (const item of items) {
    const { data, error } = await supabase
      .from('characters')
      .update({ avatar_url: item.localUrl })
      .eq('id', item.id)
      .select('id');

    if (error) {
      failed += 1;
      console.error(`[sync-local-avatars] 写库失败 ${item.type}:${item.id} -> ${error.message}`);
      continue;
    }

    if (!Array.isArray(data) || data.length === 0) {
      failed += 1;
      console.error(`[sync-local-avatars] 写库未命中 ${item.type}:${item.id}`);
      continue;
    }

    updated += 1;
  }

  return { updated, failed };
}

async function main() {
  const options = parseArgs();
  const requestedTypes = options.type === 'all' ? ['character', 'weapon'] : [options.type];
  const supabase = createSupabaseClient();
  const existingCharacters = await loadExistingCharacters(supabase);
  const bucketObjectMap = await collectAvatarBucketObjectMap(supabase);
  const supabaseUrl = resolveSupabaseUrl();

  console.log('[sync-local-avatars] 开始同步站点本地头像资源');
  console.log(`[sync-local-avatars] 类型: ${requestedTypes.join(', ')}${options.dryRun ? ' (dry-run)' : ''}`);

  const sourceItems = [];
  const sklandCatalog = await loadSklandCatalogRecords(requestedTypes, {
    logger: (message) => {
      console.log(`[sync-local-avatars] ${message}`);
    }
  });

  for (const itemType of requestedTypes) {
    const scopedRecords = existingCharacters.filter((record) => record.type === itemType);
    const { updates, ambiguous, unmatched } = matchSklandImagesToCharacters(
      sklandCatalog[itemType] || [],
      scopedRecords,
      itemType
    );
    const items = buildSyncItems(itemType, updates);
    sourceItems.push(...items);

    console.log(
      `[sync-local-avatars] 森空岛 ${itemType} 命中 ${updates.length} 条，歧义 ${ambiguous.length} 条，未匹配源项 ${unmatched.length} 条`
    );
  }

  const requestedTypeSet = new Set(requestedTypes);
  const scopedExistingCharacters = existingCharacters.filter((record) => requestedTypeSet.has(record.type));
  const sourceItemIds = new Set(sourceItems.map((item) => item.id));
  const unresolvedCharacters = scopedExistingCharacters.filter((record) => !sourceItemIds.has(record.id));
  let teamStardustCatalog = {
    character: new Map(),
    weapon: new Map()
  };
  let teamStardustLookup = buildTeamStardustLookup(teamStardustCatalog);

  if (unresolvedCharacters.length > 0) {
    try {
      teamStardustCatalog = await loadTeamStardustAssetCatalog(
        Array.from(new Set(unresolvedCharacters.map((record) => record.type))),
        {
          logger: (message) => {
            console.log(`[sync-local-avatars] ${message}`);
          }
        }
      );
      teamStardustLookup = buildTeamStardustLookup(teamStardustCatalog);
    } catch (error) {
      console.warn(`[sync-local-avatars] Team Stardust 兜底加载失败: ${error.message}`);
    }
  }

  const {
    items: downloadQueue,
    teamStardustFallbackCount,
    legacyFallbackCount
  } = mergeSyncQueue(
    sourceItems,
    scopedExistingCharacters,
    bucketObjectMap,
    supabaseUrl,
    teamStardustLookup
  );
  const coveredIds = new Set(downloadQueue.map((item) => item.id));
  const unresolvedRecords = scopedExistingCharacters.filter((record) => !coveredIds.has(record.id));

  if (teamStardustFallbackCount > 0) {
    console.log(`[sync-local-avatars] 已使用 Team Stardust 兜底 ${teamStardustFallbackCount} 条未被当前 Wiki 覆盖的记录`);
  }

  if (legacyFallbackCount > 0) {
    console.log(`[sync-local-avatars] 已使用旧 avatars bucket 兜底 ${legacyFallbackCount} 条未被 Wiki 覆盖的记录`);
  }

  if (unresolvedRecords.length > 0) {
    console.log(`[sync-local-avatars] 仍未覆盖 ${unresolvedRecords.length} 条记录: ${unresolvedRecords.map((record) => `${record.type}:${record.id}(${record.name})`).join(', ')}`);
  }

  let downloadSuccess = 0;
  let downloadFailed = 0;
  const downloadedItems = [];

  for (let index = 0; index < downloadQueue.length; index += 1) {
    const item = downloadQueue[index];
    process.stdout.write(`[sync-local-avatars] 下载 ${index + 1}/${downloadQueue.length}: ${item.type}:${item.id} ... `);

    try {
      if (!options.dryRun) {
        await downloadAvatar(item);
      }

      downloadedItems.push(item);
      downloadSuccess += 1;
      console.log('ok');
    } catch (error) {
      downloadFailed += 1;
      console.log(`failed (${error.message})`);
    }
  }

  let dbUpdated = 0;
  let dbFailed = 0;
  if (options.writeDb && downloadedItems.length > 0) {
    const dbResult = await writeAvatarUrlsToDatabase(downloadedItems);
    dbUpdated = dbResult.updated;
    dbFailed = dbResult.failed;
  }

  console.log('[sync-local-avatars] 完成');
  console.log(`[sync-local-avatars] 下载成功 ${downloadSuccess}，下载失败 ${downloadFailed}`);
  if (options.writeDb) {
    console.log(`[sync-local-avatars] 写库成功 ${dbUpdated}，写库失败 ${dbFailed}`);
    console.log('[sync-local-avatars] 下一步：检查 public/avatars 变更，然后提交并推送以触发静态部署');
  } else {
    console.log('[sync-local-avatars] 未写库（dry-run 或 --no-write-db）');
  }
}

main().catch((error) => {
  console.error('[sync-local-avatars] 失败:', error);
  process.exitCode = 1;
});
