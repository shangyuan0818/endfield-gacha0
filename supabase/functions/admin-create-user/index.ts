import { createCorsResponse, jsonResponse, requireSuperAdmin } from '../_shared/admin.ts';

const ALLOWED_ROLES = new Set(['user', 'admin', 'super_admin']);

function getPasswordCharacterGroups(password: string) {
  return [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
}

function assertPasswordPolicy(password: string) {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  if (password.length > 100) {
    throw new Error('Password must be 100 characters or fewer');
  }

  if (getPasswordCharacterGroups(password) < 2) {
    throw new Error('Password must include at least two character groups');
  }
}

function normalizeUserPayload(payload: Record<string, unknown>) {
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const username = String(payload.username || '').trim() || email.split('@')[0];
  const role = String(payload.role || 'user');

  if (!email) {
    throw new Error('Email is required');
  }

  assertPasswordPolicy(password);

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
