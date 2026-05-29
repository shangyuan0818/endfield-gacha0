import { buildManualPlaceholderRetirementReport } from './manualPlaceholderAudit.mjs';

const PLAN_VERSION = 1;

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asCount(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
}

function uniqueTexts(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map(normalizeText)
      .filter(Boolean)
  )];
}

function buildReferenceUpdate(table, column, fromId, toId, estimatedRows) {
  return {
    table,
    column,
    match: fromId,
    updateTo: toId,
    estimatedRows: asCount(estimatedRows),
  };
}

function buildAliasRetention({
  aliasTable,
  targetColumn,
  fromId,
  toId,
  kind,
}) {
  const note = `DATA-NEW-017 ${kind} placeholder retirement: keep ${fromId} as alias for ${toId}`;

  return [
    {
      table: aliasTable,
      source: 'internal',
      alias_id: toId,
      [targetColumn]: toId,
      is_primary: true,
      note: 'canonical self alias',
    },
    {
      table: aliasTable,
      source: 'manual_placeholder',
      alias_id: fromId,
      [targetColumn]: toId,
      is_primary: false,
      note,
    },
  ];
}

function buildCharacterImpact(item, toId) {
  const references = item.references || {};
  const fromId = item.id;

  return {
    affectedTables: [
      'characters',
      'character_id_aliases',
      'history',
      'pool_characters',
      'pools',
    ],
    referenceUpdates: [
      buildReferenceUpdate('history', 'character_id', fromId, toId, references.historyRows),
      buildReferenceUpdate('pool_characters', 'character_id', fromId, toId, references.poolCharacterRows),
      buildReferenceUpdate('pools', 'featured_characters[]', fromId, toId, references.featuredCharacterEntries),
    ],
    aliasRetention: buildAliasRetention({
      aliasTable: 'character_id_aliases',
      targetColumn: 'character_id',
      fromId,
      toId,
      kind: 'character',
    }),
    rowMerge: {
      sourceTable: 'characters',
      sourceKey: 'id',
      sourceId: fromId,
      targetId: toId,
      expectedName: item.name || null,
      expectedType: item.type || null,
      deleteSourceAfterMerge: true,
    },
  };
}

function buildPoolImpact(item, toId) {
  const references = item.references || {};
  const fromId = item.id;

  return {
    affectedTables: [
      'pools',
      'pool_id_aliases',
      'history',
      'pool_characters',
    ],
    referenceUpdates: [
      buildReferenceUpdate('history', 'pool_id', fromId, toId, references.historyRows),
      buildReferenceUpdate('pool_characters', 'pool_id', fromId, toId, references.poolCharacterRows),
    ],
    aliasRetention: buildAliasRetention({
      aliasTable: 'pool_id_aliases',
      targetColumn: 'pool_id',
      fromId,
      toId,
      kind: 'pool',
    }),
    rowMerge: {
      sourceTable: 'pools',
      sourceKey: 'pool_id',
      sourceId: fromId,
      targetId: toId,
      expectedName: item.name || null,
      expectedType: item.type || null,
      deleteSourceAfterMerge: true,
    },
  };
}

function resolveBlockedReason(item) {
  const state = normalizeText(item?.state);

  if (state === 'conflicting_alias_targets') {
    return {
      code: 'conflicting_alias_targets',
      message: '存在多个非手动 canonical alias 目标，必须人工确认唯一官方 ID 后才能迁移。',
    };
  }

  if (state === 'manual_target_only') {
    return {
      code: 'manual_target_only',
      message: '当前 alias 只指向另一个手动 placeholder，不能把 placeholder 合并到 placeholder。',
    };
  }

  if (state === 'needs_official_id') {
    return {
      code: 'missing_official_id',
      message: '尚未发现唯一非手动 canonical alias 目标，等待官方 ID 或管理员指定目标。',
    };
  }

  return {
    code: 'not_ready_to_merge',
    message: `当前状态 ${state || 'unknown'} 不允许生成迁移操作。`,
  };
}

function buildGuards({ item, toId, kind }) {
  const sourceTable = kind === 'character' ? 'characters' : 'pools';
  const sourceKey = kind === 'character' ? 'id' : 'pool_id';
  const alias = item.alias || {};

  const guards = [
    {
      code: 'source_exists_or_alias_only',
      table: sourceTable,
      key: sourceKey,
      value: item.id,
      action: '若源行不存在但 alias 已存在，则只能保留 alias，不得删除目标行。',
    },
    {
      code: 'target_exists_or_create_from_source',
      table: sourceTable,
      key: sourceKey,
      value: toId,
      action: '目标官方行不存在时只能从源行复制生成，并保留旧 ID alias。',
    },
    {
      code: 'target_is_unique',
      expectedTargetIds: [toId],
      actualTargetIds: alias.canonicalTargetIds || [],
      action: '只有一个非手动 canonical target 时才允许执行。',
    },
    {
      code: 'no_self_merge',
      fromId: item.id,
      toId,
      action: '源 ID 与目标 ID 相同时拒绝执行。',
    },
  ];

  if (item.name) {
    guards.push({
      code: 'expected_name',
      table: sourceTable,
      key: sourceKey,
      value: item.id,
      expected: item.name,
    });
  }

  if (item.type) {
    guards.push({
      code: 'expected_type',
      table: sourceTable,
      key: sourceKey,
      value: item.id,
      expected: item.type,
    });
  }

  return guards;
}

function buildRollback({ item, toId, kind, impact }) {
  const fromId = item.id;
  const sourceTable = kind === 'character' ? 'characters' : 'pools';
  const sourceKey = kind === 'character' ? 'id' : 'pool_id';
  const aliasTable = kind === 'character' ? 'character_id_aliases' : 'pool_id_aliases';
  const targetColumn = kind === 'character' ? 'character_id' : 'pool_id';

  return {
    strategy: 'reverse_reference_updates_with_alias_retention',
    requiresSnapshot: true,
    snapshotBeforeApply: [
      {
        table: sourceTable,
        key: sourceKey,
        ids: [fromId, toId],
      },
      {
        table: aliasTable,
        filters: [
          { column: 'alias_id', values: [fromId, toId] },
          { column: targetColumn, values: [fromId, toId] },
        ],
      },
      ...impact.referenceUpdates.map(update => ({
        table: update.table,
        column: update.column,
        ids: [fromId, toId],
      })),
    ],
    steps: [
      `确认 apply 前保存了 ${sourceTable} / ${aliasTable} / 引用表快照。`,
      `把引用表中由 ${fromId} 改到 ${toId} 的记录按快照恢复。`,
      `恢复 ${aliasTable} 中 ${fromId} 与 ${toId} 相关 alias 行。`,
      `如 apply 阶段删除了 ${sourceTable}.${sourceKey} = ${fromId}，从快照恢复源行。`,
      `保留审计日志，记录回滚原因和操作者。`,
    ],
  };
}

function buildWarnings(item) {
  const warnings = [];

  if (!item.alias?.hasInternalSelfAlias) {
    warnings.push({
      code: 'missing_internal_self_alias',
      message: '源 placeholder 缺少 internal self alias；apply 时必须先补 alias 或确认源行存在。',
    });
  }

  const referenceTotal = Object.values(item.references || {})
    .reduce((total, value) => total + asCount(value), 0);

  if (referenceTotal === 0) {
    warnings.push({
      code: 'no_observed_references',
      message: '审计样本中未发现引用；仍需保留 alias 以兼容历史导入导出。',
    });
  }

  return warnings;
}

function buildReadyOperation(item, kind) {
  const canonicalTargets = uniqueTexts(item?.alias?.canonicalTargetIds);
  const toId = canonicalTargets[0];
  const fromId = normalizeText(item?.id);

  if (!fromId || !toId || fromId === toId || canonicalTargets.length !== 1) {
    return {
      status: 'blocked',
      kind,
      fromId,
      toId: toId || null,
      reason: {
        code: 'invalid_ready_candidate',
        message: 'ready_to_merge 候选缺少唯一且不同的 fromId/toId。',
      },
      sourceState: item?.state || 'unknown',
    };
  }

  const impact = kind === 'character'
    ? buildCharacterImpact(item, toId)
    : buildPoolImpact(item, toId);

  return {
    status: 'ready',
    kind,
    fromId,
    toId,
    label: item.name || item.up_character || null,
    sourceState: item.state,
    references: item.references || {},
    guards: buildGuards({ item, toId, kind }),
    warnings: buildWarnings(item),
    impact,
    applyOrder: [
      '验证 source / target / alias 快照与 dry-run 计划一致。',
      '写入或修正目标 canonical self alias。',
      '写入 manual_placeholder alias，把旧 ID 指向目标官方 ID。',
      '更新引用表中的旧 ID。',
      '合并源行的可保留字段到目标行。',
      '在验证引用归零后删除或归档源 placeholder 行。',
      '写入管理员审计日志并刷新相关公共缓存。',
    ],
    rollback: buildRollback({ item, toId, kind, impact }),
  };
}

function buildBlockedOperation(item, kind) {
  return {
    status: 'blocked',
    kind,
    fromId: normalizeText(item?.id),
    toId: null,
    label: item?.name || item?.up_character || null,
    sourceState: item?.state || 'unknown',
    reason: resolveBlockedReason(item),
    references: item?.references || {},
    alias: item?.alias || {},
  };
}

function buildOperations(items = [], kind) {
  return (Array.isArray(items) ? items : []).map((item) => {
    if (item?.state === 'ready_to_merge') {
      return buildReadyOperation(item, kind);
    }

    return buildBlockedOperation(item, kind);
  });
}

function summarizeOperations(operations = []) {
  const ready = operations.filter(operation => operation.status === 'ready');
  const blocked = operations.filter(operation => operation.status === 'blocked');
  const affectedTables = uniqueTexts(ready.flatMap(operation => operation.impact?.affectedTables || []));
  const referenceUpdateCount = ready
    .flatMap(operation => operation.impact?.referenceUpdates || [])
    .reduce((total, update) => total + asCount(update.estimatedRows), 0);

  return {
    readyCount: ready.length,
    blockedCount: blocked.length,
    affectedTables,
    estimatedReferenceUpdateCount: referenceUpdateCount,
    warningCount: ready.reduce((total, operation) => total + (operation.warnings?.length || 0), 0),
  };
}

export function buildManualPlaceholderMigrationPlan(retirementReport, {
  generatedAt = new Date().toISOString(),
  generatedFrom = 'manualPlaceholderRetirement',
} = {}) {
  const characters = buildOperations(retirementReport?.characters, 'character');
  const pools = buildOperations(retirementReport?.pools, 'pool');
  const allOperations = [...characters, ...pools];
  const summary = summarizeOperations(allOperations);

  return {
    planType: 'manual_placeholder_official_id_migration',
    version: PLAN_VERSION,
    mode: 'dry_run',
    generatedAt,
    generatedFrom,
    writesDatabase: false,
    safety: {
      requiresHumanReview: true,
      requiresFreshProductionAudit: true,
      refusedStates: [
        'conflicting_alias_targets',
        'manual_target_only',
        'needs_official_id',
      ],
      note: '此计划只描述迁移步骤和回滚要求，不执行 SQL、不写入数据库。',
    },
    sourceSummary: retirementReport?.summary || {},
    summary: {
      readyCharacterMigrations: characters.filter(operation => operation.status === 'ready').length,
      readyPoolMigrations: pools.filter(operation => operation.status === 'ready').length,
      blockedCharacterPlaceholders: characters.filter(operation => operation.status === 'blocked').length,
      blockedPoolPlaceholders: pools.filter(operation => operation.status === 'blocked').length,
      estimatedReferenceUpdateCount: summary.estimatedReferenceUpdateCount,
      affectedTables: summary.affectedTables,
      warningCount: summary.warningCount,
    },
    operations: {
      characters,
      pools,
    },
    blocked: allOperations.filter(operation => operation.status === 'blocked'),
  };
}

export function buildManualPlaceholderMigrationPlanFromData(data = {}, options = {}) {
  return buildManualPlaceholderMigrationPlan(
    buildManualPlaceholderRetirementReport(data),
    options
  );
}
