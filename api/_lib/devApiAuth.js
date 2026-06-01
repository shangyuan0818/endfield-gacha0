import {
  createSupabaseAccessTokenClient,
  getBearerToken,
  getSupabaseAdminClient,
  getSupabaseAnonServerClient,
} from './authAdmin.js';
import { safeSecretHashMatch, buildSecretPrefix } from './devApiSecrets.js';
import { resolveAuthenticatedRequestUser } from './siteAuth.js';

function normalizeScopes(scopes) {
  if (Array.isArray(scopes)) {
    return scopes.map((scope) => String(scope || '').trim()).filter(Boolean);
  }

  return [];
}

export function getApiCredential(req) {
  const headerValue = req.headers?.['x-api-key']
    || req.headers?.['X-API-Key']
    || getBearerToken(req);

  return String(headerValue || '').trim() || null;
}

export function hasRequiredScopes(client, requiredScopes = []) {
  const grantedScopes = new Set(normalizeScopes(client?.granted_scopes));
  return requiredScopes.every((scope) => grantedScopes.has(scope));
}

export async function requireAuthenticatedUser(req, { useAnonServerClient = true } = {}) {
  const authResult = await resolveAuthenticatedRequestUser(req, {
    adminClient: getSupabaseAdminClient(),
  });

  if (!authResult.ok) {
    return {
      error: {
        status: authResult.status || 401,
        message: authResult.error || 'Invalid access token',
      },
    };
  }

  if (authResult.source === 'site_session') {
    return {
      accessToken: authResult.accessToken || null,
      siteSession: authResult.session,
      user: authResult.user,
    };
  }

  const accessToken = authResult.accessToken;
  const callerClient = useAnonServerClient
    ? getSupabaseAnonServerClient()
    : createSupabaseAccessTokenClient(accessToken);

  if (!callerClient) {
    return {
      error: { status: 503, message: 'Supabase caller client not configured' },
    };
  }

  const userResult = useAnonServerClient
    ? await callerClient.auth.getUser(accessToken)
    : await callerClient.auth.getUser();

  const callerUser = userResult?.data?.user;
  if (userResult?.error || !callerUser?.id) {
    return {
      error: {
        status: 401,
        message: userResult?.error?.message || 'Invalid access token',
      },
    };
  }

  return {
    accessToken,
    user: callerUser,
  };
}

export async function requireApiClient(req, {
  requiredScopes = [],
  clientTypes = [],
} = {}) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return {
      error: { status: 503, message: 'Supabase admin client not configured' },
    };
  }

  const secret = getApiCredential(req);
  if (!secret) {
    return {
      error: { status: 401, message: 'Missing API credential' },
    };
  }

  const keyPrefix = buildSecretPrefix(secret);
  if (!keyPrefix) {
    return {
      error: { status: 401, message: 'Invalid API credential' },
    };
  }

  const { data: keyRow, error: keyError } = await adminClient
    .from('api_client_keys')
    .select('*')
    .eq('key_prefix', keyPrefix)
    .limit(1)
    .maybeSingle();

  if (keyError) {
    return {
      error: { status: 500, message: keyError.message || 'Failed to load API key' },
    };
  }

  if (!keyRow || keyRow.status !== 'active' || !safeSecretHashMatch(secret, keyRow.key_hash)) {
    return {
      error: { status: 401, message: 'Invalid API credential' },
    };
  }

  if (keyRow.expires_at && new Date(keyRow.expires_at).getTime() <= Date.now()) {
    return {
      error: { status: 401, message: 'API key expired' },
    };
  }

  const { data: client, error: clientError } = await adminClient
    .from('api_clients')
    .select('*')
    .eq('id', keyRow.client_id)
    .limit(1)
    .maybeSingle();

  if (clientError) {
    return {
      error: { status: 500, message: clientError.message || 'Failed to load API client' },
    };
  }

  if (!client || client.status !== 'active') {
    return {
      error: { status: 403, message: 'API client is not active' },
    };
  }

  if (Array.isArray(clientTypes) && clientTypes.length > 0 && !clientTypes.includes(client.client_type)) {
    return {
      error: { status: 403, message: 'API client type not allowed' },
    };
  }

  if (!hasRequiredScopes(client, requiredScopes)) {
    return {
      error: { status: 403, message: 'API scope not granted' },
    };
  }

  await adminClient
    .from('api_client_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRow.id);

  return {
    adminClient,
    client,
    key: keyRow,
  };
}

export async function requireVerifierClient(req, provider) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return {
      error: { status: 503, message: 'Supabase admin client not configured' },
    };
  }

  const secret = getApiCredential(req);
  if (!secret) {
    return {
      error: { status: 401, message: 'Missing verifier credential' },
    };
  }

  const secretPrefix = buildSecretPrefix(secret);
  const normalizedProvider = String(provider || '').trim().toLowerCase();

  const { data: client, error } = await adminClient
    .from('api_clients')
    .select('*')
    .eq('client_type', 'official_bot')
    .eq('provider', normalizedProvider)
    .eq('verifier_secret_prefix', secretPrefix)
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      error: { status: 500, message: error.message || 'Failed to load verifier client' },
    };
  }

  if (
    !client
    || client.status !== 'active'
    || !safeSecretHashMatch(secret, client.verifier_secret_hash)
  ) {
    return {
      error: { status: 401, message: 'Invalid verifier credential' },
    };
  }

  await adminClient
    .from('api_clients')
    .update({ verifier_last_used_at: new Date().toISOString() })
    .eq('id', client.id);

  return {
    adminClient,
    client,
  };
}

export default {
  getApiCredential,
  hasRequiredScopes,
  requireAuthenticatedUser,
  requireApiClient,
  requireVerifierClient,
};
