// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createSupabaseAccessTokenClient: vi.fn(),
  getBearerToken: vi.fn(),
  getSupabaseAdminClient: vi.fn(),
  createSupabaseCompatAccessToken: vi.fn(),
  loadSiteSession: vi.fn(),
}));

vi.mock('../_lib/authAdmin.js', () => ({
  createSupabaseAccessTokenClient: mocks.createSupabaseAccessTokenClient,
  getBearerToken: mocks.getBearerToken,
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

vi.mock('../_lib/siteSession.js', () => ({
  createSupabaseCompatAccessToken: mocks.createSupabaseCompatAccessToken,
  loadSiteSession: mocks.loadSiteSession,
}));

import { resolveAuthenticatedRequestUser } from '../_lib/siteAuth.js';

describe('siteAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseAdminClient.mockReturnValue(null);
    mocks.getBearerToken.mockReturnValue(null);
    mocks.createSupabaseAccessTokenClient.mockReturnValue(null);
    mocks.createSupabaseCompatAccessToken.mockReturnValue(null);
    mocks.loadSiteSession.mockResolvedValue(null);
  });

  it('authenticates bearer tokens with the publishable-key client when no admin client exists', async () => {
    const callerClient = {
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: {
              id: 'user-1',
            },
          },
          error: null,
        })),
      },
    };
    mocks.getBearerToken.mockReturnValue('native-token');
    mocks.createSupabaseAccessTokenClient.mockReturnValue(callerClient);

    await expect(resolveAuthenticatedRequestUser({ headers: {} }, {
      adminClient: null,
    })).resolves.toMatchObject({
      ok: true,
      source: 'supabase',
      user: {
        id: 'user-1',
      },
      adminClient: null,
      callerClient,
      accessToken: 'native-token',
    });

    expect(mocks.loadSiteSession).not.toHaveBeenCalled();
    expect(callerClient.auth.getUser).toHaveBeenCalledWith('native-token');
  });

  it('still reports service configuration errors without admin client or bearer token', async () => {
    await expect(resolveAuthenticatedRequestUser({ headers: {} }, {
      adminClient: null,
    })).resolves.toMatchObject({
      ok: false,
      status: 503,
      code: 'auth_service_not_configured',
    });
  });
});
