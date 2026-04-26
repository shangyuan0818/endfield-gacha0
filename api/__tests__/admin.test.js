// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rejectDisallowedBrowserOrigin: vi.fn(() => false),
  checkMemoryRateLimit: vi.fn(() => ({ allowed: true, retryAfter: 0 })),
  getRequesterKey: vi.fn(() => 'test-requester'),
  getSupabaseAdminClient: vi.fn(),
  getBearerToken: vi.fn(() => 'token'),
  createSupabaseAccessTokenClient: vi.fn(),
  getSupabaseAnonServerClient: vi.fn(),
  listMergedAdminUsers: vi.fn(),
  parseRequestedJobIds: vi.fn(() => ['official-announcements']),
  runOpsAutomationJobs: vi.fn(),
}));

vi.mock('../_lib/http.js', () => ({
  rejectDisallowedBrowserOrigin: mocks.rejectDisallowedBrowserOrigin,
  checkMemoryRateLimit: mocks.checkMemoryRateLimit,
  getRequesterKey: mocks.getRequesterKey,
}));

vi.mock('../_lib/authAdmin.js', () => ({
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
  getBearerToken: mocks.getBearerToken,
  createSupabaseAccessTokenClient: mocks.createSupabaseAccessTokenClient,
  getSupabaseAnonServerClient: mocks.getSupabaseAnonServerClient,
  listMergedAdminUsers: mocks.listMergedAdminUsers,
}));

vi.mock('../_lib/opsAutomation.js', () => ({
  parseRequestedJobIds: mocks.parseRequestedJobIds,
}));

vi.mock('../_lib/runOpsAutomation.js', () => ({
  runOpsAutomationJobs: mocks.runOpsAutomationJobs,
}));

import handler from '../admin.js';

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

function createProfilesQuery(role = 'super_admin') {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: { id: 'super-admin-id', role },
          error: null,
        })),
      })),
    })),
  };
}

function createCleanupQuery() {
  return {
    update: vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null })),
    })),
  };
}

function createAdminClient({ role = 'super_admin', deleteError = null } = {}) {
  return {
    from: vi.fn((table) => {
      if (table === 'profiles') {
        return createProfilesQuery(role);
      }

      if (['announcements', 'site_config', 'puzzles'].includes(table)) {
        return createCleanupQuery();
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
    auth: {
      admin: {
        deleteUser: vi.fn(async () => ({ error: deleteError })),
        updateUserById: vi.fn(async () => ({ error: null })),
      },
    },
  };
}

function createApiKeyRevokeAdminClient({
  role = 'super_admin',
  revokedKey = {
    id: 'key-1',
    client_id: 'client-1',
    key_prefix: 'ek_live_test',
    label: 'primary',
    status: 'revoked',
    revoked_at: '2026-04-26T00:00:00.000Z',
  },
  revokeError = null,
} = {}) {
  const maybeSingle = vi.fn(async () => ({
    data: revokedKey,
    error: revokeError,
  }));
  const select = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));

  return {
    from: vi.fn((table) => {
      if (table === 'profiles') {
        return createProfilesQuery(role);
      }

      if (table === 'api_client_keys') {
        return { update };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
    __apiKeyRevokeMocks: {
      update,
      eq,
      select,
      maybeSingle,
    },
  };
}

function createRequest({
  method = 'GET',
  url = 'https://example.com/api/admin-users',
  body,
  headers = {},
} = {}) {
  return {
    method,
    url,
    body,
    headers,
  };
}

describe('api/admin handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseAccessTokenClient.mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'super-admin-id' } },
          error: null,
        })),
      },
    });
    mocks.getSupabaseAnonServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'super-admin-id' } },
          error: null,
        })),
      },
    });
  });

  it('returns merged users for the users route', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    mocks.listMergedAdminUsers.mockResolvedValue([
      { id: 'user-1', email: 'one@example.com' },
      { id: 'user-2', email: 'two@example.com' },
    ]);

    const req = createRequest({
      method: 'GET',
      url: 'https://example.com/api/admin-users',
      headers: { authorization: 'Bearer token' },
    });
    const res = createJsonResponseRecorder();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mocks.listMergedAdminUsers).toHaveBeenCalledWith(adminClient, { repairProfiles: true });
    expect(res.body).toEqual({
      success: true,
      users: [
        { id: 'user-1', email: 'one@example.com' },
        { id: 'user-2', email: 'two@example.com' },
      ],
    });
  });

  it('rejects deleting the current super admin', async () => {
    mocks.getSupabaseAdminClient.mockReturnValue(createAdminClient());

    const req = createRequest({
      method: 'POST',
      url: 'https://example.com/api/admin-delete-user',
      headers: { authorization: 'Bearer token' },
      body: { userId: 'super-admin-id' },
    });
    const res = createJsonResponseRecorder();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: 'Cannot delete current super admin',
    });
  });

  it('cleans up foreign keys before deleting a user', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest({
      method: 'POST',
      url: 'https://example.com/api/admin-delete-user',
      headers: { authorization: 'Bearer token' },
      body: { userId: 'target-user-id' },
    });
    const res = createJsonResponseRecorder();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(adminClient.from).toHaveBeenCalledWith('announcements');
    expect(adminClient.from).toHaveBeenCalledWith('site_config');
    expect(adminClient.from).toHaveBeenCalledWith('puzzles');
    expect(adminClient.auth.admin.deleteUser).toHaveBeenCalledWith('target-user-id');
    expect(res.body).toEqual({
      success: true,
      userId: 'target-user-id',
    });
  });

  it('revokes one developer API key from the admin route', async () => {
    const adminClient = createApiKeyRevokeAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest({
      method: 'POST',
      url: 'https://example.com/api/admin?route=api-clients-revoke-key',
      headers: { authorization: 'Bearer token' },
      body: { keyId: 'key-1' },
    });
    const res = createJsonResponseRecorder();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(adminClient.from).toHaveBeenCalledWith('api_client_keys');
    expect(adminClient.__apiKeyRevokeMocks.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'revoked',
      revoked_at: expect.any(String),
    }));
    expect(adminClient.__apiKeyRevokeMocks.eq).toHaveBeenCalledWith('id', 'key-1');
    expect(res.body).toMatchObject({
      success: true,
      key: {
        id: 'key-1',
        client_id: 'client-1',
        key_prefix: 'ek_live_test',
        status: 'revoked',
      },
    });
    expect(JSON.stringify(res.body)).not.toContain('key_hash');
  });

  it('rejects API key revoke without keyId', async () => {
    mocks.getSupabaseAdminClient.mockReturnValue(createApiKeyRevokeAdminClient());

    const req = createRequest({
      method: 'POST',
      url: 'https://example.com/api/admin?route=api-clients-revoke-key',
      headers: { authorization: 'Bearer token' },
      body: {},
    });
    const res = createJsonResponseRecorder();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: 'Missing keyId',
    });
  });
});
