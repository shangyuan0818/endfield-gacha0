// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
  listMergedAdminUsers: vi.fn(),
  findAuthUserByEmail: vi.fn(),
  rejectDisallowedBrowserOrigin: vi.fn(() => false),
  requireSuperAdminUser: vi.fn(),
  parseRequestedJobIds: vi.fn(() => ['official-announcements']),
  runOpsAutomationJobs: vi.fn(),
  buildOpsAutomationHttpPayload: vi.fn((runResult = {}) => ({
    success: Boolean(runResult.ok),
    partial: Boolean(runResult.partial),
    jobGraph: Array.isArray(runResult.jobGraph) ? runResult.jobGraph : [],
    ...(runResult.results || {}),
  })),
}));

vi.mock('../_lib/authAdmin.js', () => ({
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
  listMergedAdminUsers: mocks.listMergedAdminUsers,
  findAuthUserByEmail: mocks.findAuthUserByEmail,
}));

vi.mock('../_lib/http.js', () => ({
  rejectDisallowedBrowserOrigin: mocks.rejectDisallowedBrowserOrigin,
  checkMemoryRateLimit: vi.fn(() => ({ allowed: true, retryAfter: 0 })),
  getRequesterKey: vi.fn(() => 'test-requester'),
}));

vi.mock('../_lib/siteAuth.js', () => ({
  requireSuperAdminUser: mocks.requireSuperAdminUser,
}));

vi.mock('../_lib/opsAutomation.js', () => ({
  parseRequestedJobIds: mocks.parseRequestedJobIds,
}));

vi.mock('../_lib/runOpsAutomation.js', () => ({
  runOpsAutomationJobs: mocks.runOpsAutomationJobs,
  buildOpsAutomationHttpPayload: mocks.buildOpsAutomationHttpPayload,
}));

import adminHandler from '../_routes/root/admin.js';

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
  url = 'https://example.com/api/admin',
  headers = { cookie: '__Host-eg_session=redacted' },
  body,
} = {}) {
  return {
    method,
    url,
    headers,
    body,
  };
}

function matchesFilters(row, filters) {
  return filters.every(({ op, column, value }) => {
    if (op === 'eq') return row?.[column] === value;
    if (op === 'in') return value.includes(row?.[column]);
    return true;
  });
}

class AdminQuery {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.operation = 'select';
    this.filters = [];
    this.payload = null;
    this.limitValue = null;
  }

  select(selection = '*') {
    this.selection = selection;
    return this;
  }

  update(payload) {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  upsert(payload, options) {
    this.operation = 'upsert';
    this.payload = payload;
    this.options = options;
    return Promise.resolve(this.client.__executeQuery(this));
  }

  eq(column, value) {
    this.filters.push({ op: 'eq', column, value });
    return this;
  }

  in(column, value) {
    this.filters.push({ op: 'in', column, value });
    return this;
  }

  order(column, options) {
    this.client.__state.orderCalls.push({ table: this.table, column, options });
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  maybeSingle() {
    return Promise.resolve(this.client.__executeQuery(this, { single: true }));
  }

  then(resolve, reject) {
    return Promise.resolve(this.client.__executeQuery(this)).then(resolve, reject);
  }
}

function createAdminClient() {
  const state = {
    orderCalls: [],
    calls: [],
    recoveryRequests: [
      {
        id: 'recovery-1',
        status: 'pending',
        admin_note: '',
        handled_by: 'handler-id',
        created_at: '2026-06-05T00:00:00.000Z',
      },
    ],
    publicProfiles: [
      {
        id: 'handler-id',
        username: '处理人',
        role: 'admin',
      },
    ],
    opsRuns: [
      {
        id: 'run-1',
        job_id: 'official-announcements',
        status: 'success',
        trigger_type: 'manual',
        created_at: '2026-06-05T01:00:00.000Z',
      },
      {
        id: 'run-2',
        job_id: 'pool-schedule',
        status: 'failed',
        trigger_type: 'cron',
        created_at: '2026-06-05T02:00:00.000Z',
      },
    ],
    profileUpserts: [],
    rpcCalls: [],
  };

  const createUser = vi.fn(async () => ({
    data: {
      user: {
        id: 'created-user-id',
      },
    },
    error: null,
  }));
  const deleteUser = vi.fn(async () => ({ error: null }));

  const adminClient = {
    from: vi.fn((table) => new AdminQuery(adminClient, table)),
    rpc: vi.fn(async (name, payload) => {
      state.rpcCalls.push({ name, payload });
      return {
        data: {
          id: payload.p_target_user_id,
          username: payload.p_username,
          role: payload.p_role,
        },
        error: null,
      };
    }),
    auth: {
      admin: {
        createUser,
        deleteUser,
      },
    },
    __executeQuery(query, { single = false } = {}) {
      state.calls.push({
        table: query.table,
        operation: query.operation,
        filters: [...query.filters],
        payload: query.payload,
        limitValue: query.limitValue,
      });

      if (query.table === 'account_recovery_requests') {
        if (query.operation === 'update') {
          let updated = null;
          state.recoveryRequests = state.recoveryRequests.map((row) => {
            if (!matchesFilters(row, query.filters)) return row;
            updated = { ...row, ...query.payload };
            return updated;
          });
          return { data: single ? updated : (updated ? [updated] : []), error: null };
        }
        const rows = state.recoveryRequests.filter(row => matchesFilters(row, query.filters));
        return { data: single ? rows[0] || null : rows, error: null };
      }

      if (query.table === 'public_profiles') {
        const rows = state.publicProfiles.filter(row => matchesFilters(row, query.filters));
        return { data: single ? rows[0] || null : rows, error: null };
      }

      if (query.table === 'ops_automation_runs') {
        const rows = state.opsRuns
          .filter(row => matchesFilters(row, query.filters))
          .slice(0, query.limitValue || state.opsRuns.length);
        return { data: single ? rows[0] || null : rows, error: null };
      }

      if (query.table === 'profiles' && query.operation === 'upsert') {
        state.profileUpserts.push({
          payload: query.payload,
          options: query.options,
        });
        return { data: Array.isArray(query.payload) ? query.payload : [query.payload], error: null };
      }

      throw new Error(`Unexpected table: ${query.table}`);
    },
    __state: state,
  };

  return adminClient;
}

function configureSuperAdmin(adminClient) {
  mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
  mocks.requireSuperAdminUser.mockResolvedValue({
    ok: true,
    user: { id: 'super-admin-id' },
    profile: { id: 'super-admin-id', role: 'super_admin' },
    adminClient,
  });
}

describe('site-session admin routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const adminClient = createAdminClient();
    configureSuperAdmin(adminClient);
  });

  it('loads account recovery requests and attaches handler public profiles', async () => {
    const adminClient = createAdminClient();
    configureSuperAdmin(adminClient);
    const req = createRequest({
      url: 'https://example.com/api/admin-account-recovery',
    });
    const res = createJsonResponseRecorder();

    await adminHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mocks.requireSuperAdminUser).toHaveBeenCalledWith(req, { adminClient });
    expect(res.body.requests).toEqual([
      expect.objectContaining({
        id: 'recovery-1',
        handlerProfile: {
          id: 'handler-id',
          username: '处理人',
          role: 'admin',
        },
      }),
    ]);
  });

  it('updates account recovery requests with the authenticated admin as handler', async () => {
    const adminClient = createAdminClient();
    configureSuperAdmin(adminClient);
    const req = createRequest({
      method: 'PATCH',
      url: 'https://example.com/api/admin-account-recovery',
      body: {
        requestId: 'recovery-1',
        status: 'verified',
        admin_note: '已核验',
        handled_by: 'forged-user-id',
      },
    });
    const res = createJsonResponseRecorder();

    await adminHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(adminClient.__state.calls.at(-1)).toMatchObject({
      table: 'account_recovery_requests',
      operation: 'update',
      filters: [{ op: 'eq', column: 'id', value: 'recovery-1' }],
      payload: expect.objectContaining({
        status: 'verified',
        admin_note: '已核验',
        handled_by: 'super-admin-id',
        handled_at: expect.any(String),
        updated_at: expect.any(String),
      }),
    });
    expect(JSON.stringify(adminClient.__state.calls.at(-1).payload)).not.toContain('forged-user-id');
  });

  it('loads filtered ops automation runs through the admin route', async () => {
    const adminClient = createAdminClient();
    configureSuperAdmin(adminClient);
    const req = createRequest({
      url: 'https://example.com/api/admin-ops-automation?jobId=official-announcements&status=success&triggerType=manual&limit=500',
    });
    const res = createJsonResponseRecorder();

    await adminHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.runs).toEqual([
      expect.objectContaining({
        id: 'run-1',
        job_id: 'official-announcements',
      }),
    ]);
    expect(adminClient.__state.calls.at(-1)).toMatchObject({
      table: 'ops_automation_runs',
      operation: 'select',
      limitValue: 200,
      filters: [
        { op: 'eq', column: 'job_id', value: 'official-announcements' },
        { op: 'eq', column: 'status', value: 'success' },
        { op: 'eq', column: 'trigger_type', value: 'manual' },
      ],
    });
  });

  it('creates users through the same-origin admin route', async () => {
    const adminClient = createAdminClient();
    configureSuperAdmin(adminClient);
    const req = createRequest({
      method: 'POST',
      url: 'https://example.com/api/admin-users',
      body: {
        email: 'new@example.com',
        password: 'TempPass123',
        username: '新用户',
        role: 'admin',
      },
    });
    const res = createJsonResponseRecorder();

    await adminHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(adminClient.auth.admin.createUser).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'TempPass123',
      email_confirm: true,
      user_metadata: {
        username: '新用户',
      },
    });
    expect(adminClient.__state.profileUpserts).toEqual([
      {
        payload: {
          id: 'created-user-id',
          username: '新用户',
          email: 'new@example.com',
          role: 'admin',
        },
        options: { onConflict: 'id' },
      },
    ]);
    expect(res.body.user).toMatchObject({
      id: 'created-user-id',
      email: 'new@example.com',
      username: '新用户',
      role: 'admin',
    });
  });

  it('updates user profiles through the same-origin admin route', async () => {
    const adminClient = createAdminClient();
    configureSuperAdmin(adminClient);
    const req = createRequest({
      method: 'PATCH',
      url: 'https://example.com/api/admin-users',
      body: {
        userId: 'target-user-id',
        username: '新名称',
        role: 'admin',
      },
    });
    const res = createJsonResponseRecorder();

    await adminHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(adminClient.__state.rpcCalls).toEqual([
      {
        name: 'admin_update_profile',
        payload: {
          p_target_user_id: 'target-user-id',
          p_username: '新名称',
          p_role: 'admin',
          p_actor_user_id: 'super-admin-id',
        },
      },
    ]);
    expect(res.body.profile).toMatchObject({
      id: 'target-user-id',
      username: '新名称',
      role: 'admin',
    });
  });
});
