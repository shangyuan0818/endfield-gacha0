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

    const cleanupOperations = [
      adminClient
        .from('announcements')
        .update({ created_by: null })
        .eq('created_by', normalizedUserId),
      adminClient
        .from('site_config')
        .update({ updated_by: null })
        .eq('updated_by', normalizedUserId),
      adminClient
        .from('puzzles')
        .update({ uploader_id: null })
        .eq('uploader_id', normalizedUserId)
    ];

    for (const operation of cleanupOperations) {
      const { error } = await operation;
      if (error) {
        throw error;
      }
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
