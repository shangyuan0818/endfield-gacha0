import { randomUUID } from 'node:crypto';
import { applyCors } from './http.js';
import { requireApiClient } from './devApiAuth.js';
import { enforceRateLimit } from './devApiRateLimit.js';

export const DEV_API_VERSION = 'v1';

const DEFAULT_CORS_HEADERS = 'Content-Type, Authorization, X-API-Key';
const SAFE_ERROR_MESSAGES = {
  400: 'Bad request',
  401: 'API key required',
  403: 'Forbidden',
  404: 'Not found',
  405: 'Method not allowed',
  429: 'Too many requests',
  500: 'Internal server error',
  503: 'Service unavailable',
};

const ERROR_CODES = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  405: 'method_not_allowed',
  409: 'conflict',
  410: 'gone',
  429: 'rate_limited',
  500: 'internal_error',
  503: 'service_unavailable',
};

function normalizeStatus(status) {
  const numericStatus = Number(status);
  if (Number.isInteger(numericStatus) && numericStatus >= 400 && numericStatus <= 599) {
    return numericStatus;
  }

  return 500;
}

function getRequestId(req) {
  const headerValue = req?.headers?.['x-request-id'] || req?.headers?.['X-Request-Id'];
  return String(headerValue || '').trim() || randomUUID();
}

function buildMeta({
  cache = 'no-store',
  rateLimit = null,
  requestId = null,
} = {}) {
  return {
    apiVersion: DEV_API_VERSION,
    generatedAt: new Date().toISOString(),
    cache,
    ...(rateLimit ? { rateLimit } : {}),
    ...(requestId ? { requestId } : {}),
  };
}

function mapSafeError(error, fallbackStatus = 500) {
  const status = normalizeStatus(error?.status || error?.statusCode || fallbackStatus);
  const code = error?.code || ERROR_CODES[status] || 'internal_error';
  const explicitMessage = String(error?.publicMessage || error?.message || '').trim();
  const message = status >= 500
    ? SAFE_ERROR_MESSAGES[status]
    : explicitMessage || SAFE_ERROR_MESSAGES[status] || 'Request failed';

  return {
    status,
    error: {
      code,
      message,
      ...(error?.details ? { details: error.details } : {}),
    },
  };
}

export function sendSuccess(res, data, {
  status = 200,
  meta,
} = {}) {
  return res.status(status).json({
    success: true,
    data,
    meta: buildMeta(meta),
  });
}

export function sendError(res, error, {
  status,
  meta,
} = {}) {
  const safeError = mapSafeError(error, status);
  return res.status(safeError.status).json({
    success: false,
    error: safeError.error,
    meta: buildMeta(meta),
  });
}

export function methodGuard(req, res, methods, meta) {
  const allowedMethods = Array.isArray(methods) ? methods : [methods];
  if (allowedMethods.includes(req.method)) {
    return true;
  }

  res.setHeader('Allow', allowedMethods.join(', '));
  sendError(res, {
    status: 405,
    message: `Method ${req.method || 'UNKNOWN'} not allowed`,
  }, { meta });
  return false;
}

export function withCors(req, res, {
  methods = 'GET, OPTIONS',
  headers = DEFAULT_CORS_HEADERS,
  meta,
} = {}) {
  const { allowed, origin } = applyCors(req, res, { methods, headers });

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return false;
  }

  if (origin && !allowed) {
    sendError(res, {
      status: 403,
      message: 'Origin not allowed',
    }, { meta });
    return false;
  }

  return true;
}

function buildClientContext(authResult) {
  const scopes = Array.isArray(authResult?.client?.granted_scopes)
    ? authResult.client.granted_scopes
    : [];

  return {
    clientId: authResult?.client?.id || null,
    clientType: authResult?.client?.client_type || null,
    keyPrefix: authResult?.key?.key_prefix || null,
    scopes,
    rateLimitTier: authResult?.client?.rate_limit_tier || 'default',
  };
}

function formatRateLimitMeta(result, action) {
  if (!result) {
    return null;
  }

  return {
    action,
    allowed: result.allowed !== false,
    remaining: Number.isFinite(Number(result.remaining)) ? Number(result.remaining) : null,
    retryAfter: Number.isFinite(Number(result.retry_after)) ? Number(result.retry_after) : 0,
  };
}

async function enforceDevApiRateLimit(adminClient, keyPrefix, action) {
  try {
    return await enforceRateLimit(adminClient, `api-key:${keyPrefix}`, action);
  } catch (error) {
    if (action === 'dev_api_public') {
      throw error;
    }

    return enforceRateLimit(adminClient, `api-key:${keyPrefix}`, 'dev_api_public');
  }
}

export async function withDevApiAuth(req, {
  requiredScopes = ['public.read'],
  clientTypes = [],
} = {}) {
  const authResult = await requireApiClient(req, {
    requiredScopes,
    clientTypes,
  });

  if (authResult.error) {
    return {
      error: authResult.error,
    };
  }

  return {
    ...authResult,
    clientContext: buildClientContext(authResult),
  };
}

export async function withDevApiRateLimit(authResult, action) {
  const rateLimitResult = await enforceDevApiRateLimit(
    authResult.adminClient,
    authResult.key.key_prefix,
    action
  );

  return {
    result: rateLimitResult,
    meta: formatRateLimitMeta(rateLimitResult, action),
  };
}

export async function handlePublicDevApi(req, res, {
  methods = ['GET'],
  rateLimitAction = 'dev_api_catalog',
  cache = 'private, max-age=60, stale-while-revalidate=300',
  handler,
}) {
  const requestId = getRequestId(req);
  const baseMeta = {
    requestId,
    cache,
  };

  res.setHeader('Cache-Control', cache);

  if (!withCors(req, res, {
    methods: `${methods.join(', ')}, OPTIONS`,
    headers: DEFAULT_CORS_HEADERS,
    meta: baseMeta,
  })) {
    return;
  }

  if (!methodGuard(req, res, methods, baseMeta)) {
    return;
  }

  const authResult = await withDevApiAuth(req, {
    requiredScopes: ['public.read'],
  });

  if (authResult.error) {
    return sendError(res, authResult.error, { meta: baseMeta });
  }

  try {
    const rateLimit = await withDevApiRateLimit(authResult, rateLimitAction);
    const meta = {
      ...baseMeta,
      rateLimit: rateLimit.meta,
    };

    if (rateLimit.result?.allowed === false) {
      return sendError(res, {
        status: 429,
        message: rateLimit.result.reason || 'Too many requests',
        details: {
          retryAfter: rateLimit.result.retry_after || 0,
        },
      }, { meta });
    }

    const data = await handler({
      req,
      res,
      adminClient: authResult.adminClient,
      clientContext: authResult.clientContext,
    });

    return sendSuccess(res, data, { meta });
  } catch (error) {
    return sendError(res, {
      status: error?.status || error?.statusCode || 500,
      message: error?.message || 'Dev API request failed',
      code: error?.code,
      details: error?.details,
    }, { meta: baseMeta });
  }
}

export default {
  DEV_API_VERSION,
  handlePublicDevApi,
  methodGuard,
  sendError,
  sendSuccess,
  withCors,
  withDevApiAuth,
  withDevApiRateLimit,
};
