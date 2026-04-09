import {
  getHistoryRecordTimestampMs,
  normalizeMetadataTimestamp
} from './gameAccountMetadata.js';
import { formatAppDateTime, getAppLocale, getMessage } from '../i18n/index.js';

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

export function formatFreshnessAbsolute(value, fallback = null, locale = getAppLocale(), options = {}) {
  const timestamp = parseTimestampMs(value);
  if (!timestamp) {
    return fallback ?? getMessage('common.unknown', {}, locale);
  }

  return formatAppDateTime(
    timestamp,
    locale,
    { hour12: false, ...options },
    fallback ?? getMessage('common.unknown', {}, locale)
  );
}

export function formatFreshnessRelative(value, unknownLabel = null, locale = getAppLocale()) {
  const timestamp = parseTimestampMs(value);
  if (!timestamp) {
    return unknownLabel ?? getMessage('common.timeUnknown', {}, locale);
  }

  const delta = Math.max(0, Date.now() - timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;
  if (delta < minute) {
    return getMessage('common.justUpdated', {}, locale);
  }

  if (delta < hour) {
    return getMessage('common.minutesStale', { count: Math.floor(delta / minute) }, locale);
  }

  if (delta < day) {
    return getMessage('common.hoursStale', { count: Math.floor(delta / hour) }, locale);
  }

  if (delta < month) {
    return getMessage('common.daysStale', { count: Math.floor(delta / day) }, locale);
  }

  if (delta < year) {
    return getMessage('common.monthsStale', { count: Math.floor(delta / month) }, locale);
  }

  return getMessage('common.yearsStale', { count: Math.floor(delta / year) }, locale);
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
