import {
  methodGuard,
  sendError,
  sendSuccess,
  withCors,
  withDevApiRateLimit,
} from './devApiResponse.js';
import { requireApiClient } from './devApiAuth.js';
import { resolveVerifiedBinding } from './botSummary.js';
import { normalizeProvider, sanitizeBotBinding } from './bindingDtos.js';

function getRequestMeta() {
  return {
    cache: 'no-store',
  };
}

function sanitizeOfficialBotData(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const safeData = JSON.parse(JSON.stringify(data));
  const sensitiveKeys = new Set([
    'user_id',
    'platform_user_id',
    'game_uid',
    'gameUid',
    'pool_id',
    'poolId',
    'record_id',
    'recordId',
    'share_target',
  ]);

  function isSensitiveIdentifierString(value) {
    const text = String(value || '').trim().toLowerCase();
    return (
      /^(special|weapon|wepon|weponbox|pool|chr|char|wpn|manual)_/.test(text)
      || text === 'standard'
      || text === 'beginner'
    );
  }

  function stripSensitiveFields(value) {
    if (Array.isArray(value)) {
      return value
        .map(stripSensitiveFields)
        .filter((item) => item !== null && item !== undefined && item !== '');
    }

    if (typeof value === 'string') {
      return isSensitiveIdentifierString(value) ? null : value;
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    Object.keys(value).forEach((key) => {
      if (sensitiveKeys.has(key)) {
        delete value[key];
        return;
      }

      const strippedValue = stripSensitiveFields(value[key]);
      if (strippedValue === null || strippedValue === undefined || strippedValue === '') {
        delete value[key];
        return;
      }

      value[key] = strippedValue;
    });

    return value;
  }

  if (safeData.user && typeof safeData.user === 'object') {
    delete safeData.user.id;
  }

  if (safeData.summary?.latest_pull && typeof safeData.summary.latest_pull === 'object') {
    delete safeData.summary.latest_pull.id;
    delete safeData.summary.latest_pull.user_id;
  }

  if (Array.isArray(safeData.records)) {
    safeData.records = safeData.records.map((record) => {
      const safeRecord = { ...record };
      delete safeRecord.id;
      delete safeRecord.user_id;
      return safeRecord;
    });
  }

  return stripSensitiveFields(safeData);
}

export async function handleOfficialBotSelfApi(req, res, {
  handler,
  validateQuery,
} = {}) {
  const meta = getRequestMeta();
  res.setHeader('Cache-Control', 'no-store');

  if (!withCors(req, res, {
    methods: 'GET, OPTIONS',
    headers: 'Content-Type, Authorization, X-API-Key',
    meta,
  })) {
    return;
  }

  if (!methodGuard(req, res, ['GET'], meta)) {
    return;
  }

  const authResult = await requireApiClient(req, {
    requiredScopes: ['bot.self.read'],
    clientTypes: ['official_bot'],
  });

  if (authResult.error) {
    return sendError(res, authResult.error, { meta });
  }

  try {
    const provider = normalizeProvider(req.query?.provider);
    const platformUserId = String(req.query?.platformUserId || '').trim();

    if (!provider || !platformUserId) {
      throw {
        status: 400,
        message: 'Missing provider or platformUserId',
      };
    }

    if (provider !== authResult.client.provider) {
      throw {
        status: 403,
        message: 'Provider mismatch for official bot client',
      };
    }

    validateQuery?.(req.query || {});

    const rateLimit = await withDevApiRateLimit(authResult, 'dev_api_bot_self');
    const responseMeta = {
      ...meta,
      rateLimit: rateLimit.meta,
    };

    if (rateLimit.result?.allowed === false) {
      return sendError(res, {
        status: 429,
        message: rateLimit.result.reason || 'Too many requests',
        details: {
          retryAfter: rateLimit.result.retry_after || 0,
        },
      }, { meta: responseMeta });
    }

    const binding = await resolveVerifiedBinding(authResult.adminClient, provider, platformUserId);
    if (!binding) {
      throw {
        status: 404,
        message: 'Verified binding not found',
      };
    }

    const data = await handler({
      req,
      adminClient: authResult.adminClient,
      binding,
      userId: binding.user_id,
      provider,
      platformUserId,
    });

    return sendSuccess(res, {
      binding: sanitizeBotBinding(binding),
      ...sanitizeOfficialBotData(data),
    }, { meta: responseMeta });
  } catch (error) {
    return sendError(res, {
      status: error?.status || error?.statusCode || 500,
      message: error?.message || 'Official bot API request failed',
      code: error?.code,
      details: error?.details,
    }, { meta });
  }
}

export default {
  handleOfficialBotSelfApi,
};
