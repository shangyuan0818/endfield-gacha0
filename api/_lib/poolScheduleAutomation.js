import { buildPoolSelfAliasRows } from '../../shared/idAliasService.js';
import { normalizeEntityNameForMatch } from '../../src/utils/canonicalEntityUtils.js';

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
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'limited_character') return 'limited';
  if (normalized === 'limited_weapon') return 'weapon';
  if (normalized === 'limited' || normalized === 'weapon' || normalized === 'standard') {
    return normalized;
  }
  return 'limited';
}

function buildCharacterLookup(characters) {
  const lookup = new Map();

  (Array.isArray(characters) ? characters : []).forEach((character) => {
    const variants = [
      character?.name,
      ...(Array.isArray(character?.aliases) ? character.aliases : []),
    ];

    variants
      .map(value => normalizeEntityNameForMatch(value))
      .filter(Boolean)
      .forEach((key) => {
        if (!lookup.has(key)) {
          lookup.set(key, []);
        }

        lookup.get(key).push(character);
      });
  });

  return lookup;
}

function resolveUniqueCharacter(characterLookup, name, itemType) {
  const normalized = normalizeEntityNameForMatch(name);
  if (!normalized) {
    return {
      id: null,
      candidates: [],
    };
  }

  const candidates = (characterLookup.get(normalized) || [])
    .filter(character => character?.type === itemType);

  return {
    id: candidates.length === 1 ? normalizeText(candidates[0]?.id) : null,
    candidates,
  };
}

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

function buildPoolCharacterRows(featuredCharacterIds, upCharacterId) {
  return normalizeStringArray(featuredCharacterIds).map(characterId => ({
    character_id: characterId,
    is_up: Boolean(upCharacterId) && characterId === upCharacterId,
  }));
}

function normalizeAppliedPoolIds(reviewBundle) {
  return normalizeStringArray(reviewBundle?.review?.appliedPoolIds);
}

export function buildPoolScheduleApplyPlan(reviewBundle, {
  characters = [],
  selectedPoolIds = [],
} = {}) {
  const incomingRecords = Array.isArray(reviewBundle?.snapshots?.incoming)
    ? reviewBundle.snapshots.incoming
    : [];
  const selectedIdSet = new Set(normalizeStringArray(selectedPoolIds));
  const previouslyAppliedSet = new Set(normalizeAppliedPoolIds(reviewBundle));
  const availablePoolIds = incomingRecords
    .map(record => normalizeText(record?.pool_id || record?.id))
    .filter(Boolean);
  const requestedRecords = selectedIdSet.size > 0
    ? incomingRecords.filter(record => selectedIdSet.has(normalizeText(record?.pool_id || record?.id)))
    : incomingRecords;
  const missingRequestedPoolIds = selectedIdSet.size > 0
    ? Array.from(selectedIdSet).filter(poolId => !availablePoolIds.includes(poolId))
    : [];

  const characterLookup = buildCharacterLookup(characters);
  const applicableRecords = [];
  const blockedRecords = [];
  const alreadyAppliedRecords = [];

  requestedRecords.forEach((rawRecord) => {
    const record = normalizeIncomingPoolRecord(rawRecord);
    const issues = [];

    if (!record.pool_id) {
      issues.push({
        code: 'missing_pool_id',
        message: '缺少 pool_id，无法发布',
      });
    }

    if (!record.name) {
      issues.push({
        code: 'missing_name',
        message: '缺少卡池名称，无法发布',
      });
    }

    if (record.pool_id && previouslyAppliedSet.has(record.pool_id)) {
      alreadyAppliedRecords.push({
        pool_id: record.pool_id,
        name: record.name,
      });
      return;
    }

    if (!record.start_time) {
      issues.push({
        code: 'missing_start_time',
        message: '缺少明确开始时间，当前版本仍要求人工补齐后再发布',
      });
    }

    if (!record.end_time) {
      issues.push({
        code: 'missing_end_time',
        message: '缺少明确结束时间，当前版本仍要求人工补齐后再发布',
      });
    }

    const itemType = record.type === 'weapon' ? 'weapon' : 'character';
    const unresolvedFeaturedNames = record.featured_character_names.filter((name) => {
      const resolved = resolveUniqueCharacter(characterLookup, name, itemType);
      return !resolved.id || !record.featured_characters.includes(resolved.id);
    });

    if (record.featured_character_names.length > 0 && record.featured_characters.length === 0) {
      issues.push({
        code: 'missing_featured_character_ids',
        message: '未能解析 featured_characters 的规范 ID',
      });
    }

    if (unresolvedFeaturedNames.length > 0) {
      issues.push({
        code: 'unresolved_featured_characters',
        message: `以下名称未完成规范 ID 映射：${unresolvedFeaturedNames.join(' / ')}`,
      });
    }

    const upMatch = resolveUniqueCharacter(characterLookup, record.up_character, itemType);
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
        pool_id: record.pool_id,
        name: record.name,
        type: record.type,
        up_character: record.up_character,
        featured_character_names: record.featured_character_names,
        issues,
      });
      return;
    }

    const poolCharacterRows = buildPoolCharacterRows(record.featured_characters, upCharacterId);
    applicableRecords.push({
      ...record,
      up_character_id: upCharacterId,
      poolCharacterRows,
      aliasRows: buildPoolSelfAliasRows(record.pool_id),
      insertPayload: {
        pool_id: record.pool_id,
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
  });

  const requestedPoolIds = requestedRecords
    .map(record => normalizeText(record?.pool_id || record?.id))
    .filter(Boolean);

  return {
    requestedPoolIds,
    availablePoolIds,
    missingRequestedPoolIds,
    applicablePoolIds: applicableRecords.map(record => record.pool_id),
    blockedPoolIds: blockedRecords.map(record => record.pool_id).filter(Boolean),
    alreadyAppliedPoolIds: alreadyAppliedRecords.map(record => record.pool_id).filter(Boolean),
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

export function buildUpdatedPoolScheduleReviewBundle(reviewBundle, {
  appliedPoolIds = [],
  blockedPoolIds = [],
  actorUserId = null,
  attemptedAt = new Date().toISOString(),
  note = null,
  status = 'pending_manual_review',
  error = null,
} = {}) {
  const previousReview = reviewBundle?.review && typeof reviewBundle.review === 'object'
    ? reviewBundle.review
    : {};
  const nextAppliedPoolIds = Array.from(new Set([
    ...normalizeAppliedPoolIds(reviewBundle),
    ...normalizeStringArray(appliedPoolIds),
  ]));

  return {
    ...reviewBundle,
    review: {
      ...previousReview,
      status,
      requiresApproval: status !== 'applied',
      appliedPoolIds: nextAppliedPoolIds,
      blockedPoolIds: normalizeStringArray(blockedPoolIds),
      lastAttemptedAt: attemptedAt,
      lastAttemptedBy: actorUserId,
      lastAppliedAt: appliedPoolIds.length > 0
        ? attemptedAt
        : (previousReview.lastAppliedAt || null),
      lastAppliedBy: appliedPoolIds.length > 0
        ? actorUserId
        : (previousReview.lastAppliedBy || null),
      note: normalizeText(note) || previousReview.note || null,
      lastError: normalizeText(error) || null,
    },
  };
}
