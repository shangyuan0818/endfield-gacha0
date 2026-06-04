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

import ticketsHandler from '../_routes/root/tickets.js';

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
  url = '/api/tickets',
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
    if (filter.op === 'gt') return new Date(row?.[filter.column] || 0).getTime() > new Date(filter.value || 0).getTime();
    if (filter.op === 'is') return row?.[filter.column] === filter.value;
    return true;
  });
}

class TicketsQuery {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.operation = 'select';
    this.filters = [];
    this.insertPayload = null;
    this.updatePatch = null;
    this.limitCount = null;
    this.selection = '*';
  }

  select(selection = '*') {
    this.selection = selection;
    return this;
  }

  insert(payload) {
    this.operation = 'insert';
    this.insertPayload = payload;
    return this;
  }

  update(patch) {
    this.operation = 'update';
    this.updatePatch = patch;
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

  gt(column, value) {
    this.filters.push({ op: 'gt', column, value });
    return this;
  }

  is(column, value) {
    this.filters.push({ op: 'is', column, value });
    return this;
  }

  order() {
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  maybeSingle() {
    return Promise.resolve(this.client.__executeQuery(this, { maybeSingle: true }));
  }

  single() {
    return Promise.resolve(this.client.__executeQuery(this, { maybeSingle: true }));
  }

  then(resolve, reject) {
    return Promise.resolve(this.client.__executeQuery(this)).then(resolve, reject);
  }
}

function createAdminClient({
  tableError = null,
} = {}) {
  const state = {
    profiles: [
      { id: 'user-1', username: 'user', role: 'user' },
      { id: 'user-2', username: 'other', role: 'user' },
      { id: 'admin-1', username: 'admin', role: 'admin' },
      { id: 'super-1', username: 'root', role: 'super_admin' },
    ],
    tickets: [
      {
        id: 'ticket-own',
        user_id: 'user-1',
        type: 'bug',
        title: '自己的问题',
        content: '导入失败',
        priority: 'medium',
        status: 'pending',
        target_role: 'admin',
        created_at: '2026-06-01T01:00:00.000Z',
        updated_at: '2026-06-01T01:00:00.000Z',
      },
      {
        id: 'ticket-other',
        user_id: 'user-2',
        type: 'question',
        title: '别人的问题',
        content: '无法登录',
        priority: 'low',
        status: 'processing',
        target_role: 'admin',
        created_at: '2026-06-01T02:00:00.000Z',
        updated_at: '2026-06-01T02:00:00.000Z',
      },
      {
        id: 'ticket-super',
        user_id: 'user-2',
        type: 'account',
        title: '给超管',
        content: '账号恢复',
        priority: 'high',
        status: 'pending',
        target_role: 'super_admin',
        created_at: '2026-06-01T03:00:00.000Z',
        updated_at: '2026-06-01T03:00:00.000Z',
      },
    ],
    replies: [
      {
        id: 'reply-visible',
        ticket_id: 'ticket-own',
        user_id: 'user-1',
        content: '补充说明',
        is_internal: false,
        created_at: '2026-06-01T04:00:00.000Z',
      },
      {
        id: 'reply-internal',
        ticket_id: 'ticket-own',
        user_id: 'admin-1',
        content: '内部备注',
        is_internal: true,
        created_at: '2026-06-01T05:00:00.000Z',
      },
    ],
    calls: [],
  };

  const adminClient = {
    state,
    from: vi.fn((table) => new TicketsQuery(adminClient, table)),
    __executeQuery(query, { maybeSingle = false } = {}) {
      state.calls.push({
        table: query.table,
        operation: query.operation,
        filters: query.filters,
        insertPayload: query.insertPayload,
        updatePatch: query.updatePatch,
      });

      if (tableError && query.table === 'tickets') {
        return { data: null, error: tableError };
      }

      if (query.table === 'profiles') {
        const rows = state.profiles.filter((row) => matchesFilters(row, query.filters));
        return { data: maybeSingle ? rows[0] || null : rows, error: null };
      }

      if (query.table === 'tickets') {
        if (query.operation === 'insert') {
          const inserted = {
            id: 'ticket-created',
            created_at: '2026-06-02T01:00:00.000Z',
            updated_at: '2026-06-02T01:00:00.000Z',
            ...query.insertPayload,
          };
          state.tickets.unshift(inserted);
          return { data: maybeSingle ? inserted : [inserted], error: null };
        }
        if (query.operation === 'update') {
          let updated = null;
          state.tickets = state.tickets.map((row) => {
            if (!matchesFilters(row, query.filters)) return row;
            updated = { ...row, ...query.updatePatch };
            return updated;
          });
          return { data: maybeSingle ? updated : updated ? [updated] : [], error: null };
        }
        const rows = state.tickets.filter((row) => matchesFilters(row, query.filters));
        return { data: maybeSingle ? rows[0] || null : rows.slice(0, query.limitCount || rows.length), error: null };
      }

      if (query.table === 'ticket_replies') {
        const rows = state.replies.filter((row) => matchesFilters(row, query.filters));
        return { data: rows.slice(0, query.limitCount || rows.length), error: null };
      }

      throw new Error(`Unexpected table: ${query.table}`);
    },
  };

  return adminClient;
}

function configureAuth({
  id = 'user-1',
  role = 'user',
} = {}) {
  mocks.resolveAuthenticatedRequestUser.mockResolvedValue({
    ok: true,
    source: 'site_session',
    user: { id },
    profile: { id, role },
  });
}

describe('/api/tickets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseAdminClient.mockReturnValue(createAdminClient());
    configureAuth();
  });

  it('lists only the current user tickets for a normal user', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    configureAuth({ id: 'user-1', role: 'user' });
    const req = createRequest();
    const res = createJsonResponseRecorder();

    await ticketsHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mocks.resolveAuthenticatedRequestUser).toHaveBeenCalledWith(req, {
      adminClient,
      touch: true,
    });
    expect(res.body).toMatchObject({
      success: true,
      tableExists: true,
      meta: {
        count: 1,
      },
    });
    expect(res.body.tickets.map((ticket) => ticket.id)).toEqual(['ticket-own']);
  });

  it('lets admins see admin-targeted tickets plus their own tickets', async () => {
    configureAuth({ id: 'admin-1', role: 'admin' });
    const req = createRequest();
    const res = createJsonResponseRecorder();

    await ticketsHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.tickets.map((ticket) => ticket.id)).toEqual(['ticket-own', 'ticket-other']);
  });

  it('supports updatedAfter filtering for ticket badges without direct browser table reads', async () => {
    configureAuth({ id: 'admin-1', role: 'admin' });
    const req = createRequest({
      url: '/api/tickets?updatedAfter=2026-06-01T01%3A30%3A00.000Z',
    });
    const res = createJsonResponseRecorder();

    await ticketsHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.tickets.map((ticket) => ticket.id)).toEqual(['ticket-other']);
  });

  it('creates tickets for the authenticated user and ignores payload user ids', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    configureAuth({ id: 'user-1', role: 'user' });
    const req = createRequest({
      method: 'POST',
      body: {
        user_id: 'attacker-user',
        type: 'bug',
        title: '  导入失败  ',
        content: '无法保存抽卡数据',
        priority: 'urgent',
        target_role: 'super_admin',
      },
    });
    const res = createJsonResponseRecorder();

    await ticketsHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ticket).toMatchObject({
      id: 'ticket-created',
      user_id: 'user-1',
      target_role: 'admin',
      status: 'pending',
      title: '导入失败',
    });
    const insertCall = adminClient.state.calls.find((call) => call.table === 'tickets' && call.operation === 'insert');
    expect(insertCall.insertPayload).not.toHaveProperty('attacker-user');
  });

  it('rejects owner status updates and only allows staff management', async () => {
    configureAuth({ id: 'user-1', role: 'user' });
    const req = createRequest({
      method: 'PATCH',
      body: {
        ticketId: 'ticket-own',
        status: 'resolved',
      },
    });
    const res = createJsonResponseRecorder();

    await ticketsHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      code: 'ticket_update_forbidden',
    });
  });

  it('allows admins to update admin-targeted ticket status', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    configureAuth({ id: 'admin-1', role: 'admin' });
    const req = createRequest({
      method: 'PATCH',
      body: {
        ticketId: 'ticket-other',
        status: 'resolved',
      },
    });
    const res = createJsonResponseRecorder();

    await ticketsHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ticket).toMatchObject({
      id: 'ticket-other',
      status: 'resolved',
      resolved_by: 'admin-1',
    });
  });

  it('hides internal replies from ticket owners', async () => {
    configureAuth({ id: 'user-1', role: 'user' });
    const req = createRequest({
      url: '/api/tickets?mode=replies&ticketId=ticket-own',
    });
    const res = createJsonResponseRecorder();

    await ticketsHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.replies.map((reply) => reply.id)).toEqual(['reply-visible']);
  });

  it('includes internal replies for staff who can manage the ticket', async () => {
    configureAuth({ id: 'admin-1', role: 'admin' });
    const req = createRequest({
      url: '/api/tickets?mode=replies&ticketId=ticket-own',
    });
    const res = createJsonResponseRecorder();

    await ticketsHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.replies.map((reply) => reply.id)).toEqual(['reply-visible', 'reply-internal']);
  });

  it('returns reply summaries only for tickets the caller can see', async () => {
    configureAuth({ id: 'user-1', role: 'user' });
    const req = createRequest({
      url: '/api/tickets?mode=reply-summaries&ticketIds=ticket-own,ticket-other',
    });
    const res = createJsonResponseRecorder();

    await ticketsHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.replies.map((reply) => reply.ticket_id)).toEqual(['ticket-own', 'ticket-own']);
    expect(res.body.meta).toMatchObject({
      allowedTicketCount: 1,
    });
  });

  it('returns a stable disabled state when the tickets table is missing', async () => {
    mocks.getSupabaseAdminClient.mockReturnValue(createAdminClient({
      tableError: {
        code: '42P01',
        message: 'relation "tickets" does not exist',
      },
    }));
    const req = createRequest();
    const res = createJsonResponseRecorder();

    await ticketsHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      tableExists: false,
      tickets: [],
    });
  });

  it('rejects unauthenticated requests without returning ticket rows', async () => {
    mocks.resolveAuthenticatedRequestUser.mockResolvedValue({
      ok: false,
      status: 401,
      error: 'Missing access token',
      code: 'missing_access_token',
    });
    const req = createRequest({ headers: {} });
    const res = createJsonResponseRecorder();

    await ticketsHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: 'Missing access token',
      code: 'missing_access_token',
    });
  });
});
