import { createCorsResponse, jsonResponse, requireSuperAdmin } from '../_shared/admin.ts';

const ALLOWED_ROLES = new Set(['user', 'admin', 'super_admin']);

function normalizeUserPayload(payload: Record<string, unknown>) {
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const username = String(payload.username || '').trim() || email.split('@')[0];
  const role = String(payload.role || 'user');

  if (!email) {
    throw new Error('Email is required');
  }

  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  if (!ALLOWED_ROLES.has(role)) {
    throw new Error('Invalid role');
  }

  return { email, password, username, role };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return createCorsResponse();
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Method not allowed' });
  }

  try {
    const { adminClient } = await requireSuperAdmin(req);
    const payload = normalizeUserPayload(await req.json());

    const { data, error } = await adminClient.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        username: payload.username
      }
    });

    if (error || !data.user?.id) {
      throw error || new Error('Create user failed');
    }

    const userId = data.user.id;
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: userId,
        username: payload.username,
        email: payload.email,
        role: payload.role
      }, {
        onConflict: 'id'
      });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(userId);
      throw profileError;
    }

    return jsonResponse(200, {
      success: true,
      user: {
        id: userId,
        email: payload.email,
        username: payload.username,
        role: payload.role
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Create user failed';
    const status = message === 'Permission denied'
      ? 403
      : message === 'Missing authorization header' || message === 'Invalid auth token'
        ? 401
        : 400;

    return jsonResponse(status, {
      success: false,
      error: message
    });
  }
});
