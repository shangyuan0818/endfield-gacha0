import {
  classifyCharacterIdSource,
  classifyPoolIdSource,
} from '../../src/utils/canonicalEntityUtils.js';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueTexts(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map(normalizeText)
      .filter(Boolean)
  )];
}

function countRowsBy(rows = [], keyName) {
  const counts = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const value = normalizeText(row?.[keyName]);
    if (!value) {
      return;
    }

    counts.set(value, (counts.get(value) || 0) + 1);
  });

  return counts;
}

function countFeaturedCharacterRefs(pools = []) {
  const counts = new Map();

  (Array.isArray(pools) ? pools : []).forEach((pool) => {
    (Array.isArray(pool?.featured_characters) ? pool.featured_characters : []).forEach((characterId) => {
      const normalized = normalizeText(characterId);
      if (!normalized) {
        return;
      }

      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    });
  });

  return counts;
}

function buildAliasSnapshot(id, aliasRows = [], targetColumn, classifyIdSource) {
  const normalizedId = normalizeText(id);
  const outboundRows = [];
  const inboundRows = [];

  (Array.isArray(aliasRows) ? aliasRows : []).forEach((row) => {
    const aliasId = normalizeText(row?.alias_id);
    const targetId = normalizeText(row?.[targetColumn]);

    if (aliasId === normalizedId) {
      outboundRows.push(row);
    }

    if (targetId === normalizedId) {
      inboundRows.push(row);
    }
  });

  const targetIds = uniqueTexts(outboundRows.map(row => row?.[targetColumn]));
  const nonSelfTargetIds = targetIds.filter(targetId => targetId !== normalizedId);
  const canonicalTargetIds = nonSelfTargetIds.filter(targetId => classifyIdSource(targetId) !== 'manual_placeholder');
  const manualTargetIds = nonSelfTargetIds.filter(targetId => classifyIdSource(targetId) === 'manual_placeholder');
  const hasInternalSelfAlias = outboundRows.some(row => (
    row?.source === 'internal'
    && row?.is_primary === true
    && normalizeText(row?.[targetColumn]) === normalizedId
  ));

  return {
    hasInternalSelfAlias,
    outboundAliasCount: outboundRows.length,
    inboundAliasCount: inboundRows.length,
    targetIds,
    nonSelfTargetIds,
    canonicalTargetIds,
    manualTargetIds,
    sources: uniqueTexts(outboundRows.map(row => row?.source)),
  };
}

function resolvePlaceholderState(aliasSnapshot) {
  if (aliasSnapshot.canonicalTargetIds.length > 1 || aliasSnapshot.nonSelfTargetIds.length > 1) {
    return 'conflicting_alias_targets';
  }

  if (aliasSnapshot.canonicalTargetIds.length === 1) {
    return 'ready_to_merge';
  }

  if (aliasSnapshot.manualTargetIds.length > 0) {
    return 'manual_target_only';
  }

  return 'needs_official_id';
}

function resolveSuggestedAction(state) {
  switch (state) {
    case 'ready_to_merge':
      return '可生成 merge plan；迁移时保留旧 ID alias，并更新 history / pool_characters / featured_characters 引用。';
    case 'conflicting_alias_targets':
      return '先人工确认唯一官方目标 ID；存在多个 alias target 时不得生成自动迁移 SQL。';
    case 'manual_target_only':
      return '当前只指向另一个手动 placeholder；需要先找到官方 ID 或人工指定 canonical target。';
    default:
      return '等待官方 ID、Wiki ID 或管理员指定 canonical target 后再迁移。';
  }
}

function buildPlaceholderRows({
  rows,
  idKey,
  classifyIdSource,
  aliasRows,
  targetColumn,
  referenceCounters,
  formatRow,
}) {
  return (Array.isArray(rows) ? rows : [])
    .filter(row => classifyIdSource(row?.[idKey]) === 'manual_placeholder')
    .map((row) => {
      const id = normalizeText(row?.[idKey]);
      const aliasSnapshot = buildAliasSnapshot(id, aliasRows, targetColumn, classifyIdSource);
      const state = resolvePlaceholderState(aliasSnapshot);
      const references = Object.fromEntries(
        Object.entries(referenceCounters || {}).map(([key, counter]) => [key, counter.get(id) || 0])
      );

      return {
        ...formatRow(row),
        id,
        state,
        suggestedAction: resolveSuggestedAction(state),
        alias: aliasSnapshot,
        references,
      };
    })
    .sort((left, right) => {
      const stateCompare = left.state.localeCompare(right.state);
      if (stateCompare !== 0) {
        return stateCompare;
      }

      return left.id.localeCompare(right.id);
    });
}

function summarizePlaceholders(items = []) {
  return {
    count: items.length,
    readyToMerge: items.filter(item => item.state === 'ready_to_merge').length,
    needsOfficialId: items.filter(item => item.state === 'needs_official_id').length,
    manualTargetOnly: items.filter(item => item.state === 'manual_target_only').length,
    conflictingAliasTargets: items.filter(item => item.state === 'conflicting_alias_targets').length,
    missingInternalSelfAlias: items.filter(item => !item.alias.hasInternalSelfAlias).length,
  };
}

function sumReference(items = [], key) {
  return items.reduce((total, item) => total + (Number(item.references?.[key]) || 0), 0);
}

function normalizeReferenceOverrideMap(value) {
  if (value instanceof Map) {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return new Map();
  }

  return new Map(Object.entries(value));
}

function normalizeCountOverride(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null;
}

function applyReferenceOverrides(items = [], overridesInput) {
  const overrides = normalizeReferenceOverrideMap(overridesInput);
  if (overrides.size === 0) {
    return items;
  }

  return items.map((item) => {
    const itemOverrides = overrides.get(item.id);
    if (!itemOverrides || typeof itemOverrides !== 'object') {
      return item;
    }

    const references = { ...(item.references || {}) };
    Object.entries(itemOverrides).forEach(([key, value]) => {
      const count = normalizeCountOverride(value);
      if (count !== null) {
        references[key] = count;
      }
    });

    return {
      ...item,
      references,
    };
  });
}

export function buildManualPlaceholderRetirementReport({
  pools = [],
  characters = [],
  characterAliasRows = [],
  poolAliasRows = [],
  historyRows = [],
  poolCharacterRows = [],
  referenceCountOverrides = {},
} = {}) {
  const historyCharacterCounts = countRowsBy(historyRows, 'character_id');
  const historyPoolCounts = countRowsBy(historyRows, 'pool_id');
  const poolCharacterCharacterCounts = countRowsBy(poolCharacterRows, 'character_id');
  const poolCharacterPoolCounts = countRowsBy(poolCharacterRows, 'pool_id');
  const featuredCharacterCounts = countFeaturedCharacterRefs(pools);

  const characterPlaceholders = applyReferenceOverrides(buildPlaceholderRows({
    rows: characters,
    idKey: 'id',
    classifyIdSource: classifyCharacterIdSource,
    aliasRows: characterAliasRows,
    targetColumn: 'character_id',
    referenceCounters: {
      historyRows: historyCharacterCounts,
      poolCharacterRows: poolCharacterCharacterCounts,
      featuredCharacterEntries: featuredCharacterCounts,
    },
    formatRow: row => ({
      name: row?.name || null,
      type: row?.type || null,
    }),
  }), referenceCountOverrides.characters);

  const poolPlaceholders = applyReferenceOverrides(buildPlaceholderRows({
    rows: pools,
    idKey: 'pool_id',
    classifyIdSource: classifyPoolIdSource,
    aliasRows: poolAliasRows,
    targetColumn: 'pool_id',
    referenceCounters: {
      historyRows: historyPoolCounts,
      poolCharacterRows: poolCharacterPoolCounts,
    },
    formatRow: row => ({
      name: row?.name || null,
      type: row?.type || null,
      start_time: row?.start_time || null,
      end_time: row?.end_time || null,
      up_character: row?.up_character || null,
    }),
  }), referenceCountOverrides.pools);

  const characterSummary = summarizePlaceholders(characterPlaceholders);
  const poolSummary = summarizePlaceholders(poolPlaceholders);

  return {
    summary: {
      characterPlaceholderCount: characterSummary.count,
      poolPlaceholderCount: poolSummary.count,
      readyCharacterMergeCount: characterSummary.readyToMerge,
      readyPoolMergeCount: poolSummary.readyToMerge,
      characterNeedsOfficialIdCount: characterSummary.needsOfficialId,
      poolNeedsOfficialIdCount: poolSummary.needsOfficialId,
      characterManualTargetOnlyCount: characterSummary.manualTargetOnly,
      poolManualTargetOnlyCount: poolSummary.manualTargetOnly,
      characterAliasConflictCount: characterSummary.conflictingAliasTargets,
      poolAliasConflictCount: poolSummary.conflictingAliasTargets,
      characterMissingSelfAliasCount: characterSummary.missingInternalSelfAlias,
      poolMissingSelfAliasCount: poolSummary.missingInternalSelfAlias,
      historyCharacterManualReferenceCount: sumReference(characterPlaceholders, 'historyRows'),
      historyPoolManualReferenceCount: sumReference(poolPlaceholders, 'historyRows'),
      poolCharacterManualCharacterReferenceCount: sumReference(characterPlaceholders, 'poolCharacterRows'),
      poolCharacterManualPoolReferenceCount: sumReference(poolPlaceholders, 'poolCharacterRows'),
      featuredCharacterManualReferenceCount: sumReference(characterPlaceholders, 'featuredCharacterEntries'),
    },
    characters: characterPlaceholders,
    pools: poolPlaceholders,
  };
}
