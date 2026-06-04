// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ensureProfileForAuthUser: vi.fn(),
  getSupabaseAdminClient: vi.fn(),
  loadAuthUserById: vi.fn(),
  rejectDisallowedBrowserOrigin: vi.fn(() => false),
  resolveAuthenticatedRequestUser: vi.fn(),
}));

vi.mock('../_lib/authAdmin.js', () => ({
  ensureProfileForAuthUser: mocks.ensureProfileForAuthUser,
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
  loadAuthUserById: mocks.loadAuthUserById,
}));

vi.mock('../_lib/http.js', () => ({
  rejectDisallowedBrowserOrigin: mocks.rejectDisallowedBrowserOrigin,
}));

vi.mock('../_lib/siteAuth.js', () => ({
  resolveAuthenticatedRequestUser: mocks.resolveAuthenticatedRequestUser,
}));

import accountProfileHandler from '../_routes/root/account-profile.js';

function createJsonResponseRecorder() {
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

function createRequest({
  method = 'GET',
  headers = { cookie: '__Host-eg_session=redacted' },
  body,
} = {}) {
  return {
    method,
    headers,
    body,
  };
}

function createProfile(overrides = {}) {
  return {
    id: 'user-1',
    username: '博士',
    email: null,
    role: 'admin',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-02T00:00:00.000Z',
    last_seen_at: '2026-06-03T00:00:00.000Z',
    ...overrides,
  };
}

function createAdminClient({
  updateError = null,
  authUpdateError = null,
} = {}) {
  const state = {
    updatePayload: null,
    updateFilter: null,
    authUpdatePayload: null,
  };
  const updatedProfile = createProfile({
    username: '新博士',
    role: 'admin',
  });

  const query = {
    update: vi.fn((payload) => {
      state.updatePayload = payload;
      return query;
    }),
    eq: vi.fn((column, value) => {
      state.updateFilter = { column, value };
      return query;
    }),
    select: vi.fn(() => query),
    single: vi.fn(async () => ({
      data: updateError ? null : updatedProfile,
      error: updateError,
    })),
  };

  const updateUserById = vi.fn(async (_userId, payload) => {
    state.authUpdatePayload = payload;
    return authUpdateError
      ? { data: null, error: authUpdateError }
      : {
          data: {
            user: {
              id: 'user-1',
              email: null,
              user_metadata: payload.user_metadata,
            },
          },
          error: null,
        };
  });

  return {
    from: vi.fn((table) => {
      if (table !== 'profiles') {
        throw new Error(`Unexpected table: ${table}`);
      }
      return query;
    }),
    auth: {
      admin: {
        updateUserById,
      },
    },
    __state: state,
    __query: query,
    __updateUserById: updateUserById,
  };
}

describe('/api/account-profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseAdminClient.mockReturnValue(createAdminClient());
    mocks.resolveAuthenticatedRequestUser.mockResolvedValue({
      ok: true,
      source: 'site_session',
      user: {
        id: 'user-1',
        email: null,
        user_metadata: {
          username: '旧博士',
          site_session: true,
        },
      },
      profile: createProfile(),
    });
    mocks.loadAuthUserById.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      user_metadata: {
        username: '旧博士',
      },
    });
    mocks.ensureProfileForAuthUser.mockResolvedValue(createProfile());
  });

  it('loads the current account profile through the site-session auth path', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    const req = createRequest();
    const res = createJsonResponseRecorder();

    await accountProfileHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(mocks.resolveAuthenticatedRequestUser).toHaveBeenCalledWith(req, {
      adminClient,
      touch: true,
    });
    expect(mocks.ensureProfileForAuthUser).toHaveBeenCalledWith(
      adminClient,
      expect.objectContaining({ id: 'user-1' }),
      expect.objectContaining({ id: 'user-1' })
    );
    expect(res.body).toMatchObject({
      success: true,
      source: 'site_session',
      profile: {
        id: 'user-1',
        username: '博士',
        role: 'admin',
      },
      user: {
        id: 'user-1',
        profile_role: 'admin',
        user_metadata: {
          username: '博士',
          display_name: '博士',
        },
      },
    });
  });

  it('loads the auth user before ensuring profile for bearer-authenticated requests', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    mocks.resolveAuthenticatedRequestUser.mockResolvedValue({
      ok: true,
      source: 'supabase',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        user_metadata: {
          username: '旧博士',
        },
      },
      profile: null,
    });

    const req = createRequest({
      headers: {
        authorization: 'Bearer token',
      },
    });
    const res = createJsonResponseRecorder();

    await accountProfileHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mocks.loadAuthUserById).toHaveBeenCalledWith(adminClient, 'user-1');
    expect(mocks.ensureProfileForAuthUser).toHaveBeenCalledWith(
      adminClient,
      expect.objectContaining({ email: 'user@example.com' }),
      null
    );
  });

  it('updates only the authenticated user username and ignores forged ids', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    const req = createRequest({
      method: 'PATCH',
      body: {
        id: 'attacker',
        user_id: 'attacker',
        username: '新博士',
      },
    });
    const res = createJsonResponseRecorder();

    await accountProfileHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(adminClient.__state.updatePayload).toEqual({
      username: '新博士',
    });
    expect(adminClient.__state.updateFilter).toEqual({
      column: 'id',
      value: 'user-1',
    });
    expect(adminClient.__updateUserById).toHaveBeenCalledWith('user-1', {
      user_metadata: expect.objectContaining({
        username: '新博士',
        display_name: '新博士',
      }),
    });
    expect(res.body).toMatchObject({
      success: true,
      profile: {
        id: 'user-1',
        username: '新博士',
      },
      metadataSync: {
        attempted: true,
        ok: true,
      },
    });
  });

  it('does not fail profile update when auth metadata sync fails', async () => {
    const adminClient = createAdminClient({
      authUpdateError: {
        code: 'metadata_sync_failed',
        message: 'metadata update failed',
      },
    });
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    const req = createRequest({
      method: 'PATCH',
      body: {
        username: '新博士',
      },
    });
    const res = createJsonResponseRecorder();

    await accountProfileHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      profile: {
        username: '新博士',
      },
      metadataSync: {
        attempted: true,
        ok: false,
        code: 'metadata_sync_failed',
      },
    });
  });

  it('rejects invalid usernames before writing profile data', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    const req = createRequest({
      method: 'PATCH',
      body: {
        username: '!',
      },
    });
    const res = createJsonResponseRecorder();

    await accountProfileHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: 'Invalid username',
      code: 'too_short',
    });
    expect(adminClient.from).not.toHaveBeenCalled();
  });

  it('returns authentication errors without exposing private details', async () => {
    mocks.resolveAuthenticatedRequestUser.mockResolvedValue({
      ok: false,
      status: 401,
      error: 'Missing access token',
      code: 'missing_access_token',
    });

    const req = createRequest({ headers: {} });
    const res = createJsonResponseRecorder();

    await accountProfileHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: 'Missing access token',
      code: 'missing_access_token',
    });
  });
});
