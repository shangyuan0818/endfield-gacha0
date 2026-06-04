import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseAccessToken } from '../../authFetchService.js';
import { fetchJsonWithTimeout, fetchWithTimeout } from '../../supabaseRequest.js';
import {
  createUser,
  deleteUser,
  loadUsers,
  resetUserPassword,
  updateUserProfile,
} from '../userService.js';

vi.mock('../../authFetchService.js', () => ({
  getSupabaseAccessToken: vi.fn(),
}));

vi.mock('../../supabaseRequest.js', () => ({
  fetchJsonWithTimeout: vi.fn(),
  fetchWithTimeout: vi.fn(),
}));

function createJsonResponse(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn(async () => payload),
  };
}

describe('admin userService same-origin API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAccessToken.mockResolvedValue(null);
    fetchWithTimeout.mockResolvedValue(createJsonResponse({
      success: true,
      users: [
        {
          id: 'user-1',
          username: '测试用户',
        },
      ],
    }));
    fetchJsonWithTimeout.mockResolvedValue({
      response: {
        ok: true,
        status: 200,
      },
      data: {
        success: true,
        profile: {
          id: 'user-1',
          username: '新名称',
          role: 'admin',
        },
      },
    });
  });

  it('loads users with same-origin cookies when no native token exists', async () => {
    await expect(loadUsers()).resolves.toEqual([
      {
        id: 'user-1',
        username: '测试用户',
      },
    ]);

    expect(getSupabaseAccessToken).toHaveBeenCalledWith({
      syncSiteSession: false,
      useSiteSessionCache: true,
      allowSiteSessionToken: false,
    });
    expect(fetchWithTimeout).toHaveBeenCalledWith('/api/admin-users', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    }, expect.objectContaining({
      label: 'admin-users',
    }));
  });

  it('updates profiles through the same-origin admin route', async () => {
    await expect(updateUserProfile('user-1', {
      username: '新名称',
      role: 'admin',
    })).resolves.toEqual({
      id: 'user-1',
      username: '新名称',
      role: 'admin',
    });

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/admin-users', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'user-1',
        username: '新名称',
        role: 'admin',
      }),
    }, expect.objectContaining({
      label: 'admin-update-profile',
    }));
  });

  it('creates users through the same-origin admin route', async () => {
    fetchWithTimeout.mockResolvedValue(createJsonResponse({
      success: true,
      user: {
        id: 'user-created',
        email: 'new@example.com',
      },
    }));

    await expect(createUser({
      email: 'new@example.com',
      password: 'TempPass123',
      username: '',
      role: 'user',
    })).resolves.toMatchObject({
      success: true,
      user: {
        id: 'user-created',
      },
    });

    expect(fetchWithTimeout).toHaveBeenCalledWith('/api/admin-users', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'new@example.com',
        password: 'TempPass123',
        username: 'new',
        role: 'user',
      }),
    }, expect.objectContaining({
      label: 'admin-create-user',
    }));
  });

  it('deletes users and resets passwords with same-origin cookies', async () => {
    fetchWithTimeout.mockResolvedValue(createJsonResponse({
      success: true,
    }));

    await expect(deleteUser('user-1')).resolves.toEqual({ success: true });
    await expect(resetUserPassword('user-1', 'TempPass123')).resolves.toEqual({ success: true });

    expect(fetchWithTimeout).toHaveBeenNthCalledWith(1, '/api/admin-delete-user', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: 'user-1' }),
    }, expect.objectContaining({
      label: 'admin-delete-user',
    }));
    expect(fetchWithTimeout).toHaveBeenNthCalledWith(2, '/api/admin-user-reset-password', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'user-1',
        temporaryPassword: 'TempPass123',
      }),
    }, expect.objectContaining({
      label: 'admin-user-reset-password',
    }));
  });

  it('uses a native Supabase token when one is available', async () => {
    getSupabaseAccessToken.mockResolvedValue('native-token');

    await loadUsers();

    expect(fetchWithTimeout).toHaveBeenCalledWith('/api/admin-users', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer native-token',
      },
    }, expect.any(Object));
  });
});
