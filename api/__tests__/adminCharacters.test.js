// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
  rejectDisallowedBrowserOrigin: vi.fn(() => false),
  requireSuperAdminUser: vi.fn(),
  resolveCharacterAliasMap: vi.fn(async () => new Map()),
  serverWarn: vi.fn(),
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

vi.mock('../../shared/idAliasService.js', async () => {
  const actual = await vi.importActual('../../shared/idAliasService.js');
  return {
    ...actual,
    resolveCharacterAliasMap: mocks.resolveCharacterAliasMap,
  };
});

vi.mock('../_lib/serverLogger.js', () => ({
  serverLogger: {
    warn: mocks.serverWarn,
  },
}));

import adminCharactersHandler from '../_routes/root/admin-characters.js';

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
  url = '/api/admin-characters',
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
    if (filter.op === 'in') return filter.values.includes(row?.[filter.column]);
    return true;
  });
}

class AdminCharactersQuery {
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

  eq(column, value) {
    this.filters.push({ op: 'eq', column, value });
    return this;
  }

  in(column, values) {
    this.filters.push({ op: 'in', column, values });
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
    characters: [
      {
        id: 'char-1',
        name: '测试角色',
        rarity: 6,
        type: 'character',
        pool_config: { pools: [] },
      },
      {
        id: 'weapon_manual_test_weapon_abc123',
        name: '测试武器',
        rarity: 6,
        type: 'weapon',
        pool_config: { pools: ['weapon'] },
      },
    ],
  };

  const adminClient = {
    from: vi.fn((table) => new AdminCharactersQuery(adminClient, table)),
    rpc: vi.fn(async (name, payload) => {
      state.rpcCalls.push({ name, payload });
      if (name === 'admin_sync_character_with_aliases' && payload.p_character_id === 'char_fail') {
        return { data: null, error: new Error('sync failed') };
      }
      return { data: null, error: null };
    }),
    __executeQuery(query) {
      state.calls.push({
        table: query.table,
        operation: query.operation,
        filters: query.filters,
        payload: query.payload,
      });

      if (query.table !== 'characters') {
        throw new Error(`Unexpected table: ${query.table}`);
      }

      if (query.operation === 'delete') {
        state.characters = state.characters.filter(row => !matchesFilters(row, query.filters));
        return { data: null, error: null };
      }
      if (query.operation === 'update') {
        state.characters = state.characters.map(row => (
          matchesFilters(row, query.filters)
            ? { ...row, ...query.payload }
            : row
        ));
        return { data: null, error: null };
      }

      return {
        data: state.characters.filter(row => matchesFilters(row, query.filters)),
        error: null,
      };
    },
    __state: state,
  };

  return adminClient;
}

function configureSuperAdminAuth(adminClient) {
  mocks.requireSuperAdminUser.mockResolvedValue({
    ok: true,
    user: { id: 'super-admin-id' },
    profile: { id: 'super-admin-id', role: 'super_admin' },
    adminClient,
  });
}

describe('/api/admin-characters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveCharacterAliasMap.mockResolvedValue(new Map());
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    configureSuperAdminAuth(adminClient);
  });

  it('loads characters through the site-session admin path', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    configureSuperAdminAuth(adminClient);
    const req = createRequest({ url: '/api/admin-characters?mode=characters' });
    const res = createJsonResponseRecorder();

    await adminCharactersHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mocks.requireSuperAdminUser).toHaveBeenCalledWith(req, {
      adminClient,
      touch: true,
    });
    expect(res.body).toMatchObject({
      success: true,
      data: [
        expect.objectContaining({ id: 'char-1' }),
        expect.objectContaining({ id: 'weapon_manual_test_weapon_abc123' }),
      ],
    });
  });

  it('saves characters through the hardened alias RPC and blocks id edits', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    configureSuperAdminAuth(adminClient);
    const req = createRequest({
      method: 'POST',
      body: {
        action: 'saveCharacter',
        characterData: {
          id: 'char-2',
          name: '新角色',
          rarity: 6,
          type: 'character',
        },
      },
    });
    const res = createJsonResponseRecorder();

    await adminCharactersHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(adminClient.__state.rpcCalls).toEqual([
      expect.objectContaining({
        name: 'admin_upsert_character_with_aliases',
        payload: expect.objectContaining({
          p_character_id: 'char-2',
          p_insert_payload: expect.objectContaining({
            id: 'char-2',
            name: '新角色',
          }),
        }),
      }),
    ]);

    const blockedReq = createRequest({
      method: 'POST',
      body: {
        action: 'saveCharacter',
        characterData: {
          id: 'char-new',
          name: '改 ID',
        },
        existingCharacter: {
          id: 'char-old',
        },
      },
    });
    const blockedRes = createJsonResponseRecorder();

    await adminCharactersHandler(blockedReq, blockedRes);

    expect(blockedRes.statusCode).toBe(400);
    expect(blockedRes.body.code).toBe('character_id_change_blocked');
  });

  it('batch-updates pool config server-side before writing rows', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    configureSuperAdminAuth(adminClient);
    const req = createRequest({
      method: 'POST',
      body: {
        action: 'batchUpdateCharacters',
        characterIds: ['char-1'],
        batchEditForm: {
          is_limited: true,
          pools: {
            limited: true,
            standard: null,
            weapon: null,
          },
        },
      },
    });
    const res = createJsonResponseRecorder();

    await adminCharactersHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      updateCount: 1,
    });
    expect(adminClient.__state.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'characters',
        operation: 'update',
        filters: [{ op: 'eq', column: 'id', value: 'char-1' }],
        payload: expect.objectContaining({
          is_limited: true,
          pool_config: expect.objectContaining({
            pools: ['limited'],
            is_active_in_limited: true,
          }),
        }),
      }),
    ]));
  });

  it('syncs wiki items with alias resolution and manual placeholder reuse on the server', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    configureSuperAdminAuth(adminClient);
    mocks.resolveCharacterAliasMap.mockResolvedValue(new Map([
      ['char_wiki_existing', 'char-1'],
    ]));
    const req = createRequest({
      method: 'POST',
      body: {
        action: 'syncWikiItems',
        items: [
          {
            id: 'char_wiki_existing',
            name: '测试角色',
            rarity: 6,
            type: 'character',
          },
          {
            id: 'weapon_wiki_new',
            name: '测试武器',
            rarity: 6,
            type: 'weapon',
            _iconId: 'weapon_icon',
          },
        ],
      },
    });
    const res = createJsonResponseRecorder();

    await adminCharactersHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      newCount: 0,
      skippedCount: 2,
      errorCount: 0,
    });
    expect(adminClient.__state.rpcCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'admin_sync_character_with_aliases',
        payload: expect.objectContaining({
          p_character_id: 'char-1',
        }),
      }),
      expect.objectContaining({
        name: 'admin_sync_character_with_aliases',
        payload: expect.objectContaining({
          p_character_id: 'weapon_manual_test_weapon_abc123',
        }),
      }),
    ]));
  });

  it('rejects non-super-admin requests before returning private data', async () => {
    mocks.requireSuperAdminUser.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Super admin role required',
      code: 'super_admin_required',
    });
    const req = createRequest();
    const res = createJsonResponseRecorder();

    await adminCharactersHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      success: false,
      error: 'Super admin role required',
      code: 'super_admin_required',
    });
  });
});
