import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../../supabaseClient.js';
import { getAuthFetchHeaders, getSupabaseAccessToken } from '../authFetchService.js';
import { getCurrentSiteSession } from '../siteSessionService.js';

vi.mock('../../supabaseClient.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('../siteSessionService.js', () => ({
  getCurrentSiteSession: vi.fn(),
}));

describe('authFetchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentSiteSession.mockResolvedValue({
      authenticated: false,
      supabase: null,
    });
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: null,
      },
    });
  });

  it('prefers the site-session Supabase-compatible token over stale Supabase client state', async () => {
    getCurrentSiteSession.mockResolvedValue({
      authenticated: true,
      supabase: {
        accessToken: 'site-session-token',
      },
    });
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'stale-supabase-token',
        },
      },
    });

    await expect(getSupabaseAccessToken()).resolves.toBe('site-session-token');
    expect(supabase.auth.getSession).not.toHaveBeenCalled();
  });

  it('falls back to the Supabase client token when no site session token exists', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'supabase-token',
        },
      },
    });

    await expect(getSupabaseAccessToken()).resolves.toBe('supabase-token');
  });

  it('throws the shared expired-session error when a required token is missing', async () => {
    await expect(getAuthFetchHeaders({}, { requireToken: true })).rejects.toThrow('当前登录已失效，请重新登录后重试');
  });
});
