// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
  rejectDisallowedBrowserOrigin: vi.fn(() => false),
  requireSuperAdminUser: vi.fn(),
}));

vi.mock('../_lib/authAdmin.js', () => ({
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

vi.mock('../_lib/http.js', () => ({
  rejectDisallowedBrowserOrigin: mocks.rejectDisallowedBrowserOrigin,
}));

vi.mock('../_lib/siteAuth.js', () => ({
  requireSuperAdminUser: mocks.requireSuperAdminUser,
}));

import adminPoolsHandler from '../_routes/root/admin-pools.js';

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
  url = '/api/admin-pools',
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
  return filters.every((filter) => {
    if (filter.op === 'eq') return row?.[filter.column] === filter.value;
    return true;
  });
}

class AdminPoolsQuery {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.operation = 'select';
    this.filters = [];
    this.payload = null;
  }

  select(selection = '*') {
    this.selection = selection;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  update(payload) {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  upsert(payload, options = {}) {
    this.operation = 'upsert';
    this.payload = payload;
    this.options = options;
    return this;
  }

  eq(column, value) {
    this.filters.push({ op: 'eq', column, value });
    return this;
  }

  order() {
    return this;
  }

  then(resolve, reject) {
    return Promise.resolve(this.client.__executeQuery(this)).then(resolve, reject);
  }
}

function createAdminClient() {
  const state = {
    calls: [],
    rpcCalls: [],
    pools: [
      {
        pool_id: 'pool-1',
        name: '测试卡池',
        created_at: '2026-06-01T00:00:00.000Z',
      },
    ],
    characters: [
      {
        id: 'char-1',
        name: '测试角色',
        rarity: 6,
        type: 'character',
      },
    ],
    poolCharacters: [
      {
        pool_id: 'pool-1',
        character_id: 'char-1',
        is_up: true,
      },
    ],
    history: [
      {
        record_id: 1,
        pool_id: 'pool-1',
        rarity: 6,
        character_name: '测试角色',
        item_name: '测试角色',
        is_standard: true,
      },
      {
        record_id: 2,
        pool_id: 'pool-1',
        rarity: 6,
        character_name: '常驻角色',
        item_name: '常驻角色',
        is_standard: false,
      },
    ],
  };

  const adminClient = {
    from: vi.fn((table) => new AdminPoolsQuery(adminClient, table)),
    rpc: vi.fn(async (name, payload) => {
      state.rpcCalls.push({ name, payload });
      return { data: null, error: null };
    }),
    __executeQuery(query) {
      state.calls.push({
        table: query.table,
        operation: query.operation,
        filters: query.filters,
        payload: query.payload,
        options: query.options,
      });

      if (query.table === 'pools') {
        if (query.operation === 'delete') {
          state.pools = state.pools.filter((row) => !matchesFilters(row, query.filters));
          return { data: null, error: null };
        }
        return { data: state.pools.filter((row) => matchesFilters(row, query.filters)), error: null };
      }

      if (query.table === 'characters') {
        return { data: state.characters, error: null };
      }

      if (query.table === 'pool_characters') {
        if (query.operation === 'delete') {
          state.poolCharacters = state.poolCharacters.filter((row) => !matchesFilters(row, query.filters));
          return { data: null, error: null };
        }
        if (query.operation === 'upsert') {
          const rows = Array.isArray(query.payload) ? query.payload : [query.payload];
          state.poolCharacters.push(...rows);
          return { data: rows, error: null };
        }
        return { data: state.poolCharacters.filter((row) => matchesFilters(row, query.filters)), error: null };
      }

      if (query.table === 'history') {
        if (query.operation === 'update') {
          state.history = state.history.map((row) => (
            matchesFilters(row, query.filters)
              ? { ...row, ...query.payload }
              : row
          ));
          return { data: null, error: null };
        }
        return { data: state.history.filter((row) => matchesFilters(row, query.filters)), error: null };
      }

      throw new Error(`Unexpected table: ${query.table}`);
    },
    __state: state,
  };

  return adminClient;
}

function configureSuperAdminAuth(adminClient, userId = 'super-admin-id') {
  mocks.requireSuperAdminUser.mockResolvedValue({
    ok: true,
    user: { id: userId },
    profile: { id: userId, role: 'super_admin' },
    adminClient,
  });
}

describe('/api/admin-pools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    configureSuperAdminAuth(adminClient);
  });

  it('loads admin pool data through the site-session auth path', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    configureSuperAdminAuth(adminClient);
    const req = createRequest({ url: '/api/admin-pools?mode=pools' });
    const res = createJsonResponseRecorder();

    await adminPoolsHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mocks.requireSuperAdminUser).toHaveBeenCalledWith(req, {
      adminClient,
      touch: true,
    });
    expect(res.body).toMatchObject({
      success: true,
      data: [
        expect.objectContaining({
          pool_id: 'pool-1',
        }),
      ],
    });
  });

  it('creates manual pools on behalf of the authenticated super admin only', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    configureSuperAdminAuth(adminClient, 'real-super-admin');
    const req = createRequest({
      method: 'POST',
      body: {
        action: 'savePool',
        poolData: {
          name: '新卡池',
          type: 'limited',
          up_character: '测试角色',
          start_time: '2026-06-05T04:00:00.000Z',
          end_time: '2026-06-26T04:00:00.000Z',
          user_id: 'attacker-user',
        },
        editingPool: null,
        characters: [
          { id: 'char-1', name: '测试角色', type: 'character' },
        ],
        editingPoolCharacters: [
          { character_id: 'char-1', is_up: true },
        ],
      },
    });
    const res = createJsonResponseRecorder();

    await adminPoolsHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      isNew: true,
      addedCount: 1,
    });
    const rpcCall = adminClient.__state.rpcCalls.find((call) => call.name === 'admin_upsert_pool_with_aliases');
    expect(rpcCall).toBeTruthy();
    expect(rpcCall.payload.p_insert_payload).toMatchObject({
      name: '新卡池',
      user_id: 'real-super-admin',
    });
    expect(rpcCall.payload.p_insert_payload.user_id).not.toBe('attacker-user');
  });

  it('deletes pool roster rows before deleting the pool row', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    configureSuperAdminAuth(adminClient);
    const req = createRequest({
      method: 'DELETE',
      body: {
        poolId: 'pool-1',
      },
    });
    const res = createJsonResponseRecorder();

    await adminPoolsHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(adminClient.__state.calls.filter((call) => call.operation === 'delete')).toEqual([
      expect.objectContaining({
        table: 'pool_characters',
        filters: [{ op: 'eq', column: 'pool_id', value: 'pool-1' }],
      }),
      expect.objectContaining({
        table: 'pools',
        filters: [{ op: 'eq', column: 'pool_id', value: 'pool-1' }],
      }),
    ]);
  });

  it('recalculates limited pool off-rate flags server-side', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    configureSuperAdminAuth(adminClient);
    const req = createRequest({
      method: 'POST',
      body: {
        action: 'recalculateIsStandard',
        pools: [
          {
            pool_id: 'pool-1',
            type: 'limited',
            up_character: '测试角色',
          },
        ],
      },
    });
    const res = createJsonResponseRecorder();

    await adminPoolsHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      changedCount: 2,
    });
    expect(adminClient.__state.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'history',
        operation: 'update',
        payload: { is_standard: false },
        filters: [{ op: 'eq', column: 'record_id', value: 1 }],
      }),
      expect.objectContaining({
        table: 'history',
        operation: 'update',
        payload: { is_standard: true },
        filters: [{ op: 'eq', column: 'record_id', value: 2 }],
      }),
    ]));
  });

  it('rejects non-super-admin requests before returning pool data', async () => {
    mocks.requireSuperAdminUser.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Super admin role required',
      code: 'super_admin_required',
    });
    const req = createRequest();
    const res = createJsonResponseRecorder();

    await adminPoolsHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      success: false,
      error: 'Super admin role required',
      code: 'super_admin_required',
    });
  });
});
