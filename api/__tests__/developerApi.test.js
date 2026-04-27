// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rejectDisallowedBrowserOrigin: vi.fn(() => false),
  applyCors: vi.fn(() => ({ allowed: true, origin: '' })),
  getSupabaseAdminClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  requireVerifierClient: vi.fn(),
  requireApiClient: vi.fn(),
  enforceRateLimit: vi.fn(async () => ({ allowed: true })),
  randomBytes: vi.fn(() => Buffer.from('ABCDEFGH')),
  resolveVerifiedBinding: vi.fn(),
  fetchBotSelfSummary: vi.fn(),
}));

vi.mock('../_lib/http.js', () => ({
  rejectDisallowedBrowserOrigin: mocks.rejectDisallowedBrowserOrigin,
  applyCors: mocks.applyCors,
}));

vi.mock('../_lib/authAdmin.js', () => ({
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

vi.mock('../_lib/devApiAuth.js', () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
  requireVerifierClient: mocks.requireVerifierClient,
  requireApiClient: mocks.requireApiClient,
}));

vi.mock('../_lib/devApiRateLimit.js', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

vi.mock('node:crypto', () => ({
  randomBytes: mocks.randomBytes,
}));

vi.mock('../_lib/botSummary.js', () => ({
  resolveVerifiedBinding: mocks.resolveVerifiedBinding,
  fetchBotSelfSummary: mocks.fetchBotSelfSummary,
}));

import devApplicationsHandler from '../_routes/dev/applications/index.js';
import bindingMeHandler from '../_routes/integrations/bindings/me.js';
import bindingVerifyHandler from '../_routes/integrations/bindings/verify.js';
import botSelfSummaryHandler from '../_routes/dev/v1/bot/self-summary.js';

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

function createApplicationsAdminClient(onInsert) {
  return {
    from: vi.fn((table) => {
      if (table !== 'api_clients') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        insert: vi.fn((payload) => {
          onInsert?.(payload);
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: 'client-1',
                  client_type: 'developer',
                  provider: null,
                  name: payload.name,
                  use_case: payload.use_case,
                  status: payload.status,
                  requested_scopes: payload.requested_scopes,
                  granted_scopes: payload.granted_scopes,
                  rate_limit_tier: payload.rate_limit_tier,
                  review_note: '',
                  approved_at: null,
                  created_at: '2026-04-22T00:00:00.000Z',
                  updated_at: '2026-04-22T00:00:00.000Z',
                },
                error: null,
              })),
            })),
          };
        }),
      };
    }),
  };
}

function createBindingsAdminClient({
  challengeRow,
  conflictRow = null,
  bindingRow = null,
  challengeUpdateSpy = vi.fn(),
}) {
  return {
    from: vi.fn((table) => {
      if (table === 'platform_binding_challenges') {
        return {
          select: vi.fn(() => {
            const chain = {
              eq: vi.fn(() => chain),
              limit: vi.fn(() => chain),
              maybeSingle: vi.fn(async () => ({ data: challengeRow, error: null })),
            };
            return chain;
          }),
          update: vi.fn((payload) => {
            challengeUpdateSpy(payload);
            return {
              eq: vi.fn(async () => ({ error: null })),
            };
          }),
        };
      }

      if (table === 'user_platform_bindings') {
        return {
          select: vi.fn(() => {
            const chain = {
              eq: vi.fn(() => chain),
              limit: vi.fn(() => chain),
              maybeSingle: vi.fn(async () => ({ data: conflictRow, error: null })),
            };
            return chain;
          }),
          update: vi.fn(() => {
            const chain = {
              eq: vi.fn(() => chain),
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: bindingRow, error: null })),
              })),
              single: vi.fn(async () => ({ data: bindingRow, error: null })),
            };
            return chain;
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function createBindingStatusAdminClient() {
  return {
    from: vi.fn((table) => {
      if (table === 'user_platform_bindings') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [
                  {
                    id: 'binding-1',
                    user_id: 'user-1',
                    provider: 'telegram',
                    platform_user_id: 'tg-private',
                    display_handle: '@tester',
                    status: 'verified',
                    verified_at: '2026-04-22T00:00:00.000Z',
                  },
                ],
                error: null,
              })),
            })),
          })),
        };
      }

      if (table === 'platform_binding_challenges') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [
                  {
                    id: 'challenge-1',
                    user_id: 'user-1',
                    provider: 'discord',
                    challenge_code: 'ABCD2345',
                    status: 'pending',
                    expires_at: '2099-01-01T00:00:00.000Z',
                  },
                ],
                error: null,
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe('developer api handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-1' },
      accessToken: 'token',
    });
    mocks.requireVerifierClient.mockResolvedValue({
      adminClient: null,
      client: { id: 'bot-client', provider: 'discord' },
    });
    mocks.requireApiClient.mockResolvedValue({
      adminClient: {},
      client: { id: 'bot-client', provider: 'discord', client_type: 'official_bot' },
        key: { key_prefix: 'egk_bot_prefix' },
    });
  });

  it('creates a developer application with only public.read scope', async () => {
    let insertedPayload = null;
    mocks.getSupabaseAdminClient.mockReturnValue(
      createApplicationsAdminClient((payload) => {
        insertedPayload = payload;
      })
    );

    const req = {
      method: 'POST',
      body: {
        name: 'My Tool',
        useCase: 'Read public banner and ranking data for a community dashboard.',
        requestedScopes: ['public.read', 'bot.self.read'],
      },
      headers: {},
    };
    const res = createJsonResponseRecorder();

    await devApplicationsHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(insertedPayload).toMatchObject({
      owner_user_id: 'user-1',
      client_type: 'developer',
      status: 'pending',
      requested_scopes: ['public.read'],
      granted_scopes: [],
    });
    expect(res.body?.data?.application?.requested_scopes).toEqual(['public.read']);
  });

  it('marks an expired binding challenge as expired', async () => {
    const challengeUpdateSpy = vi.fn();
    const adminClient = createBindingsAdminClient({
      challengeRow: {
        id: 'challenge-1',
        binding_id: 'binding-1',
        user_id: 'user-1',
        provider: 'discord',
        status: 'pending',
        expires_at: '2026-04-20T00:00:00.000Z',
      },
      challengeUpdateSpy,
    });

    mocks.requireVerifierClient.mockResolvedValue({
      adminClient,
      client: { id: 'official-discord', provider: 'discord' },
    });

    const req = {
      method: 'POST',
      body: {
        provider: 'discord',
        challengeCode: 'ABC123',
        platformUserId: 'discord-user-1',
      },
      headers: {},
    };
    const res = createJsonResponseRecorder();

    await bindingVerifyHandler(req, res);

    expect(res.statusCode).toBe(410);
    expect(challengeUpdateSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: 'expired',
    }));
    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: 'gone',
        message: 'Binding challenge expired',
      },
      meta: {
        apiVersion: 'v1',
      },
    });
  });

  it('loads own binding status without exposing platform user ids', async () => {
    mocks.getSupabaseAdminClient.mockReturnValue(createBindingStatusAdminClient());

    const req = {
      method: 'GET',
      query: {},
      headers: {},
    };
    const res = createJsonResponseRecorder();

    await bindingMeHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        bindings: expect.arrayContaining([
          expect.objectContaining({
            provider: 'telegram',
            binding: expect.objectContaining({
              display_handle: '@tester',
              status: 'verified',
            }),
          }),
          expect.objectContaining({
            provider: 'discord',
            challenge: expect.objectContaining({
              challenge_code: 'ABCD2345',
              status: 'pending',
            }),
          }),
        ]),
      },
      meta: {
        apiVersion: 'v1',
      },
    });
    expect(JSON.stringify(res.body)).not.toContain('tg-private');
    expect(JSON.stringify(res.body)).not.toContain('user-1');
  });

  it('rejects official bot self-summary when provider does not match the bot client', async () => {
    const req = {
      method: 'GET',
      query: {
        provider: 'telegram',
        platformUserId: 'tg-user',
      },
      headers: {},
    };
    const res = createJsonResponseRecorder();

    await botSelfSummaryHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(mocks.resolveVerifiedBinding).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: 'forbidden',
        message: 'Provider mismatch for official bot client',
      },
      meta: {
        apiVersion: 'v1',
      },
    });
  });
});
