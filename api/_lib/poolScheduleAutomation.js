import { buildPoolSelfAliasRows } from '../../shared/idAliasService.js';
import {
  buildPoolAuditKey,
} from '../../src/utils/canonicalEntityUtils.js';
import { buildCharacterLookup, resolveEntity } from './poolScheduleFeed.js';

// ---------------------------------------------------------------------------
// 文本工具
// ---------------------------------------------------------------------------

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value) {
  return Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .map(item => normalizeText(item))
      .filter(Boolean)
  ));
}

function normalizePoolType(value) {
  const n = normalizeText(value).toLowerCase();
  if (n === 'limited_character') return 'limited';
  if (n === 'limited_weapon') return 'weapon';
  if (n === 'limited' || n === 'weapon' || n === 'standard') return n;
  return 'limited';
}

const ISO_DATE_TIME_WITH_TIMEZONE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function normalizeIsoDateTimeInput(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return {
      value: '',
      isEmpty: true,
      isValid: false,
    };
  }

  if (!ISO_DATE_TIME_WITH_TIMEZONE_PATTERN.test(normalized)) {
    return {
      value: normalized,
      isEmpty: false,
      isValid: false,
    };
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return {
      value: normalized,
      isEmpty: false,
      isValid: false,
    };
  }

  return {
    value: date.toISOString(),
    isEmpty: false,
    isValid: true,
  };
}

// ---------------------------------------------------------------------------
// 记录规范化
// ---------------------------------------------------------------------------

function normalizeIncomingPoolRecord(record) {
  return {
    pool_id: normalizeText(record?.pool_id || record?.id),
    name: normalizeText(record?.name || record?.title),
    type: normalizePoolType(record?.type),
    start_time: normalizeText(record?.start_time),
    end_time: normalizeText(record?.end_time),
    up_character: normalizeText(record?.up_character),
    featured_characters: normalizeStringArray(record?.featured_characters),
    featured_character_names: normalizeStringArray(record?.featured_character_names),
    description: normalizeText(record?.description) || null,
    banner_url: normalizeText(record?.banner_url) || null,
    source_notice_id: normalizeText(record?.source_notice_id) || null,
    source_url: normalizeText(record?.source_url) || null,
  };
}

// ---------------------------------------------------------------------------
// Alias 与 pool_characters 构建
// ---------------------------------------------------------------------------

function buildPoolCharacterRows(featuredCharacterIds, upCharacterId) {
  return normalizeStringArray(featuredCharacterIds).map(characterId => ({
    character_id: characterId,
    is_up: Boolean(upCharacterId) && characterId === upCharacterId,
  }));
}

function buildPoolAliasRows(canonicalPoolId, sourcePoolId) {
  const canonical = normalizeText(canonicalPoolId);
  const source = normalizeText(sourcePoolId);
  const rows = buildPoolSelfAliasRows(canonical);

  if (source && canonical && source !== canonical) {
    rows.push({
      source: 'official_notice',
      alias_id: source,
      pool_id: canonical,
      is_primary: false,
      note: 'Resolved automation notice pool id to canonical pool id',
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Review bundle 辅助
// ---------------------------------------------------------------------------

function normalizeAppliedPoolIds(reviewBundle) {
  return normalizeStringArray(reviewBundle?.review?.appliedPoolIds);
}

function buildCurrentPoolIdLookup(reviewBundle) {
  const currentRecords = Array.isArray(reviewBundle?.snapshots?.current)
    ? reviewBundle.snapshots.current
    : [];
  const lookup = new Map();
  for (const record of currentRecords) {
    const key = buildPoolAuditKey(record);
    const poolId = normalizeText(record?.pool_id || record?.id);
    if (key && poolId && !lookup.has(key)) lookup.set(key, poolId);
  }
  return lookup;
}

function resolveTargetPoolId({
  baseRecord,
  editedRecord,
  recordId,
  currentPoolIdLookup,
}) {
  const baseAuditKey = buildPoolAuditKey(baseRecord);
  const editedAuditKey = buildPoolAuditKey(editedRecord);

  return currentPoolIdLookup.get(baseAuditKey)
    || currentPoolIdLookup.get(editedAuditKey)
    || recordId;
}

// ---------------------------------------------------------------------------
// 应用计划构建
// ---------------------------------------------------------------------------

export function buildPoolScheduleApplyPlan(reviewBundle, {
  characters = [],
  selectedPoolIds = [],
  overrides = {},
} = {}) {
  const incomingRecords = Array.isArray(reviewBundle?.snapshots?.incoming)
    ? reviewBundle.snapshots.incoming
    : [];
  const selectedIdSet = new Set(normalizeStringArray(selectedPoolIds));
  const previouslyAppliedSet = new Set(normalizeAppliedPoolIds(reviewBundle));
  const availablePoolIds = incomingRecords
    .map(r => normalizeText(r?.pool_id || r?.id))
    .filter(Boolean);
  const requestedRecords = selectedIdSet.size > 0
    ? incomingRecords.filter(r => selectedIdSet.has(normalizeText(r?.pool_id || r?.id)))
    : incomingRecords;
  const missingRequestedPoolIds = selectedIdSet.size > 0
    ? [...selectedIdSet].filter(id => !availablePoolIds.includes(id))
    : [];
  const currentPoolIdLookup = buildCurrentPoolIdLookup(reviewBundle);
  const charLookup = buildCharacterLookup(characters);

  const applicableRecords = [];
  const blockedRecords = [];
  const alreadyAppliedRecords = [];

  for (const rawRecord of requestedRecords) {
    const base = normalizeIncomingPoolRecord(rawRecord);
    const recordId = normalizeText(base.pool_id || rawRecord?.id);

    // 应用超管编辑覆盖
    const edits = overrides[recordId];
    const record = normalizeIncomingPoolRecord(edits ? { ...base, ...edits } : base);

    const targetPoolId = resolveTargetPoolId({
      baseRecord: base,
      editedRecord: record,
      recordId,
      currentPoolIdLookup,
    });
    record.record_id = recordId;
    record.target_pool_id = targetPoolId;

    const issues = [];

    if (!record.record_id && !record.target_pool_id) {
      issues.push({ code: 'missing_pool_id', message: '缺少 pool_id，无法发布' });
    }
    if (!record.name) {
      issues.push({ code: 'missing_name', message: '缺少卡池名称，无法发布' });
    }

    if (record.record_id && previouslyAppliedSet.has(record.record_id)) {
      alreadyAppliedRecords.push({
        pool_id: record.record_id,
        target_pool_id: record.target_pool_id,
        name: record.name,
      });
      continue;
    }

    const normalizedStartTime = normalizeIsoDateTimeInput(record.start_time);
    if (normalizedStartTime.isEmpty) {
      issues.push({ code: 'missing_start_time', message: '缺少开始时间' });
    } else if (!normalizedStartTime.isValid) {
      issues.push({
        code: 'invalid_start_time',
        message: '开始时间格式无效，请使用 ISO 8601 且带时区，例如 2026-03-29T04:00:00.000Z',
      });
    } else {
      record.start_time = normalizedStartTime.value;
    }

    const normalizedEndTime = normalizeIsoDateTimeInput(record.end_time);
    if (normalizedEndTime.isEmpty) {
      issues.push({ code: 'missing_end_time', message: '缺少结束时间' });
    } else if (!normalizedEndTime.isValid) {
      issues.push({
        code: 'invalid_end_time',
        message: '结束时间格式无效，请使用 ISO 8601 且带时区，例如 2026-04-15T04:00:00.000Z',
      });
    } else {
      record.end_time = normalizedEndTime.value;
    }

    const itemType = record.type === 'weapon' ? 'weapon' : 'character';

    // 重新解析 featured characters（可能被编辑覆盖）
    if (record.featured_character_names.length > 0 && record.featured_characters.length === 0) {
      const resolved = [];
      for (const name of record.featured_character_names) {
        const { id } = resolveEntity(charLookup, name, itemType);
        if (id) resolved.push(id);
      }
      record.featured_characters = [...new Set(resolved)];
    }

    const unresolvedNames = record.featured_character_names.filter(name => {
      const { id } = resolveEntity(charLookup, name, itemType);
      return !id || !record.featured_characters.includes(id);
    });

    if (record.featured_character_names.length > 0 && record.featured_characters.length === 0) {
      issues.push({ code: 'missing_featured_character_ids', message: '未能解析 featured_characters 的规范 ID' });
    }
    if (unresolvedNames.length > 0) {
      issues.push({
        code: 'unresolved_featured_characters',
        message: `以下名称未完成规范 ID 映射：${unresolvedNames.join(' / ')}`,
      });
    }

    const upMatch = resolveEntity(charLookup, record.up_character, itemType);
    const upCharacterId = upMatch.id;

    if (record.up_character && !upCharacterId) {
      issues.push({
        code: 'unresolved_up_character',
        message: `UP 目标「${record.up_character}」未完成规范 ID 映射`,
      });
    }
    if (upCharacterId && record.featured_characters.length > 0 && !record.featured_characters.includes(upCharacterId)) {
      issues.push({
        code: 'up_character_not_in_featured',
        message: `UP 目标「${record.up_character}」不在 featured_characters 列表中`,
      });
    }

    if (issues.length > 0) {
      blockedRecords.push({
        pool_id: record.record_id,
        target_pool_id: record.target_pool_id,
        name: record.name,
        type: record.type,
        start_time: record.start_time,
        end_time: record.end_time,
        up_character: record.up_character,
        featured_character_names: record.featured_character_names,
        issues,
      });
      continue;
    }

    const poolCharacterRows = buildPoolCharacterRows(record.featured_characters, upCharacterId);
    applicableRecords.push({
      ...record,
      up_character_id: upCharacterId,
      poolCharacterRows,
      aliasRows: buildPoolAliasRows(record.target_pool_id, record.record_id),
      insertPayload: {
        pool_id: record.target_pool_id,
        name: record.name,
        type: record.type,
        locked: false,
        is_limited_weapon: record.type === 'weapon' ? true : null,
        description: record.description,
        start_time: record.start_time,
        end_time: record.end_time,
        banner_url: record.banner_url,
        featured_characters: record.featured_characters,
        up_character: record.up_character || null,
      },
      updatePayload: {
        name: record.name,
        type: record.type,
        is_limited_weapon: record.type === 'weapon' ? true : null,
        description: record.description,
        start_time: record.start_time,
        end_time: record.end_time,
        banner_url: record.banner_url,
        featured_characters: record.featured_characters,
        up_character: record.up_character || null,
      },
    });
  }

  const requestedPoolIds = requestedRecords
    .map(r => normalizeText(r?.pool_id || r?.id))
    .filter(Boolean);

  return {
    requestedPoolIds,
    availablePoolIds,
    missingRequestedPoolIds,
    applicablePoolIds: applicableRecords.map(r => r.record_id || r.pool_id).filter(Boolean),
    blockedPoolIds: blockedRecords.map(r => r.pool_id).filter(Boolean),
    alreadyAppliedPoolIds: alreadyAppliedRecords.map(r => r.pool_id).filter(Boolean),
    applicableRecords,
    blockedRecords,
    alreadyAppliedRecords,
    summary: {
      available: availablePoolIds.length,
      requested: requestedPoolIds.length,
      applicable: applicableRecords.length,
      blocked: blockedRecords.length,
      alreadyApplied: alreadyAppliedRecords.length,
      missingRequested: missingRequestedPoolIds.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Review bundle 更新
// ---------------------------------------------------------------------------

export function buildUpdatedPoolScheduleReviewBundle(reviewBundle, {
  appliedPoolIds = [],
  blockedPoolIds = [],
  actorUserId = null,
  attemptedAt = new Date().toISOString(),
  note = null,
  status = 'pending_manual_review',
  error = null,
} = {}) {
  const prev = reviewBundle?.review && typeof reviewBundle.review === 'object'
    ? reviewBundle.review
    : {};
  const nextApplied = [...new Set([
    ...normalizeAppliedPoolIds(reviewBundle),
    ...normalizeStringArray(appliedPoolIds),
  ])];

  return {
    ...reviewBundle,
    review: {
      ...prev,
      status,
      requiresApproval: status !== 'applied',
      appliedPoolIds: nextApplied,
      blockedPoolIds: normalizeStringArray(blockedPoolIds),
      lastAttemptedAt: attemptedAt,
      lastAttemptedBy: actorUserId,
      lastAppliedAt: appliedPoolIds.length > 0 ? attemptedAt : (prev.lastAppliedAt || null),
      lastAppliedBy: appliedPoolIds.length > 0 ? actorUserId : (prev.lastAppliedBy || null),
      note: normalizeText(note) || prev.note || null,
      lastError: normalizeText(error) || null,
    },
  };
}
