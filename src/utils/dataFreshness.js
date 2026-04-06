import {
  getHistoryRecordTimestampMs,
  normalizeMetadataTimestamp
} from './gameAccountMetadata.js';

function parseTimestampMs(value) {
  const normalized = normalizeMetadataTimestamp(value);
  if (!normalized) {
    return null;
  }

  return new Date(normalized).getTime();
}

export function getLatestHistoryTimestampMs(records = []) {
  let latestTimestamp = null;

  (Array.isArray(records) ? records : []).forEach((record) => {
    const timestamp = getHistoryRecordTimestampMs(record);
    if (!timestamp) {
      return;
    }

    if (!latestTimestamp || timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
    }
  });

  return latestTimestamp;
}

export function formatFreshnessAbsolute(value, fallback = '未知') {
  const timestamp = parseTimestampMs(value);
  if (!timestamp) {
    return fallback;
  }

  return new Date(timestamp).toLocaleString('zh-CN', {
    hour12: false
  });
}

export function formatFreshnessRelative(value, unknownLabel = '时间未知') {
  const timestamp = parseTimestampMs(value);
  if (!timestamp) {
    return unknownLabel;
  }

  const delta = Math.max(0, Date.now() - timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;

  if (delta < minute) {
    return '刚刚更新';
  }

  if (delta < hour) {
    return `${Math.floor(delta / minute)} 分钟未更新`;
  }

  if (delta < day) {
    return `${Math.floor(delta / hour)} 小时未更新`;
  }

  if (delta < month) {
    return `${Math.floor(delta / day)} 天未更新`;
  }

  if (delta < year) {
    return `${Math.floor(delta / month)} 个月未更新`;
  }

  return `${Math.floor(delta / year)} 年未更新`;
}

export function getFreshnessTone(value) {
  const timestamp = parseTimestampMs(value);
  if (!timestamp) {
    return 'unknown';
  }

  const ageDays = Math.max(0, Date.now() - timestamp) / (24 * 60 * 60 * 1000);

  if (ageDays <= 1) {
    return 'fresh';
  }

  if (ageDays <= 7) {
    return 'notice';
  }

  return 'stale';
}
