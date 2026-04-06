import { getSupabaseAdminClient } from './authAdmin.js';
import { buildOfficialAnnouncementRecords } from './officialAnnouncementsFeed.js';
import { detectNewCharacters } from './detectNewCharacters.js';
import {
  buildOpsAutomationDedupeKey,
  parseRequestedJobIds,
} from './opsAutomation.js';
import { syncAnnouncements } from './syncAnnouncements.js';
import { syncPools } from './syncPools.js';

const JOB_META = Object.freeze({
  'official-announcements': {
    label: '官方公告同步',
    resultKey: 'announcements',
  },
  'pool-schedule': {
    label: '卡池轮换同步',
    resultKey: 'pools',
  },
  'wiki-catalog': {
    label: '图鉴巡检提醒',
    resultKey: 'newCharacterCheck',
  },
});

function hasSupabaseAdminConfig(env = process.env) {
  return Boolean(
    (env.VITE_SUPABASE_URL || env.SUPABASE_URL)
    && env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function sanitizeSummary(result) {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const summary = { ...result };
  delete summary.records;
  delete summary.rawRecords;

  if (Array.isArray(summary.errors) && summary.errors.length > 20) {
    summary.errors = summary.errors.slice(0, 20);
  }

  if (Array.isArray(summary.unresolvedNames) && summary.unresolvedNames.length > 50) {
    summary.unresolvedNames = summary.unresolvedNames.slice(0, 50);
  }

  return summary;
}

function resolveRunStatus(jobId, result) {
  if (result?.error) {
    return 'failure';
  }

  switch (jobId) {
    case 'official-announcements':
      return Number(result?.synced || 0) > 0 ? 'success' : 'skipped';
    case 'pool-schedule':
      return Number(result?.created || 0) > 0 || Number(result?.updated || 0) > 0
        ? 'success'
        : 'skipped';
    case 'wiki-catalog':
      return Number(result?.found || 0) > 0 ? 'success' : 'skipped';
    default:
      return 'success';
  }
}

async function persistAutomationRun(supabase, payload) {
  const baseRecord = {
    job_id: payload.job_id,
    job_label: payload.job_label,
    trigger_type: payload.trigger_type,
    status: payload.status,
    dry_run: false,
    dedupe_key: payload.dedupe_key,
    source_tag: payload.source_tag || null,
    source_url: payload.source_url || null,
    summary: payload.summary || null,
    error_message: payload.error_message || null,
    started_at: payload.started_at,
    finished_at: payload.finished_at,
    created_by: payload.created_by || null,
  };

  if (!payload.dedupe_key) {
    const { error } = await supabase.from('ops_automation_runs').insert(baseRecord);
    if (error) throw error;
    return;
  }

  const { data: existing, error: selectError } = await supabase
    .from('ops_automation_runs')
    .select('id')
    .eq('job_id', payload.job_id)
    .eq('dedupe_key', payload.dedupe_key)
    .limit(1);

  if (selectError) throw selectError;

  if (existing?.[0]?.id) {
    const { error } = await supabase
      .from('ops_automation_runs')
      .update(baseRecord)
      .eq('id', existing[0].id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('ops_automation_runs').insert(baseRecord);
  if (error) throw error;
}

async function runSingleAutomationJob(jobId, {
  triggerType,
  supabase,
  createdBy = null,
  announcementRecords = null,
  poolResult = null,
} = {}) {
  const jobMeta = JOB_META[jobId];
  const startedAt = new Date().toISOString();

  let result;
  try {
    switch (jobId) {
      case 'official-announcements':
        result = await syncAnnouncements();
        break;
      case 'pool-schedule':
        result = await syncPools(
          announcementRecords && announcementRecords.length > 0
            ? announcementRecords
            : await buildOfficialAnnouncementRecords()
        );
        break;
      case 'wiki-catalog':
        result = await detectNewCharacters(poolResult?.unresolvedNames || []);
        break;
      default:
        throw new Error(`Unknown ops automation job: ${jobId}`);
    }
  } catch (error) {
    result = { error: error.message };
  }

  const status = resolveRunStatus(jobId, result);
  await persistAutomationRun(supabase, {
    job_id: jobId,
    job_label: jobMeta.label,
    trigger_type: triggerType,
    status,
    dedupe_key: buildOpsAutomationDedupeKey(jobId, triggerType),
    summary: sanitizeSummary(result),
    error_message: result?.error || null,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    created_by: createdBy,
  });

  return result;
}

export async function runOpsAutomationJobs({
  requestedJobIds = 'all',
  triggerType = 'api',
  createdBy = null,
  env = process.env,
} = {}) {
  const jobIds = parseRequestedJobIds(requestedJobIds);
  if (!hasSupabaseAdminConfig(env)) {
    return {
      ok: false,
      status: 503,
      error: 'Supabase admin client is not configured',
    };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      ok: false,
      status: 503,
      error: 'Supabase admin client is not configured',
    };
  }

  const results = {};
  let announcementRecords = null;
  let poolResult = null;

  if (jobIds.includes('official-announcements')) {
    const announcementResult = await runSingleAutomationJob('official-announcements', {
      triggerType,
      supabase,
      createdBy,
    });
    results.announcements = announcementResult;
    announcementRecords = announcementResult?.records || announcementResult?.rawRecords || null;
  }

  if (jobIds.includes('pool-schedule')) {
    const nextPoolResult = await runSingleAutomationJob('pool-schedule', {
      triggerType,
      supabase,
      createdBy,
      announcementRecords,
    });
    results.pools = nextPoolResult;
    poolResult = nextPoolResult;
  }

  if (jobIds.includes('wiki-catalog')) {
    results.newCharacterCheck = await runSingleAutomationJob('wiki-catalog', {
      triggerType,
      supabase,
      createdBy,
      poolResult,
    });
  }

  const hasErrors = Object.values(results).some(result => result?.error);
  return {
    ok: !hasErrors,
    status: hasErrors ? 500 : 200,
    results,
  };
}
