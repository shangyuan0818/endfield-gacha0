import { getSupabaseAdminClient } from '../../_lib/authAdmin.js';
import { rejectDisallowedBrowserOrigin } from '../../_lib/http.js';
import { resolveAuthenticatedRequestUser } from '../../_lib/siteAuth.js';

function sendError(res, status, error, code = error) {
  return res.status(status).json({
    success: false,
    error,
    code,
  });
}

export default async function accountLastSeenHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, {
    methods: 'POST, OPTIONS',
    headers: 'Content-Type, Authorization',
  })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendError(res, 405, 'Method not allowed', 'method_not_allowed');
  }

  const adminClient = getSupabaseAdminClient();
  const authResult = await resolveAuthenticatedRequestUser(req, {
    adminClient,
    touch: Boolean(adminClient),
  });

  if (!authResult.ok) {
    return sendError(
      res,
      authResult.status || 401,
      authResult.error || 'Authentication required',
      authResult.code || 'authentication_required'
    );
  }

  try {
    const dbClient = adminClient || authResult.callerClient;
    if (!dbClient) {
      return sendError(res, 503, 'Auth service not configured', 'auth_service_not_configured');
    }

    const updatedAt = new Date().toISOString();
    if (authResult.source !== 'site_session') {
      const { error } = await dbClient
        .from('profiles')
        .update({ last_seen_at: updatedAt })
        .eq('id', authResult.user.id);

      if (error) {
        throw error;
      }
    }

    return res.status(200).json({
      success: true,
      updated: true,
      updatedAt,
      source: authResult.source || 'unknown',
    });
  } catch (error) {
    return sendError(
      res,
      500,
      error?.message || 'Failed to update last seen',
      'last_seen_update_failed'
    );
  }
}
