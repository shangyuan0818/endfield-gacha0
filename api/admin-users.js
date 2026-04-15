import { rejectDisallowedBrowserOrigin } from './_lib/http.js';
import {
  createSupabaseAccessTokenClient,
  getBearerToken,
  getSupabaseAdminClient,
  listMergedAdminUsers,
} from './_lib/authAdmin.js';

async function verifySuperAdmin(req) {
  const token = getBearerToken(req);
  if (!token) {
    return null;
  }

  const callerClient = createSupabaseAccessTokenClient(token);
  const adminClient = getSupabaseAdminClient();
  if (!callerClient || !adminClient) {
    return null;
  }

  const { data: userPayload, error: userError } = await callerClient.auth.getUser();
  if (userError || !userPayload?.user?.id) {
    return null;
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userPayload.user.id)
    .single();

  if (profileError || profile?.role !== 'super_admin') {
    return null;
  }

  return {
    callerUser: userPayload.user,
    adminClient
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, {
    methods: 'GET, OPTIONS',
    headers: 'Content-Type, Authorization'
  })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const authResult = await verifySuperAdmin(req);
  if (!authResult?.adminClient) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  try {
    const users = await listMergedAdminUsers(authResult.adminClient, {
      repairProfiles: true
    });

    return res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to load admin users'
    });
  }
}
