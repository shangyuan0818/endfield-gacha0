// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rejectDisallowedBrowserOrigin: vi.fn(() => false),
  checkMemoryRateLimit: vi.fn(() => ({ allowed: true, retryAfter: 0 })),
  getRequesterKey: vi.fn(() => '203.0.113.10:https://ef-gacha.mogujun.icu'),
  getSupabaseAdminClient: vi.fn(),
  resolveSupabaseUrl: vi.fn(() => 'https://db.example.test'),
  resolveSupabasePublishableKey: vi.fn(() => 'publishable-key'),
  createClient: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

vi.mock('../_lib/http.js', () => ({
  rejectDisallowedBrowserOrigin: mocks.rejectDisallowedBrowserOrigin,
  checkMemoryRateLimit: mocks.checkMemoryRateLimit,
  getRequesterKey: mocks.getRequesterKey,
}));

vi.mock('../_lib/authAdmin.js', () => ({
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

vi.mock('../_lib/supabaseEnv.js', () => ({
  resolveSupabaseUrl: mocks.resolveSupabaseUrl,
  resolveSupabasePublishableKey: mocks.resolveSupabasePublishableKey,
}));

import authRateLimitHandler from '../_routes/root/auth-rate-limit.js';

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
    action: 'register',
    email: 'User@Example.com',
  },
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

function createAdminClient() {
  const insert = vi.fn(async () => ({ error: null }));
  return {
    from: vi.fn((table) => {
      if (table !== 'auth_security_events') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return { insert };
    }),
    __mocks: {
      insert,
    },
  };
}

function withProductionEnv(callback) {
  return async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousCaptchaMode = process.env.AUTH_CAPTCHA_MODE;
    const previousCaptchaSecret = process.env.AUTH_CAPTCHA_SECRET_KEY;
    try {
      process.env.NODE_ENV = 'production';
      await callback();
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }

      if (previousCaptchaMode === undefined) {
        delete process.env.AUTH_CAPTCHA_MODE;
      } else {
        process.env.AUTH_CAPTCHA_MODE = previousCaptchaMode;
      }

      if (previousCaptchaSecret === undefined) {
        delete process.env.AUTH_CAPTCHA_SECRET_KEY;
      } else {
        process.env.AUTH_CAPTCHA_SECRET_KEY = previousCaptchaSecret;
      }
    }
  };
}

describe('api/auth-rate-limit handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockReturnValue({
      rpc: vi.fn(async () => ({
        data: {
          allowed: true,
          retry_after: 0,
        },
        error: null,
      })),
    });
  });

  it('blocks register preflight when CAPTCHA is enforced and missing', withProductionEnv(async () => {
    process.env.AUTH_CAPTCHA_MODE = 'enforce';
    process.env.AUTH_CAPTCHA_SECRET_KEY = 'captcha-secret';
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest();
    const res = createJsonResponseRecorder();

    await authRateLimitHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      success: true,
      allowed: false,
      source: 'captcha',
      code: 'captcha_required',
      risk: {
        bucket: 'blocked',
        reasons: ['captcha_required'],
      },
    });
    expect(adminClient.__mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'auth_rate_limit_check',
      action: 'register',
      outcome: 'captcha_blocked',
      risk_bucket: 'blocked',
      risk_reasons: ['captcha_required'],
      email_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      email_redacted: 'u***r@e***e.com',
      captcha: expect.objectContaining({
        code: 'captcha_required',
      }),
    }));
    expect(JSON.stringify(adminClient.__mocks.insert.mock.calls)).not.toContain('User@Example.com');
    expect(JSON.stringify(adminClient.__mocks.insert.mock.calls)).not.toContain('captcha-secret');
  }));

  it('records a redacted risk event for allowed login preflight', withProductionEnv(async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest({
      body: {
        action: 'login',
        email: 'User@Example.com',
      },
    });
    const res = createJsonResponseRecorder();

    await authRateLimitHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      allowed: true,
      retry_after: 0,
      source: 'supabase',
      risk: {
        bucket: 'low',
        reasons: [],
      },
    });
    expect(adminClient.__mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'auth_rate_limit_check',
      action: 'login',
      outcome: 'allowed',
      risk_bucket: 'low',
      email_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(JSON.stringify(adminClient.__mocks.insert.mock.calls)).not.toContain('user@example.com');
  }));

  it('returns a rate-limit response and audit bucket when memory limit is exceeded', withProductionEnv(async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);
    mocks.checkMemoryRateLimit.mockReturnValueOnce({ allowed: false, retryAfter: 300 });

    const req = createRequest({
      body: {
        action: 'password_reset',
        email: 'User@Example.com',
      },
    });
    const res = createJsonResponseRecorder();

    await authRateLimitHandler(req, res);

    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({
      success: true,
      allowed: false,
      retry_after: 300,
      risk: {
        bucket: 'blocked',
        reasons: ['rate_limit_exceeded'],
      },
    });
    expect(adminClient.__mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'rate_limited',
      risk_bucket: 'blocked',
      risk_reasons: ['rate_limit_exceeded'],
      rate_limit: expect.objectContaining({
        allowed: false,
        retryAfter: 300,
      }),
    }));
  }));
});
