import {
  buildCharacterAuditKey,
  buildPoolAuditKey,
  classifyCharacterIdSource,
  classifyPoolIdSource,
  normalizeEntityNameForMatch,
} from '../../src/utils/canonicalEntityUtils.js';

const PLAN_VERSION = 1;

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDate(value) {
  const text = normalizeText(value);
  return text ? text.slice(0, 10) : '';
}

function uniqueTexts(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map(normalizeText)
      .filter(Boolean)
  )];
}

function getRows(data, keyName) {
  return Array.isArray(data?.[keyName]) ? data[keyName] : [];
}

function getSnapshotSourceRows(data, sourceKey, retirementKey) {
  const candidateSourceRows = getRows(data?.candidateSourceRows, sourceKey);
  if (candidateSourceRows.length > 0) {
    return candidateSourceRows;
  }

  const directRows = getRows(data, sourceKey);
  if (directRows.length > 0) {
    return directRows;
  }

  return getRows(data?.manualPlaceholderRetirement, retirementKey);
}

function normalizeCharacterRow(row, source = 'audit') {
  const id = normalizeText(row?.id || row?.character_id);
  if (!id) {
    return null;
  }

  return {
    id,
    name: normalizeText(row?.name) || null,
    type: normalizeText(row?.type) || 'character',
    source: normalizeText(row?.source) || source,
    aliases: Array.isArray(row?.aliases) ? row.aliases : [],
  };
}

function normalizePoolRow(row, source = 'audit') {
  const poolId = normalizeText(row?.pool_id || row?.id || row?.poolId);
  if (!poolId) {
    return null;
  }

  return {
    pool_id: poolId,
    name: normalizeText(row?.name || row?.poolName) || null,
    type: normalizeText(row?.type || row?.poolType) || 'unknown',
    up_character: normalizeText(row?.up_character || row?.upCharacter) || null,
    start_time: normalizeText(row?.start_time || row?.startTime) || null,
    end_time: normalizeText(row?.end_time || row?.endTime) || null,
    source: normalizeText(row?.source) || source,
  };
}

function normalizeAliasRow(row, targetColumn) {
  const aliasId = normalizeText(row?.alias_id);
  const targetId = normalizeText(row?.[targetColumn]);
  if (!aliasId || !targetId) {
    return null;
  }

  return {
    source: normalizeText(row?.source) || 'unknown',
    alias_id: aliasId,
    [targetColumn]: targetId,
    is_primary: row?.is_primary === true,
  };
}

function buildMap(rows, keyName) {
  return new Map(
    rows
      .map(row => [normalizeText(row?.[keyName]), row])
      .filter(([id]) => Boolean(id))
  );
}

function buildNameIndex(rows, buildKey) {
  const index = new Map();
  rows.forEach((row) => {
    const key = buildKey(row);
    if (!key) {
      return;
    }
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key).push(row);
  });
  return index;
}

function isCanonicalCharacterId(id) {
  return classifyCharacterIdSource(id) !== 'manual_placeholder';
}

function isCanonicalPoolId(id) {
  return classifyPoolIdSource(id) !== 'manual_placeholder';
}

function collectAliasTargets(aliasRows, fromId, targetColumn, isCanonicalId) {
  return uniqueTexts(
    aliasRows
      .filter(row => normalizeText(row?.alias_id) === fromId)
      .map(row => row?.[targetColumn])
  ).filter(targetId => targetId !== fromId && isCanonicalId(targetId));
}

function buildCandidate({
  targetId,
  targetRow,
  confidence,
  evidence,
  reasons,
  warnings = [],
}) {
  return {
    targetId,
    confidence,
    evidence: uniqueTexts(evidence),
    reasons: uniqueTexts(reasons),
    target: targetRow || null,
    warnings,
  };
}

function dedupeCandidates(candidates) {
  const byTarget = new Map();
  const rank = { high: 3, medium: 2, low: 1 };

  candidates.forEach((candidate) => {
    if (!candidate?.targetId) {
      return;
    }

    const existing = byTarget.get(candidate.targetId);
    if (!existing) {
      byTarget.set(candidate.targetId, candidate);
      return;
    }

    const nextRank = rank[candidate.confidence] || 0;
    const currentRank = rank[existing.confidence] || 0;
    byTarget.set(candidate.targetId, {
      ...existing,
      confidence: nextRank > currentRank ? candidate.confidence : existing.confidence,
      evidence: uniqueTexts([...(existing.evidence || []), ...(candidate.evidence || [])]),
      reasons: uniqueTexts([...(existing.reasons || []), ...(candidate.reasons || [])]),
      warnings: [...(existing.warnings || []), ...(candidate.warnings || [])],
    });
  });

  return [...byTarget.values()].sort((left, right) => {
    const rankDiff = (rank[right.confidence] || 0) - (rank[left.confidence] || 0);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return left.targetId.localeCompare(right.targetId);
  });
}

function buildCharacterCandidates(item, context) {
  const id = normalizeText(item?.id);
  const nameKey = buildCharacterAuditKey(item);
  const aliasTargets = collectAliasTargets(
    context.characterAliasRows,
    id,
    'character_id',
    isCanonicalCharacterId
  );
  const candidates = [];

  aliasTargets.forEach((targetId) => {
    candidates.push(buildCandidate({
      targetId,
      targetRow: context.characterLookup.get(targetId) || null,
      confidence: 'high',
      evidence: ['alias_target'],
      reasons: ['当前 alias 已经指向非手动官方 ID。'],
    }));
  });

  const sameNameRows = (context.characterNameIndex.get(nameKey) || [])
    .filter(row => row.id !== id && isCanonicalCharacterId(row.id));
  sameNameRows.forEach((row) => {
    candidates.push(buildCandidate({
      targetId: row.id,
      targetRow: row,
      confidence: 'medium',
      evidence: ['same_normalized_name_and_type'],
      reasons: ['角色 / 武器名称和类型与现有官方 ID 记录一致，需要人工确认后才能迁移。'],
    }));
  });

  return dedupeCandidates(candidates);
}

function buildPoolNameOnlyKey(pool) {
  const type = normalizeText(pool?.type) || 'unknown';
  const name = normalizeEntityNameForMatch(pool?.name);
  return name ? `${type}|name:${name}` : '';
}

function buildPoolLooseKeys(pool) {
  const type = normalizeText(pool?.type) || 'unknown';
  const upCharacter = normalizeEntityNameForMatch(pool?.up_character);
  const startDate = normalizeDate(pool?.start_time);
  const keys = [];

  if (upCharacter && startDate) {
    keys.push(`${type}|${upCharacter}|${startDate}`);
  }

  const nameOnlyKey = buildPoolNameOnlyKey(pool);
  if (nameOnlyKey) {
    keys.push(nameOnlyKey);
  }

  return uniqueTexts(keys);
}

function isSamePoolWindow(left, right) {
  const leftStart = normalizeDate(left?.start_time);
  const rightStart = normalizeDate(right?.start_time);
  if (leftStart && rightStart && leftStart !== rightStart) {
    return false;
  }

  const leftEnd = normalizeDate(left?.end_time);
  const rightEnd = normalizeDate(right?.end_time);
  if (leftEnd && rightEnd && leftEnd !== rightEnd) {
    return false;
  }

  return true;
}

function buildPoolCandidates(item, context) {
  const id = normalizeText(item?.id || item?.pool_id);
  const aliasTargets = collectAliasTargets(
    context.poolAliasRows,
    id,
    'pool_id',
    isCanonicalPoolId
  );
  const candidates = [];

  aliasTargets.forEach((targetId) => {
    candidates.push(buildCandidate({
      targetId,
      targetRow: context.poolLookup.get(targetId) || null,
      confidence: 'high',
      evidence: ['alias_target'],
      reasons: ['当前 alias 已经指向非手动官方卡池 ID。'],
    }));
  });

  buildPoolLooseKeys(item).forEach((key) => {
    const rows = context.poolIndex.get(key) || [];
    rows
      .filter(row => row.pool_id !== id && isCanonicalPoolId(row.pool_id))
      .filter(row => isSamePoolWindow(item, row))
      .forEach((row) => {
        const hasStart = Boolean(normalizeDate(item?.start_time) && normalizeDate(row?.start_time));
        candidates.push(buildCandidate({
          targetId: row.pool_id,
          targetRow: row,
          confidence: hasStart ? 'medium' : 'low',
          evidence: [key.includes('|name:') ? 'same_normalized_pool_name' : 'same_type_up_and_start_date'],
          reasons: [
            hasStart
              ? '卡池类型、UP 名称和开始日期与现有官方 ID 记录一致，需要人工确认。'
              : '卡池名称与现有官方 ID 记录一致，但时间证据不足，只能低置信度审阅。',
          ],
        }));
      });
  });

  return dedupeCandidates(candidates);
}

function buildReviewItem(item, kind, candidates) {
  const references = item?.references || {};
  const hasUniqueHighCandidate = candidates.filter(candidate => candidate.confidence === 'high').length === 1;

  return {
    kind,
    placeholderId: normalizeText(item?.id),
    label: item?.name || item?.up_character || null,
    type: item?.type || null,
    sourceState: item?.state || 'unknown',
    reviewStatus: candidates.length === 0 ? 'no_candidate' : 'needs_human_review',
    recommendedNextStep: hasUniqueHighCandidate
      ? '已有高置信候选；请管理员确认后写入 alias，再重新生成迁移计划。'
      : '不能自动迁移；请管理员核对候选、官方公告或导入样本后再确认唯一目标。',
    references,
    candidates,
  };
}

function summarize(items) {
  const withCandidates = items.filter(item => item.candidates.length > 0);
  const highConfidence = withCandidates.filter(item => item.candidates.some(candidate => candidate.confidence === 'high'));
  const mediumConfidence = withCandidates.filter(item => item.candidates.some(candidate => candidate.confidence === 'medium'));

  return {
    totalPlaceholders: items.length,
    placeholdersWithCandidates: withCandidates.length,
    placeholdersWithoutCandidates: items.length - withCandidates.length,
    highConfidenceReviewItems: highConfidence.length,
    mediumConfidenceReviewItems: mediumConfidence.length,
  };
}

export function buildManualPlaceholderCandidateReviewPlan(data = {}, {
  generatedAt = new Date().toISOString(),
  generatedFrom = 'manual-placeholder-audit',
} = {}) {
  const retirement = data?.manualPlaceholderRetirement || data;
  const characterItems = getRows(retirement, 'characters');
  const poolItems = getRows(retirement, 'pools');
  const characterRows = getSnapshotSourceRows(data, 'characters', 'characters')
    .map(row => normalizeCharacterRow(row, 'snapshot'))
    .filter(Boolean);
  const poolRows = getSnapshotSourceRows(data, 'pools', 'pools')
    .map(row => normalizePoolRow(row, 'snapshot'))
    .filter(Boolean);
  const characterAliasRows = [
    ...getRows(data?.candidateSourceRows, 'characterAliasRows'),
    ...getRows(data, 'characterAliasRows'),
  ]
    .map(row => normalizeAliasRow(row, 'character_id'))
    .filter(Boolean);
  const poolAliasRows = [
    ...getRows(data?.candidateSourceRows, 'poolAliasRows'),
    ...getRows(data, 'poolAliasRows'),
  ]
    .map(row => normalizeAliasRow(row, 'pool_id'))
    .filter(Boolean);
  const characterLookup = buildMap(characterRows, 'id');
  const poolLookup = buildMap(poolRows, 'pool_id');
  const context = {
    characterRows,
    poolRows,
    characterAliasRows,
    poolAliasRows,
    characterLookup,
    poolLookup,
    characterNameIndex: buildNameIndex(characterRows, buildCharacterAuditKey),
    poolIndex: buildNameIndex(poolRows, row => buildPoolAuditKey(row)),
  };

  buildNameIndex(poolRows, buildPoolNameOnlyKey).forEach((rows, key) => {
    if (!context.poolIndex.has(key)) {
      context.poolIndex.set(key, []);
    }
    context.poolIndex.get(key).push(...rows);
  });

  const characters = characterItems.map((item) => {
    const normalizedItem = {
      ...item,
      id: normalizeText(item?.id),
      name: item?.name || null,
      type: item?.type || 'character',
    };
    return buildReviewItem(
      normalizedItem,
      'character',
      buildCharacterCandidates(normalizedItem, context)
    );
  });

  const pools = poolItems.map((item) => {
    const normalizedItem = {
      ...item,
      id: normalizeText(item?.id || item?.pool_id),
      pool_id: normalizeText(item?.id || item?.pool_id),
      name: item?.name || null,
      type: item?.type || 'unknown',
      up_character: item?.up_character || null,
      start_time: item?.start_time || null,
      end_time: item?.end_time || null,
    };
    return buildReviewItem(
      normalizedItem,
      'pool',
      buildPoolCandidates(normalizedItem, context)
    );
  });

  const allItems = [...characters, ...pools];

  return {
    planType: 'manual_placeholder_official_id_candidate_review',
    version: PLAN_VERSION,
    mode: 'review_only',
    generatedAt,
    generatedFrom,
    writesDatabase: false,
    safety: {
      requiresHumanReview: true,
      producesApplySql: false,
      note: '该计划只列出可能的官方 ID 候选，不写数据库、不生成迁移 SQL。确认唯一目标后，应先写入 alias，再重新生成正式迁移计划。',
    },
    sourceSummary: retirement?.summary || {},
    summary: {
      characterPlaceholders: summarize(characters),
      poolPlaceholders: summarize(pools),
      totalReviewItems: allItems.length,
      totalWithCandidates: allItems.filter(item => item.candidates.length > 0).length,
      totalWithoutCandidates: allItems.filter(item => item.candidates.length === 0).length,
    },
    reviewItems: {
      characters,
      pools,
    },
    candidateReviewQueue: allItems.filter(item => item.candidates.length > 0),
  };
}
