import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../supabaseClient.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('../../supabaseRequest.js', () => ({
  fetchWithTimeout: vi.fn(),
}));

vi.mock('../../authFetchService.js', () => ({
  getSupabaseAccessToken: vi.fn(),
}));

vi.mock('../../../utils/appLogger.js', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { supabase } from '../../../supabaseClient.js';
import { getSupabaseAccessToken } from '../../authFetchService.js';
import { fetchWithTimeout } from '../../supabaseRequest.js';
import {
  invalidatePublicCache,
  subscribePublicCacheWarnings,
} from '../publicCacheService.js';

function mockJsonResponse(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn(async () => payload),
  };
}

describe('publicCacheService warning subscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'test-access-token',
        },
      },
    });
    getSupabaseAccessToken.mockResolvedValue('test-access-token');
  });

  it('notifies listeners when cache bump fails', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribePublicCacheWarnings(listener);
    fetchWithTimeout.mockResolvedValue(mockJsonResponse({
      success: false,
      error: 'cache bump failed',
    }, false, 500));

    const result = await invalidatePublicCache('stats', 'admin:test');

    expect(result.success).toBe(false);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'stats',
      reason: 'admin:test',
      error: 'cache bump failed',
    }));

    unsubscribe();
  });

  it('notifies listeners when analytics refresh is partial', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribePublicCacheWarnings(listener);
    fetchWithTimeout.mockResolvedValue(mockJsonResponse({
      success: true,
      analyticsRefresh: {
        ok: true,
        partial: true,
        warning: 'analytics_refresh_partial',
      },
    }));

    const result = await invalidatePublicCache('pools', 'admin:test');

    expect(result.success).toBe(true);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'pools',
      reason: 'admin:test',
      error: 'analytics_refresh_partial',
      analyticsRefresh: expect.objectContaining({
        partial: true,
        warning: 'analytics_refresh_partial',
      }),
    }));

    unsubscribe();
  });

  it('does not notify unsubscribed listeners', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribePublicCacheWarnings(listener);
    unsubscribe();
    fetchWithTimeout.mockResolvedValue(mockJsonResponse({
      success: true,
      analyticsRefresh: {
        ok: false,
        error: 'analytics_refresh_failed',
      },
    }));

    await invalidatePublicCache('public', 'admin:test');

    expect(listener).not.toHaveBeenCalled();
  });
});
