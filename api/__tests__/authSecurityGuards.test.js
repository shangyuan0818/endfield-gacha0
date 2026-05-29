// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import {
  evaluateAuthSecurityRisk,
  normalizeAuthEmail,
  sanitizeAuthAuditValue,
  serializeAuthSecurityAudit,
  verifyAuthCaptcha,
} from '../_lib/authSecurityGuards.js';

function createRequest({
  headers = {
    'x-forwarded-for': '203.0.113.10',
    origin: 'https://ef-gacha.mogujun.icu',
    'user-agent': 'Vitest',
  },
} = {}) {
  return {
    headers,
    socket: {
      remoteAddress: '127.0.0.1',
    },
  };
}

describe('authSecurityGuards', () => {
  it('normalizes and hashes email identifiers without exposing the raw address', () => {
    const identity = normalizeAuthEmail('User.Name+Reset@Example.COM');
    const serialized = JSON.stringify(identity);

    expect(identity).toMatchObject({
      ok: true,
      domain: 'example.com',
      redacted: 'u***t@e***e.com',
    });
    expect(identity.emailHash).toMatch(/^[a-f0-9]{64}$/);
    expect(identity.domainHash).toMatch(/^[a-f0-9]{64}$/);
    expect(serialized).not.toContain('User.Name+Reset@Example.COM');
    expect(serialized).not.toContain('user.name+reset@example.com');
  });

  it('enforces configured CAPTCHA tokens and keeps token values out of audit output', async () => {
    const fetchImpl = vi.fn(async () => ({
      json: async () => ({
        success: false,
        'error-codes': ['invalid-input-response'],
      }),
    }));

    const result = await verifyAuthCaptcha({
      action: 'register',
      token: 'raw-captcha-token',
      requesterIp: '203.0.113.10',
      env: {
        AUTH_CAPTCHA_MODE: 'enforce',
        AUTH_CAPTCHA_PROVIDER: 'turnstile',
        AUTH_CAPTCHA_SECRET_KEY: 'captcha-secret',
      },
      fetchImpl,
    });

    expect(result).toMatchObject({
      ok: false,
      required: true,
      status: 'failed',
      code: 'captcha_failed',
      errorCodes: ['invalid-input-response'],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain('raw-captcha-token');
    expect(JSON.stringify(result)).not.toContain('captcha-secret');
  });

  it('blocks high-risk configured email domains while storing only hashes', () => {
    const risk = evaluateAuthSecurityRisk({
      action: 'register',
      req: createRequest(),
      email: 'person@blocked.example',
      rateLimitResult: { allowed: true, retryAfter: 0 },
      captchaResult: { ok: true, status: 'disabled', code: 'captcha_disabled' },
      env: {
        AUTH_RISK_BLOCKED_EMAIL_DOMAINS: 'blocked.example',
      },
    });

    expect(risk).toMatchObject({
      bucket: 'blocked',
      shouldBlock: true,
      reasons: ['blocked_email_domain'],
    });
    expect(risk.email.emailHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(risk)).not.toContain('person@blocked.example');
  });

  it('sanitizes auth audit metadata and serializes CAPTCHA/rate-limit summaries', () => {
    const audit = serializeAuthSecurityAudit({
      risk: {
        bucket: 'blocked',
        shouldBlock: true,
        reasons: ['rate_limit_exceeded'],
        requester: {
          ipHash: 'hash-ip',
          originHash: 'hash-origin',
        },
        email: {
          emailHash: 'hash-email',
          domainHash: 'hash-domain',
          redacted: 'u***r@example.com',
        },
      },
      captcha: {
        provider: 'turnstile',
        mode: 'enforce',
        required: true,
        status: 'missing',
        code: 'captcha_required',
      },
      rateLimit: {
        allowed: false,
        retryAfter: 300,
        source: 'memory',
      },
    });
    const sanitized = sanitizeAuthAuditValue({
      email: 'raw@example.com',
      password: 'secret',
      token: 'token',
      nested: {
        game_uid: '1545600000',
        message: 'send to raw@example.com',
      },
    });

    expect(audit).toMatchObject({
      version: 1,
      risk: {
        bucket: 'blocked',
        shouldBlock: true,
      },
      captcha: {
        code: 'captcha_required',
      },
      rateLimit: {
        allowed: false,
        retryAfter: 300,
      },
    });
    expect(sanitized).toEqual({
      email: '[redacted]',
      password: '[redacted]',
      token: '[redacted]',
      nested: {
        game_uid: '[redacted]',
        message: 'send to [redacted-email]',
      },
    });
  });
});
