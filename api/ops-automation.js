import { getSupabaseAdminClient } from './_lib/authAdmin.js';
import { rejectDisallowedBrowserOrigin } from './_lib/http.js';
import {
  authorizeOpsAutomationRequest,
  getDefaultRunnableJobIds,
  normalizeTriggerType,
  parseRequestedJobIds,
  runOpsAutomationJob,
} from './_lib/opsAutomation.js';

function pickSingleQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function getRequestBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;

  if (!host) {
    return '';
  }

  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, { methods: 'GET, OPTIONS' })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const auth = authorizeOpsAutomationRequest(req);
  if (!auth.ok) {
    return res.status(auth.status).json({
      success: false,
      error: auth.error,
    });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return res.status(503).json({
      success: false,
      error: 'Supabase admin client is not configured',
    });
  }

  const rawJob = pickSingleQueryValue(req.query?.job);
  const rawTrigger = pickSingleQueryValue(req.query?.trigger);
  const rawMode = pickSingleQueryValue(req.query?.mode);
  const sourceBaseUrl = getRequestBaseUrl(req);

  if (rawMode && rawMode !== 'dry-run') {
    return res.status(501).json({
      success: false,
      error: 'Only dry-run mode is implemented for ops automation',
    });
  }

  let jobIds;
  let triggerType;

  try {
    jobIds = rawJob
      ? parseRequestedJobIds(rawJob)
      : getDefaultRunnableJobIds(process.env, { baseUrl: sourceBaseUrl });
    triggerType = normalizeTriggerType(rawTrigger, rawJob ? 'manual' : 'cron');
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Invalid ops automation query',
    });
  }

  if (jobIds.length === 0) {
    return res.status(503).json({
      success: false,
      error: 'No runnable ops automation jobs are configured',
    });
  }

  const dryRun = true;
  const results = [];

  for (const jobId of jobIds) {
    // 串行执行，避免后台任务同时争抢外部源与审计写入顺序
    const result = await runOpsAutomationJob({
      supabase,
      jobId,
      dryRun,
      triggerType,
      sourceBaseUrl,
    });
    results.push(result);
  }

  const hasProblems = results.some(result => result.status !== 'success');
  return res.status(hasProblems ? 500 : 200).json({
    success: !hasProblems,
    dryRun,
    triggerType,
    results,
  });
}

export const __internal = {
  pickSingleQueryValue,
};
