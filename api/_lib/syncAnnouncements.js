import { getSupabaseAdminClient } from './authAdmin.js';
import {
  buildOfficialAnnouncementRecordsFromSources,
  buildOfficialAnnouncementSourceRecords,
} from './officialAnnouncementsFeed.js';

const DEFAULT_PAGE_SIZE = 10;
const FORCE_REFRESH_WINDOW_DAYS = 7;
const GAME_ANNOUNCEMENT_PRIORITY = 0;
const ANNOUNCEMENT_TITLE_MAX_LENGTH = 100;
const ANNOUNCEMENT_CONTENT_MAX_LENGTH = 5000;
const ANNOUNCEMENT_VERSION_MAX_LENGTH = 20;

const SYNC_COMPARE_FIELDS = [
  'title',
  'summary',
  'content',
  'version',
  'published_at',
  'source_url',
  'is_active',
  'priority',
];

function normalizeComparableValue(value) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return String(value);
}

function isAnnouncementRecordChanged(currentRecord = {}, nextRecord = {}) {
  return SYNC_COMPARE_FIELDS.some((field) => (
    normalizeComparableValue(currentRecord[field]) !== normalizeComparableValue(nextRecord[field])
  ));
}

function truncateDbText(value, maxLength, suffix = '…') {
  const normalizedValue = String(value || '').trim();
  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  const normalizedSuffix = String(suffix || '');
  const availableLength = Math.max(1, maxLength - normalizedSuffix.length);
  return `${normalizedValue.slice(0, availableLength).trimEnd()}${normalizedSuffix}`;
}

function normalizePersistedAnnouncementRecord(record = {}) {
  const title = truncateDbText(record.title || '官方公告', ANNOUNCEMENT_TITLE_MAX_LENGTH);
  const summary = String(record.summary || '').trim();
  const fallbackContent = summary || title || '官方公告内容请查看原文。';
  const content = truncateDbText(
    record.content || fallbackContent,
    ANNOUNCEMENT_CONTENT_MAX_LENGTH,
    '\n\n> 内容因数据库长度限制已裁剪，请查看官方原文。'
  ) || fallbackContent;

  return {
    ...record,
    title,
    summary,
    content,
    version: truncateDbText(record.version || 'hg-unknown', ANNOUNCEMENT_VERSION_MAX_LENGTH, ''),
  };
}

function shouldRefreshAnnouncementRecord(existingRecord, nextRawRecord, { forceRefresh = false } = {}) {
  if (forceRefresh || !existingRecord) {
    return true;
  }

  if (!normalizeComparableValue(existingRecord.content)) {
    return true;
  }

  return normalizeComparableValue(existingRecord.version) !== normalizeComparableValue(nextRawRecord.version);
}

function getRecentAnnouncementCutoffIso(now = Date.now(), days = FORCE_REFRESH_WINDOW_DAYS) {
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
}

function isRecentAnnouncementSourceRecord(record, cutoffIso = getRecentAnnouncementCutoffIso()) {
  const timestamp = new Date(record?.published_at || 0).getTime();
  const cutoff = new Date(cutoffIso).getTime();
  return Number.isFinite(timestamp) && timestamp >= cutoff;
}

async function persistAnnouncementRecord(supabase, record, isExistingRecord) {
  if (isExistingRecord) {
    return supabase
      .from('announcements')
      .update(record)
      .eq('source_id', record.source_id);
  }

  return supabase
    .from('announcements')
    .insert(record);
}

export async function syncAnnouncements({
  forceRefresh = false,
} = {}) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { synced: 0, skipped: 0, error: 'Database not configured' };
  }

  const fetchedRawRecords = await buildOfficialAnnouncementSourceRecords(DEFAULT_PAGE_SIZE);
  const rawRecords = forceRefresh
    ? fetchedRawRecords.filter(record => isRecentAnnouncementSourceRecord(record))
    : fetchedRawRecords;
  if (rawRecords.length === 0) {
    return { synced: 0, skipped: 0, summarized: 0, total: 0, forceRefresh };
  }

  const sourceIds = rawRecords.map(record => String(record.source_id));

  const { data: existing, error: selectError } = await supabase
    .from('announcements')
    .select('source_id, title, summary, content, version, published_at, source_url, is_active, priority')
    .in('source_id', sourceIds);
  if (selectError) {
    return {
      synced: 0,
      skipped: 0,
      summarized: 0,
      total: rawRecords.length,
      forceRefresh,
      error: selectError.message,
      records: rawRecords,
      rawRecords,
    };
  }

  const existingById = new Map((existing || []).map(r => [String(r.source_id), r]));
  const recordsNeedingSummary = rawRecords.filter((record) => {
    const existingRecord = existingById.get(String(record.source_id));
    return shouldRefreshAnnouncementRecord(existingRecord, record, { forceRefresh });
  });

  if (recordsNeedingSummary.length === 0) {
    return {
      synced: 0,
      created: 0,
      updated: 0,
      skipped: rawRecords.length,
      summarized: 0,
      total: rawRecords.length,
      forceRefresh,
      records: rawRecords,
      rawRecords,
    };
  }

  const records = await buildOfficialAnnouncementRecordsFromSources(recordsNeedingSummary, {
    allowLlm: true,
    bypassLlmCache: forceRefresh,
  });

  const persistRecords = records.map(record => normalizePersistedAnnouncementRecord({
    source_id: record.source_id,
    title: record.title,
    summary: record.summary,
    content: record.content,
    version: record.version,
    published_at: record.published_at,
    source_url: record.source_url,
    is_active: true,
    priority: GAME_ANNOUNCEMENT_PRIORITY,
  }));

  const recordsToPersist = persistRecords.filter((record) => {
    const existingRecord = existingById.get(String(record.source_id));
    return !existingRecord || isAnnouncementRecordChanged(existingRecord, record);
  });

  if (recordsToPersist.length === 0) {
    return {
      synced: 0,
      created: 0,
      updated: 0,
      skipped: rawRecords.length,
      summarized: records.length,
      total: rawRecords.length,
      forceRefresh,
      records: rawRecords,
      updatedRecords: records,
      rawRecords,
    };
  }

  let synced = 0;
  let created = 0;
  let updated = 0;
  const errors = [];

  for (const record of recordsToPersist) {
    try {
      const isExistingRecord = existingById.has(String(record.source_id));
      const { error } = await persistAnnouncementRecord(supabase, record, isExistingRecord);

      if (error) throw error;
      synced++;
      if (isExistingRecord) {
        updated++;
      } else {
        created++;
      }
    } catch (err) {
      errors.push({ source_id: record.source_id, title: record.title, error: err.message });
    }
  }

  const skipped = rawRecords.length - recordsToPersist.length;
  return {
    synced,
    created,
    updated,
    skipped,
    summarized: records.length,
    total: rawRecords.length,
    forceRefresh,
    error: errors.length > 0 && synced === 0 ? '公告写入数据库失败' : undefined,
    errors: errors.length > 0 ? errors : undefined,
    records: rawRecords,
    updatedRecords: records,
    rawRecords,
  };
}

export const __internal = {
  ANNOUNCEMENT_CONTENT_MAX_LENGTH,
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
  ANNOUNCEMENT_VERSION_MAX_LENGTH,
  FORCE_REFRESH_WINDOW_DAYS,
  GAME_ANNOUNCEMENT_PRIORITY,
  getRecentAnnouncementCutoffIso,
  isAnnouncementRecordChanged,
  isRecentAnnouncementSourceRecord,
  normalizePersistedAnnouncementRecord,
  persistAnnouncementRecord,
  shouldRefreshAnnouncementRecord,
};
