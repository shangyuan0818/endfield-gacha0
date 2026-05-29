// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rejectDisallowedBrowserOrigin: vi.fn(() => false),
  getBearerToken: vi.fn(() => 'token'),
  getSupabaseAdminClient: vi.fn(),
  getSupabaseAnonServerClient: vi.fn(),
}));

vi.mock('../_lib/http.js', () => ({
  rejectDisallowedBrowserOrigin: mocks.rejectDisallowedBrowserOrigin,
}));

vi.mock('../_lib/authAdmin.js', () => ({
  getBearerToken: mocks.getBearerToken,
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
  getSupabaseAnonServerClient: mocks.getSupabaseAnonServerClient,
}));

import accountSecurityStateHandler from '../_routes/root/account-security-state.js';

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
  url = 'https://example.com/api/account-security-state',
  body,
  headers = { authorization: 'Bearer token' },
} = {}) {
  return {
    method,
    url,
    body,
    headers,
  };
}

function createAdminClient({
  stateRow = {
    password_change_required: true,
    password_change_reason: 'account_recovery_temporary_password',
    password_change_source: 'account_recovery',
    password_change_requested_at: '2026-05-24T00:00:00.000Z',
    password_change_expires_at: '2026-05-25T00:00:00.000Z',
    password_change_recovery_request_id: 'recovery-1',
    email_verification_required: true,
    email_verification_reason: 'mail_verification_rollout_2026_05',
    email_verification_requested_at: '2026-05-26T00:00:00.000Z',
    email_verification_verified_at: null,
  },
  stateError = null,
  upsertError = null,
} = {}) {
  const maybeSingle = vi.fn(async () => ({
    data: stateRow,
    error: stateError,
  }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const upsert = vi.fn(async () => ({ error: upsertError }));

  return {
    from: vi.fn((table) => {
      if (table !== 'account_security_states') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select,
        upsert,
      };
    }),
    __securityStateMocks: {
      select,
      eq,
      maybeSingle,
      upsert,
    },
  };
}

describe('api/account-security-state handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBearerToken.mockReturnValue('token');
    mocks.getSupabaseAnonServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-1' } },
          error: null,
        })),
      },
    });
  });

  it('loads the current user password-change state from the private table', async () => {
    const adminClient = createAdminClient();
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest();
    const res = createJsonResponseRecorder();

    await accountSecurityStateHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(adminClient.from).toHaveBeenCalledWith('account_security_states');
    expect(adminClient.__securityStateMocks.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(res.body).toEqual({
      success: true,
      state: {
        passwordChangeRequired: true,
        reason: 'account_recovery_temporary_password',
        source: 'account_recovery',
        requestedAt: '2026-05-24T00:00:00.000Z',
        expiresAt: '2026-05-25T00:00:00.000Z',
        recoveryRequestId: 'recovery-1',
        emailVerificationRequired: true,
        emailVerificationReason: 'mail_verification_rollout_2026_05',
        emailVerificationRequestedAt: '2026-05-26T00:00:00.000Z',
        emailVerificationVerifiedAt: null,
      },
    });
    expect(JSON.stringify(res.body)).not.toContain('password_change_');
  });

  it('clears the password-change requirement for the current user', async () => {
    const adminClient = createAdminClient({
      stateRow: {
        password_change_required: false,
        password_change_reason: null,
        password_change_source: null,
        password_change_requested_at: null,
        password_change_expires_at: null,
        password_change_recovery_request_id: null,
        email_verification_required: false,
        email_verification_reason: null,
        email_verification_requested_at: null,
        email_verification_verified_at: '2026-05-26T00:00:00.000Z',
      },
    });
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const req = createRequest({
      method: 'POST',
      body: {
        action: 'clear_password_change_required',
      },
    });
    const res = createJsonResponseRecorder();

    await accountSecurityStateHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(adminClient.__securityStateMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        password_change_required: false,
        password_change_reason: null,
        password_change_source: null,
        password_change_recovery_request_id: null,
        password_change_set_by: null,
        updated_at: expect.any(String),
      }),
      { onConflict: 'user_id' },
    );
    expect(res.body).toEqual({
      success: true,
      state: {
        passwordChangeRequired: false,
        reason: null,
        source: null,
        requestedAt: null,
        expiresAt: null,
        recoveryRequestId: null,
        emailVerificationRequired: false,
        emailVerificationReason: null,
        emailVerificationRequestedAt: null,
        emailVerificationVerifiedAt: '2026-05-26T00:00:00.000Z',
      },
    });
  });

  it('rejects requests without an access token', async () => {
    mocks.getBearerToken.mockReturnValue(null);
    mocks.getSupabaseAdminClient.mockReturnValue(createAdminClient());

    const req = createRequest();
    const res = createJsonResponseRecorder();

    await accountSecurityStateHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: 'Missing access token',
    });
  });
});
