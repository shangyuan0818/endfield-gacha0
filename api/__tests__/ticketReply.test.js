// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rejectDisallowedBrowserOrigin: vi.fn(() => false),
  checkMemoryRateLimit: vi.fn(() => ({ allowed: true, retryAfter: 0 })),
  getRequesterKey: vi.fn(() => 'ticket-reply-requester'),
  getBearerToken: vi.fn(() => 'access-token'),
  createSupabaseAccessTokenClient: vi.fn(),
  ensureProfileForAuthUser: vi.fn(),
  getSupabaseAdminClient: vi.fn(),
  resolveAuthenticatedRequestUser: vi.fn(),
  getRequesterIp: vi.fn(() => '203.0.113.20'),
  enqueueMailOutboxEvent: vi.fn(),
}));

vi.mock('../_lib/http.js', () => ({
  rejectDisallowedBrowserOrigin: mocks.rejectDisallowedBrowserOrigin,
  checkMemoryRateLimit: mocks.checkMemoryRateLimit,
  getRequesterKey: mocks.getRequesterKey,
}));

vi.mock('../_lib/authAdmin.js', () => ({
  createSupabaseAccessTokenClient: mocks.createSupabaseAccessTokenClient,
  ensureProfileForAuthUser: mocks.ensureProfileForAuthUser,
  getBearerToken: mocks.getBearerToken,
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

vi.mock('../_lib/siteAuth.js', () => ({
  resolveAuthenticatedRequestUser: mocks.resolveAuthenticatedRequestUser,
}));

vi.mock('../_lib/authSecurityGuards.js', () => ({
  getRequesterIp: mocks.getRequesterIp,
}));

vi.mock('../_lib/mailOutbox.js', () => ({
  enqueueMailOutboxEvent: mocks.enqueueMailOutboxEvent,
}));

import handler from '../_routes/root/ticket-reply.js';

function createJsonResponseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    getHeader(name) {
      return this.headers[name];
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
  body = {
    ticketId: 'ticket-1',
    content: '管理员已回复，请查看。',
    locale: 'zh-CN',
  },
  headers = {
    authorization: 'Bearer access-token',
    origin: 'https://ef-gacha.mogujun.icu',
    'x-forwarded-for': '203.0.113.20',
  },
} = {}) {
  return {
    method: 'POST',
    url: 'https://example.com/api/tickets/reply',
    body,
    headers,
    socket: {
      remoteAddress: '127.0.0.1',
    },
  };
}

class TicketReplyQuery {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.operation = 'select';
    this.patch = null;
    this.insertPayload = null;
    this.filters = [];
  }

  select() {
    return this;
  }

  insert(payload) {
    this.operation = 'insert';
    this.insertPayload = payload;
    return this;
  }

  update(patch) {
    this.operation = 'update';
    this.patch = patch;
    return this;
  }

  eq(field, value) {
    this.filters.push({ field, value });
    return this;
  }

  limit() {
    return Promise.resolve(this.client.__executeQuery(this));
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

function matchesFilters(row, filters) {
  return filters.every((filter) => row?.[filter.field] === filter.value);
}

function createTicketReplyAdminClient({
  callerProfile = {
    id: 'admin-user-id',
    email: 'admin@example.com',
    username: 'admin',
    role: 'admin',
  },
  ownerProfile = {
    id: 'ticket-owner-id',
    email: 'ticket.owner@example.com',
    username: 'owner',
    role: 'user',
  },
  ticket = {
    id: 'ticket-1',
    user_id: 'ticket-owner-id',
    title: '导入失败',
    status: 'processing',
    target_role: 'admin',
    created_at: '2026-06-10T01:00:00.000Z',
    updated_at: '2026-06-10T01:30:00.000Z',
  },
  ticketUpdateError = null,
  mailRuntimeConfig = null,
} = {}) {
  const state = {
    profiles: [callerProfile, ownerProfile].filter(Boolean),
    tickets: ticket ? [ticket] : [],
    replies: [],
    siteConfig: mailRuntimeConfig
      ? [{
        key: 'mail_runtime_config',
        value: JSON.stringify(mailRuntimeConfig),
        updated_at: '2026-06-12T00:00:00.000Z',
        updated_by: 'admin-user-id',
      }]
      : [],
    calls: [],
  };

  const adminClient = {
    state,
    from: vi.fn((table) => new TicketReplyQuery(adminClient, table)),
    __executeQuery(query, { maybeSingle = false } = {}) {
      state.calls.push({
        table: query.table,
        operation: query.operation,
        filters: query.filters,
        patch: query.patch,
        insertPayload: query.insertPayload,
      });

      if (query.table === 'profiles') {
        const rows = state.profiles.filter((row) => matchesFilters(row, query.filters));
        return { data: maybeSingle ? rows[0] || null : rows, error: null };
      }

      if (query.table === 'tickets') {
        if (query.operation === 'update') {
          if (ticketUpdateError) {
            return { data: null, error: ticketUpdateError };
          }

          state.tickets = state.tickets.map((row) => (
            matchesFilters(row, query.filters) ? { ...row, ...query.patch } : row
          ));
          return { data: null, error: null };
        }

        const rows = state.tickets.filter((row) => matchesFilters(row, query.filters));
        return { data: maybeSingle ? rows[0] || null : rows, error: null };
      }

      if (query.table === 'ticket_replies') {
        if (query.operation !== 'insert') {
          throw new Error(`Unexpected ticket_replies operation: ${query.operation}`);
        }

        const inserted = {
          id: 'reply-1',
          ticket_id: query.insertPayload.ticket_id,
          user_id: query.insertPayload.user_id,
          content: query.insertPayload.content,
          is_internal: Boolean(query.insertPayload.is_internal),
          created_at: '2026-06-10T02:00:00.000Z',
        };
        state.replies.push(inserted);
        return { data: maybeSingle ? inserted : [inserted], error: null };
      }

      if (query.table === 'site_config') {
        const rows = state.siteConfig.filter((row) => matchesFilters(row, query.filters));
        return { data: maybeSingle ? rows[0] || null : rows, error: null };
      }

      throw new Error(`Unexpected table: ${query.table}`);
    },
  };

  return adminClient;
}

function configureCaller(userId = 'admin-user-id') {
  mocks.resolveAuthenticatedRequestUser.mockResolvedValue({
    ok: true,
    user: {
      id: userId,
      email: `${userId}@example.com`,
    },
  });
  mocks.createSupabaseAccessTokenClient.mockReturnValue({
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: {
            id: userId,
            email: `${userId}@example.com`,
          },
        },
        error: null,
      })),
    },
  });
}

function withTicketMailEnv(callback) {
  return async () => {
    const keys = [
      'TICKET_REPLY_MAIL_OUTBOX_ENABLED',
      'MAIL_OUTBOX_WORKER_ENABLED',
      'MAIL_WORKER_ENABLED',
    ];
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

    process.env.TICKET_REPLY_MAIL_OUTBOX_ENABLED = 'true';
    process.env.MAIL_OUTBOX_WORKER_ENABLED = 'true';

    try {
      await callback();
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  };
}

describe('api/tickets/reply handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TICKET_REPLY_MAIL_OUTBOX_ENABLED;
    delete process.env.MAIL_OUTBOX_WORKER_ENABLED;
    delete process.env.MAIL_WORKER_ENABLED;
    configureCaller();
    mocks.ensureProfileForAuthUser.mockResolvedValue({
      id: 'admin-user-id',
      email: 'admin@example.com',
      username: 'admin',
      role: 'user',
    });
    mocks.enqueueMailOutboxEvent.mockResolvedValue({
      ok: true,
      queued: true,
      action: 'queue',
      code: 'mail_outbox_queued',
      outboxId: 'outbox-1',
    });
  });

  it('saves a staff ticket reply and queues a redacted mail notification when enabled', withTicketMailEnv(async () => {
    const adminClient = createTicketReplyAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest();
    const res = createJsonResponseRecorder();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(adminClient.state.replies).toEqual([
      expect.objectContaining({
        ticket_id: 'ticket-1',
        user_id: 'admin-user-id',
        content: '管理员已回复，请查看。',
        is_internal: false,
      }),
    ]);
    expect(mocks.enqueueMailOutboxEvent).toHaveBeenCalledWith(expect.objectContaining({
      adminClient,
      eventType: 'ticket_reply',
      recipientEmail: 'ticket.owner@example.com',
      requesterIp: '203.0.113.20',
      userId: 'admin-user-id',
      templateKey: 'ticket.reply',
      locale: 'zh-CN',
      relatedEntityType: 'ticket',
      relatedEntityId: 'ticket-1',
      purposeKey: 'reply-1',
      payload: expect.objectContaining({
        actorRole: 'admin',
        ticketStatus: 'processing',
        replyId: 'reply-1',
      }),
    }));
    expect(res.body).toMatchObject({
      success: true,
      partial: false,
      reply: {
        id: 'reply-1',
        ticket_id: 'ticket-1',
        is_internal: false,
      },
      mailNotification: {
        enabled: true,
        attempted: true,
        status: 'queued',
        code: 'mail_outbox_queued',
        outboxId: 'outbox-1',
      },
    });
    expect(JSON.stringify(res.body)).not.toContain('ticket.owner@example.com');
    expect(JSON.stringify(res.body)).not.toContain('decision');
  }));

  it('moves a pending ticket to processing when staff replies', withTicketMailEnv(async () => {
    const adminClient = createTicketReplyAdminClient({
      ticket: {
        id: 'ticket-1',
        user_id: 'ticket-owner-id',
        title: '导入失败',
        status: 'pending',
        target_role: 'admin',
        created_at: '2026-06-10T01:00:00.000Z',
        updated_at: '2026-06-10T01:30:00.000Z',
      },
    });
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest();
    const res = createJsonResponseRecorder();

    await handler(req, res);

    const ticketUpdateCall = adminClient.state.calls.find((call) => (
      call.table === 'tickets' && call.operation === 'update'
    ));
    expect(ticketUpdateCall?.patch).toMatchObject({
      status: 'processing',
    });
    expect(adminClient.state.tickets[0]).toMatchObject({
      id: 'ticket-1',
      status: 'processing',
    });
    expect(mocks.enqueueMailOutboxEvent).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        ticketStatus: 'processing',
      }),
    }));
    expect(res.body).toMatchObject({
      success: true,
      partial: false,
      ticket: {
        id: 'ticket-1',
        status: 'processing',
        previousStatus: 'pending',
        statusChanged: true,
      },
    });
  }));

  it('keeps user self replies private and does not enqueue ticket mail', withTicketMailEnv(async () => {
    configureCaller('ticket-owner-id');
    const adminClient = createTicketReplyAdminClient({
      callerProfile: {
        id: 'ticket-owner-id',
        email: 'ticket.owner@example.com',
        username: 'owner',
        role: 'user',
      },
      ticket: {
        id: 'ticket-1',
        user_id: 'ticket-owner-id',
        title: '导入失败',
        status: 'pending',
        target_role: 'admin',
        created_at: '2026-06-10T01:00:00.000Z',
        updated_at: '2026-06-10T01:30:00.000Z',
      },
    });
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest({
      body: {
        ticketId: 'ticket-1',
        content: '我补充一下复现步骤。',
      },
    });
    const res = createJsonResponseRecorder();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const ticketUpdateCall = adminClient.state.calls.find((call) => (
      call.table === 'tickets' && call.operation === 'update'
    ));
    expect(ticketUpdateCall?.patch).not.toHaveProperty('status');
    expect(adminClient.state.tickets[0]).toMatchObject({
      id: 'ticket-1',
      status: 'pending',
    });
    expect(mocks.enqueueMailOutboxEvent).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({
      success: true,
      ticket: {
        id: 'ticket-1',
        status: 'pending',
        previousStatus: 'pending',
        statusChanged: false,
      },
      mailNotification: {
        enabled: true,
        attempted: false,
        status: 'skipped',
        code: 'ticket_reply_mail_only_for_staff_reply',
      },
    });
  }));

  it('saves staff internal notes without updating the ticket or sending mail', withTicketMailEnv(async () => {
    const adminClient = createTicketReplyAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest({
      body: {
        ticketId: 'ticket-1',
        content: '内部排查：怀疑是历史数据格式问题。',
        isInternal: true,
        locale: 'zh-CN',
      },
    });
    const res = createJsonResponseRecorder();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(adminClient.state.replies).toEqual([
      expect.objectContaining({
        ticket_id: 'ticket-1',
        user_id: 'admin-user-id',
        content: '内部排查：怀疑是历史数据格式问题。',
        is_internal: true,
      }),
    ]);
    expect(adminClient.state.calls.some((call) => call.table === 'tickets' && call.operation === 'update')).toBe(false);
    expect(mocks.enqueueMailOutboxEvent).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({
      success: true,
      partial: false,
      reply: {
        id: 'reply-1',
        ticket_id: 'ticket-1',
        is_internal: true,
      },
      ticket: {
        id: 'ticket-1',
        status: 'processing',
        previousStatus: 'processing',
        statusChanged: false,
      },
      mailNotification: {
        enabled: true,
        attempted: false,
        status: 'skipped',
        code: 'ticket_internal_note_no_mail',
      },
    });
  }));

  it('rejects internal notes from normal ticket owners', withTicketMailEnv(async () => {
    configureCaller('ticket-owner-id');
    const adminClient = createTicketReplyAdminClient({
      callerProfile: {
        id: 'ticket-owner-id',
        email: 'ticket.owner@example.com',
        username: 'owner',
        role: 'user',
      },
    });
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest({
      body: {
        ticketId: 'ticket-1',
        content: '我不应该能写内部备注。',
        isInternal: true,
      },
    });
    const res = createJsonResponseRecorder();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      code: 'ticket_internal_note_forbidden',
    });
    expect(adminClient.state.replies).toEqual([]);
    expect(mocks.enqueueMailOutboxEvent).not.toHaveBeenCalled();
  }));

  it('moves owner replies on resolved tickets back to pending', withTicketMailEnv(async () => {
    configureCaller('ticket-owner-id');
    const adminClient = createTicketReplyAdminClient({
      callerProfile: {
        id: 'ticket-owner-id',
        email: 'ticket.owner@example.com',
        username: 'owner',
        role: 'user',
      },
      ticket: {
        id: 'ticket-1',
        user_id: 'ticket-owner-id',
        title: '导入失败',
        status: 'resolved',
        target_role: 'admin',
        created_at: '2026-06-10T01:00:00.000Z',
        updated_at: '2026-06-10T01:30:00.000Z',
      },
    });
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest({
      body: {
        ticketId: 'ticket-1',
        content: '问题还在，请继续看一下。',
      },
    });
    const res = createJsonResponseRecorder();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const ticketUpdateCall = adminClient.state.calls.find((call) => (
      call.table === 'tickets' && call.operation === 'update'
    ));
    expect(ticketUpdateCall?.patch).toMatchObject({
      status: 'pending',
    });
    expect(adminClient.state.tickets[0]).toMatchObject({
      id: 'ticket-1',
      status: 'pending',
    });
    expect(mocks.enqueueMailOutboxEvent).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({
      success: true,
      ticket: {
        id: 'ticket-1',
        status: 'pending',
        previousStatus: 'resolved',
        statusChanged: true,
      },
    });
  }));

  it('lets runtime config disable staff reply mail without blocking the reply', withTicketMailEnv(async () => {
    const adminClient = createTicketReplyAdminClient({
      mailRuntimeConfig: {
        version: 1,
        events: {
          ticketReply: false,
        },
        controls: {
          killSwitch: null,
          disabledEvents: [],
          pausedDomains: [],
        },
      },
    });
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest();
    const res = createJsonResponseRecorder();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(adminClient.state.replies).toHaveLength(1);
    expect(mocks.enqueueMailOutboxEvent).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({
      success: true,
      mailNotification: {
        enabled: false,
        attempted: false,
        status: 'disabled',
        code: 'ticket_reply_mail_disabled',
      },
    });
  }));

  it('rejects replying to tickets outside the caller permission boundary', async () => {
    configureCaller('other-user-id');
    const adminClient = createTicketReplyAdminClient({
      callerProfile: {
        id: 'other-user-id',
        email: 'other@example.com',
        username: 'other',
        role: 'user',
      },
    });
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest();
    const res = createJsonResponseRecorder();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(adminClient.state.replies).toEqual([]);
    expect(mocks.enqueueMailOutboxEvent).not.toHaveBeenCalled();
  });

  it('keeps reply save successful when mail enqueue fails', withTicketMailEnv(async () => {
    mocks.enqueueMailOutboxEvent.mockRejectedValue(new Error('mail queue unavailable'));
    const adminClient = createTicketReplyAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest();
    const res = createJsonResponseRecorder();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(adminClient.state.replies).toHaveLength(1);
    expect(res.body).toMatchObject({
      success: true,
      mailNotification: {
        enabled: true,
        attempted: true,
        status: 'error',
        code: 'mail_enqueue_exception',
      },
    });
    expect(JSON.stringify(res.body)).not.toContain('mail queue unavailable');
    expect(JSON.stringify(res.body)).not.toContain('ticket.owner@example.com');
  }));
});
