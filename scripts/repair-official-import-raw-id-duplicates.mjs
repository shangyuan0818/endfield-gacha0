#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

import {
  classifyCharacterIdSource,
  normalizeEntityNameForMatch,
} from '../src/utils/canonicalEntityUtils.js';
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
  return typeof value === 'string' ? value.trim() : String(value || '').trim();
}

function normalizeNameKey(value) {
  return normalizeEntityNameForMatch(value);
}

function parseArgs(argv) {
  const options = {
    supabaseUrl: null,
    supabaseKey: null,
    pageSize: DEFAULT_PAGE_SIZE,
    writeJson: null,
    apply: false,
    includeNonnumeric: false,
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
      continue;
    }

    if (arg === '--apply') {
      options.apply = true;
      continue;
    }

    if (arg === '--include-nonnumeric') {
      options.includeNonnumeric = true;
      continue;
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

function isMissingColumnError(error) {
  const text = [
    error?.message,
    error?.details,
    error?.hint,
    error?.code,
  ].map(value => String(value || '')).join('\n');

  return text.includes('does not exist')
    || text.includes('Could not find')
    || text.includes('PGRST204')
    || text.includes('42703');
}

async function countRowsByColumn(supabaseClient, { table, column, value, optionalMissingColumn = false }) {
  const { count, error } = await supabaseClient
    .from(table)
    .select(column, { count: 'exact', head: true })
    .eq(column, value);

  if (error) {
    if (optionalMissingColumn && isMissingColumnError(error)) {
      return {
        count: 0,
        missingColumn: true,
        error: error.message,
      };
    }

    throw new Error(`[${table}.${column}] ${error.message}`);
  }

  return {
    count: Number.isFinite(count) ? count : 0,
    missingColumn: false,
    error: null,
  };
}

function isRawDuplicateCharacter(row, { includeNonnumeric = false } = {}) {
  const id = normalizeText(row?.id);
  if (!id) {
    return false;
  }

  if (/^\d+$/.test(id)) {
    return true;
  }

  return includeNonnumeric && classifyCharacterIdSource(id) === 'source_raw';
}

function isCanonicalTargetCandidate(row) {
  const source = classifyCharacterIdSource(row?.id);
  return source === 'seeded' || source === 'manual_placeholder';
}

function scoreTarget(rawRow, targetRow) {
  if (normalizeText(rawRow?.type) !== normalizeText(targetRow?.type)) {
    return 0;
  }

  const rawName = normalizeNameKey(rawRow?.name);
  const targetName = normalizeNameKey(targetRow?.name);
  if (!rawName || !targetName || rawName !== targetName) {
    return 0;
  }

  let score = 80;
  const rawRarity = Number.parseInt(String(rawRow?.rarity || ''), 10);
  const targetRarity = Number.parseInt(String(targetRow?.rarity || ''), 10);
  if (Number.isFinite(rawRarity) && Number.isFinite(targetRarity)) {
    score += rawRarity === targetRarity ? 8 : -12;
  }

  const targetId = normalizeText(targetRow?.id).toLowerCase();
  if (targetId.startsWith('chr_') || targetId.startsWith('wpn_')) {
    score += 8;
  } else if (targetId.startsWith('char_') || targetId.startsWith('weapon_')) {
    score += 2;
  }
  if (normalizeText(targetRow?.avatar_url)) {
    score += 4;
  }
  if (classifyCharacterIdSource(targetId) === 'manual_placeholder') {
    score -= 10;
  }

  return Math.max(0, score);
}

function findUniqueTarget(rawRow, candidates) {
  const scored = candidates
    .filter(candidate => normalizeText(candidate?.id) !== normalizeText(rawRow?.id))
    .map(candidate => ({ candidate, score: scoreTarget(rawRow, candidate) }))
    .filter(item => item.score >= 50)
    .sort((left, right) => right.score - left.score);

  if (scored.length === 0) {
    return { target: null, reason: 'no_match' };
  }

  if (scored.length > 1 && scored[0].score === scored[1].score) {
    return {
      target: null,
      reason: 'ambiguous_match',
      candidates: scored.slice(0, 5).map(item => ({
        id: item.candidate.id,
        name: item.candidate.name,
        score: item.score,
      })),
    };
  }

  return {
    target: scored[0].candidate,
    reason: 'matched',
    score: scored[0].score,
  };
}

function countPoolCharacterRefs(poolCharacterRows, characterId) {
  return poolCharacterRows.filter(row => normalizeText(row.character_id) === characterId).length;
}

function countFeaturedRefs(poolRows, characterId) {
  return poolRows.filter(pool => (
    Array.isArray(pool.featured_characters)
    && pool.featured_characters.map(normalizeText).includes(characterId)
  )).length;
}

async function buildRepairPlan(supabaseClient, options) {
  const [characterRows, characterAliasRows, poolRows, poolCharacterRows] = await Promise.all([
    loadPagedRows(supabaseClient, {
      table: 'characters',
      select: 'id, name, type, rarity, aliases, avatar_url',
      orderBy: 'id',
      pageSize: options.pageSize,
    }),
    loadPagedRows(supabaseClient, {
      table: 'character_id_aliases',
      select: 'id, source, alias_id, character_id, is_primary',
      orderBy: 'id',
      pageSize: options.pageSize,
    }),
    loadPagedRows(supabaseClient, {
      table: 'pools',
      select: 'pool_id, name, featured_characters',
      orderBy: 'pool_id',
      pageSize: options.pageSize,
    }),
    loadPagedRows(supabaseClient, {
      table: 'pool_characters',
      select: 'pool_id, character_id, is_up, created_at',
      orderBy: 'pool_id',
      pageSize: options.pageSize,
    }),
  ]);

  const rawRows = characterRows.filter(row => isRawDuplicateCharacter(row, options));
  const candidates = characterRows.filter(isCanonicalTargetCandidate);
  const ready = [];
  const skipped = [];

  for (const rawRow of rawRows) {
    const match = findUniqueTarget(rawRow, candidates);
    if (!match.target) {
      skipped.push({
        id: rawRow.id,
        name: rawRow.name,
        type: rawRow.type,
        rarity: rawRow.rarity,
        reason: match.reason,
        candidates: match.candidates || [],
      });
      continue;
    }

    const historyCount = await countRowsByColumn(supabaseClient, {
      table: 'history',
      column: 'character_id',
      value: rawRow.id,
      optionalMissingColumn: true,
    });

    ready.push({
      fromId: rawRow.id,
      toId: match.target.id,
      name: rawRow.name,
      type: rawRow.type,
      rarity: rawRow.rarity,
      targetName: match.target.name,
      targetType: match.target.type,
      targetRarity: match.target.rarity,
      score: match.score,
      references: {
        history: historyCount.count,
        historyCharacterIdMissing: historyCount.missingColumn,
        poolCharacters: countPoolCharacterRefs(poolCharacterRows, rawRow.id),
        featuredCharacters: countFeaturedRefs(poolRows, rawRow.id),
        aliases: characterAliasRows.filter(row => normalizeText(row.character_id) === rawRow.id).length,
      },
      source: {
        aliases: Array.isArray(rawRow.aliases) ? rawRow.aliases : [],
        avatar_url: rawRow.avatar_url || null,
      },
      target: {
        aliases: Array.isArray(match.target.aliases) ? match.target.aliases : [],
        avatar_url: match.target.avatar_url || null,
      },
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      characterCount: characterRows.length,
      rawDuplicateCount: rawRows.length,
      readyCount: ready.length,
      skippedCount: skipped.length,
    },
    ready,
    skipped,
  };
}

function mergeAliases(sourceRow, targetRow) {
  return [...new Set([
    ...(Array.isArray(targetRow.target?.aliases) ? targetRow.target.aliases : []),
    ...(Array.isArray(sourceRow.source?.aliases) ? sourceRow.source.aliases : []),
    sourceRow.fromId,
    sourceRow.name,
  ].map(normalizeText).filter(Boolean))];
}

async function assertNoError(label, result) {
  if (result?.error) {
    throw new Error(`[${label}] ${result.error.message}`);
  }
  return result;
}

async function applyRepairItem(supabaseClient, item, poolRows) {
  await assertNoError('characters.update target', await supabaseClient
    .from('characters')
    .update({
      aliases: mergeAliases(item, item),
      avatar_url: item.target.avatar_url || item.source.avatar_url || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', item.toId));

  await assertNoError('character_id_aliases.update refs', await supabaseClient
    .from('character_id_aliases')
    .update({
      character_id: item.toId,
      is_primary: false,
      updated_at: new Date().toISOString(),
    })
    .eq('character_id', item.fromId));

  await assertNoError('character_id_aliases.upsert official alias', await supabaseClient
    .from('character_id_aliases')
    .upsert([{
      source: 'official_api',
      alias_id: item.fromId,
      character_id: item.toId,
      is_primary: false,
      note: `Official import raw id ${item.fromId} repaired to ${item.toId}`,
    }], { onConflict: 'source,alias_id' }));

  const historyUpdateResult = await supabaseClient
    .from('history')
    .update({
      character_id: item.toId,
      updated_at: new Date().toISOString(),
    })
    .eq('character_id', item.fromId);
  if (historyUpdateResult.error && !isMissingColumnError(historyUpdateResult.error)) {
    throw new Error(`[history.update character_id] ${historyUpdateResult.error.message}`);
  }

  const { data: rosterRows, error: rosterSelectError } = await supabaseClient
    .from('pool_characters')
    .select('pool_id, character_id, is_up, created_at')
    .eq('character_id', item.fromId);
  if (rosterSelectError) {
    throw new Error(`[pool_characters.select] ${rosterSelectError.message}`);
  }

  if (Array.isArray(rosterRows) && rosterRows.length > 0) {
    await assertNoError('pool_characters.upsert target refs', await supabaseClient
      .from('pool_characters')
      .upsert(rosterRows.map(row => ({
        ...row,
        character_id: item.toId,
      })), { onConflict: 'pool_id,character_id' }));

    await assertNoError('pool_characters.delete source refs', await supabaseClient
      .from('pool_characters')
      .delete()
      .eq('character_id', item.fromId));
  }

  for (const pool of poolRows) {
    if (!Array.isArray(pool.featured_characters) || !pool.featured_characters.includes(item.fromId)) {
      continue;
    }

    const featuredCharacters = [...new Set(pool.featured_characters.map((characterId) => (
      characterId === item.fromId ? item.toId : characterId
    )).filter(Boolean))];

    await assertNoError(`pools.update featured_characters ${pool.pool_id}`, await supabaseClient
      .from('pools')
      .update({
        featured_characters: featuredCharacters,
        updated_at: new Date().toISOString(),
      })
      .eq('pool_id', pool.pool_id));
  }

  await assertNoError('characters.delete source', await supabaseClient
    .from('characters')
    .delete()
    .eq('id', item.fromId));
}

async function applyRepairPlan(supabaseClient, plan, options) {
  if (!options.apply || plan.ready.length === 0) {
    return {
      applied: 0,
      skipped: plan.ready.length,
    };
  }

  const poolRows = await loadPagedRows(supabaseClient, {
    table: 'pools',
    select: 'pool_id, featured_characters',
    orderBy: 'pool_id',
    pageSize: options.pageSize,
  });

  let applied = 0;
  for (const item of plan.ready) {
    await applyRepairItem(supabaseClient, item, poolRows);
    applied += 1;
  }

  return {
    applied,
    skipped: 0,
  };
}

async function writeJsonReport(filePath, report) {
  if (!filePath) {
    return null;
  }

  const absolutePath = path.resolve(process.cwd(), filePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, JSON.stringify(report, null, 2), 'utf8');
  return absolutePath;
}

function printPlan(report, targetLabel, applyResult) {
  console.log('# 官方导入 raw ID 重复角色修复计划');
  console.log(`目标: ${targetLabel}`);
  console.log(`生成时间: ${report.generatedAt}`);
  console.log(`角色/武器总数: ${report.summary.characterCount}`);
  console.log(`疑似 raw 重复行: ${report.summary.rawDuplicateCount}`);
  console.log(`可自动修复: ${report.summary.readyCount}`);
  console.log(`跳过: ${report.summary.skippedCount}`);

  if (applyResult) {
    console.log(`实际写入修复: ${applyResult.applied}`);
  } else {
    console.log('当前模式: 只检查不写入；确认计划后添加 --apply 才会实际修复。');
  }

  if (report.ready.length > 0) {
    console.log('\n## 可自动修复项目');
    report.ready.slice(0, 30).forEach((item) => {
      console.log(`- ${item.fromId} ${item.name} [${item.type}/${item.rarity || '未知星级'}] -> ${item.toId} ${item.targetName}，引用 history=${item.references.history}, pool_characters=${item.references.poolCharacters}, featured=${item.references.featuredCharacters}, alias=${item.references.aliases}`);
    });
    if (report.ready.length > 30) {
      console.log(`... 其余 ${report.ready.length - 30} 项已省略，可用 --write-json 查看完整结果`);
    }
  }

  if (report.skipped.length > 0) {
    console.log('\n## 跳过项目');
    report.skipped.slice(0, 30).forEach((item) => {
      console.log(`- ${item.id} ${item.name} [${item.type}/${item.rarity || '未知星级'}] -> ${item.reason}`);
    });
    if (report.skipped.length > 30) {
      console.log(`... 其余 ${report.skipped.length - 30} 项已省略，可用 --write-json 查看完整结果`);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await ensureEnvLoaded();
  const config = resolveSupabaseConfig(options);
  const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const plan = await buildRepairPlan(supabase, options);
  const applyResult = options.apply ? await applyRepairPlan(supabase, plan, options) : null;
  const report = {
    ...plan,
    target: formatSupabaseTargetLabel(config.supabaseUrl, config.authMode),
    mode: options.apply ? 'apply' : 'check_only',
    applyResult,
  };
  const writtenPath = await writeJsonReport(options.writeJson, report);

  printPlan(report, report.target, applyResult);
  if (writtenPath) {
    console.log(`\n已写出 JSON 报告: ${writtenPath}`);
  }
}

main().catch((error) => {
  console.error('[repair-official-import-raw-id-duplicates] 修复失败:', error);
  process.exitCode = 1;
});
