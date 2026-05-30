// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rejectDisallowedBrowserOrigin: vi.fn(() => false),
  checkMemoryRateLimit: vi.fn(() => ({ allowed: true, retryAfter: 0 })),
  getRequesterKey: vi.fn(() => 'test-requester'),
  getSupabaseAdminClient: vi.fn(),
  findAuthUserByEmail: vi.fn(),
  ensureProfileForAuthUser: vi.fn(async () => ({})),
  verifyAuthCaptcha: vi.fn(async () => ({
    ok: true,
    provider: 'turnstile',
    mode: 'off',
    required: false,
    monitoring: false,
    status: 'disabled',
    code: 'captcha_disabled',
  })),
  evaluateAuthSecurityRisk: vi.fn(() => ({
    action: 'register',
    bucket: 'low',
    shouldBlock: false,
    reasons: [],
    requester: {
      ipHash: 'requester-hash',
      originHash: 'origin-hash',
      userAgentHash: 'ua-hash',
      hasOrigin: true,
      hasUserAgent: true,
    },
    email: {
      ok: true,
      reason: '',
      emailHash: 'email-hash',
      domainHash: 'domain-hash',
      redacted: 'u***r@e***e.com',
    },
  })),
  getRequesterIp: vi.fn(() => '203.0.113.10'),
  persistAuthSecurityEvent: vi.fn(async () => ({ ok: true })),
  createMailProviderAdapter: vi.fn(),
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

vi.mock('../_lib/authSecurityGuards.js', () => ({
  evaluateAuthSecurityRisk: mocks.evaluateAuthSecurityRisk,
  getRequesterIp: mocks.getRequesterIp,
  persistAuthSecurityEvent: mocks.persistAuthSecurityEvent,
  verifyAuthCaptcha: mocks.verifyAuthCaptcha,
}));

vi.mock('../_lib/mailProviderAdapter.js', () => ({
  createMailProviderAdapter: mocks.createMailProviderAdapter,
}));

import authEmailActionHandler from '../_routes/root/auth-email-action.js';

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
  body,
  headers = {
    origin: 'https://ef-gacha.mogujun.icu',
    'x-forwarded-for': '203.0.113.10',
    'user-agent': 'Vitest',
  },
} = {}) {
  return {
    method: 'POST',
    body,
    headers,
    socket: {
      remoteAddress: '127.0.0.1',
    },
  };
}

function createAdminClient({
  generateLinkResult = {
    data: {
      properties: {
        action_link: 'https://auth.example.test/action-link',
      },
      user: {
        id: 'user-1',
        email: 'user@example.com',
      },
    },
    error: null,
  },
  mailRuntimeConfig = null,
} = {}) {
  const generateLink = vi.fn(async () => generateLinkResult);
  const createUser = vi.fn(async (attributes) => ({
    data: {
      user: {
        id: 'user-1',
        email: attributes.email,
      },
    },
    error: null,
  }));
  const deleteUser = vi.fn(async () => ({ error: null }));
  const deliveryInsert = vi.fn(async () => ({ error: null }));
  const securityUpsert = vi.fn(async () => ({ error: null }));
  const runtimeRow = mailRuntimeConfig
    ? {
      key: 'mail_runtime_config',
      value: JSON.stringify(mailRuntimeConfig),
      updated_at: '2026-06-12T00:00:00.000Z',
      updated_by: 'admin-user-id',
    }
    : null;

  return {
    auth: {
      admin: {
        createUser,
        deleteUser,
        generateLink,
      },
    },
    from: vi.fn((table) => {
      if (table === 'site_config') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(async () => ({
                data: runtimeRow ? [runtimeRow] : [],
                error: null,
              })),
            })),
          })),
        };
      }

      if (table === 'account_security_states') {
        return {
          upsert: securityUpsert,
        };
      }

      if (table !== 'mail_delivery_events') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        insert: deliveryInsert,
      };
    }),
    __mocks: {
      createUser,
      deleteUser,
      deliveryInsert,
      generateLink,
      securityUpsert,
    },
  };
}

function createMailAdapter({
  ok = true,
  dryRun = false,
} = {}) {
  const sentMessages = [];
  return {
    sentMessages,
    config: {
      dryRun,
      provider: 'stalwart',
      providerKey: dryRun ? 'stalwart:dry-run' : 'stalwart',
      fromAddress: 'no-reply@leevident.com',
      fromName: 'Endfield Gacha',
    },
    send: vi.fn(async (message) => {
      sentMessages.push(message);
      return {
        ok,
        accepted: ok,
        dryRun,
        retryable: !ok,
        providerKey: dryRun ? 'stalwart:dry-run' : 'stalwart',
        providerMessageId: ok ? 'provider-message-id' : '',
        code: ok ? 'stalwart_smtp_accepted' : 'stalwart_smtp_failed',
        reason: ok ? 'accepted' : 'failed',
      };
    }),
  };
}

function withAuthMailEnv(callback) {
  return async () => {
    const keys = [
      'APP_URL',
      'AUTH_MAIL_ACTIONS_ENABLED',
      'AUTH_EMAIL_ACTIONS_ENABLED',
      'MAIL_OUTBOX_WORKER_ENABLED',
      'MAIL_WORKER_ENABLED',
      'MAIL_OUTBOX_GLOBAL_KILL_SWITCH',
      'SUPABASE_URL',
      'VITE_SUPABASE_URL',
    ];
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

    process.env.APP_URL = 'https://ef-gacha.example';
    process.env.AUTH_MAIL_ACTIONS_ENABLED = 'true';
    process.env.MAIL_OUTBOX_WORKER_ENABLED = 'true';
    process.env.MAIL_OUTBOX_GLOBAL_KILL_SWITCH = 'false';

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

function assertNoRawEmail(value) {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain('User@Example.com');
  expect(serialized).not.toContain('user@example.com');
}

describe('api/auth-email-action handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AUTH_MAIL_ACTIONS_ENABLED;
    delete process.env.AUTH_EMAIL_ACTIONS_ENABLED;
    delete process.env.MAIL_OUTBOX_WORKER_ENABLED;
    delete process.env.MAIL_WORKER_ENABLED;
    delete process.env.MAIL_OUTBOX_GLOBAL_KILL_SWITCH;

    mocks.findAuthUserByEmail.mockResolvedValue(null);
    mocks.createMailProviderAdapter.mockReturnValue(createMailAdapter());
  });

  it('allows registration when auth mail delivery is disabled and marks email verification required', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest({
      body: {
        action: 'register_confirmation',
        email: 'User@Example.com',
        password: 'StrongPass123',
      },
    });
    const res = createJsonResponseRecorder();

    await authEmailActionHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        status: 'registered_unverified',
        deliveryChannel: 'auth',
        nextStep: 'login_and_verify_email',
      },
    });
    expect(adminClient.__mocks.createUser).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'StrongPass123',
      email_confirm: true,
      user_metadata: {
        username: 'user',
      },
    });
    expect(adminClient.__mocks.securityUpsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      email_verification_required: true,
      email_verification_reason: 'new_registration',
    }), { onConflict: 'user_id' });
    expect(adminClient.__mocks.generateLink).not.toHaveBeenCalled();
    expect(mocks.createMailProviderAdapter).not.toHaveBeenCalled();
  });

  it('does not block registration when runtime config disables auth mail delivery', withAuthMailEnv(async () => {
    const adminClient = createAdminClient({
      mailRuntimeConfig: {
        version: 1,
        events: {
          authMailActions: false,
        },
        controls: {
          killSwitch: null,
          disabledEvents: [],
          pausedDomains: [],
        },
      },
    });
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest({
      body: {
        action: 'register_confirmation',
        email: 'User@Example.com',
        password: 'StrongPass123',
      },
    });
    const res = createJsonResponseRecorder();

    await authEmailActionHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        status: 'registered_unverified',
      },
    });
    expect(adminClient.__mocks.createUser).toHaveBeenCalled();
    expect(adminClient.__mocks.generateLink).not.toHaveBeenCalled();
    expect(mocks.createMailProviderAdapter).not.toHaveBeenCalled();
  }));

  it('uses a generic disabled response for password reset to avoid account enumeration', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest({
      body: {
        action: 'password_reset',
        email: 'User@Example.com',
      },
    });
    const res = createJsonResponseRecorder();

    await authEmailActionHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        status: 'mail_unavailable',
        nextStep: 'manual_recovery_available',
      },
    });
    expect(adminClient.__mocks.generateLink).not.toHaveBeenCalled();
    assertNoRawEmail(res.body);
  });

  it('creates an immediately usable account and asks the user to verify email later', withAuthMailEnv(async () => {
    const adminClient = createAdminClient();
    const adapter = createMailAdapter();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    mocks.createMailProviderAdapter.mockReturnValue(adapter);

    const req = createRequest({
      body: {
        action: 'register_confirmation',
        email: 'User@Example.com',
        password: 'StrongPass123',
        username: 'Mogu',
        locale: 'zh-CN',
      },
    });
    const res = createJsonResponseRecorder();

    await authEmailActionHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        status: 'registered_unverified',
        nextStep: 'login_and_verify_email',
      },
    });
    expect(adminClient.__mocks.createUser).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'StrongPass123',
      email_confirm: true,
      user_metadata: {
        username: 'Mogu',
      },
    });
    expect(mocks.ensureProfileForAuthUser).toHaveBeenCalledWith(adminClient, {
      id: 'user-1',
      email: 'user@example.com',
    });
    expect(adminClient.__mocks.securityUpsert).toHaveBeenCalledWith(expect.objectContaining({
      email_verification_required: true,
      email_verification_reason: 'new_registration',
    }), { onConflict: 'user_id' });
    expect(adminClient.__mocks.generateLink).not.toHaveBeenCalled();
    expect(adapter.sentMessages).toHaveLength(0);
  }));

  it('keeps duplicate registration explicit without sending another message', withAuthMailEnv(async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    mocks.findAuthUserByEmail.mockResolvedValue({
      id: 'existing-user',
      email: 'user@example.com',
      email_confirmed_at: '2026-06-01T00:00:00.000Z',
    });

    const req = createRequest({
      body: {
        action: 'register_confirmation',
        email: 'User@Example.com',
        password: 'StrongPass123',
      },
    });
    const res = createJsonResponseRecorder();

    await authEmailActionHandler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      success: false,
      code: 'email_already_registered',
    });
    expect(adminClient.__mocks.generateLink).not.toHaveBeenCalled();
    expect(mocks.createMailProviderAdapter).not.toHaveBeenCalled();
  }));

  it('keeps duplicate unverified registration explicit without replacing the user', withAuthMailEnv(async () => {
    const adminClient = createAdminClient();
    const adapter = createMailAdapter();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    mocks.findAuthUserByEmail.mockResolvedValue({
      id: 'unconfirmed-user',
      email: 'user@example.com',
      email_confirmed_at: null,
    });
    mocks.createMailProviderAdapter.mockReturnValue(adapter);

    const req = createRequest({
      body: {
        action: 'register_confirmation',
        email: 'User@Example.com',
        password: 'StrongPass123',
        username: 'Mogu',
      },
    });
    const res = createJsonResponseRecorder();

    await authEmailActionHandler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      success: false,
      code: 'email_already_registered',
    });
    expect(adminClient.__mocks.deleteUser).not.toHaveBeenCalled();
    expect(adminClient.__mocks.generateLink).not.toHaveBeenCalled();
    expect(mocks.createMailProviderAdapter).not.toHaveBeenCalled();
  }));

  it('does not generate or send reset mail for an unknown email', withAuthMailEnv(async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    mocks.findAuthUserByEmail.mockResolvedValue(null);

    const req = createRequest({
      body: {
        action: 'password_reset',
        email: 'User@Example.com',
      },
    });
    const res = createJsonResponseRecorder();

    await authEmailActionHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        status: 'sent_if_available',
        nextStep: 'check_email',
      },
    });
    expect(adminClient.__mocks.generateLink).not.toHaveBeenCalled();
    expect(mocks.createMailProviderAdapter).not.toHaveBeenCalled();
    assertNoRawEmail(res.body);
  }));

  it('generates password reset links against the existing reset-password route', withAuthMailEnv(async () => {
    const adminClient = createAdminClient({
      generateLinkResult: {
        data: {
          properties: {
            action_link: 'https://auth.example.test/action-link',
            email_otp: '123456',
          },
          user: {
            id: 'user-1',
            email: 'user@example.com',
          },
        },
        error: null,
      },
    });
    const adapter = createMailAdapter();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    mocks.findAuthUserByEmail.mockResolvedValue({
      id: 'existing-user',
      email: 'user@example.com',
    });
    mocks.createMailProviderAdapter.mockReturnValue(adapter);

    const req = createRequest({
      body: {
        action: 'password_reset',
        email: 'User@Example.com',
        locale: 'en-US',
      },
    });
    const res = createJsonResponseRecorder();

    await authEmailActionHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(adminClient.__mocks.generateLink).toHaveBeenCalledWith({
      type: 'recovery',
      email: 'user@example.com',
      options: {
        redirectTo: 'https://ef-gacha.example/reset-password',
      },
    });
    expect(adapter.sentMessages[0]).toMatchObject({
      templateKey: 'auth.password-reset',
      locale: 'en-US',
      eventType: 'password_reset',
    });
    expect(adapter.sentMessages[0].html).toContain('<!doctype html>');
    expect(adapter.sentMessages[0].html).toContain('123456');
    expect(adapter.sentMessages[0].html).not.toContain('https://auth.example.test/action-link');
    expect(adapter.sentMessages[0].text).toContain('验证码: 123456');
    expect(adapter.sentMessages[0].subject).toBe('Reset your Endfield Gacha password');
    expect(adminClient.__mocks.deliveryInsert).toHaveBeenCalledWith(expect.objectContaining({
      outbox_id: null,
      event_type: 'password_reset_accepted',
      provider_message_id_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      event_payload_redacted_json: expect.objectContaining({
        eventType: 'password_reset',
        recipientRedacted: 'u***r@e***e.com',
      }),
    }));
    assertNoRawEmail(res.body);
  }));

  it('sends a styled magic-link email login message for existing accounts', withAuthMailEnv(async () => {
    const adminClient = createAdminClient({
      generateLinkResult: {
        data: {
          properties: {
            action_link: 'https://auth.example.test/action-link',
            email_otp: '654321',
          },
          user: {
            id: 'user-1',
            email: 'user@example.com',
          },
        },
        error: null,
      },
    });
    const adapter = createMailAdapter();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    mocks.findAuthUserByEmail.mockResolvedValue({
      id: 'existing-user',
      email: 'user@example.com',
    });
    mocks.createMailProviderAdapter.mockReturnValue(adapter);

    const req = createRequest({
      body: {
        action: 'email_login',
        email: 'User@Example.com',
      },
    });
    const res = createJsonResponseRecorder();

    await authEmailActionHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        status: 'sent',
        nextStep: 'enter_login_code',
        codeEntry: true,
      },
    });
    expect(adminClient.__mocks.generateLink).toHaveBeenCalledWith({
      type: 'magiclink',
      email: 'user@example.com',
      options: {
        redirectTo: 'https://ef-gacha.example',
      },
    });
    expect(adapter.sentMessages[0]).toMatchObject({
      templateKey: 'auth.email-login',
      eventType: 'email_login',
      relatedEntityType: 'auth_action',
      relatedEntityId: 'email_login',
    });
    expect(adapter.sentMessages[0].html).toContain('<!doctype html>');
    expect(adapter.sentMessages[0].html).toContain('654321');
    expect(adapter.sentMessages[0].html).not.toContain('https://auth.example.test/action-link');
    expect(adapter.sentMessages[0].text).toContain('验证码: 654321');
    assertNoRawEmail(res.body);
  }));

  it('requires captcha when auth mail action captcha verification fails', withAuthMailEnv(async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    mocks.verifyAuthCaptcha.mockResolvedValueOnce({
      ok: false,
      provider: 'turnstile',
      mode: 'enforce',
      required: true,
      monitoring: false,
      status: 'missing',
      code: 'captcha_required',
    });

    const req = createRequest({
      body: {
        action: 'email_login',
        email: 'User@Example.com',
      },
    });
    const res = createJsonResponseRecorder();

    await authEmailActionHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      success: false,
      error: 'Captcha verification required',
      code: 'captcha_required',
    });
    expect(adminClient.__mocks.generateLink).not.toHaveBeenCalled();
    expect(mocks.createMailProviderAdapter).not.toHaveBeenCalled();
  }));
});
