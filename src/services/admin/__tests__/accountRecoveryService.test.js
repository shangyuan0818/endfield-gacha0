import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseAccessToken } from '../../authFetchService.js';
import { fetchJsonWithTimeout, fetchWithTimeout } from '../../supabaseRequest.js';
import {
  loadAccountRecoveryRequests,
  resetRecoveryRequestPassword,
  updateAccountRecoveryRequest,
} from '../accountRecoveryService.js';

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

describe('accountRecoveryService same-origin API client', () => {
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
        requests: [
          {
            id: 'recovery-1',
            status: 'pending',
            handlerProfile: null,
          },
        ],
      },
    });
    fetchWithTimeout.mockResolvedValue(createJsonResponse({
      success: true,
      expiresAt: '2026-06-05T12:00:00.000Z',
    }));
  });

  it('loads recovery requests with same-origin cookies when no native token exists', async () => {
    await expect(loadAccountRecoveryRequests()).resolves.toEqual([
      {
        id: 'recovery-1',
        status: 'pending',
        handlerProfile: null,
      },
    ]);

    expect(getSupabaseAccessToken).toHaveBeenCalledWith({
      syncSiteSession: false,
      useSiteSessionCache: true,
      allowSiteSessionToken: false,
    });
    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/admin-account-recovery', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    }, expect.objectContaining({
      label: 'admin-account-recovery-load',
    }));
  });

  it('updates recovery request status through the same-origin route', async () => {
    fetchJsonWithTimeout.mockResolvedValue({
      response: {
        ok: true,
        status: 200,
      },
      data: {
        success: true,
        request: {
          id: 'recovery-1',
          status: 'verified',
        },
      },
    });

    await expect(updateAccountRecoveryRequest('recovery-1', {
      status: 'verified',
      admin_note: '身份已核验',
      handled_by: 'forged-admin-id',
    })).resolves.toEqual({
      id: 'recovery-1',
      status: 'verified',
    });

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/admin-account-recovery', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestId: 'recovery-1',
        status: 'verified',
        admin_note: '身份已核验',
      }),
    }, expect.objectContaining({
      label: 'admin-account-recovery-update',
    }));
  });

  it('sets a temporary password with same-origin cookies when no native token exists', async () => {
    await expect(resetRecoveryRequestPassword(
      'recovery-1',
      'target-user-id',
      'TempPass123',
      '线下核验'
    )).resolves.toEqual({
      success: true,
      expiresAt: '2026-06-05T12:00:00.000Z',
    });

    expect(fetchWithTimeout).toHaveBeenCalledWith('/api/admin-reset-recovery-password', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestId: 'recovery-1',
        userId: 'target-user-id',
        temporaryPassword: 'TempPass123',
        adminNote: '线下核验',
      }),
    }, expect.objectContaining({
      label: 'admin-reset-recovery-password',
    }));
  });

  it('uses a native Supabase token when one is available', async () => {
    getSupabaseAccessToken.mockResolvedValue('native-token');

    await loadAccountRecoveryRequests();

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/admin-account-recovery', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer native-token',
      },
    }, expect.any(Object));
  });
});
