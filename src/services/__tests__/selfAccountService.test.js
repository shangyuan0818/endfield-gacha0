import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteOwnAccount } from '../selfAccountService.js';
import { getSupabaseAccessToken } from '../authFetchService.js';
import { fetchWithTimeout } from '../supabaseRequest.js';

vi.mock('../authFetchService.js', () => ({
  getSupabaseAccessToken: vi.fn(),
}));

vi.mock('../supabaseRequest.js', () => ({
  fetchWithTimeout: vi.fn(),
}));

function createJsonResponse(payload, {
  ok = true,
  status = 200,
} = {}) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(payload),
  };
}

describe('selfAccountService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAccessToken.mockResolvedValue(null);
    fetchWithTimeout.mockResolvedValue(createJsonResponse({
      success: true,
      deleted: true,
    }));
  });

  it('deletes own account with same-origin cookies when no native token is available', async () => {
    await expect(deleteOwnAccount('current-password')).resolves.toEqual({
      success: true,
      deleted: true,
    });

    expect(getSupabaseAccessToken).toHaveBeenCalledWith({
      syncSiteSession: false,
      useSiteSessionCache: true,
      allowSiteSessionToken: false,
    });
    expect(fetchWithTimeout).toHaveBeenCalledWith('/api/self-delete-account', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: 'current-password',
      }),
    }, expect.objectContaining({
      label: 'self-delete-account',
    }));
  });

  it('adds Authorization only when a native Supabase token is available', async () => {
    getSupabaseAccessToken.mockResolvedValue('native-token');

    await deleteOwnAccount('current-password');

    expect(fetchWithTimeout).toHaveBeenCalledWith('/api/self-delete-account', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer native-token',
      },
      body: JSON.stringify({
        currentPassword: 'current-password',
      }),
    }, expect.any(Object));
  });

  it('surfaces self-delete errors', async () => {
    fetchWithTimeout.mockResolvedValue(createJsonResponse({
      success: false,
      error: '当前密码不正确',
    }, {
      ok: false,
      status: 403,
    }));

    await expect(deleteOwnAccount('wrong-password')).rejects.toThrow('当前密码不正确');
  });
});
