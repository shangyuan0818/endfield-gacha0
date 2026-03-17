import {
  checkMemoryRateLimit,
  getRequesterKey,
  rejectDisallowedBrowserOrigin
} from './_lib/http.js';
import {
  getBearerToken,
  getSupabaseAdminClient,
  getSupabaseAnonServerClient
} from './_lib/authAdmin.js';

const SELF_DELETE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 5
};

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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, { methods: 'POST, OPTIONS', headers: 'Content-Type, Authorization' })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const requesterKey = getRequesterKey(req);
  const rateLimitResult = checkMemoryRateLimit(`self-delete-account:${requesterKey}`, SELF_DELETE_LIMIT);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      retry_after: rateLimitResult.retryAfter
    });
  }

  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return res.status(401).json({
      success: false,
      error: 'Missing access token'
    });
  }

  const adminClient = getSupabaseAdminClient();
  const callerClient = getSupabaseAnonServerClient();

  if (!adminClient || !callerClient) {
    return res.status(503).json({
      success: false,
      error: 'Account deletion service not configured'
    });
  }

  const { currentPassword } = parseRequestBody(req);
  const normalizedPassword = String(currentPassword || '').trim();

  if (normalizedPassword.length < 6) {
    return res.status(400).json({
      success: false,
      error: 'Current password is required'
    });
  }

  try {
    const { data: userData, error: userError } = await callerClient.auth.getUser(accessToken);
    if (userError || !userData?.user?.id) {
      return res.status(401).json({
        success: false,
        error: userError?.message || 'Invalid access token'
      });
    }

    const currentUser = userData.user;
    const normalizedEmail = String(currentUser.email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        error: 'Current account does not support password confirmation'
      });
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', currentUser.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    if (profile?.role === 'admin' || profile?.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        error: '管理员账号请通过超管流程删除'
      });
    }

    const { error: passwordError } = await callerClient.auth.signInWithPassword({
      email: normalizedEmail,
      password: normalizedPassword
    });

    if (passwordError) {
      return res.status(401).json({
        success: false,
        error: '当前密码不正确'
      });
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(currentUser.id);
    if (deleteError) {
      throw deleteError;
    }

    return res.status(200).json({
      success: true,
      userId: currentUser.id
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to delete account'
    });
  }
}
