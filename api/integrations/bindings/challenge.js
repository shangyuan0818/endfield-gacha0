import { randomBytes } from 'node:crypto';
import { getSupabaseAdminClient } from '../../_lib/authAdmin.js';
import { requireAuthenticatedUser } from '../../_lib/devApiAuth.js';
import { enforceRateLimit } from '../../_lib/devApiRateLimit.js';
import { methodGuard, sendError, sendSuccess, withCors } from '../../_lib/devApiResponse.js';
import {
  assertProvider,
  normalizeProvider,
  parseRequestBody,
  sanitizeBinding,
  sanitizeChallenge,
} from '../../_lib/bindingDtos.js';

const CHALLENGE_TTL_MINUTES = 10;

function generateChallengeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let value = '';
  for (const byte of bytes) {
    value += alphabet[byte % alphabet.length];
  }
  return value;
}

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

  const authResult = await requireAuthenticatedUser(req);
  if (authResult.error) {
    return sendError(res, authResult.error, { meta });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return sendError(res, {
      status: 503,
      message: 'Supabase admin client not configured',
    }, { meta });
  }

  try {
    const { provider } = parseRequestBody(req);
    const normalizedProvider = normalizeProvider(provider);
    assertProvider(normalizedProvider);

    const rateLimitResult = await enforceRateLimit(
      adminClient,
      `binding:user:${authResult.user.id}:${normalizedProvider}`,
      'binding_challenge_create'
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

    const { data: existingBinding, error: bindingError } = await adminClient
      .from('user_platform_bindings')
      .select('*')
      .eq('user_id', authResult.user.id)
      .eq('provider', normalizedProvider)
      .neq('status', 'revoked')
      .limit(1)
      .maybeSingle();

    if (bindingError) {
      throw bindingError;
    }

    if (existingBinding?.status === 'verified') {
      return sendError(res, {
        status: 409,
        message: 'Provider already bound. Revoke it before starting a new bind challenge.',
      }, { meta });
    }

    let bindingRow = existingBinding || null;

    if (!bindingRow) {
      const insertResult = await adminClient
        .from('user_platform_bindings')
        .insert({
          user_id: authResult.user.id,
          provider: normalizedProvider,
          status: 'pending',
          metadata: {},
        })
        .select('*')
        .single();

      if (insertResult.error) {
        throw insertResult.error;
      }

      bindingRow = insertResult.data;
    }

    await adminClient
      .from('platform_binding_challenges')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', authResult.user.id)
      .eq('provider', normalizedProvider)
      .eq('status', 'pending');

    const challengeCode = generateChallengeCode();
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60 * 1000).toISOString();

    const { data: challengeRow, error: challengeError } = await adminClient
      .from('platform_binding_challenges')
      .insert({
        binding_id: bindingRow.id,
        user_id: authResult.user.id,
        provider: normalizedProvider,
        challenge_code: challengeCode,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select('*')
      .single();

    if (challengeError) {
      throw challengeError;
    }

    return sendSuccess(res, {
      binding: sanitizeBinding(bindingRow),
      challenge: sanitizeChallenge(challengeRow, { includeCode: true }),
    }, { meta });
  } catch (error) {
    return sendError(res, {
      status: error?.status || error?.statusCode || 500,
      message: error?.message || 'Failed to create binding challenge',
      details: error?.details,
    }, {
      meta,
    });
  }
}
