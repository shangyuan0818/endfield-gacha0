import fs from 'node:fs/promises';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';
import {
  resolveSupabasePublishableKey,
  resolveSupabaseSecretKey,
  resolveSupabaseUrl,
} from './lib/supabaseEnv.mjs';

const DEFAULT_PAGE_SIZE = 1000;
const ENV_FILE_CANDIDATES = [
  '.env.local',
  '.env',
  path.join('backend', '.env.local'),
  path.join('backend', '.env'),
];

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseArgs(argv) {
  const options = {
    supabaseUrl: null,
    supabaseKey: null,
    pageSize: DEFAULT_PAGE_SIZE,
    writeJson: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];

    if (arg === '--supabase-url' && nextValue) {
      options.supabaseUrl = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--supabase-key' && nextValue) {
      options.supabaseKey = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--page-size' && nextValue) {
      const pageSize = Number.parseInt(nextValue, 10);
      if (Number.isFinite(pageSize) && pageSize > 0) {
        options.pageSize = pageSize;
      }
      index += 1;
      continue;
    }

    if (arg === '--write-json' && nextValue) {
      options.writeJson = nextValue;
      index += 1;
    }
  }

  return options;
}

async function loadEnvFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const contents = await fs.readFile(absolutePath, 'utf8').catch(() => null);
  if (!contents) {
    return;
  }

  contents
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .forEach((line) => {
      const separatorIndex = line.indexOf('=');
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
}

async function hydrateEnvFiles() {
  for (const candidate of ENV_FILE_CANDIDATES) {
    await loadEnvFile(candidate);
  }
}

function resolveCredentials(options) {
  const supabaseUrl = normalizeText(options.supabaseUrl) || resolveSupabaseUrl();
  const serviceRoleKey = resolveSupabaseSecretKey();
  const explicitKey = normalizeText(options.supabaseKey);
  const publicKey = resolveSupabasePublishableKey();
  const supabaseKey = explicitKey || serviceRoleKey || publicKey;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('缺少 Supabase URL 或可用密钥；请配置 SUPABASE_URL/VITE_SUPABASE_URL 与 SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY 或 SUPABASE_PUBLISHABLE_KEY/VITE_SUPABASE_PUBLISHABLE_KEY');
  }

  return {
    supabaseUrl,
    supabaseKey,
    usingServiceRole: Boolean(serviceRoleKey && supabaseKey === serviceRoleKey),
  };
}

async function fetchExactCount(supabase, table) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw error;
  }

  return Number(count || 0);
}

async function fetchAllRows(supabase, table, columns, { pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, to);

    if (error) {
      throw error;
    }

    const chunk = Array.isArray(data) ? data : [];
    rows.push(...chunk);

    if (chunk.length < pageSize) {
      return rows;
    }

    from += pageSize;
  }
}

function classifyAvatarUrl(url) {
  const value = normalizeText(url);
  if (!value) {
    return 'missing';
  }

  if (value.startsWith('/avatars/')) {
    return 'local_static';
  }

  if (value.startsWith('/api/wiki-proxy')) {
    return 'wiki_proxy';
  }

  if (value.includes('/storage/v1/object/public/avatars')) {
    return 'supabase_storage_public';
  }

  if (/^https?:\/\//i.test(value)) {
    return 'remote_external';
  }

  return 'other';
}

function summarizeCharacters(characters) {
  const avatarUrlBreakdown = {
    missing: 0,
    local_static: 0,
    wiki_proxy: 0,
    supabase_storage_public: 0,
    remote_external: 0,
    other: 0,
  };

  const byType = {};
  const nonLocalAvatarRecords = [];

  for (const character of characters) {
    const avatarKind = classifyAvatarUrl(character.avatar_url);
    avatarUrlBreakdown[avatarKind] = (avatarUrlBreakdown[avatarKind] || 0) + 1;
    byType[character.type] = (byType[character.type] || 0) + 1;

    if (avatarKind !== 'local_static') {
      nonLocalAvatarRecords.push({
        id: character.id,
        name: character.name,
        type: character.type,
        avatar_url: character.avatar_url || null,
        avatarKind,
      });
    }
  }

  return {
    total: characters.length,
    byType,
    avatarUrlBreakdown,
    nonLocalAvatarRecords,
  };
}

function getObjectSize(objectRow) {
  const metadata = objectRow?.metadata;
  if (!metadata || typeof metadata !== 'object') {
    return 0;
  }

  const rawSize = metadata.size ?? metadata.fileSize ?? metadata.filesize ?? 0;
  const size = Number(rawSize);
  return Number.isFinite(size) ? size : 0;
}

function buildStorageSummary(objects) {
  const buckets = new Map();

  for (const objectRow of objects) {
    const bucketId = normalizeText(objectRow?.bucket_id) || 'unknown';
    const size = getObjectSize(objectRow);
    const current = buckets.get(bucketId) || {
      bucketId,
      objectCount: 0,
      totalBytes: 0,
      largestObjects: [],
    };

    current.objectCount += 1;
    current.totalBytes += size;
    current.largestObjects.push({
      name: objectRow?.name || null,
      bytes: size,
      created_at: objectRow?.created_at || null,
      updated_at: objectRow?.updated_at || null,
    });
    current.largestObjects.sort((left, right) => right.bytes - left.bytes);
    current.largestObjects = current.largestObjects.slice(0, 10);

    buckets.set(bucketId, current);
  }

  return Array.from(buckets.values()).sort((left, right) => right.totalBytes - left.totalBytes);
}

async function listBucketPage(bucket, prefix, pageSize, offset) {
  const { data, error } = await bucket.list(prefix, {
    limit: pageSize,
    offset,
    sortBy: {
      column: 'name',
      order: 'asc',
    }
  });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

async function collectBucketObjects(supabase, bucketId, pageSize) {
  const bucket = supabase.storage.from(bucketId);
  const queue = [''];
  const objects = [];

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

        objects.push({
          ...entry,
          bucket_id: bucketId,
          name: fullPath,
        });
      }

      if (page.length < pageSize) {
        break;
      }

      offset += pageSize;
    }
  }

  return objects;
}

async function fetchStorageObjectsViaStorageApi(supabase, pageSize) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    throw error;
  }

  const allObjects = [];

  for (const bucket of buckets || []) {
    const objects = await collectBucketObjects(supabase, bucket.id, pageSize);
    allObjects.push(...objects);
  }

  return allObjects;
}

function printSummary(report) {
  console.log('=== Supabase 配额审计 ===');
  console.log(`项目: ${report.projectRef || 'unknown'}`);
  console.log(`认证: ${report.auth.usingServiceRole ? 'service_role' : 'anon_or_public'}`);
  console.log('');
  console.log('表记录数:');
  Object.entries(report.tableCounts).forEach(([table, count]) => {
    console.log(`- ${table}: ${count}`);
  });
  console.log('');
  console.log('角色头像 URL 分布:');
  Object.entries(report.characters.avatarUrlBreakdown).forEach(([kind, count]) => {
    console.log(`- ${kind}: ${count}`);
  });
  console.log('');

  if (report.characters.nonLocalAvatarRecords.length > 0) {
    console.log('未切到本地静态路径的角色:');
    report.characters.nonLocalAvatarRecords.forEach((record) => {
      console.log(`- ${record.type}:${record.id} (${record.name}) -> ${record.avatarKind} -> ${record.avatar_url || 'null'}`);
    });
    console.log('');
  }

  if (report.storage.status === 'ok') {
    console.log('Storage buckets:');
    report.storage.buckets.forEach((bucket) => {
      console.log(`- ${bucket.bucketId}: ${bucket.objectCount} objects, ${bucket.totalBytes} bytes`);
    });
  } else {
    console.log(`Storage buckets: ${report.storage.status} (${report.storage.message || 'unavailable'})`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await hydrateEnvFiles();
  const { supabaseUrl, supabaseKey, usingServiceRole } = resolveCredentials(options);
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });

  const [historyCount, poolsCount, charactersCount, poolCharactersCount, publicProfilesCount] = await Promise.all([
    fetchExactCount(supabase, 'history'),
    fetchExactCount(supabase, 'pools'),
    fetchExactCount(supabase, 'characters'),
    fetchExactCount(supabase, 'pool_characters'),
    fetchExactCount(supabase, 'public_profiles'),
  ]);

  const characters = await fetchAllRows(
    supabase,
    'characters',
    'id, name, type, avatar_url',
    { pageSize: options.pageSize }
  );

  let storage = {
    status: 'skipped',
    message: usingServiceRole ? 'not attempted' : '需要 SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY 才能可靠审计 storage.objects',
    buckets: [],
  };

  try {
    const storageObjects = await fetchStorageObjectsViaStorageApi(supabase, options.pageSize);
    storage = {
      status: 'ok',
      message: null,
      buckets: buildStorageSummary(storageObjects),
    };
  } catch (error) {
    storage = {
      status: 'unavailable',
      message: error?.message || String(error),
      buckets: [],
    };
  }

  const report = {
    generatedAt: new Date().toISOString(),
    projectRef: (() => {
      try {
        return new URL(supabaseUrl).hostname.split('.')[0] || null;
      } catch {
        return null;
      }
    })(),
    auth: {
      usingServiceRole,
    },
    tableCounts: {
      history: historyCount,
      pools: poolsCount,
      characters: charactersCount,
      pool_characters: poolCharactersCount,
      public_profiles: publicProfilesCount,
    },
    characters: summarizeCharacters(characters),
    storage,
  };

  printSummary(report);

  if (options.writeJson) {
    const outputPath = path.resolve(process.cwd(), options.writeJson);
    await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log('');
    console.log(`JSON 报告已写入: ${outputPath}`);
  }
}

main().catch((error) => {
  console.error('[audit-supabase-quota-usage] 执行失败:', error);
  process.exitCode = 1;
});
