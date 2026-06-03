// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rejectDisallowedBrowserOrigin: vi.fn(() => false),
  getSupabaseAdminClient: vi.fn(),
  loadAuthUserById: vi.fn(),
  findAuthUserByEmail: vi.fn(),
  resolveAuthenticatedRequestUser: vi.fn(),
}));

vi.mock('../_lib/http.js', () => ({
  rejectDisallowedBrowserOrigin: mocks.rejectDisallowedBrowserOrigin,
}));

vi.mock('../_lib/authAdmin.js', () => ({
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
  loadAuthUserById: mocks.loadAuthUserById,
  findAuthUserByEmail: mocks.findAuthUserByEmail,
}));

vi.mock('../_lib/siteAuth.js', () => ({
  resolveAuthenticatedRequestUser: mocks.resolveAuthenticatedRequestUser,
}));

import accountPasswordSetupHandler from '../_routes/root/account-password-setup.js';

function createResponseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

function createRequest(body = {}) {
  return {
    method: 'POST',
    headers: {
      authorization: 'Bearer token',
      origin: 'https://ef-gacha.mogujun.icu',
    },
    body,
  };
}

function createAdminClient({
  securityState,
  profile,
} = {}) {
  const updateUserById = vi.fn(async (_userId, payload) => ({
    data: {
      user: {
        id: 'user-1',
        email: payload.email || 'github.hash@oauth.local.invalid',
      },
    },
    error: null,
  }));
  const upserts = [];

  return {
    auth: {
      admin: {
        updateUserById,
        listUsers: vi.fn(async () => ({ data: { users: [] }, error: null })),
      },
    },
    from(table) {
      if (table === 'account_security_states') {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: securityState, error: null }),
                };
              },
            };
          },
          upsert(payload) {
            upserts.push(payload);
            return {
              select() {
                return {
                  maybeSingle: async () => ({ data: payload, error: null }),
                };
              },
            };
          },
        };
      }
      if (table === 'profiles') {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: profile, error: null }),
                };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    __mocks: {
      updateUserById,
      upserts,
    },
  };
}

describe('api/account-password-setup handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveAuthenticatedRequestUser.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
    });
    mocks.loadAuthUserById.mockResolvedValue({
      id: 'user-1',
      email: 'github.hash@oauth.local.invalid',
      user_metadata: {
        synthetic_oauth_email: true,
      },
    });
    mocks.findAuthUserByEmail.mockResolvedValue(null);
  });

  it('rejects first password setup until the user verifies a site email', async () => {
    const adminClient = createAdminClient({
      securityState: {
        password_change_required: true,
        password_change_reason: 'oauth_password_setup_required',
        email_verification_required: true,
        email_verification_verified_at: null,
      },
      profile: {
        id: 'user-1',
        email: null,
        role: 'user',
      },
    });
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    const res = createResponseRecorder();

    await accountPasswordSetupHandler(createRequest({ newPassword: 'StrongPass123' }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('verified_email_required');
    expect(adminClient.__mocks.updateUserById).not.toHaveBeenCalled();
  });

  it('sets a site password and syncs verified site email for OAuth users', async () => {
    const adminClient = createAdminClient({
      securityState: {
        password_change_required: true,
        password_change_reason: 'oauth_password_setup_required_existing',
        email_verification_required: false,
        email_verification_verified_at: '2026-06-03T00:00:00.000Z',
      },
      profile: {
        id: 'user-1',
        email: 'site-user@example.com',
        role: 'user',
      },
    });
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    const res = createResponseRecorder();

    await accountPasswordSetupHandler(createRequest({ newPassword: 'StrongPass123' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(adminClient.__mocks.updateUserById).toHaveBeenCalledWith('user-1', expect.objectContaining({
      password: 'StrongPass123',
      email: 'site-user@example.com',
      email_confirm: true,
      user_metadata: expect.objectContaining({
        synthetic_oauth_email: false,
        email_bound_from_profile: true,
        site_password_set: true,
      }),
    }));
    expect(adminClient.__mocks.upserts[0]).toMatchObject({
      user_id: 'user-1',
      password_change_required: false,
      password_change_reason: null,
    });
  });
});
