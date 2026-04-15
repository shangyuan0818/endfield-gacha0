import {
  createSupabaseAccessTokenClient,
  getBearerToken,
  getSupabaseAdminClient,
} from './_lib/authAdmin.js';
import { rejectDisallowedBrowserOrigin } from './_lib/http.js';

async function verifySuperAdmin(req, adminClient) {
  const token = getBearerToken(req);
  if (!token) {
    return {
      error: { status: 401, message: 'Missing access token' }
    };
  }

  const callerClient = createSupabaseAccessTokenClient(token);
  if (!callerClient) {
    return {
      error: { status: 503, message: 'Supabase caller client not configured' }
    };
  }

  const { data: userPayload, error: userError } = await callerClient.auth.getUser();
  if (userError || !userPayload?.user?.id) {
    return {
      error: { status: 401, message: userError?.message || 'Invalid access token' }
    };
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userPayload.user.id)
    .single();

  if (profileError) {
    return {
      error: { status: 500, message: profileError.message || 'Failed to load caller profile' }
    };
  }

  if (profile?.role !== 'super_admin') {
    return {
      error: { status: 403, message: 'Super admin role required' }
    };
  }

  return {
    callerUser: userPayload.user
  };
}

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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, {
    methods: 'POST, OPTIONS',
    headers: 'Content-Type, Authorization'
  })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return res.status(503).json({
      success: false,
      error: 'Auth admin not configured'
    });
  }

  const authResult = await verifySuperAdmin(req, adminClient);
  if (authResult.error) {
    return res.status(authResult.error.status).json({
      success: false,
      error: authResult.error.message
    });
  }

  const { userId } = parseRequestBody(req);
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedUserId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required'
    });
  }

  if (normalizedUserId === authResult.callerUser.id) {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete current super admin'
    });
  }

  try {
    const cleanupOperations = [
      adminClient.from('announcements').update({ created_by: null }).eq('created_by', normalizedUserId),
      adminClient.from('site_config').update({ updated_by: null }).eq('updated_by', normalizedUserId),
      adminClient.from('puzzles').update({ uploader_id: null }).eq('uploader_id', normalizedUserId),
    ];

    for (const operation of cleanupOperations) {
      const { error } = await operation;
      if (error) {
        throw error;
      }
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(normalizedUserId);
    if (deleteError) {
      throw deleteError;
    }

    return res.status(200).json({
      success: true,
      userId: normalizedUserId
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to delete user'
    });
  }
}
