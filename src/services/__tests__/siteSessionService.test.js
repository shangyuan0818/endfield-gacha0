import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../../supabaseClient.js';
import { fetchJsonWithTimeout } from '../supabaseRequest.js';
import {
  bootstrapSiteSessionFromSupabaseToken,
  getCurrentSiteSession,
} from '../siteSessionService.js';

vi.mock('../../supabaseClient.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      setSession: vi.fn(),
    },
  },
}));

vi.mock('../supabaseRequest.js', () => ({
  fetchJsonWithTimeout: vi.fn(),
}));

describe('siteSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    supabase.auth.setSession.mockResolvedValue({ error: null });
  });

  it('bootstraps a site session from an explicit Supabase access token', async () => {
    fetchJsonWithTimeout.mockResolvedValue({
      response: { ok: true },
      data: {
        success: true,
        data: {
          bootstrapped: true,
          source: 'supabase',
        },
      },
    });

    const result = await bootstrapSiteSessionFromSupabaseToken('access-token');

    expect(result).toEqual({
      bootstrapped: true,
      authenticated: true,
      source: 'supabase',
    });
    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/auth/session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer access-token',
      },
    }, expect.objectContaining({
      label: 'auth-session-bootstrap',
    }));
  });

  it('uses the current Supabase session token when no token is passed', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'current-access-token',
        },
      },
    });
    fetchJsonWithTimeout.mockResolvedValue({
      response: { ok: true },
      data: {
        success: true,
        data: {
          bootstrapped: true,
          source: 'supabase',
        },
      },
    });

    await bootstrapSiteSessionFromSupabaseToken();

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/auth/session', expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer current-access-token',
      }),
    }), expect.any(Object));
  });

  it('syncs authenticated site sessions back to the Supabase client', async () => {
    fetchJsonWithTimeout.mockResolvedValue({
      response: { ok: true },
      data: {
        success: true,
        authenticated: true,
        data: {
          authenticated: true,
          user: {
            id: '00000000-0000-4000-8000-000000000001',
          },
          profile: {
            username: 'site_user',
          },
          identities: [],
          session: {
            id: 'site-session-id',
          },
          supabase: {
            accessToken: 'compat-access-token',
            tokenType: 'bearer',
            expiresIn: 3600,
            expiresAt: 1800000000,
          },
        },
      },
    });

    const result = await getCurrentSiteSession();

    expect(result.authenticated).toBe(true);
    expect(result.supabaseSessionSynced).toBe(true);
    expect(supabase.auth.setSession).toHaveBeenCalledWith(expect.objectContaining({
      access_token: 'compat-access-token',
      refresh_token: 'site_session_site-session-id',
      user: expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000001',
      }),
    }));
  });
});
