import {
  DEFAULT_HOME_NEXT_VERSION_TARGET_DATE,
  DEFAULT_HOME_VERSION_TIMELINE,
  buildHomeRotationVersionSections,
  resolveHomeVersionPlan,
} from './homeVersionTimeline.js';

function normalizeText(value) {
  if (value == null) {
    return '';
  }

  return String(value).trim();
}

function parseTimelineConfig(value) {
  if (value == null || value === '') {
    return DEFAULT_HOME_VERSION_TIMELINE;
  }

  if (typeof value === 'string') {
    return JSON.parse(value);
  }

  return value;
}

function getRawVersions(parsedConfig) {
  if (Array.isArray(parsedConfig)) {
    return parsedConfig;
  }

  if (Array.isArray(parsedConfig?.versions)) {
    return parsedConfig.versions;
  }

  return DEFAULT_HOME_VERSION_TIMELINE;
}

export function parseHomeVersionPoolIdsText(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map(normalizeText).filter(Boolean))];
  }

  return [...new Set(String(value || '')
    .split(/[\n,，;；\s]+/u)
    .map(normalizeText)
    .filter(Boolean))];
}

function getPoolId(pool) {
  return normalizeText(pool?.pool_id || pool?.poolId || pool?.id);
}

function getPoolStartAt(pool) {
  return normalizeText(pool?.start_time || pool?.startTime || pool?.startDate || pool?.starts_at || pool?.startsAt);
}

function getPoolEndAt(pool) {
  return normalizeText(pool?.end_time || pool?.endTime || pool?.endDate || pool?.ends_at || pool?.endsAt);
}

function toValidTimestamp(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const time = new Date(normalized).getTime();
  return Number.isFinite(time) ? { value: normalized, time } : null;
}

function normalizeDurationDays(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }

  const numberValue = Number(normalized);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return normalized;
  }

  return Number(numberValue.toFixed(2)).toString();
}

function calculateDurationDays(startsAt, endsAt) {
  const start = toValidTimestamp(startsAt);
  const end = toValidTimestamp(endsAt);
  if (!start || !end || end.time <= start.time) {
    return '';
  }

  return normalizeDurationDays((end.time - start.time) / 86400000);
}

function formatChinaOffsetTimestamp(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    return '';
  }

  const chinaTime = new Date(date.getTime() + 8 * 3600000);
  const pad = (value) => String(value).padStart(2, '0');
  return [
    chinaTime.getUTCFullYear(),
    '-',
    pad(chinaTime.getUTCMonth() + 1),
    '-',
    pad(chinaTime.getUTCDate()),
    'T',
    pad(chinaTime.getUTCHours()),
    ':',
    pad(chinaTime.getUTCMinutes()),
    ':',
    pad(chinaTime.getUTCSeconds()),
    '+08:00',
  ].join('');
}

export function applyHomeVersionDurationToEndAt(row) {
  const start = toValidTimestamp(row?.startsAt);
  const durationDays = Number(row?.durationDays);
  if (!start || !Number.isFinite(durationDays) || durationDays <= 0) {
    return normalizeText(row?.endsAt);
  }

  return formatChinaOffsetTimestamp(new Date(start.time + durationDays * 86400000));
}

export function inferHomeVersionTimeRangeFromPools(row, pools = []) {
  const selectedIds = new Set(parseHomeVersionPoolIdsText(row?.poolIdsText));
  if (selectedIds.size === 0 || !Array.isArray(pools) || pools.length === 0) {
    return null;
  }

  const matched = pools.filter((pool) => selectedIds.has(getPoolId(pool)));
  const starts = matched
    .map((pool) => toValidTimestamp(getPoolStartAt(pool)))
    .filter(Boolean)
    .sort((left, right) => left.time - right.time);
  const ends = matched
    .map((pool) => toValidTimestamp(getPoolEndAt(pool)))
    .filter(Boolean)
    .sort((left, right) => right.time - left.time);

  if (starts.length === 0 && ends.length === 0) {
    return null;
  }

  return {
    startsAt: starts[0]?.value || normalizeText(row?.startsAt),
    endsAt: ends[0]?.value || normalizeText(row?.endsAt),
    durationDays: calculateDurationDays(starts[0]?.value || normalizeText(row?.startsAt), ends[0]?.value || normalizeText(row?.endsAt)),
    matchedCount: matched.length,
  };
}

export function createHomeVersionTimelineRows(value, {
  fallbackTargetAt = DEFAULT_HOME_NEXT_VERSION_TARGET_DATE,
} = {}) {
  try {
    const parsedConfig = parseTimelineConfig(value);
    const versions = getRawVersions(parsedConfig);
    return {
      parseError: null,
      rows: versions.map((version, index) => ({
        id: normalizeText(version?.id) || `version-${index + 1}`,
        name: normalizeText(version?.name || version?.title),
        nameEn: normalizeText(version?.name_en || version?.nameEn || version?.title_en || version?.titleEn),
        startsAt: normalizeText(
          version?.starts_at
          || version?.startsAt
          || version?.start_time
          || version?.startTime
          || version?.target_at
          || version?.targetAt
          || (index === 0 ? fallbackTargetAt : '')
        ),
        endsAt: normalizeText(version?.ends_at || version?.endsAt || version?.end_time || version?.endTime),
        durationDays: normalizeDurationDays(version?.duration_days || version?.durationDays)
          || calculateDurationDays(
            version?.starts_at || version?.startsAt || version?.start_time || version?.startTime || version?.target_at || version?.targetAt || (index === 0 ? fallbackTargetAt : ''),
            version?.ends_at || version?.endsAt || version?.end_time || version?.endTime
          ),
        enabled: version?.enabled !== false
          && version?.disabled !== true
          && !['disabled', 'hidden'].includes(normalizeText(version?.status).toLowerCase()),
        order: Number.isFinite(Number(version?.order)) ? String(Number(version.order)) : String((index + 1) * 10),
        poolIdsText: parseHomeVersionPoolIdsText(version?.pool_ids || version?.poolIds).join('\n'),
      })),
    };
  } catch (error) {
    return {
      parseError: error,
      rows: DEFAULT_HOME_VERSION_TIMELINE.map((version, index) => ({
        id: version.id || `version-${index + 1}`,
        name: version.name || '',
        nameEn: version.name_en || '',
        startsAt: version.starts_at || fallbackTargetAt,
        endsAt: version.ends_at || '',
        durationDays: normalizeDurationDays(version.duration_days) || calculateDurationDays(version.starts_at || fallbackTargetAt, version.ends_at),
        enabled: version.enabled !== false,
        order: Number.isFinite(Number(version.order)) ? String(Number(version.order)) : String((index + 1) * 10),
        poolIdsText: parseHomeVersionPoolIdsText(version.pool_ids).join('\n'),
      })),
    };
  }
}

function isValidTimestamp(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return false;
  }

  return Number.isFinite(new Date(normalized).getTime());
}

export function validateHomeVersionTimelineRows(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const rowErrors = safeRows.map(() => []);
  const errors = [];
  const idCounts = new Map();

  safeRows.forEach((row) => {
    const id = normalizeText(row?.id);
    if (id) {
      idCounts.set(id, (idCounts.get(id) || 0) + 1);
    }
  });

  safeRows.forEach((row, index) => {
    const currentErrors = rowErrors[index];
    const id = normalizeText(row?.id);
    const name = normalizeText(row?.name);
    const startsAt = normalizeText(row?.startsAt);
    const endsAt = normalizeText(row?.endsAt);
    const order = normalizeText(row?.order);
    const durationDays = normalizeText(row?.durationDays);

    if (!id) {
      currentErrors.push('版本 ID 不能为空');
    } else if (idCounts.get(id) > 1) {
      currentErrors.push('版本 ID 重复');
    }

    if (!name) {
      currentErrors.push('中文版本名不能为空');
    }

    if (!isValidTimestamp(startsAt)) {
      currentErrors.push('开始时间必须是有效时间');
    }

    if (endsAt) {
      if (!isValidTimestamp(endsAt)) {
        currentErrors.push('结束时间必须是有效时间');
      } else if (isValidTimestamp(startsAt) && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
        currentErrors.push('结束时间必须晚于开始时间');
      }
    }

    if (order && !Number.isFinite(Number(order))) {
      currentErrors.push('排序必须是数字');
    }

    if (durationDays) {
      const durationNumber = Number(durationDays);
      if (!Number.isFinite(durationNumber) || durationNumber <= 0) {
        currentErrors.push('持续天数必须是大于 0 的数字');
      }
    }

    if (currentErrors.length > 0) {
      errors.push(`第 ${index + 1} 个版本：${currentErrors.join('；')}`);
    }
  });

  if (safeRows.length === 0) {
    errors.push('至少需要保留一个版本节点');
  }

  return {
    valid: errors.length === 0,
    errors,
    rowErrors,
  };
}

export function serializeHomeVersionTimelineRows(rows) {
  const versions = (Array.isArray(rows) ? rows : []).map((row, index) => {
    const poolIds = parseHomeVersionPoolIdsText(row?.poolIdsText);
    const durationDays = Number(row?.durationDays);
    const endsAt = normalizeText(row?.endsAt) || applyHomeVersionDurationToEndAt(row) || null;
    return {
      id: normalizeText(row?.id) || `version-${index + 1}`,
      name: normalizeText(row?.name),
      name_en: normalizeText(row?.nameEn),
      starts_at: normalizeText(row?.startsAt),
      ends_at: endsAt,
      duration_days: Number.isFinite(durationDays) && durationDays > 0 ? Number(durationDays.toFixed(2)) : null,
      enabled: row?.enabled !== false,
      order: Number.isFinite(Number(row?.order)) ? Number(row.order) : (index + 1) * 10,
      pool_ids: poolIds,
    };
  });

  return JSON.stringify({ versions }, null, 2);
}

export function buildHomeVersionTimelineEditorPreview(rows, {
  fallbackTargetAt = DEFAULT_HOME_NEXT_VERSION_TARGET_DATE,
  locale = 'zh-CN',
  now = new Date(),
} = {}) {
  const serialized = serializeHomeVersionTimelineRows(rows);
  return resolveHomeVersionPlan({
    timelineConfig: serialized,
    legacyTargetAt: fallbackTargetAt,
    locale,
    now,
  });
}

function buildPoolScheduleForPreview(rows, pools = []) {
  const selectedIds = new Set(
    (Array.isArray(rows) ? rows : [])
      .flatMap((row) => parseHomeVersionPoolIdsText(row?.poolIdsText))
  );

  return (Array.isArray(pools) ? pools : [])
    .filter((pool) => selectedIds.has(getPoolId(pool)))
    .map((pool) => ({
      id: getPoolId(pool),
      name: normalizeText(pool?.name) || getPoolId(pool),
      displayName: normalizeText(pool?.name) || getPoolId(pool),
      poolType: pool?.type === 'extra' ? 'extra' : pool?.type,
      startDate: getPoolStartAt(pool),
      endDate: getPoolEndAt(pool),
      poolData: {
        ...pool,
        type: pool?.type,
      },
    }));
}

export function buildHomeVersionTimelinePoolPreview(rows, pools = [], {
  fallbackTargetAt = DEFAULT_HOME_NEXT_VERSION_TARGET_DATE,
  locale = 'zh-CN',
  now = new Date(),
} = {}) {
  const versionPlan = buildHomeVersionTimelineEditorPreview(rows, {
    fallbackTargetAt,
    locale,
    now,
  });
  const poolSchedule = buildPoolScheduleForPreview(rows, pools);

  if (poolSchedule.length === 0) {
    return [];
  }

  return buildHomeRotationVersionSections({
    poolSchedule,
    versionPlan,
    now,
  });
}
