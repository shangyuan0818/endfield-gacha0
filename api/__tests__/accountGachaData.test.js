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

import accountGachaDataHandler from '../_routes/root/account-gacha-data.js';

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
  url = '/api/account-gacha-data',
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

function createQuery(table, state) {
  const query = {
    table,
    selection: '',
    filters: [],
    operation: 'select',
    select: vi.fn((selection = '*') => {
      query.selection = selection;
      return query;
    }),
    delete: vi.fn(() => {
      query.operation = 'delete';
      state.deleteCalls.push({
        table,
        filters: query.filters,
      });
      return query;
    }),
    eq: vi.fn((column, value) => {
      query.filters.push({ op: 'eq', column, value });
      return query;
    }),
    not: vi.fn((column, op, value) => {
      query.filters.push({ op: 'not', column, value });
      return query;
    }),
    order: vi.fn(() => query),
    range: vi.fn(async () => {
      if (table === 'history' && query.selection.includes('seq_id')) {
        return { data: state.seqKeyRows, error: null };
      }
      if (table === 'history') {
        return { data: state.historyRows, error: null };
      }
      return { data: [], error: null };
    }),
    in: vi.fn(async (column, values) => {
      query.filters.push({ op: 'in', column, values });
      if (query.operation === 'delete') {
        return { data: null, error: null };
      }
      if (table === 'pool_id_aliases') {
        return { data: state.poolAliasRows, error: null };
      }
      if (table === 'character_id_aliases') {
        return { data: state.characterAliasRows, error: null };
      }
      return { data: [], error: null };
    }),
    then(resolve, reject) {
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    },
  };
  return query;
}

function createAdminClient() {
  const state = {
    historyRows: [
      {
        record_id: 'record-1',
        rarity: 6,
        is_standard: false,
        special_type: null,
        timestamp: '2026-06-05T12:00:00.000Z',
        pool_id: 'official_pool_alias',
        user_id: 'user-1',
        character_name: '弭弗',
        item_name: null,
        character_id: 'char_alias',
        batch_id: 'batch-1',
        seq_id: '1',
        pity: 120,
        is_new: true,
        is_free: false,
        game_uid: 'game-1',
        nick_name: '博士',
      },
    ],
    seqKeyRows: [
      {
        seq_id: '1',
        game_uid: 'game-1',
        pool_id: 'special_official_001',
      },
    ],
    poolAliasRows: [
      {
        id: 1,
        source: 'official_api',
        alias_id: 'official_pool_alias',
        pool_id: 'special_official_001',
        is_primary: true,
      },
    ],
    characterAliasRows: [
      {
        id: 2,
        source: 'official_api',
        alias_id: 'char_alias',
        character_id: 'char_official_001',
        is_primary: true,
      },
    ],
    upsertCalls: [],
    deleteCalls: [],
  };

  const client = {
    from: vi.fn((table) => ({
      select: (...args) => createQuery(table, state).select(...args),
      delete: () => createQuery(table, state).delete(),
      upsert: vi.fn(async (rows, options) => {
        state.upsertCalls.push({
          table,
          rows,
          options,
        });
        return { data: rows, error: null };
      }),
    })),
    __state: state,
  };

  return client;
}

describe('/api/account-gacha-data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseAdminClient.mockReturnValue(createAdminClient());
    mocks.resolveAuthenticatedRequestUser.mockResolvedValue({
      ok: true,
      source: 'site_session',
      user: {
        id: 'user-1',
      },
    });
  });

  it('loads current user history through the site-session auth path', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    const req = createRequest();
    const res = createJsonResponseRecorder();

    await accountGachaDataHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(mocks.resolveAuthenticatedRequestUser).toHaveBeenCalledWith(req, {
      adminClient,
      touch: true,
    });
    expect(res.body).toMatchObject({
      success: true,
      source: 'site_session',
      meta: {
        count: 1,
        truncated: false,
      },
      warnings: [],
    });
    expect(res.body.history).toEqual([
      expect.objectContaining({
        id: 'record-1',
        user_id: 'user-1',
        poolId: 'special_official_001',
        character_id: 'char_official_001',
        pity: 80,
        gameUid: 'game-1',
      }),
    ]);
  });

  it('loads current user history with the caller client when admin secrets are absent', async () => {
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
    const req = createRequest({
      headers: { authorization: 'Bearer native-token' },
    });
    const res = createJsonResponseRecorder();

    await accountGachaDataHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mocks.resolveAuthenticatedRequestUser).toHaveBeenCalledWith(req, {
      adminClient: null,
      touch: false,
    });
    expect(callerClient.from).toHaveBeenCalledWith('history');
    expect(res.body).toMatchObject({
      success: true,
      source: 'supabase',
      meta: {
        count: 1,
        truncated: false,
      },
    });
  });

  it('returns current user seq keys for import dedupe', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    const req = createRequest({
      url: '/api/account-gacha-data?mode=seq-keys&gameUid=game-1',
    });
    const res = createJsonResponseRecorder();

    await accountGachaDataHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      keys: [
        {
          seqId: '1',
          gameUid: 'game-1',
          poolId: 'special_official_001',
        },
      ],
      meta: {
        count: 1,
        truncated: false,
      },
    });
  });

  it('saves pools and history for the authenticated user, ignoring payload user ids', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    const req = createRequest({
      method: 'POST',
      body: {
        pools: [
          {
            id: 'official_pool_alias',
            user_id: 'attacker-user',
            name: '测试卡池',
            type: 'limited',
          },
        ],
        history: [
          {
            id: '1001',
            user_id: 'attacker-user',
            poolId: 'official_pool_alias',
            character_id: 'char_alias',
            name: '弭弗',
            rarity: 6,
            seqId: '1',
            gameUid: 'game-1',
            timestamp: '2026-06-05T12:00:00.000Z',
          },
        ],
      },
    });
    const res = createJsonResponseRecorder();

    await accountGachaDataHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      saved: {
        pools: 1,
        history: 1,
      },
    });

    const poolUpsert = adminClient.__state.upsertCalls.find(call => call.table === 'pools');
    const historyUpsert = adminClient.__state.upsertCalls.find(call => call.table === 'history');
    expect(poolUpsert).toMatchObject({
      options: { onConflict: 'pool_id' },
    });
    expect(poolUpsert.rows[0]).toMatchObject({
      user_id: 'user-1',
      pool_id: 'special_official_001',
    });
    expect(historyUpsert).toMatchObject({
      options: { onConflict: 'user_id,game_uid,pool_id,seq_id' },
    });
    expect(historyUpsert.rows[0]).toMatchObject({
      user_id: 'user-1',
      pool_id: 'special_official_001',
      character_id: 'char_official_001',
    });
  });

  it('resolves pool and character aliases through the authenticated endpoint', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    const req = createRequest({
      method: 'POST',
      body: {
        action: 'resolveAliases',
        poolIds: ['official_pool_alias'],
        characterIds: ['char_alias'],
      },
    });
    const res = createJsonResponseRecorder();

    await accountGachaDataHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      poolAliases: {
        official_pool_alias: 'special_official_001',
      },
      characterAliases: {
        char_alias: 'char_official_001',
      },
    });
  });

  it('deletes only authenticated user records by record id', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    const req = createRequest({
      method: 'DELETE',
      body: {
        action: 'records',
        recordIds: ['1', '2', '2', 'bad'],
      },
    });
    const res = createJsonResponseRecorder();

    await accountGachaDataHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      deleted: {
        history: 2,
        pools: 0,
      },
    });
    expect(adminClient.__state.deleteCalls[0]).toMatchObject({
      table: 'history',
    });
    expect(adminClient.__state.deleteCalls[0].filters).toEqual([
      { op: 'eq', column: 'user_id', value: 'user-1' },
      { op: 'in', column: 'record_id', values: [1, 2] },
    ]);
  });

  it('rejects unauthenticated requests without returning private rows', async () => {
    mocks.resolveAuthenticatedRequestUser.mockResolvedValue({
      ok: false,
      status: 401,
      error: 'Missing access token',
      code: 'missing_access_token',
    });

    const req = createRequest({ headers: {} });
    const res = createJsonResponseRecorder();

    await accountGachaDataHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: 'Missing access token',
      code: 'missing_access_token',
    });
  });
});
