// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rejectDisallowedBrowserOrigin: vi.fn(() => false),
  checkMemoryRateLimit: vi.fn(() => ({ allowed: true, retryAfter: 0 })),
  getRequesterKey: vi.fn(() => 'test-requester'),
  getSupabaseAdminClient: vi.fn(),
  findAuthUserByEmail: vi.fn(),
  ensureProfileForAuthUser: vi.fn(async () => ({})),
  enqueueMailOutboxEvent: vi.fn(),
}));

vi.mock('../_lib/http.js', () => ({
  rejectDisallowedBrowserOrigin: mocks.rejectDisallowedBrowserOrigin,
  checkMemoryRateLimit: mocks.checkMemoryRateLimit,
  getRequesterKey: mocks.getRequesterKey,
}));

vi.mock('../_lib/authAdmin.js', () => ({
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
  findAuthUserByEmail: mocks.findAuthUserByEmail,
  ensureProfileForAuthUser: mocks.ensureProfileForAuthUser,
}));

vi.mock('../_lib/mailOutbox.js', () => ({
  enqueueMailOutboxEvent: mocks.enqueueMailOutboxEvent,
}));

import accountRecoveryRequestHandler from '../_routes/root/account-recovery-request.js';
import authAccountStatusHandler from '../_routes/root/auth-account-status.js';

const GENERIC_RECOVERY_DATA = {
  status: 'received',
  deliveryChannel: 'manual',
  nextStep: 'manual_review_pending',
  recoveryAvailable: true,
};

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
  url = 'https://example.com/api/account-recovery-request',
  body,
  headers = {
    origin: 'https://ef-gacha.mogujun.icu',
    'x-forwarded-for': '203.0.113.10',
    'user-agent': 'Vitest',
  },
} = {}) {
  return {
    method,
    url,
    body,
    headers,
  };
}

function createRecoveryBody(overrides = {}) {
  return {
    email: 'User@Example.com',
    requestType: 'password_reset',
    claimedAccountCount: 1,
    verificationClaims: [
      {
        gameUid: '1545600000',
        nickName: '测试账号',
      },
    ],
    note: 'Need help',
    ...overrides,
  };
}

function createRecoveryAdminClient({
  existingRequests = [],
  existingError = null,
  insertedRequest = {
    id: 'recovery-1',
    status: 'pending',
    created_at: '2026-05-24T00:00:00.000Z',
  },
  insertError = null,
} = {}) {
  const existingLimit = vi.fn(async () => ({
    data: existingRequests,
    error: existingError,
  }));
  const existingIn = vi.fn(() => ({ limit: existingLimit }));
  const existingEq = vi.fn(() => ({ in: existingIn }));
  const existingSelect = vi.fn(() => ({ eq: existingEq }));

  const insertSingle = vi.fn(async () => ({
    data: insertedRequest,
    error: insertError,
  }));
  const insertSelect = vi.fn(() => ({ single: insertSingle }));
  const insert = vi.fn(() => ({ select: insertSelect }));
  const updateEq = vi.fn(async () => ({ error: null }));
  const update = vi.fn(() => ({ eq: updateEq }));
  const securityInsert = vi.fn(async () => ({ error: null }));

  return {
    from: vi.fn((table) => {
      if (table === 'auth_security_events') {
        return {
          insert: securityInsert,
        };
      }

      if (table === 'account_recovery_requests') {
        return {
          select: existingSelect,
          insert,
          update,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
    __recoveryMocks: {
      existingSelect,
      existingEq,
      existingIn,
      existingLimit,
      insert,
      insertSelect,
      insertSingle,
      update,
      updateEq,
      securityInsert,
    },
  };
}

function withRecoveryMailEnv(overrides = {}) {
  const keys = [
    'ACCOUNT_RECOVERY_MAIL_OUTBOX_ENABLED',
    'MAIL_OUTBOX_WORKER_ENABLED',
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      process.env[key] = overrides[key];
    } else {
      delete process.env[key];
    }
  }

  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

describe('account recovery auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ACCOUNT_RECOVERY_MAIL_OUTBOX_ENABLED;
    delete process.env.MAIL_OUTBOX_WORKER_ENABLED;
    mocks.getSupabaseAdminClient.mockReturnValue({});
    mocks.findAuthUserByEmail.mockResolvedValue(null);
    mocks.enqueueMailOutboxEvent.mockResolvedValue({
      ok: true,
      queued: true,
      deduped: false,
      action: 'queue',
      code: 'mail_outbox_queued',
      outboxId: 'outbox-1',
    });
  });

  it('returns a generic account-status response without looking up the email', async () => {
    const adminClient = {};
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest({
      url: 'https://example.com/api/auth-account-status',
      body: { email: 'user@example.com' },
    });
    const res = createJsonResponseRecorder();

    await authAccountStatusHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      status: 'received',
      recoveryAvailable: true,
    });
    expect(mocks.findAuthUserByEmail).not.toHaveBeenCalled();
    expect(mocks.ensureProfileForAuthUser).not.toHaveBeenCalled();
  });

  it('returns a generic recovery response for unknown emails', async () => {
    const adminClient = createRecoveryAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    mocks.findAuthUserByEmail.mockResolvedValue(null);

    const req = createRequest({
      body: createRecoveryBody(),
    });
    const res = createJsonResponseRecorder();

    await accountRecoveryRequestHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: GENERIC_RECOVERY_DATA,
    });
    expect(mocks.findAuthUserByEmail).toHaveBeenCalledWith(adminClient, 'user@example.com');
    expect(mocks.ensureProfileForAuthUser).not.toHaveBeenCalled();
    expect(adminClient.__recoveryMocks.securityInsert).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'account_recovery_request',
      action: 'account_recovery',
      outcome: 'received_unknown_email',
      risk_bucket: 'low',
      email_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      email_redacted: 'u***r@e***e.com',
    }));
    expect(JSON.stringify(adminClient.__recoveryMocks.securityInsert.mock.calls)).not.toContain('user@example.com');
  });

  it('returns the same generic recovery response for existing pending requests', async () => {
    const adminClient = createRecoveryAdminClient({
      existingRequests: [{ id: 'existing-request' }],
    });
    const matchedUser = { id: 'matched-user-id', email: 'user@example.com' };
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    mocks.findAuthUserByEmail.mockResolvedValue(matchedUser);

    const req = createRequest({
      body: createRecoveryBody(),
    });
    const res = createJsonResponseRecorder();

    await accountRecoveryRequestHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: GENERIC_RECOVERY_DATA,
    });
    expect(mocks.ensureProfileForAuthUser).toHaveBeenCalledWith(adminClient, matchedUser);
    expect(adminClient.__recoveryMocks.insert).not.toHaveBeenCalled();
    expect(adminClient.__recoveryMocks.securityInsert).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'account_recovery_request',
      outcome: 'received_existing_request',
      email_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
  });

  it('creates a recovery request for a matched account while returning the same generic status', async () => {
    const adminClient = createRecoveryAdminClient();
    const matchedUser = { id: 'matched-user-id', email: 'user@example.com' };
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    mocks.findAuthUserByEmail.mockResolvedValue(matchedUser);

    const req = createRequest({
      body: createRecoveryBody(),
    });
    const res = createJsonResponseRecorder();

    await accountRecoveryRequestHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(adminClient.__recoveryMocks.insert).toHaveBeenCalledWith({
      email: 'user@example.com',
      matched_user_id: 'matched-user-id',
      request_type: 'password_reset',
      claimed_account_count: 1,
      verification_claims: [
        {
          gameUid: '1545600000',
          nickName: '测试账号',
        },
      ],
      note: 'Need help',
      status: 'pending',
      delivery_channel: 'manual',
      next_step: 'manual_review_pending',
      recovery_audit: expect.objectContaining({
        version: 1,
        authSecurity: expect.objectContaining({
          version: 1,
          risk: expect.objectContaining({
            bucket: 'low',
            email: expect.objectContaining({
              emailHash: expect.stringMatching(/^[a-f0-9]{64}$/),
              redacted: 'u***r@e***e.com',
            }),
          }),
          captcha: expect.objectContaining({
            code: 'captcha_disabled',
          }),
        }),
        mail: expect.objectContaining({
          status: 'not_configured',
          reason: 'provider_decision_pending',
        }),
        events: [
          expect.objectContaining({
            type: 'request_received',
            requestType: 'password_reset',
            deliveryChannel: 'manual',
            nextStep: 'manual_review_pending',
          }),
        ],
      }),
    });
    expect(res.body).toEqual({
      success: true,
      data: GENERIC_RECOVERY_DATA,
    });
    expect(JSON.stringify(res.body)).not.toContain('matched-user-id');
    expect(JSON.stringify(res.body)).not.toContain('user@example.com');
    expect(JSON.stringify(res.body)).not.toContain('recovery-1');
    expect(JSON.stringify(adminClient.__recoveryMocks.securityInsert.mock.calls)).not.toContain('1545600000');
    expect(mocks.enqueueMailOutboxEvent).not.toHaveBeenCalled();
    expect(adminClient.__recoveryMocks.update).not.toHaveBeenCalled();
  });

  it('queues a password reset mail event when the recovery mail outbox is explicitly enabled', async () => {
    const restoreEnv = withRecoveryMailEnv({
      ACCOUNT_RECOVERY_MAIL_OUTBOX_ENABLED: 'true',
      MAIL_OUTBOX_WORKER_ENABLED: 'true',
    });
    const adminClient = createRecoveryAdminClient();
    const matchedUser = { id: 'matched-user-id', email: 'user@example.com' };
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    mocks.findAuthUserByEmail.mockResolvedValue(matchedUser);

    const req = createRequest({
      body: createRecoveryBody({ locale: 'en-US' }),
    });
    const res = createJsonResponseRecorder();

    try {
      await accountRecoveryRequestHandler(req, res);
    } finally {
      restoreEnv();
    }

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: GENERIC_RECOVERY_DATA,
    });
    expect(mocks.enqueueMailOutboxEvent).toHaveBeenCalledWith(expect.objectContaining({
      adminClient,
      eventType: 'password_reset',
      recipientEmail: 'user@example.com',
      requesterIp: '203.0.113.10',
      userId: '',
      templateKey: 'auth.password-reset',
      locale: 'en-US',
      relatedEntityType: 'account_recovery',
      relatedEntityId: 'recovery-1',
      purposeKey: 'recovery-1',
      payload: expect.objectContaining({
        requestType: 'password_reset',
        resetLinkMode: 'worker_generate',
        recoveryRequestId: 'recovery-1',
        submittedAt: '2026-05-24T00:00:00.000Z',
      }),
      priority: 3,
    }));
    expect(adminClient.__recoveryMocks.update).toHaveBeenCalledWith(expect.objectContaining({
      delivery_channel: 'mail_outbox',
      next_step: 'mail_reset_queued',
      mail_outbox_id: 'outbox-1',
      recovery_audit: expect.objectContaining({
        mail: expect.objectContaining({
          status: 'queued',
          action: 'queue',
          code: 'mail_outbox_queued',
          outboxId: 'outbox-1',
        }),
        events: expect.arrayContaining([
          expect.objectContaining({ type: 'request_received' }),
          expect.objectContaining({
            type: 'mail_reset_queued',
            deliveryChannel: 'mail_outbox',
            nextStep: 'mail_reset_queued',
          }),
        ]),
      }),
      updated_at: expect.any(String),
    }));
    expect(adminClient.__recoveryMocks.updateEq).toHaveBeenCalledWith('id', 'recovery-1');

    const serializedResponse = JSON.stringify(res.body);
    expect(serializedResponse).not.toContain('outbox-1');
    expect(serializedResponse).not.toContain('recovery-1');
    expect(serializedResponse).not.toContain('matched-user-id');
    expect(serializedResponse).not.toContain('user@example.com');
  });

  it('keeps manual fallback when the recovery mail outbox blocks the reset event', async () => {
    const restoreEnv = withRecoveryMailEnv({
      ACCOUNT_RECOVERY_MAIL_OUTBOX_ENABLED: 'true',
      MAIL_OUTBOX_WORKER_ENABLED: 'true',
    });
    mocks.enqueueMailOutboxEvent.mockResolvedValue({
      ok: false,
      queued: false,
      deduped: false,
      action: 'block',
      code: 'mail_budget_exceeded:recipient',
      reason: 'Mail sending budget exceeded.',
    });
    const adminClient = createRecoveryAdminClient();
    const matchedUser = { id: 'matched-user-id', email: 'user@example.com' };
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    mocks.findAuthUserByEmail.mockResolvedValue(matchedUser);

    const req = createRequest({
      body: createRecoveryBody(),
    });
    const res = createJsonResponseRecorder();

    try {
      await accountRecoveryRequestHandler(req, res);
    } finally {
      restoreEnv();
    }

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: GENERIC_RECOVERY_DATA,
    });
    expect(adminClient.__recoveryMocks.update).toHaveBeenCalledWith(expect.objectContaining({
      delivery_channel: 'manual',
      next_step: 'manual_review_pending',
      mail_outbox_id: null,
      recovery_audit: expect.objectContaining({
        mail: expect.objectContaining({
          status: 'manual_fallback',
          action: 'block',
          code: 'mail_budget_exceeded:recipient',
          reason: 'Mail sending budget exceeded.',
        }),
        events: expect.arrayContaining([
          expect.objectContaining({
            type: 'mail_reset_fallback',
            deliveryChannel: 'manual',
            nextStep: 'manual_review_pending',
          }),
        ]),
      }),
    }));
    expect(JSON.stringify(res.body)).not.toContain('mail_budget_exceeded');
    expect(JSON.stringify(res.body)).not.toContain('user@example.com');
  });

  it('does not enqueue reset mail for account deletion recovery requests', async () => {
    const restoreEnv = withRecoveryMailEnv({
      ACCOUNT_RECOVERY_MAIL_OUTBOX_ENABLED: 'true',
      MAIL_OUTBOX_WORKER_ENABLED: 'true',
    });
    const adminClient = createRecoveryAdminClient();
    const matchedUser = { id: 'matched-user-id', email: 'user@example.com' };
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    mocks.findAuthUserByEmail.mockResolvedValue(matchedUser);

    const req = createRequest({
      body: createRecoveryBody({ requestType: 'delete_account' }),
    });
    const res = createJsonResponseRecorder();

    try {
      await accountRecoveryRequestHandler(req, res);
    } finally {
      restoreEnv();
    }

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: GENERIC_RECOVERY_DATA,
    });
    expect(mocks.enqueueMailOutboxEvent).not.toHaveBeenCalled();
    expect(adminClient.__recoveryMocks.update).not.toHaveBeenCalled();
  });

  it('requires CAPTCHA for recovery when the server policy is enforced', async () => {
    const previousMode = process.env.AUTH_CAPTCHA_MODE;
    const previousSecret = process.env.AUTH_CAPTCHA_SECRET_KEY;
    process.env.AUTH_CAPTCHA_MODE = 'enforce';
    process.env.AUTH_CAPTCHA_SECRET_KEY = 'test-captcha-secret';

    const adminClient = createRecoveryAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest({
      body: createRecoveryBody(),
    });
    const res = createJsonResponseRecorder();

    try {
      await accountRecoveryRequestHandler(req, res);
    } finally {
      if (previousMode === undefined) {
        delete process.env.AUTH_CAPTCHA_MODE;
      } else {
        process.env.AUTH_CAPTCHA_MODE = previousMode;
      }

      if (previousSecret === undefined) {
        delete process.env.AUTH_CAPTCHA_SECRET_KEY;
      } else {
        process.env.AUTH_CAPTCHA_SECRET_KEY = previousSecret;
      }
    }

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      success: false,
      error: 'Captcha verification required',
      code: 'captcha_required',
    });
    expect(mocks.findAuthUserByEmail).not.toHaveBeenCalled();
    expect(adminClient.__recoveryMocks.insert).not.toHaveBeenCalled();
    expect(adminClient.__recoveryMocks.securityInsert).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'captcha_blocked',
      risk_bucket: 'blocked',
      risk_reasons: expect.arrayContaining(['captcha_required']),
      captcha: expect.objectContaining({
        code: 'captcha_required',
      }),
    }));
  });
});
