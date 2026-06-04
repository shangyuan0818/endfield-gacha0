import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseAccessToken } from '../../authFetchService.js';
import { fetchJsonWithTimeout } from '../../supabaseRequest.js';
import {
  deleteAdminUserData,
  loadAdminUserData,
} from '../userDataService.js';

vi.mock('../../authFetchService.js', () => ({
  getSupabaseAccessToken: vi.fn(),
}));

vi.mock('../../supabaseRequest.js', () => ({
  fetchJsonWithTimeout: vi.fn(),
}));

describe('admin userDataService', () => {
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
        userId: 'target-user-id',
        pools: [
          {
            pool_id: 'pool-1',
          },
        ],
        history: [
          {
            record_id: 1,
          },
        ],
        historyMeta: {
          sampleLimit: 500,
          totalCount: 1,
          loadedCount: 1,
          isTruncated: false,
        },
      },
    });
  });

  it('loads admin user data with same-origin cookies when no native token is available', async () => {
    await expect(loadAdminUserData('target-user-id')).resolves.toEqual({
      userId: 'target-user-id',
      pools: [
        {
          pool_id: 'pool-1',
        },
      ],
      history: [
        {
          record_id: 1,
        },
      ],
      historyMeta: {
        sampleLimit: 500,
        totalCount: 1,
        loadedCount: 1,
        isTruncated: false,
      },
    });

    expect(getSupabaseAccessToken).toHaveBeenCalledWith({
      syncSiteSession: false,
      useSiteSessionCache: true,
      allowSiteSessionToken: false,
    });
    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/admin?route=user-data&userId=target-user-id', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    }, expect.objectContaining({
      label: 'admin-user-data-load',
    }));
  });

  it('uses a native Supabase token when one is available', async () => {
    getSupabaseAccessToken.mockResolvedValue('native-token');

    await loadAdminUserData('target-user-id');

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/admin?route=user-data&userId=target-user-id', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer native-token',
      },
    }, expect.any(Object));
  });

  it('deletes admin user data through the same-origin admin route', async () => {
    fetchJsonWithTimeout.mockResolvedValue({
      response: {
        ok: true,
        status: 200,
      },
      data: {
        success: true,
        action: 'deletePool',
        userId: 'target-user-id',
        poolId: 'pool-1',
      },
    });

    await expect(deleteAdminUserData({
      action: 'deletePool',
      userId: 'target-user-id',
      poolId: 'pool-1',
    })).resolves.toMatchObject({
      success: true,
      action: 'deletePool',
      poolId: 'pool-1',
    });

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/admin?route=user-data', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'deletePool',
        userId: 'target-user-id',
        poolId: 'pool-1',
      }),
    }, expect.objectContaining({
      label: 'admin-user-data-delete',
    }));
  });

  it('throws readable errors when the admin route rejects the request', async () => {
    fetchJsonWithTimeout.mockResolvedValue({
      response: {
        ok: false,
        status: 403,
      },
      data: {
        success: false,
        error: 'Super admin role required',
      },
    });

    await expect(loadAdminUserData('target-user-id')).rejects.toMatchObject({
      message: 'Super admin role required',
      code: 'admin_user_data_load_failed',
      status: 403,
    });
  });
});
