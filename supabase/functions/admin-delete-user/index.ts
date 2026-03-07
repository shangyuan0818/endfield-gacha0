import { createCorsResponse, jsonResponse, requireSuperAdmin } from '../_shared/admin.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return createCorsResponse();
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Method not allowed' });
  }

  try {
    const { user: caller, adminClient } = await requireSuperAdmin(req);
    const { userId } = await req.json();
    const normalizedUserId = String(userId || '').trim();

    if (!normalizedUserId) {
      throw new Error('User ID is required');
    }

    if (normalizedUserId === caller.id) {
      throw new Error('Cannot delete current super admin');
    }

    const { error } = await adminClient.auth.admin.deleteUser(normalizedUserId);
    if (error) {
      throw error;
    }

    return jsonResponse(200, {
      success: true,
      userId: normalizedUserId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Delete user failed';
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
