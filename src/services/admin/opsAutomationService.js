import { supabase } from '../../supabaseClient';
import { executeSupabaseRead } from '../supabaseRequest';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
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
    { label: 'loadOpsAutomationRuns', retries: 1 },
  );

  if (error) throw error;
  return data || [];
}

export async function triggerManualSync(job = 'official-announcements') {
  const token = await getAccessToken();
  if (!token) throw new Error('未登录或会话已过期');

  const res = await fetch('/api/admin-ops-automation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ job }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `请求失败 (${res.status})`);
  }
  return json;
}

export default { loadOpsAutomationRuns, triggerManualSync };
