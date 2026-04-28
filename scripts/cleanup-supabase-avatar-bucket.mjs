import fs from 'node:fs/promises';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';
import {
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
const AVATAR_BUCKET_ID = 'avatars';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseArgs(argv) {
  const options = {
    supabaseUrl: null,
    supabaseKey: null,
    pageSize: DEFAULT_PAGE_SIZE,
    dryRun: true,
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

    if (arg === '--execute') {
      options.dryRun = false;
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
  const supabaseKey = normalizeText(options.supabaseKey) || resolveSupabaseSecretKey();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('缺少 SUPABASE_URL/VITE_SUPABASE_URL 或 SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY，无法清理 avatars bucket');
  }

  return {
    supabaseUrl,
    supabaseKey,
  };
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

function parseAvatarBucketPath(url) {
  const value = normalizeText(url);
  if (!value) {
    return null;
  }

  const marker = '/storage/v1/object/public/avatars/';
  const markerIndex = value.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  return value.slice(markerIndex + marker.length);
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await hydrateEnvFiles();
  const { supabaseUrl, supabaseKey } = resolveCredentials(options);
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });

  const [characters, bucketObjects] = await Promise.all([
    fetchAllRows(supabase, 'characters', 'id, name, avatar_url', { pageSize: options.pageSize }),
    collectBucketObjects(supabase, AVATAR_BUCKET_ID, options.pageSize),
  ]);

  const referencedObjectPaths = new Set(
    characters
      .map((character) => parseAvatarBucketPath(character.avatar_url))
      .filter(Boolean)
  );

  const staleObjects = bucketObjects.filter((objectRow) => !referencedObjectPaths.has(objectRow.name));
  const staleObjectPaths = staleObjects.map((objectRow) => objectRow.name);
  const staleBytes = staleObjects.reduce((sum, objectRow) => sum + getObjectSize(objectRow), 0);

  console.log('=== avatars bucket 清理审计 ===');
  console.log(`bucket objects: ${bucketObjects.length}`);
  console.log(`referenced objects: ${referencedObjectPaths.size}`);
  console.log(`stale objects: ${staleObjects.length}`);
  console.log(`stale bytes: ${staleBytes}`);

  if (staleObjects.length > 0) {
    console.log('待清理对象样本:');
    staleObjects.slice(0, 20).forEach((objectRow) => {
      console.log(`- ${objectRow.name} (${getObjectSize(objectRow)} bytes)`);
    });
  }

  if (options.dryRun || staleObjectPaths.length === 0) {
    console.log(options.dryRun ? 'dry-run: 未执行删除' : '没有可删除对象');
    return;
  }

  let deleted = 0;
  const batchSize = 100;

  for (let index = 0; index < staleObjectPaths.length; index += batchSize) {
    const batch = staleObjectPaths.slice(index, index + batchSize);
    const { error } = await supabase.storage.from(AVATAR_BUCKET_ID).remove(batch);
    if (error) {
      throw error;
    }
    deleted += batch.length;
    console.log(`已删除 ${deleted}/${staleObjectPaths.length}`);
  }

  console.log('清理完成');
}

main().catch((error) => {
  console.error('[cleanup-supabase-avatar-bucket] 执行失败:', error);
  process.exitCode = 1;
});
