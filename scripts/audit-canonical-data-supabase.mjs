import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';
import {
  resolveSupabasePublishableKey,
  resolveSupabaseSecretKey,
  resolveSupabaseUrl,
} from './lib/supabaseEnv.mjs';

import {
  buildCharacterAuditKey,
  buildPoolAuditKey,
  classifyCharacterIdSource,
  classifyPoolIdSource,
  normalizePoolType,
} from '../src/utils/canonicalEntityUtils.js';
import { buildManualPlaceholderRetirementReport } from './lib/manualPlaceholderAudit.mjs';

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

export function parseArgs(argv) {
  const options = {
    supabaseUrl: null,
    supabaseKey: null,
    pageSize: DEFAULT_PAGE_SIZE,
    writeJson: null,
  };
  const positional = [];

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
      continue;
    }

    if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  if (!options.writeJson && positional[0] && /\.json$/i.test(positional[0])) {
    options.writeJson = positional[0];
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
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
}

async function ensureEnvLoaded() {
  for (const candidate of ENV_FILE_CANDIDATES) {
    await loadEnvFile(candidate);
  }
}

function resolveSupabaseConfig(options) {
  const secretKey = resolveSupabaseSecretKey();
  const supabaseUrl = normalizeText(options.supabaseUrl) || resolveSupabaseUrl() || null;
  const supabaseKey = normalizeText(options.supabaseKey)
    || secretKey
    || resolveSupabasePublishableKey()
    || null;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('缺少 Supabase 配置；请提供 --supabase-url / --supabase-key，或在 .env 中配置 SUPABASE_URL/VITE_SUPABASE_URL + SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY');
  }

  return {
    supabaseUrl,
    supabaseKey,
    authMode: normalizeText(options.supabaseKey) || (secretKey && supabaseKey === secretKey) ? 'service_role_or_custom' : 'anon_or_public',
  };
}

function formatSupabaseTargetLabel(supabaseUrl, authMode) {
  try {
    return `${new URL(supabaseUrl).origin} (${authMode})`;
  } catch {
    return `Supabase (${authMode})`;
  }
}

async function loadPagedRows(supabaseClient, { table, select, orderBy, pageSize }) {
  const rows = [];
  let pageIndex = 0;

  while (true) {
    const from = pageIndex * pageSize;
    const to = from + pageSize - 1;
    let query = supabaseClient.from(table).select(select).range(from, to);
    if (orderBy) {
      query = query.order(orderBy, { ascending: true });
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`[${table}] ${error.message}`);
    }

    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);
    if (batch.length < pageSize) {
      break;
    }

    pageIndex += 1;
  }

  return rows;
}

async function loadHistoryRows(supabaseClient, pageSize) {
  try {
    const rows = await loadPagedRows(supabaseClient, {
      table: 'history',
      select: 'record_id, pool_id, character_id',
      orderBy: 'record_id',
      pageSize,
    });
    return {
      rows,
      historyHasCharacterId: true,
    };
  } catch (error) {
    const message = String(error?.message || '');
    const missingCharacterId = message.includes('history.character_id does not exist')
      || message.includes("Could not find the 'character_id' column");

    if (!missingCharacterId) {
      throw error;
    }

    const rows = await loadPagedRows(supabaseClient, {
      table: 'history',
      select: 'record_id, pool_id',
      orderBy: 'record_id',
      pageSize,
    });
    return {
      rows,
      historyHasCharacterId: false,
    };
  }
}

function groupBy(items, buildKey) {
  const grouped = new Map();
  items.forEach((item) => {
    const key = buildKey(item);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(item);
  });
  return grouped;
}

function getConflictConfidence(auditKey) {
  return auditKey.includes('|name:') ? 'low' : auditKey.split('|').length >= 3 ? 'high' : 'medium';
}

function findPoolAliasCandidates(poolRecords) {
  return Array.from(groupBy(poolRecords, buildPoolAuditKey).entries())
    .map(([auditKey, records]) => {
      const distinctIds = [...new Set(records.map(record => record.pool_id))];
      if (distinctIds.length <= 1) {
        return null;
      }

      return {
        auditKey,
        confidence: getConflictConfidence(auditKey),
        records: records.map(record => ({
          pool_id: record.pool_id,
          source: record.source,
          idSource: classifyPoolIdSource(record.pool_id),
          name: record.name,
        })),
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.records.length - left.records.length);
}

function findCharacterAliasCandidates(characterRecords) {
  return Array.from(groupBy(characterRecords, buildCharacterAuditKey).entries())
    .map(([auditKey, records]) => {
      const distinctIds = [...new Set(records.map(record => record.id))];
      if (distinctIds.length <= 1) {
        return null;
      }

      return {
        auditKey,
        records: records.map(record => ({
          id: record.id,
          source: record.source,
          idSource: classifyCharacterIdSource(record.id),
          name: record.name,
        })),
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.records.length - left.records.length);
}

function buildFeaturedCharacterIssues(poolRecords, characterRecords) {
  const knownCharacterIds = new Set(characterRecords.map(record => record.id));
  return poolRecords
    .filter(record => Array.isArray(record.featured_characters) && record.featured_characters.length > 0)
    .map((record) => {
      const missingIds = record.featured_characters.filter(characterId => !knownCharacterIds.has(characterId));
      return missingIds.length > 0 ? { pool_id: record.pool_id, source: record.source, missingIds } : null;
    })
    .filter(Boolean);
}

function pickPreferredAliasRow(rows) {
  return [...rows].sort((left, right) => {
    const leftPrimary = left.is_primary ? 1 : 0;
    const rightPrimary = right.is_primary ? 1 : 0;
    if (leftPrimary !== rightPrimary) {
      return rightPrimary - leftPrimary;
    }
    if (left.source === 'internal' && right.source !== 'internal') return -1;
    if (left.source !== 'internal' && right.source === 'internal') return 1;
    return Number(left.id || 0) - Number(right.id || 0);
  })[0];
}

function buildResolvedAliasMap(aliasRows, targetColumn) {
  const grouped = new Map();
  aliasRows.forEach((row) => {
    const aliasId = normalizeText(row.alias_id);
    if (!aliasId) {
      return;
    }
    if (!grouped.has(aliasId)) {
      grouped.set(aliasId, []);
    }
    grouped.get(aliasId).push(row);
  });

  const resolved = new Map();
  grouped.forEach((rows, aliasId) => {
    const targetId = normalizeText(pickPreferredAliasRow(rows)?.[targetColumn]);
    if (targetId) {
      resolved.set(aliasId, targetId);
    }
  });
  return resolved;
}

function buildMissingInternalSelfAliases(canonicalIds, aliasRows, classifyIdSource, targetColumn) {
  const selfAliasSet = new Set(
    aliasRows
      .filter(row => row.source === 'internal' && row.is_primary === true && normalizeText(row.alias_id) === normalizeText(row[targetColumn]))
      .map(row => normalizeText(row.alias_id))
  );

  return canonicalIds
    .filter(id => !selfAliasSet.has(id))
    .map(id => ({ id, idSource: classifyIdSource(id) }));
}

function buildHistoryReferenceReport(historyIds, canonicalIds, aliasRows, classifyIdSource, targetColumn, canonicalLookup = new Map(), sourceLookup = new Map()) {
  const canonicalSet = new Set(canonicalIds);
  const aliasMap = buildResolvedAliasMap(aliasRows, targetColumn);
  const uniqueIds = [...new Set(historyIds.map(normalizeText).filter(Boolean))].sort((left, right) => left.localeCompare(right));

  const aliasBacked = [];
  const unresolved = [];
  uniqueIds.forEach((id) => {
    if (canonicalSet.has(id)) {
      return;
    }

    const canonicalId = aliasMap.get(id);
    if (canonicalId) {
      const canonicalRecord = canonicalLookup.get(canonicalId) || null;
      const sourceRecord = sourceLookup.get(id) || null;
      aliasBacked.push({
        id,
        canonicalId,
        idSource: classifyIdSource(id),
        sourceName: sourceRecord?.name || null,
        sourceType: sourceRecord?.type || null,
        canonicalName: canonicalRecord?.name || null,
        canonicalType: canonicalRecord?.type || null,
      });
      return;
    }

    const sourceRecord = sourceLookup.get(id) || null;
    unresolved.push({
      id,
      idSource: classifyIdSource(id),
      sourceName: sourceRecord?.name || null,
      sourceType: sourceRecord?.type || null,
    });
  });

  return { aliasBacked, unresolved };
}

function printTopItems(items, formatter, limit = 10) {
  items.slice(0, limit).forEach((item, index) => console.log(formatter(item, index)));
  if (items.length > limit) {
    console.log(`... 其余 ${items.length - limit} 项已省略，可用 --write-json 查看完整结果`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await ensureEnvLoaded();
  const config = resolveSupabaseConfig(options);
  const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const historyResult = await loadHistoryRows(supabase, options.pageSize);
  const historyHasCharacterId = historyResult.historyHasCharacterId;

  const [poolRows, characterRows, historyRows, characterAliasRows, poolAliasRows, poolCharacterRows] = await Promise.all([
    loadPagedRows(supabase, { table: 'pools', select: 'pool_id, name, type, up_character, start_time, end_time, featured_characters', orderBy: 'pool_id', pageSize: options.pageSize }),
    loadPagedRows(supabase, { table: 'characters', select: 'id, name, type, aliases', orderBy: 'id', pageSize: options.pageSize }),
    Promise.resolve(historyResult.rows),
    loadPagedRows(supabase, { table: 'character_id_aliases', select: 'id, source, alias_id, character_id, is_primary', orderBy: 'id', pageSize: options.pageSize }),
    loadPagedRows(supabase, { table: 'pool_id_aliases', select: 'id, source, alias_id, pool_id, is_primary', orderBy: 'id', pageSize: options.pageSize }),
    loadPagedRows(supabase, { table: 'pool_characters', select: 'pool_id, character_id', orderBy: 'pool_id', pageSize: options.pageSize }),
  ]);

  const pools = poolRows.map(row => ({ ...row, type: normalizePoolType(row.type), source: 'supabase-pools' }));
  const characters = characterRows.map(row => ({ ...row, source: 'supabase-characters' }));
  const poolLookup = new Map(pools.map(pool => [pool.pool_id, pool]));
  const characterLookup = new Map(characters.map(character => [character.id, character]));
  const historyPoolSummary = [...new Set(historyRows.map(row => normalizeText(row.pool_id)).filter(Boolean))]
    .map(poolId => {
      const pool = poolLookup.get(poolId);
      return {
        source: 'supabase-history',
        pool_id: poolId,
        name: pool?.name || null,
        type: pool?.type || 'unknown',
        up_character: pool?.up_character || null,
        start_time: pool?.start_time || null,
        end_time: pool?.end_time || null,
        featured_characters: [],
      };
    });

  const poolAliasCandidates = findPoolAliasCandidates([...pools, ...historyPoolSummary]);
  const characterAliasCandidates = findCharacterAliasCandidates(characters);
  const featuredCharacterIssues = buildFeaturedCharacterIssues(pools, characters);
  const missingCharacterSelfAliases = buildMissingInternalSelfAliases(characters.map(record => record.id), characterAliasRows, classifyCharacterIdSource, 'character_id');
  const missingPoolSelfAliases = buildMissingInternalSelfAliases(pools.map(record => record.pool_id), poolAliasRows, classifyPoolIdSource, 'pool_id');
  const historyPoolReferences = buildHistoryReferenceReport(
    historyRows.map(row => row.pool_id),
    pools.map(pool => pool.pool_id),
    poolAliasRows,
    classifyPoolIdSource,
    'pool_id',
    poolLookup,
    poolLookup
  );
  const historyCharacterReferences = historyHasCharacterId
    ? buildHistoryReferenceReport(
      historyRows.map(row => row.character_id),
      characters.map(character => character.id),
      characterAliasRows,
      classifyCharacterIdSource,
      'character_id',
      characterLookup,
      characterLookup
    )
    : { aliasBacked: [], unresolved: [] };
  const manualPlaceholderRetirement = buildManualPlaceholderRetirementReport({
    pools,
    characters,
    characterAliasRows,
    poolAliasRows,
    historyRows,
    poolCharacterRows,
  });

  const report = {
    generatedAt: new Date().toISOString(),
    target: formatSupabaseTargetLabel(config.supabaseUrl, config.authMode),
    schemaCapabilities: {
      historyCharacterId: historyHasCharacterId,
    },
    summary: {
      poolCount: pools.length,
      characterCount: characters.length,
      historyRowCount: historyRows.length,
      characterAliasRowCount: characterAliasRows.length,
      poolAliasRowCount: poolAliasRows.length,
      poolCharacterRowCount: poolCharacterRows.length,
      poolAliasCandidateCount: poolAliasCandidates.length,
      characterAliasCandidateCount: characterAliasCandidates.length,
      featuredCharacterIssueCount: featuredCharacterIssues.length,
      missingCharacterSelfAliasCount: missingCharacterSelfAliases.length,
      missingPoolSelfAliasCount: missingPoolSelfAliases.length,
      historyPoolAliasBackedReferenceCount: historyPoolReferences.aliasBacked.length,
      historyPoolUnresolvedReferenceCount: historyPoolReferences.unresolved.length,
      historyCharacterAliasBackedReferenceCount: historyCharacterReferences.aliasBacked.length,
      historyCharacterUnresolvedReferenceCount: historyCharacterReferences.unresolved.length,
    },
    poolAliasCandidates,
    characterAliasCandidates,
    featuredCharacterIssues,
    missingCharacterSelfAliases,
    missingPoolSelfAliases,
    historyPoolReferences,
    historyCharacterReferences,
    candidateSourceRows: {
      characters: characters.map(row => ({
        id: row.id,
        name: row.name || null,
        type: row.type || null,
        source: row.source,
      })),
      pools: pools.map(row => ({
        pool_id: row.pool_id,
        name: row.name || null,
        type: row.type || null,
        start_time: row.start_time || null,
        end_time: row.end_time || null,
        up_character: row.up_character || null,
        source: row.source,
      })),
      characterAliasRows: characterAliasRows.map(row => ({
        source: row.source || null,
        alias_id: row.alias_id || null,
        character_id: row.character_id || null,
        is_primary: row.is_primary === true,
      })),
      poolAliasRows: poolAliasRows.map(row => ({
        source: row.source || null,
        alias_id: row.alias_id || null,
        pool_id: row.pool_id || null,
        is_primary: row.is_primary === true,
      })),
    },
    manualPlaceholderRetirement,
  };

  console.log('# DATA-NEW-008 Supabase 审计报告');
  console.log(`目标: ${report.target}`);
  console.log(`生成时间: ${report.generatedAt}`);
  console.log(`角色记录: ${report.summary.characterCount}`);
  console.log(`卡池记录: ${report.summary.poolCount}`);
  console.log(`history 记录: ${report.summary.historyRowCount}`);
  console.log(`角色 alias 行: ${report.summary.characterAliasRowCount}`);
  console.log(`卡池 alias 行: ${report.summary.poolAliasRowCount}`);
  console.log(`卡池角色关联行: ${report.summary.poolCharacterRowCount}`);
  console.log(`缺失角色 internal self alias: ${report.summary.missingCharacterSelfAliasCount}`);
  console.log(`缺失卡池 internal self alias: ${report.summary.missingPoolSelfAliasCount}`);
  console.log(`history.character_id 列存在: ${report.schemaCapabilities.historyCharacterId ? '是' : '否'}`);
  console.log(`history.pool_id 中仍使用 alias 的引用: ${report.summary.historyPoolAliasBackedReferenceCount}`);
  console.log(`history.pool_id 无法解析的引用: ${report.summary.historyPoolUnresolvedReferenceCount}`);
  console.log(`history.character_id 中仍使用 alias 的引用: ${report.summary.historyCharacterAliasBackedReferenceCount}`);
  console.log(`history.character_id 无法解析的引用: ${report.summary.historyCharacterUnresolvedReferenceCount}`);
  console.log(`手动角色/武器 placeholder: ${manualPlaceholderRetirement.summary.characterPlaceholderCount}，可直接 merge: ${manualPlaceholderRetirement.summary.readyCharacterMergeCount}`);
  console.log(`手动卡池 placeholder: ${manualPlaceholderRetirement.summary.poolPlaceholderCount}，可直接 merge: ${manualPlaceholderRetirement.summary.readyPoolMergeCount}`);

  if (poolAliasCandidates.length > 0) {
    console.log('\n## 潜在卡池别名冲突');
    printTopItems(poolAliasCandidates, (candidate) => {
      const ids = candidate.records.map(record => `${record.pool_id} [${record.idSource}/${record.source}]`).join(' | ');
      return `- ${candidate.confidence.toUpperCase()} ${candidate.auditKey}: ${ids}`;
    });
  }

  if (characterAliasCandidates.length > 0) {
    console.log('\n## 潜在角色别名冲突');
    printTopItems(characterAliasCandidates, (candidate) => {
      const ids = candidate.records.map(record => `${record.id} [${record.idSource}/${record.source}]`).join(' | ');
      return `- ${candidate.auditKey}: ${ids}`;
    });
  }

  if (historyPoolReferences.aliasBacked.length > 0) {
    console.log('\n## history.pool_id 中仍使用 alias 的引用');
    printTopItems(historyPoolReferences.aliasBacked, item => `- ${item.id} [${item.idSource}] -> ${item.canonicalId}`, 20);
  }

  if (historyCharacterReferences.aliasBacked.length > 0) {
    console.log('\n## history.character_id 中仍使用 alias 的引用');
    printTopItems(historyCharacterReferences.aliasBacked, item => `- ${item.id} [${item.idSource}] -> ${item.canonicalId}`, 20);
  }

  if (historyPoolReferences.unresolved.length > 0) {
    console.log('\n## history.pool_id 无法解析的引用');
    printTopItems(historyPoolReferences.unresolved, item => `- ${item.id} [${item.idSource}]`, 20);
  }

  if (historyCharacterReferences.unresolved.length > 0) {
    console.log('\n## history.character_id 无法解析的引用');
    printTopItems(historyCharacterReferences.unresolved, item => `- ${item.id} [${item.idSource}]`, 20);
  }

  if (manualPlaceholderRetirement.characters.length > 0) {
    console.log('\n## 手动角色/武器 placeholder 退场清单');
    printTopItems(manualPlaceholderRetirement.characters, item => (
      `- ${item.id} [${item.state}] ${item.name || ''} -> ${item.alias.canonicalTargetIds.join(', ') || '待官方 ID'}`
    ), 20);
  }

  if (manualPlaceholderRetirement.pools.length > 0) {
    console.log('\n## 手动卡池 placeholder 退场清单');
    printTopItems(manualPlaceholderRetirement.pools, item => (
      `- ${item.id} [${item.state}] ${item.name || ''} -> ${item.alias.canonicalTargetIds.join(', ') || '待官方 ID'}`
    ), 20);
  }

  if (featuredCharacterIssues.length > 0) {
    console.log('\n## featured_characters 缺失引用');
    printTopItems(featuredCharacterIssues, issue => `- ${issue.pool_id} (${issue.source}) 缺少角色 ID: ${issue.missingIds.join(', ')}`, 20);
  }

  if (options.writeJson) {
    const outputPath = path.resolve(process.cwd(), options.writeJson);
    await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`\n已写出 JSON 报告: ${outputPath}`);
  }
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((error) => {
    console.error('[audit-canonical-data-supabase] 执行失败:', error);
    process.exitCode = 1;
  });
}
