import { getSupabaseAdminClient } from '../../_lib/authAdmin.js';
import { requireAuthenticatedUser } from '../../_lib/devApiAuth.js';
import { methodGuard, sendError, sendSuccess, withCors } from '../../_lib/devApiResponse.js';
import {
  PLATFORM_PROVIDERS,
  sanitizeBinding,
  sanitizeChallenge,
} from '../../_lib/bindingDtos.js';

function latestByProvider(rows = []) {
  const map = new Map();

  rows.forEach((row) => {
    if (!row?.provider || map.has(row.provider)) {
      return;
    }

    map.set(row.provider, row);
  });

  return map;
}

function getEffectiveChallenge(row) {
  if (!row) {
    return null;
  }

  if (row.status === 'pending' && new Date(row.expires_at).getTime() <= Date.now()) {
    return {
      ...row,
      status: 'expired',
    };
  }

  return row;
}

export default async function handler(req, res) {
  const meta = { cache: 'no-store' };
  res.setHeader('Cache-Control', 'no-store');

  if (!withCors(req, res, {
    methods: 'GET, OPTIONS',
    headers: 'Content-Type, Authorization',
    meta,
  })) {
    return;
  }

  if (!methodGuard(req, res, ['GET'], meta)) {
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
    const [bindingsResult, challengesResult] = await Promise.all([
      adminClient
        .from('user_platform_bindings')
        .select('*')
        .eq('user_id', authResult.user.id)
        .order('created_at', { ascending: false }),
      adminClient
        .from('platform_binding_challenges')
        .select('*')
        .eq('user_id', authResult.user.id)
        .order('created_at', { ascending: false }),
    ]);

    if (bindingsResult.error) {
      throw bindingsResult.error;
    }
    if (challengesResult.error) {
      throw challengesResult.error;
    }

    const latestChallengeByProvider = latestByProvider(challengesResult.data || []);
    const bindings = [...PLATFORM_PROVIDERS].map((provider) => {
      const binding = (bindingsResult.data || []).find((item) => item.provider === provider) || null;
      const challenge = getEffectiveChallenge(latestChallengeByProvider.get(provider));

      return {
        provider,
        binding: sanitizeBinding(binding),
        challenge: sanitizeChallenge(challenge, { includeCode: challenge?.status === 'pending' }),
      };
    });

    return sendSuccess(res, { bindings }, { meta });
  } catch (error) {
    return sendError(res, {
      status: error?.status || error?.statusCode || 500,
      message: error?.message || 'Failed to load binding status',
    }, { meta });
  }
}
