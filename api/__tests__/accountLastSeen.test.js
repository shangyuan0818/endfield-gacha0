// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rejectDisallowedBrowserOrigin: vi.fn(() => false),
  getSupabaseAdminClient: vi.fn(),
  resolveAuthenticatedRequestUser: vi.fn(),
}));

vi.mock('../_lib/http.js', () => ({
  rejectDisallowedBrowserOrigin: mocks.rejectDisallowedBrowserOrigin,
}));

vi.mock('../_lib/authAdmin.js', () => ({
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

vi.mock('../_lib/siteAuth.js', () => ({
  resolveAuthenticatedRequestUser: mocks.resolveAuthenticatedRequestUser,
}));

import accountLastSeenHandler from '../_routes/root/account-last-seen.js';

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
  method = 'POST',
  headers = { authorization: 'Bearer token' },
} = {}) {
  return {
    method,
    headers,
  };
}

function createAdminClient({ updateError = null } = {}) {
  const eq = vi.fn(async () => ({ error: updateError }));
  const update = vi.fn(() => ({ eq }));

  return {
    from: vi.fn((table) => {
      if (table !== 'profiles') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return { update };
    }),
    __lastSeenMocks: {
      update,
      eq,
    },
  };
}

describe('api/account-last-seen handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseAdminClient.mockReturnValue(createAdminClient());
    mocks.resolveAuthenticatedRequestUser.mockResolvedValue({
      ok: true,
      source: 'supabase',
      user: {
        id: 'user-1',
      },
    });
  });

  it('updates last_seen_at for a bearer-authenticated user', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest();
    const res = createJsonResponseRecorder();

    await accountLastSeenHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(mocks.resolveAuthenticatedRequestUser).toHaveBeenCalledWith(req, {
      adminClient,
      touch: true,
    });
    expect(adminClient.from).toHaveBeenCalledWith('profiles');
    expect(adminClient.__lastSeenMocks.update).toHaveBeenCalledWith({
      last_seen_at: expect.any(String),
    });
    expect(adminClient.__lastSeenMocks.eq).toHaveBeenCalledWith('id', 'user-1');
    expect(res.body).toMatchObject({
      success: true,
      updated: true,
      source: 'supabase',
    });
  });

  it('updates last_seen_at through the caller client when admin secrets are absent', async () => {
    const callerClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(null);
    mocks.resolveAuthenticatedRequestUser.mockResolvedValue({
      ok: true,
      source: 'supabase',
      user: {
        id: 'user-1',
      },
      callerClient,
    });

    const req = createRequest();
    const res = createJsonResponseRecorder();

    await accountLastSeenHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mocks.resolveAuthenticatedRequestUser).toHaveBeenCalledWith(req, {
      adminClient: null,
      touch: false,
    });
    expect(callerClient.__lastSeenMocks.update).toHaveBeenCalledWith({
      last_seen_at: expect.any(String),
    });
    expect(res.body).toMatchObject({
      success: true,
      updated: true,
      source: 'supabase',
    });
  });

  it('uses the site-session touch path without a second profile update', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    mocks.resolveAuthenticatedRequestUser.mockResolvedValue({
      ok: true,
      source: 'site_session',
      user: {
        id: 'user-1',
      },
    });

    const req = createRequest({
      headers: {
        cookie: '__Host-eg_session=redacted',
      },
    });
    const res = createJsonResponseRecorder();

    await accountLastSeenHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mocks.resolveAuthenticatedRequestUser).toHaveBeenCalledWith(req, {
      adminClient,
      touch: true,
    });
    expect(adminClient.from).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({
      success: true,
      updated: true,
      source: 'site_session',
    });
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

    await accountLastSeenHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: 'Missing access token',
      code: 'missing_access_token',
    });
  });
});
