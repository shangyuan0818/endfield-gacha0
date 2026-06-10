import { getSupabaseAdminClient } from './authAdmin.js';
import { buildPreferredAnnouncementRecords } from './officialAnnouncementsFeed.js';
import { detectNewCharacters } from './detectNewCharacters.js';
import { serverLogger } from './serverLogger.js';
import {
  buildOpsAutomationDedupeKey,
  parseRequestedJobIds,
} from './opsAutomation.js';
import {
  filterJobIdsBySchedule,
  loadOpsAutomationScheduleConfig,
} from './opsAutomationScheduleConfig.js';
import {
  bumpPublicCacheEpoch,
  refreshPublicAnalyticsCache,
} from './publicCache.js';
import { syncAnnouncements } from './syncAnnouncements.js';
import { syncPools } from './syncPools.js';
import { hasSupabaseSecretConfig } from './supabaseEnv.js';

const JOB_META = Object.freeze({
  'official-announcements': {
    label: '官方公告同步',
    resultKey: 'announcements',
    dependencies: [],
    sourceTag: 'official-announcements-feed',
    retry: { maxAttempts: 2, baseDelayMs: 750, maxDelayMs: 3000, durationBudgetMs: 70_000 },
  },
  'pool-schedule': {
    label: '卡池轮换同步',
    resultKey: 'pools',
    dependencies: ['official-announcements'],
    sourceTag: 'pool-schedule-feed',
    retry: { maxAttempts: 2, baseDelayMs: 750, maxDelayMs: 3000, durationBudgetMs: 45_000 },
  },
  'wiki-catalog': {
    label: '图鉴巡检提醒',
    resultKey: 'newCharacterCheck',
    dependencies: ['pool-schedule'],
    sourceTag: 'passive-detection',
    retry: { maxAttempts: 2, baseDelayMs: 750, maxDelayMs: 3000, durationBudgetMs: 30_000 },
  },
});

const DEFAULT_RETRY = Object.freeze({
  maxAttempts: 1,
  baseDelayMs: 750,
  maxDelayMs: 3000,
  durationBudgetMs: 45_000,
});

function hasSupabaseAdminConfig(env = process.env) {
  return hasSupabaseSecretConfig(env);
}

function sanitizeSummary(result) {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const summary = { ...result };
  delete summary.records;
  delete summary.rawRecords;
  delete summary.updatedRecords;

  if (Array.isArray(summary.errors) && summary.errors.length > 20) {
    summary.errors = summary.errors.slice(0, 20);
  }

  if (Array.isArray(summary.summaryErrors) && summary.summaryErrors.length > 20) {
    summary.summaryErrors = summary.summaryErrors.slice(0, 20);
  }

  if (Array.isArray(summary.unresolvedNames) && summary.unresolvedNames.length > 50) {
    summary.unresolvedNames = summary.unresolvedNames.slice(0, 50);
  }

  return summary;
}

function sanitizeResponseResults(results = {}) {
  return Object.fromEntries(
    Object.entries(results).map(([key, value]) => [key, sanitizeSummary(value)])
  );
}

function createRunContext({
  requestedJobIds,
  triggerType,
  createdBy = null,
  forceRefresh = false,
  refreshMode = null,
  announcementLimit = null,
} = {}) {
  const startedAt = new Date().toISOString();
  const entropy = Math.random().toString(36).slice(2, 8);
  return {
    runContextId: `ops-${Date.now().toString(36)}-${entropy}`,
    requestedJobIds: [...requestedJobIds],
    triggerType,
    createdBy,
    dryRun: false,
    mode: 'apply',
    forceRefresh: Boolean(forceRefresh),
    refreshMode: refreshMode || null,
    announcementLimit: announcementLimit ?? null,
    startedAt,
  };
}

function toPositiveNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

function countResultOutputs(result = {}) {
  return [
    'synced',
    'created',
    'updated',
    'found',
  ].reduce((total, key) => total + toPositiveNumber(result?.[key]), 0);
}

function hasAnyOutputMutation(result = {}) {
  return countResultOutputs(result) > 0
    || Boolean(result?.digest?.updated || result?.digest?.refreshed);
}

function normalizeWarningList(result = {}) {
  const warnings = [];
  if (result?.warning) {
    warnings.push(String(result.warning));
  }
  if (result?.sourceFallbackUsed) {
    warnings.push('官方公告源不可用，已使用数据库现有公告回退。');
  }
  if (Number(result?.summaryFailed || 0) > 0) {
    warnings.push(`LLM 摘要失败 ${Number(result.summaryFailed)} 条。`);
  }
  if (Array.isArray(result?.errors) && result.errors.length > 0) {
    warnings.push(`任务存在 ${result.errors.length} 条写入或解析错误。`);
  }
  return [...new Set(warnings.filter(Boolean))];
}

function classifyAutomationFailure(jobId, result = {}, fallbackMessage = '') {
  if (Number(result?.summaryFailed || 0) > 0) {
    return 'llm';
  }

  const message = [
    result?.error,
    result?.warning,
    fallbackMessage,
    Array.isArray(result?.errors) ? result.errors.map(item => item?.error || item?.message).join(' ') : '',
  ].filter(Boolean).join(' ');

  if (!message) {
    return null;
  }

  if (/cache|公共缓存|cacheInvalidation/i.test(message)) {
    return 'cache_invalidation';
  }
  if (/configured|配置|CRON_SECRET|Supabase admin/i.test(message)) {
    return 'config';
  }
  if (/fetch|source|Official|bulletin|新闻|公告源|network|timeout|ENOTFOUND|ECONN/i.test(message)) {
    return 'source_fetch';
  }
  if (/database|数据库|Supabase|insert|update|upsert|rpc|select|write/i.test(message)) {
    return 'database_write';
  }
  if (jobId === 'wiki-catalog' && /site_config|unregistered/i.test(message)) {
    return 'database_write';
  }

  return 'unexpected';
}

function isPartialAutomationResult(jobId, result = {}) {
  if (!result || typeof result !== 'object') {
    return false;
  }

  if (result.error && !hasAnyOutputMutation(result)) {
    return false;
  }

  return normalizeWarningList(result).length > 0
    || (Array.isArray(result.errors) && result.errors.length > 0)
    || Number(result.summaryFailed || 0) > 0
    || Boolean(classifyAutomationFailure(jobId, result));
}

function getPresentationStatus(jobId, result, persistedStatus) {
  if (persistedStatus === 'failure') {
    return 'failure';
  }
  if (isPartialAutomationResult(jobId, result)) {
    return 'partial';
  }
  return persistedStatus;
}

function resolveRunStatus(jobId, result) {
  if (
    result?.error
    && !hasAnyOutputMutation(result)
  ) {
    return 'failure';
  }

  if (
    Array.isArray(result?.errors)
    && result.errors.length > 0
    && !hasAnyOutputMutation(result)
  ) {
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

function appendAutomationWarning(result, warning) {
  if (!warning || !result || typeof result !== 'object') {
    return result;
  }

  return {
    ...result,
    warning: [result.warning, warning].filter(Boolean).join('；'),
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateBackoffDelay(attemptIndex, {
  baseDelayMs = DEFAULT_RETRY.baseDelayMs,
  maxDelayMs = DEFAULT_RETRY.maxDelayMs,
} = {}) {
  return Math.min(baseDelayMs * (2 ** Math.max(0, attemptIndex - 1)), maxDelayMs);
}

function shouldRetryJobResult(jobId, result) {
  const hasHardFailure = Boolean(result?.error)
    || (Array.isArray(result?.errors) && result.errors.length > 0);
  if (!hasHardFailure) {
    return false;
  }
  if (hasAnyOutputMutation(result)) {
    return false;
  }

  const failureType = classifyAutomationFailure(jobId, result);
  return ['source_fetch', 'database_write', 'unexpected'].includes(failureType);
}

async function runWithRetry({
  jobId,
  task,
  retry = DEFAULT_RETRY,
  wait = sleep,
} = {}) {
  if (typeof task !== 'function') {
    throw new Error('runWithRetry requires a task function');
  }

  const maxAttempts = Math.max(1, Number(retry?.maxAttempts || DEFAULT_RETRY.maxAttempts));
  const attempts = [];
  let lastResult = null;

  for (let attemptIndex = 1; attemptIndex <= maxAttempts; attemptIndex += 1) {
    const attemptStartedAt = new Date().toISOString();
    const startedMs = Date.now();
    try {
      const result = await task({ attempt: attemptIndex });
      const durationMs = Math.max(0, Date.now() - startedMs);
      const retryable = attemptIndex < maxAttempts && shouldRetryJobResult(jobId, result);
      const failureType = classifyAutomationFailure(jobId, result);
      const presentationStatus = getPresentationStatus(jobId, result, resolveRunStatus(jobId, result));
      const nextDelayMs = retryable ? calculateBackoffDelay(attemptIndex, retry) : 0;

      attempts.push({
        attempt: attemptIndex,
        status: retryable ? 'failure' : presentationStatus,
        retryable,
        durationMs,
        startedAt: attemptStartedAt,
        finishedAt: new Date().toISOString(),
        nextDelayMs: retryable ? nextDelayMs : null,
        failureType,
        errorMessage: result?.error || null,
      });

      lastResult = result;

      if (retryable) {
        await wait(nextDelayMs);
        continue;
      }

      return { result, attempts };
    } catch (error) {
      const durationMs = Math.max(0, Date.now() - startedMs);
      const errorResult = { error: error?.message || String(error) };
      const failureType = classifyAutomationFailure(jobId, errorResult, error?.message);
      const retryable = attemptIndex < maxAttempts && ['source_fetch', 'database_write', 'unexpected'].includes(failureType);
      const nextDelayMs = retryable ? calculateBackoffDelay(attemptIndex, retry) : 0;

      attempts.push({
        attempt: attemptIndex,
        status: 'failure',
        retryable,
        durationMs,
        startedAt: attemptStartedAt,
        finishedAt: new Date().toISOString(),
        nextDelayMs: retryable ? nextDelayMs : null,
        failureType,
        errorMessage: errorResult.error,
      });

      lastResult = errorResult;

      if (retryable) {
        await wait(nextDelayMs);
        continue;
      }

      return { result: errorResult, attempts };
    }
  }

  return { result: lastResult || { error: 'Unknown automation failure' }, attempts };
}

function hasPublicDataMutation(jobId, result, options = {}) {
  if (!result || typeof result !== 'object' || result.error) {
    return false;
  }

  if (jobId === 'official-announcements') {
    return Boolean(options.forceRefresh)
      || Number(result.synced || 0) > 0
      || Number(result.created || 0) > 0
      || Number(result.updated || 0) > 0
      || Boolean(result.digest?.updated || result.digest?.refreshed);
  }

  if (jobId === 'pool-schedule') {
    return Number(result.created || 0) > 0 || Number(result.updated || 0) > 0;
  }

  return false;
}

async function invalidatePublicCacheAfterMutation(supabase, jobId, result, {
  triggerType,
  forceRefresh = false,
} = {}) {
  if (!hasPublicDataMutation(jobId, result, { forceRefresh })) {
    return result;
  }

  const scope = jobId === 'pool-schedule' ? 'pools' : 'announcements';
  const reason = `ops-automation:${triggerType}:${jobId}`;
  let nextResult = result;
  const analyticsRefresh = jobId === 'pool-schedule'
    ? await refreshPublicAnalyticsCache(supabase, { reason })
    : null;

  if (analyticsRefresh && !analyticsRefresh.ok) {
    nextResult = appendAutomationWarning(
      nextResult,
      `公共统计缓存刷新失败：${analyticsRefresh.error || '未知错误'}`
    );
  }

  const bumpResult = await bumpPublicCacheEpoch(supabase, {
    scope,
    reason,
  });

  if (bumpResult.ok) {
    return {
      ...nextResult,
      cacheInvalidation: {
        ok: true,
        cacheVersion: bumpResult.version,
        scope: bumpResult.scope,
        ...(analyticsRefresh ? { analyticsRefresh } : {}),
      },
    };
  }

  return appendAutomationWarning(
    nextResult,
    `公共缓存版本刷新失败：${bumpResult.error || '未知错误'}`
  );
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
    top_changed_fields: payload.top_changed_fields || [],
    preview: payload.preview || null,
    review_bundle: payload.review_bundle || null,
    error_message: payload.error_message || null,
    started_at: payload.started_at,
    finished_at: payload.finished_at,
    created_by: payload.created_by || null,
  };

  const buildRecordWithPersistAction = (action) => {
    const summary = baseRecord.summary
      ? {
        ...baseRecord.summary,
        ops: baseRecord.summary.ops
          ? { ...baseRecord.summary.ops, persistAction: action }
          : baseRecord.summary.ops,
      }
      : baseRecord.summary;
    const reviewBundle = baseRecord.review_bundle
      ? {
        ...baseRecord.review_bundle,
        persistAction: action,
        node: baseRecord.review_bundle.node
          ? { ...baseRecord.review_bundle.node, persistAction: action }
          : baseRecord.review_bundle.node,
      }
      : baseRecord.review_bundle;

    return {
      ...baseRecord,
      summary,
      review_bundle: reviewBundle,
    };
  };

  if (!payload.dedupe_key) {
    const { error } = await supabase.from('ops_automation_runs').insert(buildRecordWithPersistAction('inserted'));
    if (error) throw error;
    return { action: 'inserted' };
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
      .update(buildRecordWithPersistAction('updated'))
      .eq('id', existing[0].id);
    if (error) throw error;
    return { action: 'updated', id: existing[0].id };
  }

  const { error } = await supabase.from('ops_automation_runs').insert(buildRecordWithPersistAction('inserted'));
  if (error) throw error;
  return { action: 'inserted' };
}

async function executeAutomationJob(jobId, {
  announcementRecords = null,
  poolResult = null,
  forceRefresh = false,
  refreshMode = null,
  announcementLimit = null,
} = {}) {
  switch (jobId) {
    case 'official-announcements':
      return syncAnnouncements({ forceRefresh, refreshMode, announcementLimit });
    case 'pool-schedule':
      return syncPools(
          announcementRecords && announcementRecords.length > 0
            ? announcementRecords
          : await buildPreferredAnnouncementRecords(undefined, { allowLlm: false })
        );
    case 'wiki-catalog':
      return detectNewCharacters(poolResult?.unresolvedNames || []);
    default:
      throw new Error(`Unknown ops automation job: ${jobId}`);
  }
}

function buildInputMeta(jobId, {
  announcementRecords = null,
  poolResult = null,
  forceRefresh = false,
  refreshMode = null,
  announcementLimit = null,
} = {}) {
  const jobMeta = JOB_META[jobId];
  if (jobId === 'official-announcements') {
    return {
      sourceTag: jobMeta.sourceTag,
      refreshMode: refreshMode || (forceRefresh ? 'summary' : 'incremental'),
      forceRefresh: Boolean(forceRefresh),
      announcementLimit: announcementLimit ?? null,
    };
  }

  if (jobId === 'pool-schedule') {
    return {
      sourceTag: jobMeta.sourceTag,
      fromJob: 'official-announcements',
      announcementRecordCount: Array.isArray(announcementRecords) ? announcementRecords.length : 0,
      fallbackSource: !Array.isArray(announcementRecords) || announcementRecords.length === 0,
    };
  }

  return {
    sourceTag: jobMeta.sourceTag,
    fromJob: 'pool-schedule',
    unresolvedNameCount: Array.isArray(poolResult?.unresolvedNames) ? poolResult.unresolvedNames.length : 0,
  };
}

function buildOutputMeta(jobId, result = {}) {
  if (jobId === 'official-announcements') {
    return {
      synced: Number(result.synced || 0),
      created: Number(result.created || 0),
      updated: Number(result.updated || 0),
      skipped: Number(result.skipped || 0),
      summarized: Number(result.summarized || 0),
      total: Number(result.total || 0),
      summaryFailed: Number(result.summaryFailed || 0),
      sourceFallbackUsed: Boolean(result.sourceFallbackUsed),
      digestMode: result.digest?.mode || result.digest?.digest?.mode || null,
    };
  }

  if (jobId === 'pool-schedule') {
    return {
      created: Number(result.created || 0),
      updated: Number(result.updated || 0),
      parsed: Number(result.parsed || 0),
      unresolvedCount: Array.isArray(result.unresolvedNames) ? result.unresolvedNames.length : 0,
      errorCount: Array.isArray(result.errors) ? result.errors.length : 0,
    };
  }

  return {
    found: Number(result.found || 0),
    total: Number(result.total || 0),
    namesCount: Array.isArray(result.names) ? result.names.length : 0,
  };
}

function buildTopChangedFields(result = {}) {
  return [
    'synced',
    'created',
    'updated',
    'skipped',
    'summarized',
    'summaryFailed',
    'parsed',
    'found',
  ]
    .map(field => ({ field, count: Number(result?.[field] || 0) }))
    .filter(item => item.count > 0);
}

function pickRecordPreview(record = {}) {
  return {
    source_id: record.source_id || record.id || null,
    title: record.title || record.name || null,
    version: record.version || null,
    published_at: record.published_at || null,
    summary_mode: record.summary_mode || null,
  };
}

function buildAutomationPreview(result = {}) {
  const records = Array.isArray(result.updatedRecords)
    ? result.updatedRecords
    : (Array.isArray(result.records) ? result.records : []);
  const preview = {
    records: records.slice(0, 5).map(pickRecordPreview),
    errors: Array.isArray(result.errors) ? result.errors.slice(0, 5) : [],
    summaryErrors: Array.isArray(result.summaryErrors) ? result.summaryErrors.slice(0, 5) : [],
    unresolvedNames: Array.isArray(result.unresolvedNames) ? result.unresolvedNames.slice(0, 20) : [],
  };

  return Object.fromEntries(
    Object.entries(preview).filter(([, value]) => Array.isArray(value) ? value.length > 0 : Boolean(value))
  );
}

function hasPublishedOutput(jobId, result = {}) {
  if (jobId === 'wiki-catalog') {
    return Number(result.found || 0) > 0 && !result.error;
  }

  return hasAnyOutputMutation(result) && !result.error;
}

function buildAutomationNodeSummary({
  jobId,
  result,
  runContext,
  startedAt,
  finishedAt,
  attempts,
  input,
  status,
  dedupeKey,
  durationMs,
} = {}) {
  const jobMeta = JOB_META[jobId];
  const retryConfig = jobMeta.retry || DEFAULT_RETRY;
  const warnings = normalizeWarningList(result);
  const durationBudgetExceeded = Number(retryConfig.durationBudgetMs || 0) > 0
    && Number(durationMs || 0) > retryConfig.durationBudgetMs;
  if (durationBudgetExceeded) {
    warnings.push(`任务耗时 ${durationMs}ms，超过预算 ${retryConfig.durationBudgetMs}ms。`);
  }

  const presentationStatus = getPresentationStatus(jobId, result, status);
  const failureType = classifyAutomationFailure(jobId, result);
  const published = hasPublishedOutput(jobId, result);
  return {
    id: jobId,
    label: jobMeta.label,
    resultKey: jobMeta.resultKey,
    runContextId: runContext.runContextId,
    dependencies: jobMeta.dependencies,
    triggerType: runContext.triggerType,
    dryRun: runContext.dryRun,
    mode: runContext.mode,
    status,
    presentationStatus,
    partial: presentationStatus === 'partial',
    failureType,
    startedAt,
    finishedAt,
    durationMs,
    durationBudgetMs: retryConfig.durationBudgetMs,
    durationBudgetExceeded,
    attempts,
    attemptCount: attempts.length,
    retryCount: Math.max(0, attempts.length - 1),
    maxAttempts: retryConfig.maxAttempts || DEFAULT_RETRY.maxAttempts,
    input,
    output: buildOutputMeta(jobId, result),
    warningCount: warnings.length,
    warnings,
    cacheInvalidation: result?.cacheInvalidation || null,
    requiresReview: false,
    published,
    publishedAt: published ? finishedAt : null,
    dedupeKey,
  };
}

function buildAutomationReviewBundle({
  jobId,
  node,
  runContext,
  result,
  persistAction = null,
} = {}) {
  const jobMeta = JOB_META[jobId];
  return {
    job: {
      id: jobId,
      label: jobMeta.label,
      resultKey: jobMeta.resultKey,
    },
    run: {
      runContextId: runContext.runContextId,
      requestedJobIds: runContext.requestedJobIds,
      triggerType: runContext.triggerType,
      dryRun: runContext.dryRun,
      mode: runContext.mode,
      startedAt: runContext.startedAt,
    },
    review: {
      status: node.presentationStatus === 'failure' ? 'blocked' : 'applied',
      requiresApproval: false,
      approvalMode: 'auto-apply',
      published: node.published,
      publishedAt: node.publishedAt,
      partial: node.partial,
    },
    node,
    output: node.output,
    preview: buildAutomationPreview(result),
    topChangedFields: buildTopChangedFields(result),
    persistAction,
  };
}

function buildAutomationJobArtifacts({
  jobId,
  result,
  node,
  runContext,
  persistAction = null,
} = {}) {
  return {
    summary: {
      ...sanitizeSummary(result),
      ops: node,
    },
    topChangedFields: buildTopChangedFields(result),
    preview: buildAutomationPreview(result),
    reviewBundle: buildAutomationReviewBundle({
      jobId,
      node,
      runContext,
      result,
      persistAction,
    }),
  };
}

async function runSingleAutomationJob(jobId, {
  triggerType,
  supabase,
  createdBy = null,
  runContext,
  announcementRecords = null,
  poolResult = null,
  forceRefresh = false,
  refreshMode = null,
  announcementLimit = null,
} = {}) {
  const jobMeta = JOB_META[jobId];
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const input = buildInputMeta(jobId, {
    announcementRecords,
    poolResult,
    forceRefresh,
    refreshMode,
    announcementLimit,
  });

  let result;
  let attempts = [];
  try {
    serverLogger.info('ops-automation.job.start', {
      jobId,
      triggerType,
      createdBy,
      forceRefresh,
      refreshMode,
    });
    const retryResult = await runWithRetry({
      jobId,
      retry: jobMeta.retry,
      task: () => executeAutomationJob(jobId, {
        announcementRecords,
        poolResult,
        forceRefresh,
        refreshMode,
        announcementLimit,
      }),
    });
    result = retryResult.result;
    attempts = retryResult.attempts;
  } catch (error) {
    serverLogger.error('ops-automation.job.exception', {
      jobId,
      triggerType,
      message: error.message,
    });
    result = { error: error.message };
    attempts = [{
      attempt: 1,
      status: 'failure',
      retryable: false,
      durationMs: Math.max(0, Date.now() - startedMs),
      startedAt,
      finishedAt: new Date().toISOString(),
      nextDelayMs: null,
      failureType: classifyAutomationFailure(jobId, result, error.message),
      errorMessage: error.message,
    }];
  }

  const status = resolveRunStatus(jobId, result);
  result = await invalidatePublicCacheAfterMutation(supabase, jobId, result, {
    triggerType,
    forceRefresh,
  });
  const dedupeKey = buildOpsAutomationDedupeKey(jobId, triggerType);
  const finishedAt = new Date().toISOString();
  const durationMs = Math.max(0, Date.now() - startedMs);
  const node = buildAutomationNodeSummary({
    jobId,
    result,
    runContext,
    startedAt,
    finishedAt,
    attempts,
    input,
    status,
    dedupeKey,
    durationMs,
  });
  result = {
    ...result,
    meta: node,
  };
  const prePersistArtifacts = buildAutomationJobArtifacts({
    jobId,
    result,
    node,
    runContext,
  });
  const persistResult = await persistAutomationRun(supabase, {
    job_id: jobId,
    job_label: jobMeta.label,
    trigger_type: triggerType,
    status,
    dedupe_key: dedupeKey,
    summary: prePersistArtifacts.summary,
    top_changed_fields: prePersistArtifacts.topChangedFields,
    preview: prePersistArtifacts.preview,
    review_bundle: prePersistArtifacts.reviewBundle,
    error_message: result?.error || null,
    started_at: startedAt,
    finished_at: finishedAt,
    created_by: createdBy,
  });
  const artifacts = buildAutomationJobArtifacts({
    jobId,
    result,
    node,
    runContext,
    persistAction: persistResult?.action || null,
  });

  serverLogger.info('ops-automation.job.finish', {
    jobId,
    triggerType,
    status,
    presentationStatus: node.presentationStatus,
    hasError: Boolean(result?.error),
    retryCount: node.retryCount,
    persistAction: persistResult?.action || null,
  });

  return {
    result,
    node: {
      ...node,
      persistAction: persistResult?.action || null,
    },
    artifacts,
  };
}

export async function runOpsAutomationJobs({
  requestedJobIds = 'all',
  triggerType = 'api',
  createdBy = null,
  env = process.env,
  forceRefresh = false,
  refreshMode = null,
  announcementLimit = null,
} = {}) {
  const jobIds = parseRequestedJobIds(requestedJobIds);
  const runContext = createRunContext({
    requestedJobIds: jobIds,
    triggerType,
    createdBy,
    forceRefresh,
    refreshMode,
    announcementLimit,
  });
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

  // cron 触发时按 site_config 的执行时机配置过滤任务；手动 / API 触发不受限
  let effectiveJobIds = jobIds;
  let scheduleSkippedJobs = [];
  if (triggerType === 'cron') {
    const scheduleConfig = await loadOpsAutomationScheduleConfig(supabase);
    const gate = filterJobIdsBySchedule(jobIds, scheduleConfig);
    effectiveJobIds = gate.allowed;
    scheduleSkippedJobs = gate.skipped;
    if (scheduleSkippedJobs.length) {
      serverLogger.info('[ops-automation] schedule gate skipped jobs', {
        weekday: gate.weekday,
        skipped: scheduleSkippedJobs,
      });
    }
  }

  const results = {};
  const jobGraph = [];
  let announcementRecords = null;
  let poolResult = null;

  if (effectiveJobIds.includes('official-announcements')) {
    const announcementRun = await runSingleAutomationJob('official-announcements', {
      triggerType,
      supabase,
      createdBy,
      runContext,
      forceRefresh,
      refreshMode,
      announcementLimit,
    });
    results.announcements = announcementRun.result;
    jobGraph.push(announcementRun.node);
    announcementRecords = announcementRun.result?.records || announcementRun.result?.rawRecords || null;
  }

  if (effectiveJobIds.includes('pool-schedule')) {
    const poolRun = await runSingleAutomationJob('pool-schedule', {
      triggerType,
      supabase,
      createdBy,
      runContext,
      announcementRecords,
    });
    results.pools = poolRun.result;
    jobGraph.push(poolRun.node);
    poolResult = poolRun.result;
  }

  if (effectiveJobIds.includes('wiki-catalog')) {
    const wikiRun = await runSingleAutomationJob('wiki-catalog', {
      triggerType,
      supabase,
      createdBy,
      runContext,
      poolResult,
    });
    results.newCharacterCheck = wikiRun.result;
    jobGraph.push(wikiRun.node);
  }

  const hasErrors = jobGraph.some(node => node.status === 'failure');
  const partial = jobGraph.some(node => node.presentationStatus === 'partial');
  return {
    ok: !hasErrors,
    partial,
    status: hasErrors ? 500 : 200,
    results: sanitizeResponseResults(results),
    jobGraph,
    scheduleSkippedJobs,
    runContext: {
      ...runContext,
      finishedAt: new Date().toISOString(),
    },
  };
}

export function buildOpsAutomationHttpPayload(runResult = {}) {
  return {
    success: Boolean(runResult.ok),
    partial: Boolean(runResult.partial),
    jobGraph: Array.isArray(runResult.jobGraph) ? runResult.jobGraph : [],
    ...(Array.isArray(runResult.scheduleSkippedJobs) && runResult.scheduleSkippedJobs.length
      ? { scheduleSkippedJobs: runResult.scheduleSkippedJobs }
      : {}),
    ...(runResult.results || {}),
  };
}

export const __internal = {
  buildAutomationJobArtifacts,
  buildAutomationNodeSummary,
  buildAutomationPreview,
  buildOpsAutomationHttpPayload,
  buildTopChangedFields,
  classifyAutomationFailure,
  createRunContext,
  getPresentationStatus,
  invalidatePublicCacheAfterMutation,
  isPartialAutomationResult,
  persistAutomationRun,
  runWithRetry,
  sanitizeResponseResults,
  sanitizeSummary,
};
