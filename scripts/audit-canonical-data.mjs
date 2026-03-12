import fs from 'node:fs/promises';
import path from 'node:path';

import {
  buildCharacterAuditKey,
  buildPoolAuditKey,
  classifyCharacterIdSource,
  classifyPoolIdSource,
  normalizePoolType,
} from '../src/utils/canonicalEntityUtils.js';

function parseArgs(argv) {
  const options = {
    pools: null,
    historyExport: null,
    characters: null,
    writeJson: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];

    if (arg === '--pools' && nextValue) {
      options.pools = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--history-export' && nextValue) {
      options.historyExport = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--characters' && nextValue) {
      options.characters = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--write-json' && nextValue) {
      options.writeJson = nextValue;
      index += 1;
      continue;
    }
  }

  return options;
}

async function readJsonFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const raw = await fs.readFile(absolutePath, 'utf8');
  return {
    path: absolutePath,
    data: JSON.parse(raw),
  };
}

function normalizePoolRecord(record, source) {
  return {
    source,
    pool_id: String(record?.pool_id || record?.id || record?.poolId || ''),
    name: record?.name || record?.poolName || null,
    type: normalizePoolType(record?.type || record?.poolType),
    up_character: record?.up_character || record?.upCharacter || null,
    start_time: record?.start_time || record?.startTime || null,
    end_time: record?.end_time || record?.endTime || null,
    featured_characters: Array.isArray(record?.featured_characters) ? record.featured_characters : [],
  };
}

function normalizeCharacterRecord(record, source) {
  return {
    source,
    id: String(record?.id || ''),
    name: record?.name || null,
    type: record?.type || 'character',
    aliases: Array.isArray(record?.aliases) ? record.aliases : [],
  };
}

function extractPools(payload, source) {
  if (Array.isArray(payload)) {
    return payload.map(record => normalizePoolRecord(record, source)).filter(record => record.pool_id);
  }

  if (Array.isArray(payload?.pools)) {
    return payload.pools.map(record => normalizePoolRecord(record, source)).filter(record => record.pool_id);
  }

  return [];
}

function extractCharacters(payload, source) {
  if (Array.isArray(payload)) {
    return payload.map(record => normalizeCharacterRecord(record, source)).filter(record => record.id);
  }

  if (Array.isArray(payload?.characters)) {
    return payload.characters.map(record => normalizeCharacterRecord(record, source)).filter(record => record.id);
  }

  return [];
}

function extractHistorySummaryPools(payload) {
  if (!Array.isArray(payload?.summary?.byPool)) {
    return [];
  }

  return payload.summary.byPool.map(record => ({
    pool_id: String(record?.poolId || ''),
    name: record?.poolName || null,
    type: normalizePoolType(record?.poolType),
    source: 'history-summary',
  })).filter(record => record.pool_id);
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
  if (auditKey.includes('|name:')) {
    return 'low';
  }

  const segments = auditKey.split('|');
  return segments.length >= 3 ? 'high' : 'medium';
}

function findPoolAliasCandidates(poolRecords) {
  const groups = groupBy(poolRecords, buildPoolAuditKey);
  const candidates = [];

  groups.forEach((records, auditKey) => {
    const distinctIds = [...new Set(records.map(record => record.pool_id))];
    if (distinctIds.length <= 1) {
      return;
    }

    const idSources = [...new Set(records.map(record => classifyPoolIdSource(record.pool_id)))];
    candidates.push({
      auditKey,
      confidence: getConflictConfidence(auditKey),
      poolType: records[0]?.type || 'unknown',
      upCharacter: records[0]?.up_character || null,
      distinctIdCount: distinctIds.length,
      idSources,
      records: records
        .slice()
        .sort((left, right) => String(left.pool_id).localeCompare(String(right.pool_id)))
        .map(record => ({
          pool_id: record.pool_id,
          source: record.source,
          idSource: classifyPoolIdSource(record.pool_id),
          name: record.name,
          up_character: record.up_character,
          start_time: record.start_time,
          end_time: record.end_time,
        })),
    });
  });

  return candidates.sort((left, right) => {
    if (right.distinctIdCount !== left.distinctIdCount) {
      return right.distinctIdCount - left.distinctIdCount;
    }

    return left.auditKey.localeCompare(right.auditKey);
  });
}

function findCharacterAliasCandidates(characterRecords) {
  const groups = groupBy(characterRecords, buildCharacterAuditKey);
  const candidates = [];

  groups.forEach((records, auditKey) => {
    const distinctIds = [...new Set(records.map(record => record.id))];
    if (distinctIds.length <= 1) {
      return;
    }

    candidates.push({
      auditKey,
      distinctIdCount: distinctIds.length,
      records: records.map(record => ({
        id: record.id,
        name: record.name,
        type: record.type,
        source: record.source,
        idSource: classifyCharacterIdSource(record.id),
      })),
    });
  });

  return candidates.sort((left, right) => right.distinctIdCount - left.distinctIdCount);
}

function buildPoolGapReport(snapshotPools, historyPools) {
  const snapshotIds = new Set(snapshotPools.map(record => record.pool_id));
  const historyIds = new Set(historyPools.map(record => record.pool_id));

  const historyOnly = historyPools
    .filter(record => !snapshotIds.has(record.pool_id))
    .map(record => ({
      pool_id: record.pool_id,
      idSource: classifyPoolIdSource(record.pool_id),
      name: record.name,
      type: record.type,
    }));

  const snapshotOnly = snapshotPools
    .filter(record => !historyIds.has(record.pool_id))
    .map(record => ({
      pool_id: record.pool_id,
      idSource: classifyPoolIdSource(record.pool_id),
      name: record.name,
      type: record.type,
      up_character: record.up_character,
      start_time: record.start_time,
    }));

  return {
    historyOnly,
    snapshotOnly,
  };
}

function buildFeaturedCharacterIssues(poolRecords, characterRecords) {
  if (characterRecords.length === 0) {
    return [];
  }

  const knownCharacterIds = new Set(characterRecords.map(record => record.id));

  return poolRecords
    .filter(record => Array.isArray(record.featured_characters) && record.featured_characters.length > 0)
    .map(record => {
      const missingIds = record.featured_characters.filter(characterId => !knownCharacterIds.has(characterId));
      if (missingIds.length === 0) {
        return null;
      }

      return {
        pool_id: record.pool_id,
        name: record.name,
        source: record.source,
        missingIds,
      };
    })
    .filter(Boolean);
}

function printSection(title) {
  console.log(`\n## ${title}`);
}

function printTopItems(items, formatter, limit = 10) {
  items.slice(0, limit).forEach((item, index) => {
    console.log(formatter(item, index));
  });

  if (items.length > limit) {
    console.log(`... 其余 ${items.length - limit} 项已省略，可用 --write-json 查看完整结果`);
  }
}

function printReport(report) {
  console.log('# DATA-NEW-008 审计报告');
  console.log(`生成时间: ${report.generatedAt}`);

  printSection('输入文件');
  Object.entries(report.files).forEach(([label, filePath]) => {
    if (filePath) {
      console.log(`- ${label}: ${filePath}`);
    }
  });

  printSection('概览');
  console.log(`- 角色记录: ${report.summary.characterCount}`);
  console.log(`- 卡池记录: ${report.summary.poolCount}`);
  console.log(`- 历史摘要卡池: ${report.summary.historySummaryPoolCount}`);
  console.log(`- 潜在卡池别名冲突: ${report.summary.poolAliasCandidateCount}`);
  console.log(`- 潜在角色别名冲突: ${report.summary.characterAliasCandidateCount}`);
  console.log(`- featured_characters 缺失引用: ${report.summary.featuredCharacterIssueCount}`);

  if (report.poolAliasCandidates.length > 0) {
    printSection('潜在卡池别名冲突');
    printTopItems(report.poolAliasCandidates, (candidate) => {
      const ids = candidate.records.map(record => `${record.pool_id} [${record.idSource}/${record.source}]`).join(' | ');
      return `- ${candidate.confidence.toUpperCase()} ${candidate.auditKey}: ${ids}`;
    });
  }

  if (report.poolGaps) {
    printSection('卡池快照 vs 历史摘要差异');
    console.log(`- 只在历史摘要中出现: ${report.poolGaps.historyOnly.length}`);
    printTopItems(report.poolGaps.historyOnly, (item) => (
      `  - ${item.pool_id} [${item.idSource}] ${item.name || ''}`.trimEnd()
    ), 20);

    console.log(`- 只在卡池快照中出现: ${report.poolGaps.snapshotOnly.length}`);
    printTopItems(report.poolGaps.snapshotOnly, (item) => (
      `  - ${item.pool_id} [${item.idSource}] ${item.name || ''}`.trimEnd()
    ), 20);
  }

  if (report.characterAliasCandidates.length > 0) {
    printSection('潜在角色别名冲突');
    printTopItems(report.characterAliasCandidates, (candidate) => {
      const ids = candidate.records.map(record => `${record.id} [${record.idSource}/${record.source}]`).join(' | ');
      return `- ${candidate.auditKey}: ${ids}`;
    });
  }

  if (report.featuredCharacterIssues.length > 0) {
    printSection('featured_characters 缺失引用');
    printTopItems(report.featuredCharacterIssues, (issue) => (
      `- ${issue.pool_id} (${issue.source}) 缺少角色 ID: ${issue.missingIds.join(', ')}`
    ));
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.pools && !options.historyExport && !options.characters) {
    console.error('用法: node scripts/audit-canonical-data.mjs --pools <卡池JSON> --history-export <导出JSON> [--characters <角色JSON>] [--write-json <报告输出路径>]');
    process.exitCode = 1;
    return;
  }

  const files = {
    pools: null,
    historyExport: null,
    characters: null,
  };

  let poolSnapshot = [];
  let historySummaryPools = [];
  let historyPools = [];
  let characterRecords = [];

  if (options.pools) {
    const { path: absolutePath, data } = await readJsonFile(options.pools);
    files.pools = absolutePath;
    poolSnapshot = extractPools(data, 'pool-snapshot');
  }

  if (options.historyExport) {
    const { path: absolutePath, data } = await readJsonFile(options.historyExport);
    files.historyExport = absolutePath;
    historyPools = extractPools(data, 'history-export');
    historySummaryPools = extractHistorySummaryPools(data);
  }

  if (options.characters) {
    const { path: absolutePath, data } = await readJsonFile(options.characters);
    files.characters = absolutePath;
    characterRecords = extractCharacters(data, 'character-snapshot');
  }

  const allPoolRecords = [...poolSnapshot, ...historyPools];
  const poolAliasCandidates = findPoolAliasCandidates(allPoolRecords);
  const characterAliasCandidates = findCharacterAliasCandidates(characterRecords);
  const featuredCharacterIssues = buildFeaturedCharacterIssues(allPoolRecords, characterRecords);
  const poolGaps = poolSnapshot.length > 0 && historySummaryPools.length > 0
    ? buildPoolGapReport(poolSnapshot, historySummaryPools)
    : null;

  const report = {
    generatedAt: new Date().toISOString(),
    files,
    summary: {
      poolCount: allPoolRecords.length,
      historySummaryPoolCount: historySummaryPools.length,
      characterCount: characterRecords.length,
      poolAliasCandidateCount: poolAliasCandidates.length,
      characterAliasCandidateCount: characterAliasCandidates.length,
      featuredCharacterIssueCount: featuredCharacterIssues.length,
    },
    poolAliasCandidates,
    characterAliasCandidates,
    featuredCharacterIssues,
    poolGaps,
  };

  printReport(report);

  if (options.writeJson) {
    const outputPath = path.resolve(process.cwd(), options.writeJson);
    await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`\n已写出 JSON 报告: ${outputPath}`);
  }
}

main().catch((error) => {
  console.error('[audit-canonical-data] 执行失败:', error);
  process.exitCode = 1;
});
