import { applyCors } from '../../_lib/http.js';
import { getSupabaseAdminClient } from '../../_lib/authAdmin.js';
import { unlinkSiteAuthIdentity } from '../../_lib/siteSession.js';

function sendJsonError(res, status, code, message, details = {}) {
  return res.status(status).json({
    success: false,
    error: code,
    code,
    message,
    details,
    meta: {
      cache: 'no-store',
      generatedAt: new Date().toISOString(),
    },
  });
}

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function guardCommon(req, res, {
  methods = ['POST'],
} = {}) {
  res.setHeader('Cache-Control', 'no-store');
  const { allowed, origin } = applyCors(req, res, {
    methods: `${methods.join(', ')}, OPTIONS`,
    headers: 'Content-Type, Authorization',
  });

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return false;
  }

  if (origin && !allowed) {
    sendJsonError(res, 403, 'origin_not_allowed', 'Origin not allowed.');
    return false;
  }

  if (!methods.includes(req.method)) {
    res.setHeader('Allow', methods.join(', '));
    sendJsonError(res, 405, 'method_not_allowed', `Method ${req.method || 'UNKNOWN'} not allowed.`);
    return false;
  }

  return true;
}

function getHttpStatusForCode(code) {
  if (code === 'site_session_required') return 401;
  if (code === 'oauth_identity_forbidden') return 403;
  if (code === 'oauth_identity_not_found') return 404;
  if (code === 'oauth_last_login_method') return 409;
  if (code === 'admin_client_unavailable' || code === 'site_session_secret_missing') return 503;
  return 400;
}

export async function authIdentityUnlinkHandler(req, res) {
  if (!guardCommon(req, res, { methods: ['POST', 'DELETE'] })) {
    return;
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return sendJsonError(res, 503, 'supabase_admin_not_configured', 'Supabase admin client is not configured.');
  }

  const body = readBody(req);
  const identityId = String(body.identityId || body.identity_id || '').trim();
  if (!identityId) {
    return sendJsonError(res, 400, 'identity_id_required', 'Identity id is required.');
  }

  const result = await unlinkSiteAuthIdentity(adminClient, {
    identityId,
    req,
  });

  if (!result.ok) {
    return sendJsonError(
      res,
      getHttpStatusForCode(result.code),
      result.code || 'oauth_identity_unlink_failed',
      result.reason || 'Failed to unlink identity.'
    );
  }

  return res.status(200).json({
    success: true,
    data: {
      identity: result.identity || null,
    },
    meta: {
      cache: 'no-store',
      generatedAt: new Date().toISOString(),
    },
  });
}

export default {
  authIdentityUnlinkHandler,
};
