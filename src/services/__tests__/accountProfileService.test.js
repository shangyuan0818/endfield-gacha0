import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadCurrentAccountProfile,
  updateOwnUsername,
} from '../accountProfileService.js';
import { getSupabaseAccessToken } from '../authFetchService.js';
import { fetchJsonWithTimeout } from '../supabaseRequest.js';

vi.mock('../authFetchService.js', () => ({
  getSupabaseAccessToken: vi.fn(),
}));

vi.mock('../supabaseRequest.js', () => ({
  fetchJsonWithTimeout: vi.fn(),
}));

describe('accountProfileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAccessToken.mockResolvedValue(null);
    fetchJsonWithTimeout.mockResolvedValue({
      response: {
        ok: true,
        status: 200,
      },
      data: {
        success: true,
        source: 'site_session',
        profile: {
          id: 'user-1',
          username: '博士',
          role: 'admin',
        },
        user: {
          id: 'user-1',
          user_metadata: {
            username: '博士',
          },
          profile_role: 'admin',
        },
      },
    });
  });

  it('loads account profile with same-origin cookies when no native token is available', async () => {
    await expect(loadCurrentAccountProfile()).resolves.toEqual({
      source: 'site_session',
      profile: {
        id: 'user-1',
        username: '博士',
        role: 'admin',
      },
      user: {
        id: 'user-1',
        user_metadata: {
          username: '博士',
        },
        profile_role: 'admin',
      },
    });

    expect(getSupabaseAccessToken).toHaveBeenCalledWith({
      syncSiteSession: false,
      useSiteSessionCache: true,
      allowSiteSessionToken: false,
    });
    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/account-profile', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    }, expect.objectContaining({
      label: 'account-profile',
    }));
  });

  it('uses a native Supabase token when one is available', async () => {
    getSupabaseAccessToken.mockResolvedValue('native-token');

    await loadCurrentAccountProfile();

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/account-profile', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer native-token',
      },
    }, expect.any(Object));
  });

  it('updates username through the same-origin profile endpoint', async () => {
    fetchJsonWithTimeout.mockResolvedValue({
      response: {
        ok: true,
        status: 200,
      },
      data: {
        success: true,
        source: 'site_session',
        profile: {
          id: 'user-1',
          username: '新博士',
          role: 'user',
        },
        user: {
          id: 'user-1',
          user_metadata: {
            username: '新博士',
          },
        },
      },
    });

    await expect(updateOwnUsername({
      id: 'user-1',
      user_metadata: {
        username: '旧博士',
        theme: 'dark',
      },
    }, ' 新博士 ')).resolves.toEqual({
      id: 'user-1',
      user_metadata: {
        username: '新博士',
        theme: 'dark',
        display_name: '新博士',
      },
      profile_role: 'user',
    });

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/account-profile', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: '新博士',
      }),
    }, expect.objectContaining({
      label: 'account-profile-update',
    }));
  });

  it('throws a readable error when profile loading fails', async () => {
    fetchJsonWithTimeout.mockResolvedValue({
      response: {
        ok: false,
        status: 401,
      },
      data: {
        success: false,
        error: 'Missing access token',
        code: 'missing_access_token',
      },
    });

    await expect(loadCurrentAccountProfile()).rejects.toMatchObject({
      message: 'Missing access token',
      code: 'missing_access_token',
      status: 401,
    });
  });

  it('rejects username updates without a current user', async () => {
    await expect(updateOwnUsername(null, '新博士')).rejects.toThrow('当前登录态已失效');
    expect(fetchJsonWithTimeout).not.toHaveBeenCalled();
  });
});
