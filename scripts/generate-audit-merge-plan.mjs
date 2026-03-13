import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseArgs(argv) {
  const options = {
    audit: null,
    out: null,
  };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];

    if (arg === '--audit' && nextValue) {
      options.audit = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--out' && nextValue) {
      options.out = nextValue;
      index += 1;
      continue;
    }

    if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  if (!options.audit && positional[0]) {
    options.audit = positional[0];
  }

  if (!options.out && positional[1]) {
    options.out = positional[1];
  }

  return options;
}

async function readJsonFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const contents = await fs.readFile(absolutePath, 'utf8');
  return JSON.parse(contents);
}

function buildDefaultOutPath(auditPath) {
  const absoluteInput = path.resolve(process.cwd(), auditPath);
  const parsedPath = path.parse(absoluteInput);
  return path.join(parsedPath.dir, `${parsedPath.name}.merge-plan.generated.json`);
}

function inferCharacterCanonicalSource(characterId) {
  const normalized = normalizeText(characterId).toLowerCase();

  if (normalized.startsWith('chr_') || normalized.startsWith('wpn_')) {
    return 'official_api';
  }

  if (normalized.startsWith('char_') || normalized.startsWith('weapon_')) {
    return 'wiki';
  }

  if (normalized.startsWith('manual_character_') || normalized.startsWith('manual_weapon_')) {
    return 'manual_placeholder';
  }

  return 'custom';
}

function inferCharacterAliasSource(idSource) {
  switch (normalizeText(idSource)) {
    case 'manual_placeholder':
      return 'manual_placeholder';
    case 'seeded':
      return 'legacy_manual';
    case 'source_raw':
      return 'import_raw';
    case 'custom':
      return 'custom';
    default:
      return 'custom';
  }
}

function inferPoolCanonicalSource(poolId) {
  const normalized = normalizeText(poolId).toLowerCase();

  if (
    normalized === 'standard'
    || normalized === 'beginner'
    || normalized.startsWith('special_')
    || normalized.startsWith('weponbox_')
    || normalized.startsWith('weaponbox_')
  ) {
    return 'official_api';
  }

  if (normalized.startsWith('manual_pool_')) {
    return 'manual_placeholder';
  }

  return 'custom';
}

function inferPoolAliasSource(idSource) {
  switch (normalizeText(idSource)) {
    case 'manual_placeholder':
      return 'manual_placeholder';
    case 'legacy_manual_seed':
      return 'legacy_manual';
    case 'custom_pool':
    case 'custom':
      return 'custom';
    case 'official':
      return 'official_api';
    default:
      return 'custom';
  }
}

function dedupeMergeEntries(items) {
  const unique = new Map();
  items.forEach((item) => {
    const fromId = normalizeText(item.fromId);
    const toId = normalizeText(item.toId);
    if (!fromId || !toId || fromId === toId) {
      return;
    }

    const key = `${fromId}=>${toId}`;
    if (!unique.has(key)) {
      unique.set(key, item);
    }
  });

  return [...unique.values()].sort((left, right) => {
    const fromCompare = left.fromId.localeCompare(right.fromId);
    if (fromCompare !== 0) {
      return fromCompare;
    }
    return left.toId.localeCompare(right.toId);
  });
}

function buildCharacterMergeEntry(item) {
  return {
    fromId: item.id,
    toId: item.canonicalId,
    fromSource: inferCharacterAliasSource(item.idSource),
    toSource: inferCharacterCanonicalSource(item.canonicalId),
    skipIfMissing: true,
    expectedName: item.sourceName || item.canonicalName || undefined,
    expectedType: item.sourceType || item.canonicalType || undefined,
    note: `Auto-generated from Supabase audit: history.character_id alias-backed reference (${item.idSource || 'unknown'} -> ${item.canonicalId})`,
  };
}

function buildPoolMergeEntry(item) {
  return {
    fromId: item.id,
    toId: item.canonicalId,
    fromSource: inferPoolAliasSource(item.idSource),
    toSource: inferPoolCanonicalSource(item.canonicalId),
    skipIfMissing: true,
    expectedName: item.sourceName || item.canonicalName || undefined,
    expectedType: item.sourceType || item.canonicalType || undefined,
    note: `Auto-generated from Supabase audit: history.pool_id alias-backed reference (${item.idSource || 'unknown'} -> ${item.canonicalId})`,
  };
}

export function buildMergePlanFromAuditReport(report, generatedFrom = 'audit-report.json') {
  const historyCharacterReferences = Array.isArray(report?.historyCharacterReferences?.aliasBacked)
    ? report.historyCharacterReferences.aliasBacked
    : [];
  const historyPoolReferences = Array.isArray(report?.historyPoolReferences?.aliasBacked)
    ? report.historyPoolReferences.aliasBacked
    : [];

  return {
    generatedFrom,
    generatedAt: new Date().toISOString(),
    sourceSummary: {
      historyCharacterAliasBackedReferenceCount: historyCharacterReferences.length,
      historyPoolAliasBackedReferenceCount: historyPoolReferences.length,
      target: report?.target || null,
      auditGeneratedAt: report?.generatedAt || null,
    },
    characters: dedupeMergeEntries(historyCharacterReferences.map(buildCharacterMergeEntry)),
    pools: dedupeMergeEntries(historyPoolReferences.map(buildPoolMergeEntry)),
  };
}

async function writeOutputFile(filePath, contents) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, contents, 'utf8');
  return absolutePath;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.audit) {
    throw new Error('缺少审计报告路径；请传入 --audit <path> 或使用第一个位置参数');
  }

  const report = await readJsonFile(options.audit);
  const plan = buildMergePlanFromAuditReport(report, path.basename(options.audit));
  const outputPath = options.out || buildDefaultOutPath(options.audit);
  const absoluteOutputPath = await writeOutputFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`);

  console.log('# DATA-NEW-008 merge plan 草案');
  console.log(`输入审计报告: ${path.resolve(process.cwd(), options.audit)}`);
  console.log(`输出 merge plan: ${absoluteOutputPath}`);
  console.log(`角色 merge 草案: ${plan.characters.length}`);
  console.log(`卡池 merge 草案: ${plan.pools.length}`);

  if (plan.characters.length === 0 && plan.pools.length === 0) {
    console.log('未发现可由 history alias-backed 引用直接生成的 merge 草案。');
  }
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((error) => {
    console.error('[generate-audit-merge-plan] 执行失败:', error);
    process.exitCode = 1;
  });
}
