import {
  getBearerToken,
  getSupabaseAdminClient,
  getSupabaseAnonServerClient,
} from './authAdmin.js';
import { rejectDisallowedBrowserOrigin } from './http.js';
import {
  getDefaultRunnableJobIds,
  parseRequestedJobIds,
  runOpsAutomationJob,
} from './opsAutomation.js';

function parseRequestBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return req.body;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRequestedJobIds(rawJobIds, env, {
  baseUrl = '',
} = {}) {
  if (typeof rawJobIds === 'string' && normalizeText(rawJobIds)) {
    return parseRequestedJobIds(rawJobIds);
  }

  if (Array.isArray(rawJobIds) && rawJobIds.length > 0) {
    return parseRequestedJobIds(rawJobIds.join(','));
  }

  return getDefaultRunnableJobIds(env, { baseUrl });
}

function getRequestBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;

  if (!host) {
    return '';
  }

  return `${proto}://${host}`;
}

async function requireSuperAdmin(req, {
  adminClient,
  callerClient,
}) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return {
      error: { status: 401, message: 'Missing access token' },
    };
  }

  if (!callerClient) {
    return {
      error: { status: 503, message: 'Supabase anon server client not configured' },
    };
  }

  const { data: userData, error: userError } = await callerClient.auth.getUser(accessToken);
  if (userError || !userData?.user?.id) {
    return {
      error: { status: 401, message: userError?.message || 'Invalid access token' },
    };
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', userData.user.id)
    .single();

  if (profileError) {
    return {
      error: { status: 500, message: profileError.message || 'Failed to load caller profile' },
    };
  }

  if (profile?.role !== 'super_admin') {
    return {
      error: { status: 403, message: 'Super admin role required' },
    };
  }

  return {
    callerUser: userData.user,
  };
}

export async function handleAdminRunOpsAutomation(req, res, {
  env = process.env,
  getAdminClient = getSupabaseAdminClient,
  getCallerClient = getSupabaseAnonServerClient,
  runJob = runOpsAutomationJob,
  now = () => new Date(),
} = {}) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, {
    methods: 'POST, OPTIONS',
    headers: 'Content-Type, Authorization',
  })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
    return;
  }

  const adminClient = getAdminClient();
  if (!adminClient) {
    res.status(503).json({
      success: false,
      error: 'Auth admin not configured',
    });
    return;
  }

  const callerClient = getCallerClient();
  const authResult = await requireSuperAdmin(req, {
    adminClient,
    callerClient,
  });

  if (authResult.error) {
    res.status(authResult.error.status).json({
      success: false,
      error: authResult.error.message,
    });
    return;
  }

  const body = parseRequestBody(req);
  const sourceBaseUrl = getRequestBaseUrl(req);
  let jobIds = [];

  try {
    jobIds = normalizeRequestedJobIds(body.jobIds, env, {
      baseUrl: sourceBaseUrl,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error?.message || 'Invalid jobIds',
    });
    return;
  }

  if (jobIds.length === 0) {
    res.status(503).json({
      success: false,
      error: 'No runnable ops automation jobs are configured',
    });
    return;
  }

  const results = [];

  for (const jobId of jobIds) {
    // 保持串行执行，避免同轮 dry-run 写入顺序和外部源访问争抢
    const result = await runJob({
      supabase: adminClient,
      jobId,
      dryRun: true,
      triggerType: 'manual',
      env,
      sourceBaseUrl,
      now: now(),
    });

    results.push(result);
  }

  const hasProblems = results.some(result => result.status !== 'success');
  res.status(hasProblems ? 500 : 200).json({
    success: !hasProblems,
    dryRun: true,
    triggerType: 'manual',
    callerUserId: authResult.callerUser.id,
    results,
  });
}

export default async function handler(req, res) {
  await handleAdminRunOpsAutomation(req, res);
}
