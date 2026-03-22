import { supabase } from '../../supabaseClient';
import { executeSupabaseRead, fetchWithTimeout } from '../supabaseRequest';
import { buildServerlessApiUrl } from '../../utils/authRedirects';

const OPS_AUTOMATION_SCHEMA_MISSING_MESSAGES = [
  "Could not find the table 'public.ops_automation_runs' in the schema cache",
  'relation "public.ops_automation_runs" does not exist',
];

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getErrorMessage(error) {
  if (!error) {
    return '';
  }

  return normalizeText(error.message || error.details || error.hint || String(error));
}

export function isOpsAutomationSchemaMissingError(error) {
  const message = getErrorMessage(error);
  if (!message) {
    return false;
  }

  return OPS_AUTOMATION_SCHEMA_MISSING_MESSAGES.some((fragment) => message.includes(fragment));
}

async function getAccessToken() {
  if (!supabase) {
    return null;
  }

  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function fetchWithAdminAuth(url, body, {
  label,
  timeoutMs = 45000,
} = {}) {
  if (!supabase) {
    throw new Error('Supabase 未配置，无法执行自动化管理操作');
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('当前登录态已失效，请重新登录后重试');
  }

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body || {}),
  }, {
    label,
    timeoutMs,
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.success !== true) {
    const error = new Error(result?.error || '自动化管理请求失败');
    error.result = result;
    throw error;
  }

  return result;
}

export async function loadOpsAutomationRuns({
  jobId = 'all',
  limit = 20,
} = {}) {
  if (!supabase) {
    throw new Error('Supabase 未配置，无法读取自动化审计记录');
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const normalizedJobId = normalizeText(jobId);
  let query = supabase
    .from('ops_automation_runs')
    .select([
      'id',
      'job_id',
      'job_label',
      'trigger_type',
      'status',
      'dry_run',
      'source_tag',
      'source_url',
      'summary',
      'top_changed_fields',
      'preview',
      'review_bundle',
      'error_message',
      'started_at',
      'finished_at',
      'created_at',
      'updated_at',
    ].join(', '))
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (normalizedJobId && normalizedJobId !== 'all') {
    query = query.eq('job_id', normalizedJobId);
  }

  const { data, error } = await executeSupabaseRead(
    () => query,
    {
      label: 'loadOpsAutomationRuns',
      retries: 1,
    }
  );

  if (error) {
    if (isOpsAutomationSchemaMissingError(error)) {
      const setupError = new Error('自动化审计表尚未部署到当前数据库，请先执行迁移后再刷新页面');
      setupError.code = 'OPS_AUTOMATION_SCHEMA_MISSING';
      setupError.cause = error;
      throw setupError;
    }

    throw error;
  }

  return data || [];
}

export async function triggerOpsAutomation(jobIds = []) {
  return fetchWithAdminAuth(buildServerlessApiUrl('/api/admin-run-ops-automation'), {
    jobIds,
  }, {
    label: 'admin-run-ops-automation',
  });
}

export async function applyOfficialAnnouncementsRun({
  runId,
  sourceIds = [],
  reviewNote = '',
} = {}) {
  return fetchWithAdminAuth(buildServerlessApiUrl('/api/admin-apply-official-announcements-run'), {
    runId,
    sourceIds,
    reviewNote,
  }, {
    label: 'admin-apply-official-announcements-run',
  });
}

export async function applyPoolScheduleRun({
  runId,
  poolIds = [],
  reviewNote = '',
} = {}) {
  return fetchWithAdminAuth(buildServerlessApiUrl('/api/admin-apply-pool-schedule-run'), {
    runId,
    poolIds,
    reviewNote,
  }, {
    label: 'admin-apply-pool-schedule-run',
  });
}

export default {
  loadOpsAutomationRuns,
  triggerOpsAutomation,
  applyOfficialAnnouncementsRun,
  applyPoolScheduleRun,
};
