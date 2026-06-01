import { applyCors } from '../../_lib/http.js';
import { getSupabaseAdminClient } from '../../_lib/authAdmin.js';
import { resolveAuthenticatedRequestUser } from '../../_lib/siteAuth.js';
import {
  createSupabaseCompatAccessToken,
  createSiteSession,
  loadSiteSession,
  revokeSiteSession,
} from '../../_lib/siteSession.js';

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

function guardCommon(req, res, {
  methods = ['GET'],
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

function buildSessionPayload(sessionResult) {
  if (!sessionResult?.authenticated) {
    return {
      success: true,
      authenticated: false,
      data: {
        authenticated: false,
      },
      meta: {
        cache: 'no-store',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  const compatToken = createSupabaseCompatAccessToken({
    user: sessionResult.user,
    profile: sessionResult.profile,
    sessionId: sessionResult.session?.id,
    ttlSeconds: sessionResult.config?.compatJwtTtlSeconds,
  });

  return {
    success: true,
    authenticated: true,
    data: {
      authenticated: true,
      user: sessionResult.user,
      profile: sessionResult.profile,
      identities: sessionResult.identities || [],
      session: {
        id: sessionResult.session?.id || null,
        expiresAt: sessionResult.session?.expires_at || null,
        absoluteExpiresAt: sessionResult.session?.absolute_expires_at || null,
        lastSeenAt: sessionResult.session?.last_seen_at || null,
      },
      supabase: compatToken ? {
        accessToken: compatToken.accessToken,
        tokenType: 'bearer',
        expiresIn: compatToken.expiresIn,
        expiresAt: compatToken.expiresAt,
      } : null,
    },
    meta: {
      cache: 'no-store',
      generatedAt: new Date().toISOString(),
    },
  };
}

async function bootstrapSiteSessionHandler(req, res) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return sendJsonError(res, 503, 'supabase_admin_not_configured', 'Supabase admin client is not configured.');
  }

  const authResult = await resolveAuthenticatedRequestUser(req, {
    adminClient,
    touch: false,
  });

  if (!authResult.ok) {
    return sendJsonError(
      res,
      authResult.status || 401,
      authResult.code || 'missing_access_token',
      authResult.error || 'Missing access token.'
    );
  }

  if (authResult.source === 'site_session') {
    const sessionResult = await loadSiteSession(adminClient, {
      req,
      res,
      touch: true,
    });

    if (!sessionResult.ok) {
      return sendJsonError(res, 500, sessionResult.code || 'site_session_load_failed', sessionResult.reason || 'Failed to load site session.');
    }

    return res.status(200).json(buildSessionPayload(sessionResult));
  }

  const sessionResult = await createSiteSession(adminClient, {
    userId: authResult.user.id,
    req,
    res,
    provider: authResult.source || 'supabase',
  });

  if (!sessionResult.ok) {
    return sendJsonError(res, 500, sessionResult.code || 'site_session_create_failed', sessionResult.reason || 'Failed to create site session.');
  }

  return res.status(200).json({
    success: true,
    data: {
      bootstrapped: true,
      source: authResult.source || 'supabase',
    },
    meta: {
      cache: 'no-store',
      generatedAt: new Date().toISOString(),
    },
  });
}

export default async function authSessionHandler(req, res) {
  if (!guardCommon(req, res, { methods: ['GET', 'POST'] })) {
    return;
  }

  if (req.method === 'POST') {
    return bootstrapSiteSessionHandler(req, res);
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return sendJsonError(res, 503, 'supabase_admin_not_configured', 'Supabase admin client is not configured.');
  }

  const sessionResult = await loadSiteSession(adminClient, {
    req,
    res,
    touch: true,
  });

  if (!sessionResult.ok) {
    return sendJsonError(res, 500, sessionResult.code || 'site_session_load_failed', sessionResult.reason || 'Failed to load site session.');
  }

  return res.status(200).json(buildSessionPayload(sessionResult));
}

export async function authSessionLogoutHandler(req, res) {
  if (!guardCommon(req, res, { methods: ['POST', 'DELETE'] })) {
    return;
  }

  const adminClient = getSupabaseAdminClient();
  if (adminClient) {
    await revokeSiteSession(adminClient, {
      req,
      res,
      reason: 'user_logout',
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      signedOut: true,
    },
    meta: {
      cache: 'no-store',
      generatedAt: new Date().toISOString(),
    },
  });
}
