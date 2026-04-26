import { rejectDisallowedBrowserOrigin } from '../../_lib/http.js';
import { getSupabaseAdminClient } from '../../_lib/authAdmin.js';
import { requireAuthenticatedUser } from '../../_lib/devApiAuth.js';
import { decryptRevealSecret } from '../../_lib/devApiSecrets.js';

function serializeKey(keyRow) {
  return {
    id: keyRow.id,
    key_prefix: keyRow.key_prefix,
    label: keyRow.label,
    status: keyRow.status,
    last_used_at: keyRow.last_used_at || null,
    expires_at: keyRow.expires_at || null,
    created_at: keyRow.created_at || null,
    revoked_at: keyRow.revoked_at || null,
    secret_revealed_at: keyRow.secret_revealed_at || null,
  };
}

function serializeClient(clientRow, keyRows, pendingSecretsByKeyId) {
  return {
    id: clientRow.id,
    client_type: clientRow.client_type,
    provider: clientRow.provider,
    name: clientRow.name,
    use_case: clientRow.use_case,
    status: clientRow.status,
    requested_scopes: clientRow.requested_scopes || [],
    granted_scopes: clientRow.granted_scopes || [],
    rate_limit_tier: clientRow.rate_limit_tier,
    review_note: clientRow.review_note || '',
    approved_at: clientRow.approved_at || null,
    created_at: clientRow.created_at || null,
    updated_at: clientRow.updated_at || null,
    keys: keyRows.map((keyRow) => ({
      ...serializeKey(keyRow),
      one_time_secret: pendingSecretsByKeyId.get(keyRow.id) || null,
    })),
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, {
    methods: 'GET, OPTIONS',
    headers: 'Content-Type, Authorization',
  })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
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
    const { data: clients, error: clientsError } = await adminClient
      .from('api_clients')
      .select('*')
      .eq('owner_user_id', authResult.user.id)
      .eq('client_type', 'developer')
      .order('created_at', { ascending: false });

    if (clientsError) {
      throw clientsError;
    }

    const clientIds = (clients || []).map((client) => client.id);
    let keys = [];
    if (clientIds.length > 0) {
      const keyResult = await adminClient
        .from('api_client_keys')
        .select('*')
        .in('client_id', clientIds)
        .order('created_at', { ascending: false });

      if (keyResult.error) {
        throw keyResult.error;
      }

      keys = keyResult.data || [];
    }

    const pendingSecretsByKeyId = new Map();
    const keyIdsToClear = [];

    for (const keyRow of keys) {
      if (!keyRow.encrypted_secret) {
        continue;
      }

      try {
        pendingSecretsByKeyId.set(keyRow.id, decryptRevealSecret(keyRow.encrypted_secret));
        keyIdsToClear.push(keyRow.id);
      } catch {
        pendingSecretsByKeyId.set(keyRow.id, null);
        keyIdsToClear.push(keyRow.id);
      }
    }

    if (keyIdsToClear.length > 0) {
      await adminClient
        .from('api_client_keys')
        .update({
          encrypted_secret: null,
          secret_revealed_at: new Date().toISOString(),
        })
        .in('id', keyIdsToClear);
    }

    const keysByClientId = new Map();
    keys.forEach((keyRow) => {
      if (!keysByClientId.has(keyRow.client_id)) {
        keysByClientId.set(keyRow.client_id, []);
      }
      keysByClientId.get(keyRow.client_id).push(keyRow);
    });

    return res.status(200).json({
      success: true,
      data: {
        applications: (clients || []).map((clientRow) => serializeClient(
          clientRow,
          keysByClientId.get(clientRow.id) || [],
          pendingSecretsByKeyId
        )),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to load developer applications',
    });
  }
}
