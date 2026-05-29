// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('../_lib/authAdmin.js', () => ({
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

import accountEmailVerifyHandler, { __internal } from '../_routes/root/account-email-verify.js';

function createResponseRecorder() {
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

function createRequest(token = 'a'.repeat(43)) {
  return {
    method: 'GET',
    query: { token },
    headers: {
      host: 'ef-gacha.example',
      'x-forwarded-proto': 'https',
    },
  };
}

function createAdminClient({
  stateRow,
  loadError = null,
  updateError = null,
} = {}) {
  const maybeSingle = vi.fn(async () => ({
    data: stateRow,
    error: loadError,
  }));
  const selectEq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq: selectEq }));
  const updateEqSecond = vi.fn(async () => ({ error: updateError }));
  const updateEqFirst = vi.fn(() => ({ eq: updateEqSecond }));
  const update = vi.fn(() => ({ eq: updateEqFirst }));

  return {
    from: vi.fn((table) => {
      expect(table).toBe('account_security_states');
      return {
        select,
        update,
      };
    }),
    __mocks: {
      maybeSingle,
      selectEq,
      update,
      updateEqFirst,
      updateEqSecond,
    },
  };
}

describe('api/account-email-verify handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.APP_URL;
    delete process.env.VITE_APP_URL;
  });

  it('clears the rollout email verification requirement for a valid token', async () => {
    const token = 'valid-token-value-that-is-long-enough-123';
    const tokenHash = __internal.hashEmailVerificationToken(token);
    const adminClient = createAdminClient({
      stateRow: {
        user_id: 'user-1',
        email_verification_required: true,
        email_verification_token_expires_at: new Date(Date.now() + 60000).toISOString(),
      },
    });
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest(token);
    const res = createResponseRecorder();

    await accountEmailVerifyHandler(req, res);

    expect(res.statusCode).toBe(303);
    expect(res.headers.Location).toBe('https://ef-gacha.example/settings?email_verification=success');
    expect(adminClient.__mocks.selectEq).toHaveBeenCalledWith('email_verification_token_hash', tokenHash);
    expect(adminClient.__mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      email_verification_required: false,
      email_verification_token_hash: null,
      email_verification_token_expires_at: null,
    }));
    expect(adminClient.__mocks.updateEqFirst).toHaveBeenCalledWith('user_id', 'user-1');
    expect(adminClient.__mocks.updateEqSecond).toHaveBeenCalledWith('email_verification_token_hash', tokenHash);
  });

  it('redirects to a failure state when the token is expired', async () => {
    const adminClient = createAdminClient({
      stateRow: {
        user_id: 'user-1',
        email_verification_required: true,
        email_verification_token_expires_at: new Date(Date.now() - 60000).toISOString(),
      },
    });
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest('expired-token-value-that-is-long-enough-123');
    const res = createResponseRecorder();

    await accountEmailVerifyHandler(req, res);

    expect(res.statusCode).toBe(303);
    expect(res.headers.Location).toBe('https://ef-gacha.example/settings?email_verification=failed&reason=token_expired');
    expect(adminClient.__mocks.update).not.toHaveBeenCalled();
  });
});
