import {
  buildAutomationAuditReport,
  buildManualReviewBundle,
} from '../../scripts/lib/opsAutomationCore.mjs';
import {
  OPS_AUTOMATION_JOBS,
  getOpsAutomationJob,
} from '../../scripts/lib/opsAutomationJobRegistry.mjs';

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
const SUPPORTED_TRIGGER_TYPES = new Set(['cron', 'manual', 'api']);
const MAINTENANCE_GATED_JOB_IDS = new Set(['pool-schedule', 'wiki-catalog']);
const VERSION_UPDATE_TITLE_PATTERN = /版本更新说明/;

export const OPS_AUTOMATION_SOURCE_ENVS = Object.freeze({
  'official-announcements': Object.freeze({
    urlEnv: 'OPS_AUTOMATION_ANNOUNCEMENTS_URL',
    tagEnv: 'OPS_AUTOMATION_ANNOUNCEMENTS_TAG',
    timeoutEnv: 'OPS_AUTOMATION_ANNOUNCEMENTS_TIMEOUT_MS',
  }),
  'pool-schedule': Object.freeze({
    urlEnv: 'OPS_AUTOMATION_POOL_SCHEDULE_URL',
    tagEnv: 'OPS_AUTOMATION_POOL_SCHEDULE_TAG',
    timeoutEnv: 'OPS_AUTOMATION_POOL_SCHEDULE_TIMEOUT_MS',
  }),
  'wiki-catalog': Object.freeze({
    urlEnv: 'OPS_AUTOMATION_WIKI_CATALOG_URL',
    tagEnv: 'OPS_AUTOMATION_WIKI_CATALOG_TAG',
    timeoutEnv: 'OPS_AUTOMATION_WIKI_CATALOG_TIMEOUT_MS',
  }),
});

const INTERNAL_SOURCE_PATHS = Object.freeze({
  'official-announcements': '/api/automation-feed?job=official-announcements',
  'pool-schedule': '/api/automation-feed?job=pool-schedule',
  'wiki-catalog': '/api/automation-feed?job=wiki-catalog',
});

function getHeaderValue(headers, name) {
  if (!headers) return '';

  if (typeof headers.get === 'function') {
    return headers.get(name) ?? '';
  }

  return headers[name]
    ?? headers[name.toLowerCase()]
    ?? headers[name.toUpperCase()]
    ?? '';
}

function coerceText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function coerceNullableText(value) {
  const normalized = coerceText(value);
  return normalized || null;
}

function coerceBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  return defaultValue;
}

function coerceInteger(value, fallback = null) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function coerceStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(item => coerceText(item))
    .filter(Boolean);
}

function coerceIsoDate(value) {
  const raw = coerceText(value);
  if (!raw) {
    return null;
  }

  const normalized = new Date(raw);
  if (Number.isNaN(normalized.getTime())) {
    throw new Error(`Invalid date value: ${raw}`);
  }

  return normalized.toISOString();
}

function coerceDateOnly(value) {
  const isoValue = coerceIsoDate(value);
  return isoValue ? isoValue.slice(0, 10) : null;
}

function buildZeroDiffSummary(extra = {}) {
  return {
    current: 0,
    incoming: 0,
    added: 0,
    updated: 0,
    unchanged: 0,
    removed: 0,
    ...extra,
  };
}

function stripHtmlToTextLines(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);
}

function parseServerDateTime(rawValue) {
  const match = /(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/.exec(rawValue || '');
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:00+08:00`).toISOString();
}

function parseMaintenanceWindowFromAnnouncement(record) {
  if (!VERSION_UPDATE_TITLE_PATTERN.test(coerceText(record?.title))) {
    return null;
  }

  const maintenanceLine = stripHtmlToTextLines(record?.content)
    .find(line => line.includes('更新维护时间'));

  if (!maintenanceLine) {
    return null;
  }

  const timeMatches = Array.from(maintenanceLine.matchAll(/(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2})/g))
    .map(match => parseServerDateTime(match[1]))
    .filter(Boolean);

  if (timeMatches.length < 2) {
    return null;
  }

  return {
    source_id: coerceText(record?.source_id),
    title: coerceText(record?.title),
    published_at: coerceIsoDate(record?.published_at),
    source_url: coerceNullableText(record?.source_url),
    start_time: timeMatches[0],
    end_time: timeMatches[1],
  };
}

export function getLatestVersionMaintenanceWindow(records) {
  return (Array.isArray(records) ? records : [])
    .map(parseMaintenanceWindowFromAnnouncement)
    .filter(Boolean)
    .sort((left, right) => (
      new Date(right.published_at || right.end_time).getTime()
      - new Date(left.published_at || left.end_time).getTime()
    ))[0] || null;
}

function getTimeoutMs(env, key) {
  const parsed = coerceInteger(env?.[key], DEFAULT_FETCH_TIMEOUT_MS);
  return parsed && parsed > 0 ? parsed : DEFAULT_FETCH_TIMEOUT_MS;
}

function normalizePoolType(type) {
  const normalized = coerceText(type).toLowerCase();
  if (normalized === 'limited_character') return 'limited';
  if (normalized === 'limited_weapon') return 'weapon';
  if (normalized === 'weapon' || normalized === 'limited' || normalized === 'standard') {
    return normalized;
  }
  return normalized || 'limited';
}

function extractRecords(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.records)) {
    return payload.records;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  throw new Error('Remote payload must be an array or an object with records/items/data array');
}

function normalizeAnnouncementRecord(record, index) {
  const sourceId = coerceText(record?.source_id || record?.id || record?.slug);
  const title = coerceText(record?.title || record?.name);
  const content = coerceText(record?.content || record?.body || record?.markdown);

  if (!sourceId) {
    throw new Error(`Announcement record #${index + 1} is missing source_id/id`);
  }
  if (!title) {
    throw new Error(`Announcement record #${index + 1} is missing title`);
  }
  if (!content) {
    throw new Error(`Announcement record #${index + 1} is missing content/body`);
  }

  return {
    source_id: sourceId,
    title,
    summary: coerceNullableText(record?.summary || record?.excerpt || record?.description),
    content,
    version: coerceText(record?.version) || 'external',
    published_at: coerceIsoDate(record?.published_at || record?.publishedAt || record?.date || record?.updated_at),
    source_url: coerceNullableText(record?.source_url || record?.url || record?.link),
    is_active: coerceBoolean(record?.is_active, true),
  };
}

function normalizePoolScheduleRecord(record, index) {
  const poolId = coerceText(record?.pool_id || record?.id);
  const name = coerceText(record?.name || record?.title);

  if (!poolId) {
    throw new Error(`Pool schedule record #${index + 1} is missing pool_id/id`);
  }
  if (!name) {
    throw new Error(`Pool schedule record #${index + 1} is missing name`);
  }

  return {
    pool_id: poolId,
    name,
    type: normalizePoolType(record?.type),
    start_time: coerceIsoDate(record?.start_time || record?.startTime || record?.starts_at),
    end_time: coerceIsoDate(record?.end_time || record?.endTime || record?.ends_at),
    up_character: coerceNullableText(record?.up_character || record?.upCharacter),
    featured_characters: coerceStringArray(record?.featured_characters || record?.featuredCharacters),
    featured_character_names: coerceStringArray(record?.featured_character_names || record?.featuredCharacterNames),
    pool_title: coerceNullableText(record?.pool_title || record?.poolTitle),
    description: coerceNullableText(record?.description),
    banner_url: coerceNullableText(record?.banner_url || record?.bannerUrl || record?.image_url),
    source_notice_id: coerceNullableText(record?.source_notice_id || record?.sourceNoticeId),
    source_url: coerceNullableText(record?.source_url || record?.sourceUrl),
  };
}

function normalizeWikiCatalogRecord(record, index) {
  const id = coerceText(record?.id || record?.character_id || record?.weapon_id || record?.source_id);
  const name = coerceText(record?.name || record?.title);

  if (!id) {
    throw new Error(`Wiki catalog record #${index + 1} is missing id`);
  }
  if (!name) {
    throw new Error(`Wiki catalog record #${index + 1} is missing name`);
  }

  const type = coerceText(record?.type).toLowerCase();
  if (type !== 'character' && type !== 'weapon') {
    throw new Error(`Wiki catalog record #${index + 1} has invalid type: ${record?.type}`);
  }

  const rarity = coerceInteger(record?.rarity, null);
  if (!rarity || rarity < 1) {
    throw new Error(`Wiki catalog record #${index + 1} has invalid rarity`);
  }

  return {
    id,
    name,
    rarity,
    type,
    avatar_url: coerceNullableText(record?.avatar_url || record?.avatarUrl || record?.image_url),
    is_limited: coerceBoolean(record?.is_limited, false),
    aliases: coerceStringArray(record?.aliases),
    release_date: coerceDateOnly(record?.release_date || record?.releaseDate),
  };
}

function normalizeCurrentPoolRecord(record) {
  return {
    pool_id: coerceText(record?.pool_id || record?.id),
    name: coerceText(record?.name),
    type: normalizePoolType(record?.type),
    start_time: coerceIsoDate(record?.start_time),
    end_time: coerceIsoDate(record?.end_time),
    up_character: coerceNullableText(record?.up_character),
    featured_characters: coerceStringArray(record?.featured_characters),
    description: coerceNullableText(record?.description),
    banner_url: coerceNullableText(record?.banner_url),
  };
}

export function authorizeOpsAutomationRequest(req, env = process.env) {
  const expectedSecret = coerceText(env?.CRON_SECRET);
  if (!expectedSecret) {
    return {
      ok: false,
      status: 503,
      error: 'CRON_SECRET not configured',
    };
  }

  const authorization = coerceText(getHeaderValue(req?.headers, 'authorization'));
  if (authorization !== `Bearer ${expectedSecret}`) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized',
    };
  }

  return { ok: true };
}

export function parseRequestedJobIds(rawValue) {
  const normalized = coerceText(rawValue || 'all').toLowerCase();
  if (!normalized || normalized === 'all') {
    return OPS_AUTOMATION_JOBS.map(job => job.id);
  }

  const requested = Array.from(new Set(
    normalized
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  ));

  const unknownJobs = requested.filter(jobId => !getOpsAutomationJob(jobId));
  if (unknownJobs.length > 0) {
    throw new Error(`Unknown ops automation job(s): ${unknownJobs.join(', ')}`);
  }

  return requested;
}

export function normalizeTriggerType(rawValue, fallback = 'cron') {
  const candidate = coerceText(rawValue || fallback).toLowerCase();
  if (!SUPPORTED_TRIGGER_TYPES.has(candidate)) {
    throw new Error(`Unsupported trigger type: ${rawValue}`);
  }

  return candidate;
}

export function getOpsAutomationSourceConfig(jobId, env = process.env, {
  baseUrl = '',
} = {}) {
  const envConfig = OPS_AUTOMATION_SOURCE_ENVS[jobId];
  if (!envConfig) {
    throw new Error(`Unknown ops automation job: ${jobId}`);
  }

  const envUrl = coerceText(env?.[envConfig.urlEnv]);
  const internalPath = INTERNAL_SOURCE_PATHS[jobId];
  const fallbackUrl = !envUrl && baseUrl && internalPath
    ? `${baseUrl}${internalPath}`
    : '';

  return {
    urlEnv: envConfig.urlEnv,
    tagEnv: envConfig.tagEnv,
    timeoutEnv: envConfig.timeoutEnv,
    url: envUrl || fallbackUrl,
    tag: coerceText(env?.[envConfig.tagEnv]) || 'external-json',
    timeoutMs: getTimeoutMs(env, envConfig.timeoutEnv),
  };
}

export function getDefaultRunnableJobIds(env = process.env, {
  baseUrl = '',
} = {}) {
  return OPS_AUTOMATION_JOBS
    .map(job => ({
      id: job.id,
      source: getOpsAutomationSourceConfig(job.id, env, { baseUrl }),
    }))
    .filter(entry => Boolean(entry.source.url))
    .map(entry => entry.id);
}

export async function getOpsAutomationMaintenanceGate(jobId, {
  env = process.env,
  sourceBaseUrl = '',
  fetchImpl = globalThis.fetch,
  now = new Date(),
} = {}) {
  if (!MAINTENANCE_GATED_JOB_IDS.has(jobId)) {
    return {
      blocked: false,
      window: null,
    };
  }

  if (coerceBoolean(env?.OPS_AUTOMATION_BYPASS_MAINTENANCE_GATE, false)) {
    return {
      blocked: false,
      window: null,
    };
  }

  const sourceConfig = getOpsAutomationSourceConfig('official-announcements', env, {
    baseUrl: sourceBaseUrl,
  });

  if (!sourceConfig.url) {
    return {
      blocked: false,
      window: null,
    };
  }

  try {
    const payload = await fetchJsonWithTimeout(sourceConfig.url, {
      fetchImpl,
      timeoutMs: sourceConfig.timeoutMs,
    });
    const announcementRecords = normalizeOpsAutomationSourceRecords('official-announcements', payload);
    const window = getLatestVersionMaintenanceWindow(announcementRecords);

    if (!window?.end_time) {
      return {
        blocked: false,
        window: null,
      };
    }

    const nowMs = new Date(now).getTime();
    const endMs = new Date(window.end_time).getTime();
    if (!Number.isFinite(nowMs) || !Number.isFinite(endMs) || nowMs >= endMs) {
      return {
        blocked: false,
        window,
      };
    }

    return {
      blocked: true,
      window,
      reason: `已检测到版本更新公告「${window.title}」，维护结束时间为 ${window.end_time}；维护结束后才开始更新图鉴与卡池数据`,
    };
  } catch {
    return {
      blocked: false,
      window: null,
    };
  }
}

export function normalizeOpsAutomationSourceRecords(jobId, payload) {
  const records = extractRecords(payload);

  switch (jobId) {
    case 'official-announcements':
      return records.map(normalizeAnnouncementRecord);
    case 'pool-schedule':
      return records.map(normalizePoolScheduleRecord);
    case 'wiki-catalog':
      return records.map(normalizeWikiCatalogRecord);
    default:
      throw new Error(`Unknown ops automation job: ${jobId}`);
  }
}

export function buildOpsAutomationDedupeKey(jobId, triggerType, now = new Date()) {
  if (triggerType !== 'cron') {
    return null;
  }

  const isoDate = new Date(now).toISOString().slice(0, 10);
  return `cron:${jobId}:${isoDate}`;
}

export async function fetchJsonWithTimeout(url, {
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is not available in current runtime');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Remote source returned ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Remote source timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function loadCurrentAnnouncementRecords(supabase) {
  const { data, error } = await supabase
    .from('announcements')
    .select('source_id, title, summary, content, version, published_at, source_url, is_active')
    .not('source_id', 'is', null)
    .order('published_at', { ascending: false, nullsFirst: false });

  if (error) {
    throw error;
  }

  return data || [];
}

async function loadCurrentPoolRecords(supabase) {
  const { data, error } = await supabase.rpc('get_app_visible_pools');
  if (error) {
    throw error;
  }

  return (data || []).map(normalizeCurrentPoolRecord);
}

async function loadCurrentWikiRecords(supabase) {
  const { data, error } = await supabase
    .from('characters')
    .select('id, name, rarity, type, avatar_url, is_limited, aliases, release_date')
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function loadCurrentOpsAutomationRecords(supabase, jobId) {
  switch (jobId) {
    case 'official-announcements':
      return loadCurrentAnnouncementRecords(supabase);
    case 'pool-schedule':
      return loadCurrentPoolRecords(supabase);
    case 'wiki-catalog':
      return loadCurrentWikiRecords(supabase);
    default:
      throw new Error(`Unknown ops automation job: ${jobId}`);
  }
}

async function persistOpsAutomationRun(supabase, payload) {
  const builder = payload.dedupe_key
    ? supabase
      .from('ops_automation_runs')
      .upsert(payload, {
        onConflict: 'job_id,dedupe_key',
        ignoreDuplicates: false,
      })
    : supabase
      .from('ops_automation_runs')
      .insert(payload);

  const { data, error } = await builder
    .select('id, job_id, status, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function runOpsAutomationJob({
  supabase,
  jobId,
  dryRun = true,
  triggerType = 'cron',
  env = process.env,
  sourceBaseUrl = '',
  fetchImpl = globalThis.fetch,
  now = new Date(),
}) {
  const job = getOpsAutomationJob(jobId);
  if (!job) {
    throw new Error(`Unknown ops automation job: ${jobId}`);
  }

  if (!supabase) {
    throw new Error('Supabase admin client is not available');
  }

  const startedAt = new Date(now).toISOString();
  const sourceConfig = getOpsAutomationSourceConfig(jobId, env, {
    baseUrl: sourceBaseUrl,
  });
  const dedupeKey = buildOpsAutomationDedupeKey(jobId, triggerType, now);
  const maintenanceGate = await getOpsAutomationMaintenanceGate(jobId, {
    env,
    sourceBaseUrl,
    fetchImpl,
    now,
  });

  if (!sourceConfig.url) {
    const run = await persistOpsAutomationRun(supabase, {
      job_id: job.id,
      job_label: job.label,
      trigger_type: triggerType,
      status: 'skipped',
      dry_run: dryRun,
      dedupe_key: dedupeKey,
      source_tag: sourceConfig.tag,
      source_url: null,
      summary: buildZeroDiffSummary({
        gate_type: 'missing_source_url',
      }),
      top_changed_fields: [],
      preview: null,
      review_bundle: null,
      error_message: `Missing source URL env: ${sourceConfig.urlEnv}`,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return {
      jobId: job.id,
      status: 'skipped',
      runId: run.id,
      sourceEnv: sourceConfig.urlEnv,
      error: `Missing source URL env: ${sourceConfig.urlEnv}`,
    };
  }

  if (maintenanceGate.blocked) {
    const run = await persistOpsAutomationRun(supabase, {
      job_id: job.id,
      job_label: job.label,
      trigger_type: triggerType,
      status: 'skipped',
      dry_run: dryRun,
      dedupe_key: dedupeKey,
      source_tag: sourceConfig.tag,
      source_url: maintenanceGate.window?.source_url || sourceConfig.url,
      summary: buildZeroDiffSummary({
        gate_type: 'maintenance_window',
        blocked_until: maintenanceGate.window?.end_time || null,
        maintenance_notice_id: maintenanceGate.window?.source_id || null,
        maintenance_notice_title: maintenanceGate.window?.title || null,
      }),
      top_changed_fields: [],
      preview: null,
      review_bundle: null,
      error_message: maintenanceGate.reason,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return {
      jobId: job.id,
      jobLabel: job.label,
      status: 'skipped',
      runId: run.id,
      sourceTag: sourceConfig.tag,
      sourceUrl: maintenanceGate.window?.source_url || sourceConfig.url,
      error: maintenanceGate.reason,
    };
  }

  try {
    const [currentRecords, incomingPayload] = await Promise.all([
      loadCurrentOpsAutomationRecords(supabase, jobId),
      fetchJsonWithTimeout(sourceConfig.url, {
        fetchImpl,
        timeoutMs: sourceConfig.timeoutMs,
      }),
    ]);

    const incomingRecords = normalizeOpsAutomationSourceRecords(jobId, incomingPayload);
    const sourceMeta = {
      tag: sourceConfig.tag,
      url: sourceConfig.url,
    };

    const auditReport = buildAutomationAuditReport({
      job,
      currentRecords,
      incomingRecords,
      dryRun,
      sourceMeta,
    });
    const reviewBundle = buildManualReviewBundle({
      job,
      currentRecords,
      incomingRecords,
      dryRun,
      sourceMeta,
    });

    const run = await persistOpsAutomationRun(supabase, {
      job_id: job.id,
      job_label: job.label,
      trigger_type: triggerType,
      status: 'success',
      dry_run: dryRun,
      dedupe_key: dedupeKey,
      source_tag: sourceConfig.tag,
      source_url: sourceConfig.url,
      summary: auditReport.summary,
      top_changed_fields: auditReport.topChangedFields,
      preview: auditReport.preview,
      review_bundle: reviewBundle,
      error_message: null,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return {
      jobId: job.id,
      jobLabel: job.label,
      status: 'success',
      runId: run.id,
      sourceTag: sourceConfig.tag,
      sourceUrl: sourceConfig.url,
      dryRun,
      summary: auditReport.summary,
      topChangedFields: auditReport.topChangedFields,
    };
  } catch (error) {
    const run = await persistOpsAutomationRun(supabase, {
      job_id: job.id,
      job_label: job.label,
      trigger_type: triggerType,
      status: 'failure',
      dry_run: dryRun,
      dedupe_key: dedupeKey,
      source_tag: sourceConfig.tag,
      source_url: sourceConfig.url,
      summary: null,
      top_changed_fields: [],
      preview: null,
      review_bundle: null,
      error_message: error?.message || 'Unknown ops automation failure',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return {
      jobId: job.id,
      jobLabel: job.label,
      status: 'failure',
      runId: run.id,
      sourceTag: sourceConfig.tag,
      sourceUrl: sourceConfig.url,
      error: error?.message || 'Unknown ops automation failure',
    };
  }
}
