import { getSupabaseAdminClient } from '../../../_lib/authAdmin.js';
import { requireAuthenticatedUser } from '../../../_lib/devApiAuth.js';
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
    const provider = normalizeProvider(parseRequestBody(req).provider);
    assertProvider(provider);

    const nowIso = new Date().toISOString();
    const { data: bindingRow, error: bindingError } = await adminClient
      .from('user_platform_bindings')
      .update({
        status: 'revoked',
        revoked_at: nowIso,
        updated_at: nowIso,
      })
      .eq('user_id', authResult.user.id)
      .eq('provider', provider)
      .neq('status', 'revoked')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (bindingError) {
      throw bindingError;
    }

    if (!bindingRow) {
      return sendError(res, {
        status: 404,
        message: 'Active binding not found',
      }, { meta });
    }

    await adminClient
      .from('platform_binding_challenges')
      .update({
        status: 'cancelled',
        updated_at: nowIso,
      })
      .eq('user_id', authResult.user.id)
      .eq('provider', provider)
      .eq('status', 'pending');

    return sendSuccess(res, {
      binding: sanitizeBinding(bindingRow),
    }, { meta });
  } catch (error) {
    return sendError(res, {
      status: error?.status || error?.statusCode || 500,
      message: error?.message || 'Failed to revoke binding',
      details: error?.details,
    }, { meta });
  }
}
