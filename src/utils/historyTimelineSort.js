import { getHistoryRecordTimestampMs, normalizeMetadataTimestamp } from './gameAccountMetadata.js';

function normalizeTimelineTimestamp(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value < 1e12 ? value * 1000 : value;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric < 1e12 ? numeric * 1000 : numeric;
  }

  const normalized = normalizeMetadataTimestamp(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized).getTime();
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getHistoryTimelineTimestampMs(record) {
  if (!record) {
    return 0;
  }

  return (
    normalizeTimelineTimestamp(record?.timestamp)
    || normalizeTimelineTimestamp(record?.gacha_time)
    || getHistoryRecordTimestampMs(record)
    || normalizeTimelineTimestamp(record?.created_at)
    || 0
  );
}

export function getHistoryTimelineCreatedAtMs(record) {
  return normalizeTimelineTimestamp(record?.created_at) || 0;
}

export function getHistoryTimelineSeq(record) {
  const raw = record?.seqId ?? record?.seq_id ?? record?.record_id ?? 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getHistoryTimelineStableKey(record) {
  return String(
    record?.id
      || record?.record_id
      || `${record?.poolId || record?.pool_id || 'pool'}:${record?.character_id || record?.characterId || record?.name || ''}`
  );
}

export function compareHistoryTimelineAsc(left, right) {
  const timeDiff = getHistoryTimelineTimestampMs(left) - getHistoryTimelineTimestampMs(right);
  if (timeDiff !== 0) {
    return timeDiff;
  }

  const createdDiff = getHistoryTimelineCreatedAtMs(left) - getHistoryTimelineCreatedAtMs(right);
  if (createdDiff !== 0) {
    return createdDiff;
  }

  const seqDiff = getHistoryTimelineSeq(left) - getHistoryTimelineSeq(right);
  if (seqDiff !== 0) {
    return seqDiff;
  }

  return getHistoryTimelineStableKey(left).localeCompare(getHistoryTimelineStableKey(right), 'zh-CN');
}

export function compareHistoryTimelineDesc(left, right) {
  return compareHistoryTimelineAsc(right, left);
}
