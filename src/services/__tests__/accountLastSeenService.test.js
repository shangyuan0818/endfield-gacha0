import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateAccountLastSeen } from '../accountLastSeenService.js';
import { getSupabaseAccessToken } from '../authFetchService.js';
import { fetchJsonWithTimeout } from '../supabaseRequest.js';

vi.mock('../authFetchService.js', () => ({
  getSupabaseAccessToken: vi.fn(),
}));

vi.mock('../supabaseRequest.js', () => ({
  fetchJsonWithTimeout: vi.fn(),
}));

describe('accountLastSeenService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAccessToken.mockResolvedValue(null);
    fetchJsonWithTimeout.mockResolvedValue({
      response: { ok: true, status: 200 },
      data: {
        success: true,
        updated: true,
        updatedAt: '2026-06-04T12:00:00.000Z',
        source: 'site_session',
      },
    });
  });

  it('updates last seen with a compatible Supabase token when one is available', async () => {
    getSupabaseAccessToken.mockResolvedValue('compat-token');

    await expect(updateAccountLastSeen()).resolves.toEqual({
      updated: true,
      updatedAt: '2026-06-04T12:00:00.000Z',
      source: 'site_session',
    });

    expect(getSupabaseAccessToken).toHaveBeenCalledWith({
      syncSiteSession: false,
      useSiteSessionCache: true,
      allowSiteSessionToken: false,
    });
    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/account-last-seen', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer compat-token',
      },
    }, expect.objectContaining({
      label: 'account-last-seen',
    }));
  });

  it('still calls the same-origin endpoint when auth only exists in HttpOnly cookies', async () => {
    await updateAccountLastSeen();

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/account-last-seen', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    }, expect.any(Object));
  });

  it('treats missing auth as a silent skip when auth is optional', async () => {
    fetchJsonWithTimeout.mockResolvedValue({
      response: { ok: false, status: 401 },
      data: {
        success: false,
        code: 'missing_access_token',
      },
    });

    await expect(updateAccountLastSeen()).resolves.toEqual({
      updated: false,
      skipped: true,
      reason: 'missing_access_token',
    });
  });

  it('throws when auth is required and the endpoint rejects the request', async () => {
    fetchJsonWithTimeout.mockResolvedValue({
      response: { ok: false, status: 401 },
      data: {
        success: false,
        error: 'Missing access token',
      },
    });

    await expect(updateAccountLastSeen({ requireAuth: true })).rejects.toThrow('Missing access token');
  });
});
