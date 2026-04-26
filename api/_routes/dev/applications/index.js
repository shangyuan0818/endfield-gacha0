import { rejectDisallowedBrowserOrigin } from '../../../_lib/http.js';
import { getSupabaseAdminClient } from '../../../_lib/authAdmin.js';
import { requireAuthenticatedUser } from '../../../_lib/devApiAuth.js';
import { enforceRateLimit } from '../../../_lib/devApiRateLimit.js';

const ALLOWED_DEVELOPER_SCOPES = ['public.read'];

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

function normalizeRequestedScopes(input) {
  const rawScopes = Array.isArray(input) ? input : [];
  const normalized = rawScopes
    .map((scope) => String(scope || '').trim())
    .filter(Boolean);

  const allowedScopes = normalized.filter((scope) => ALLOWED_DEVELOPER_SCOPES.includes(scope));
  if (allowedScopes.length > 0) {
    return [...new Set(allowedScopes)];
  }

  return ['public.read'];
}

function serializeClient(client) {
  return {
    id: client.id,
    client_type: client.client_type,
    provider: client.provider,
    name: client.name,
    use_case: client.use_case,
    status: client.status,
    requested_scopes: client.requested_scopes || [],
    granted_scopes: client.granted_scopes || [],
    rate_limit_tier: client.rate_limit_tier,
    review_note: client.review_note || '',
    approved_at: client.approved_at || null,
    created_at: client.created_at || null,
    updated_at: client.updated_at || null,
  };
}

export default async function handler(req, res) {
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
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const authResult = await requireAuthenticatedUser(req);
  if (authResult.error) {
    return res.status(authResult.error.status).json({
      success: false,
      error: authResult.error.message,
    });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return res.status(503).json({
      success: false,
      error: 'Supabase admin client not configured',
    });
  }

  try {
    const rateLimitResult = await enforceRateLimit(
      adminClient,
      `user:${authResult.user.id}`,
      'dev_api_application'
    );

    if (rateLimitResult?.allowed === false) {
      return res.status(429).json({
        success: false,
        error: rateLimitResult.reason || 'Too many requests',
        retry_after: rateLimitResult.retry_after || 0,
      });
    }

    const { name, useCase, requestedScopes } = parseRequestBody(req);
    const normalizedName = String(name || '').trim();
    const normalizedUseCase = String(useCase || '').trim();
    const normalizedScopes = normalizeRequestedScopes(requestedScopes);

    if (normalizedName.length < 2 || normalizedName.length > 80) {
      return res.status(400).json({
        success: false,
        error: 'Application name must be between 2 and 80 characters',
      });
    }

    if (normalizedUseCase.length < 10 || normalizedUseCase.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Use case must be between 10 and 1000 characters',
      });
    }

    const { data, error } = await adminClient
      .from('api_clients')
      .insert({
        owner_user_id: authResult.user.id,
        client_type: 'developer',
        provider: null,
        name: normalizedName,
        use_case: normalizedUseCase,
        status: 'pending',
        requested_scopes: normalizedScopes,
        granted_scopes: [],
        rate_limit_tier: 'developer_default',
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      data: {
        application: serializeClient(data),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to create developer application',
    });
  }
}
