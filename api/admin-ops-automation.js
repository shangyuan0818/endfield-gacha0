import { rejectDisallowedBrowserOrigin } from './_lib/http.js';
import { getSupabaseAdminClient, getBearerToken, createSupabaseAccessTokenClient } from './_lib/authAdmin.js';
import { parseRequestedJobIds } from './_lib/opsAutomation.js';
import { runOpsAutomationJobs } from './_lib/runOpsAutomation.js';

async function verifySuperAdmin(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const client = createSupabaseAccessTokenClient(token);
  if (!client) return null;
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const admin = getSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  return data?.role === 'super_admin' ? user : null;
}

function readRequestedJobs(req) {
  if (req.body?.job) {
    return req.body.job;
  }
  if (req.query?.job) {
    return req.query.job;
  }
  try {
    return new URL(req.url || '', 'https://example.com').searchParams.get('job') || 'all';
  } catch {
    return 'all';
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, {
    methods: 'POST, OPTIONS',
    headers: 'Content-Type, Authorization',
  })) return;

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const authorizedUser = await verifySuperAdmin(req);
  if (!authorizedUser) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  try {
    const requestedJobIds = parseRequestedJobIds(readRequestedJobs(req));
    const runResult = await runOpsAutomationJobs({
      requestedJobIds,
      triggerType: 'manual',
      createdBy: authorizedUser.id,
    });

    if (!runResult.ok && runResult.status === 503) {
      return res.status(503).json({ success: false, error: runResult.error });
    }

    return res.status(runResult.status).json({
      success: runResult.ok,
      ...runResult.results,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}
