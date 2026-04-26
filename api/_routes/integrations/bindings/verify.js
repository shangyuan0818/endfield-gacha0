import { requireVerifierClient } from '../../../_lib/devApiAuth.js';
import { enforceRateLimit } from '../../../_lib/devApiRateLimit.js';
import { methodGuard, sendError, sendSuccess, withCors } from '../../../_lib/devApiResponse.js';
import {
  assertProvider,
  normalizeProvider,
  parseRequestBody,
  sanitizeBinding,
} from '../../../_lib/bindingDtos.js';

export default async function handler(req, res) {
  const meta = { cache: 'no-store' };
  res.setHeader('Cache-Control', 'no-store');

  if (!withCors(req, res, {
    methods: 'POST, OPTIONS',
    headers: 'Content-Type, Authorization',
    meta,
  })) {
    return;
  }

  if (!methodGuard(req, res, ['POST'], meta)) {
    return;
  }

  const { provider, challengeCode, platformUserId, displayHandle } = parseRequestBody(req);
  const normalizedProvider = normalizeProvider(provider);
  const normalizedChallengeCode = String(challengeCode || '').trim().toUpperCase();
  const normalizedPlatformUserId = String(platformUserId || '').trim();
  const normalizedDisplayHandle = String(displayHandle || '').trim();

  try {
    assertProvider(normalizedProvider);

    if (!normalizedChallengeCode || normalizedChallengeCode.length < 6) {
      throw { status: 400, message: 'Invalid challenge code' };
    }

    if (!normalizedPlatformUserId) {
      throw { status: 400, message: 'Missing platform user id' };
    }
  } catch (error) {
    return sendError(res, error, { meta });
  }

  const verifierResult = await requireVerifierClient(req, normalizedProvider);
  if (verifierResult.error) {
    return sendError(res, verifierResult.error, { meta });
  }

  const { adminClient } = verifierResult;

  try {
    const rateLimitResult = await enforceRateLimit(
      adminClient,
      `binding:verify:${normalizedProvider}:${normalizedPlatformUserId}`,
      'binding_verify'
    );

    if (rateLimitResult?.allowed === false) {
      return sendError(res, {
        status: 429,
        message: rateLimitResult.reason || 'Too many requests',
        details: {
          retryAfter: rateLimitResult.retry_after || 0,
        },
      }, { meta });
    }

    const { data: challengeRow, error: challengeError } = await adminClient
      .from('platform_binding_challenges')
      .select('*')
      .eq('provider', normalizedProvider)
      .eq('challenge_code', normalizedChallengeCode)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();

    if (challengeError) {
      throw challengeError;
    }

    if (!challengeRow) {
      return sendError(res, {
        status: 404,
        message: 'Binding challenge not found or already used',
      }, { meta });
    }

    if (new Date(challengeRow.expires_at).getTime() <= Date.now()) {
      await adminClient
        .from('platform_binding_challenges')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString(),
        })
        .eq('id', challengeRow.id);

      return sendError(res, {
        status: 410,
        message: 'Binding challenge expired',
      }, { meta });
    }

    const conflictResult = await adminClient
      .from('user_platform_bindings')
      .select('id, user_id')
      .eq('provider', normalizedProvider)
      .eq('platform_user_id', normalizedPlatformUserId)
      .eq('status', 'verified')
      .limit(1)
      .maybeSingle();

    if (conflictResult.error) {
      throw conflictResult.error;
    }

    if (conflictResult.data && conflictResult.data.user_id !== challengeRow.user_id) {
      return sendError(res, {
        status: 409,
        message: 'Platform account already bound to another user',
      }, { meta });
    }

    const nowIso = new Date().toISOString();
    const bindingUpdate = {
      platform_user_id: normalizedPlatformUserId,
      display_handle: normalizedDisplayHandle || null,
      status: 'verified',
      verified_at: nowIso,
      revoked_at: null,
      last_verified_at: nowIso,
      updated_at: nowIso,
    };

    const { data: bindingRow, error: bindingError } = await adminClient
      .from('user_platform_bindings')
      .update(bindingUpdate)
      .eq('id', challengeRow.binding_id)
      .eq('user_id', challengeRow.user_id)
      .eq('provider', normalizedProvider)
      .select('*')
      .single();

    if (bindingError) {
      throw bindingError;
    }

    await adminClient
      .from('platform_binding_challenges')
      .update({
        status: 'consumed',
        consumed_at: nowIso,
        verified_platform_user_id: normalizedPlatformUserId,
        verified_display_handle: normalizedDisplayHandle || null,
        updated_at: nowIso,
      })
      .eq('id', challengeRow.id);

    return sendSuccess(res, {
      binding: sanitizeBinding(bindingRow),
    }, { meta });
  } catch (error) {
    return sendError(res, {
      status: error?.status || error?.statusCode || 500,
      message: error?.message || 'Failed to verify binding challenge',
      details: error?.details,
    }, { meta });
  }
}
