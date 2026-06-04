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
  url = 'https://example.com/api/admin-announcements',
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
    if (filter.op === 'is') return (row?.[filter.column] ?? null) === filter.value;
    if (filter.op === 'or' && filter.expression === 'source_id.is.null,source_id.eq.') {
      return String(row?.source_id ?? '').trim() === '';
    }
    return true;
  });
}

class AnnouncementQuery {
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

  insert(payload) {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload) {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column, value) {
    this.filters.push({ op: 'eq', column, value });
    return this;
  }

  is(column, value) {
    this.filters.push({ op: 'is', column, value });
    return this;
  }

  or(expression) {
    this.filters.push({ op: 'or', expression });
    return this;
  }

  order(column, options) {
    this.client.__state.orderCalls.push({ column, options });
    return this;
  }

  single() {
    return Promise.resolve(this.client.__executeQuery(this, { single: true }));
  }

  maybeSingle() {
    return Promise.resolve(this.client.__executeQuery(this, { single: true }));
  }

  then(resolve, reject) {
    return Promise.resolve(this.client.__executeQuery(this)).then(resolve, reject);
  }
}

function createProfileQuery(role = 'super_admin') {
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

function createAdminClient({
  role = 'super_admin',
  announcements = [
    {
      id: 'ann-1',
      title: '站内公告',
      content: '公告内容',
      version: '4.5.1',
      announcement_type: 'update',
      severity: 'info',
      is_active: true,
      priority: 10,
      source_id: null,
      updated_at: '2026-06-05T00:00:00.000Z',
    },
    {
      id: 'ann-empty-source',
      title: '旧站内公告',
      content: '旧公告内容',
      version: '4.5.0',
      announcement_type: 'temporary',
      severity: 'warning',
      is_active: true,
      priority: 9,
      source_id: '',
      updated_at: '2026-06-04T00:00:00.000Z',
    },
    {
      id: 'game-1',
      title: '游戏公告',
      content: '同步公告',
      source_id: 'game-bulletin:1',
      is_active: true,
      priority: 0,
    },
  ],
} = {}) {
  const state = {
    announcements: [...announcements],
    calls: [],
    orderCalls: [],
  };

  const adminClient = {
    from: vi.fn((table) => {
      if (table === 'profiles') {
        return createProfileQuery(role);
      }
      if (table === 'announcements') {
        return new AnnouncementQuery(adminClient, table);
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    __executeQuery(query, { single = false } = {}) {
      state.calls.push({
        table: query.table,
        operation: query.operation,
        filters: query.filters,
        payload: query.payload,
      });

      if (query.table !== 'announcements') {
        throw new Error(`Unexpected table: ${query.table}`);
      }

      if (query.operation === 'insert') {
        const row = {
          id: 'ann-created',
          created_at: '2026-06-05T01:00:00.000Z',
          ...query.payload,
        };
        state.announcements.push(row);
        return { data: single ? row : [row], error: null };
      }

      if (query.operation === 'update') {
        let updated = null;
        state.announcements = state.announcements.map((row) => {
          if (!matchesFilters(row, query.filters)) {
            return row;
          }
          updated = { ...row, ...query.payload };
          return updated;
        });
        return { data: single ? updated : (updated ? [updated] : []), error: null };
      }

      if (query.operation === 'delete') {
        const deleted = state.announcements.find(row => matchesFilters(row, query.filters)) || null;
        state.announcements = state.announcements.filter(row => !matchesFilters(row, query.filters));
        return { data: single ? deleted : (deleted ? [deleted] : []), error: null };
      }

      const rows = state.announcements.filter(row => matchesFilters(row, query.filters));
      return { data: single ? rows[0] || null : rows, error: null };
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

describe('/api/admin-announcements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    configureSuperAdminAuth(adminClient);
  });

  it('loads only manual site announcements through the site-session admin path', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    configureSuperAdminAuth(adminClient);
    const req = createRequest();
    const res = createJsonResponseRecorder();

    await adminHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mocks.requireSuperAdminUser).toHaveBeenCalledWith(req, {
      adminClient,
    });
    expect(adminClient.__state.calls).toEqual([
      expect.objectContaining({
        table: 'announcements',
        operation: 'select',
        filters: [{ op: 'or', expression: 'source_id.is.null,source_id.eq.' }],
      }),
    ]);
    expect(res.body.success).toBe(true);
    expect(res.body.announcements).toHaveLength(2);
    expect(res.body.announcements).toEqual([
      expect.objectContaining({
        id: 'ann-1',
        title: '站内公告',
        source_id: null,
      }),
      expect.objectContaining({
        id: 'ann-empty-source',
        title: '旧站内公告',
        source_id: null,
      }),
    ]);
  });

  it('creates, updates, toggles and deletes manual announcements only', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    configureSuperAdminAuth(adminClient);

    const createRes = createJsonResponseRecorder();
    await adminHandler(createRequest({
      method: 'POST',
      body: {
        title: '新公告',
        content: '新公告内容',
        version: '4.5.2',
        announcement_type: 'temporary',
        severity: 'warning',
        is_active: true,
        priority: 20,
      },
    }), createRes);

    expect(createRes.statusCode).toBe(200);
    expect(adminClient.__state.calls.at(-1)).toMatchObject({
      operation: 'insert',
      payload: expect.objectContaining({
        title: '新公告',
        content: '新公告内容',
        source_id: null,
        priority: 20,
      }),
    });

    const updateRes = createJsonResponseRecorder();
    await adminHandler(createRequest({
      method: 'PATCH',
      body: {
        id: 'ann-created',
        title: '改过的公告',
        content: '改过的内容',
        version: '4.5.2',
        priority: 21,
      },
    }), updateRes);

    expect(updateRes.statusCode).toBe(200);
    expect(adminClient.__state.calls.at(-1)).toMatchObject({
      operation: 'update',
      filters: [
        { op: 'eq', column: 'id', value: 'ann-created' },
        { op: 'or', expression: 'source_id.is.null,source_id.eq.' },
      ],
      payload: expect.objectContaining({
        title: '改过的公告',
        priority: 21,
      }),
    });

    const toggleRes = createJsonResponseRecorder();
    await adminHandler(createRequest({
      method: 'PATCH',
      body: {
        action: 'setActive',
        id: 'ann-created',
        isActive: false,
      },
    }), toggleRes);

    expect(toggleRes.statusCode).toBe(200);
    expect(adminClient.__state.calls.at(-1)).toMatchObject({
      operation: 'update',
      payload: expect.objectContaining({
        is_active: false,
      }),
    });

    const deleteRes = createJsonResponseRecorder();
    await adminHandler(createRequest({
      method: 'DELETE',
      body: {
        id: 'ann-created',
      },
    }), deleteRes);

    expect(deleteRes.statusCode).toBe(200);
    expect(adminClient.__state.calls.at(-1)).toMatchObject({
      operation: 'delete',
      filters: [
        { op: 'eq', column: 'id', value: 'ann-created' },
        { op: 'or', expression: 'source_id.is.null,source_id.eq.' },
      ],
    });
  });

  it('does not update synced game announcements from the manual admin route', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    configureSuperAdminAuth(adminClient);
    const req = createRequest({
      method: 'PATCH',
      body: {
        id: 'game-1',
        title: '不应修改',
      },
    });
    const res = createJsonResponseRecorder();

    await adminHandler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      error: 'Announcement not found',
    });
  });

  it('rejects non-super-admin requests before returning announcements', async () => {
    mocks.requireSuperAdminUser.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Super admin role required',
      code: 'super_admin_required',
    });
    const req = createRequest();
    const res = createJsonResponseRecorder();

    await adminHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      success: false,
      error: 'Super admin role required',
    });
  });
});
