// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
  getBearerToken: vi.fn(() => null),
}));

vi.mock('../_lib/authAdmin.js', () => ({
  createSupabaseAccessTokenClient: vi.fn(),
  getBearerToken: mocks.getBearerToken,
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
  getSupabaseAnonServerClient: vi.fn(),
}));

import { requireApiClient } from '../_lib/devApiAuth.js';
import { buildSecretPrefix, hashOpaqueSecret } from '../_lib/devApiSecrets.js';

const VALID_SECRET = 'egk_contract_test_secret';
const VALID_PREFIX = buildSecretPrefix(VALID_SECRET);

function createSelectChain(result) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
  };
  return chain;
}

function createAdminClient({
  keyRow,
  keyError = null,
  clientRow,
  clientError = null,
} = {}) {
  const keyUpdateSpy = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: null })),
  }));

  const adminClient = {
    keyUpdateSpy,
    from: vi.fn((table) => {
      if (table === 'api_client_keys') {
        return {
          select: vi.fn(() => createSelectChain({ data: keyRow ?? null, error: keyError })),
          update: keyUpdateSpy,
        };
      }

      if (table === 'api_clients') {
        return {
          select: vi.fn(() => createSelectChain({ data: clientRow ?? null, error: clientError })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return adminClient;
}

function createRequest(secret = VALID_SECRET) {
  return {
    headers: {
      'x-api-key': secret,
    },
  };
}

function createKeyRow(overrides = {}) {
  return {
    id: 'key-1',
    client_id: 'client-1',
    key_prefix: VALID_PREFIX,
    key_hash: hashOpaqueSecret(VALID_SECRET),
    status: 'active',
    expires_at: null,
    ...overrides,
  };
}

function createClientRow(overrides = {}) {
  return {
    id: 'client-1',
    client_type: 'developer',
    status: 'active',
    granted_scopes: ['public.read'],
    rate_limit_tier: 'default',
    ...overrides,
  };
}

describe('developer API key authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts an active key for an active client and records last_used_at', async () => {
    const adminClient = createAdminClient({
      keyRow: createKeyRow(),
      clientRow: createClientRow(),
    });
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const result = await requireApiClient(createRequest(), {
      requiredScopes: ['public.read'],
    });

    expect(result.error).toBeUndefined();
    expect(result.client).toMatchObject({
      id: 'client-1',
      status: 'active',
    });
    expect(adminClient.keyUpdateSpy).toHaveBeenCalledWith({
      last_used_at: expect.any(String),
    });
  });

  it('rejects revoked or rotated-out keys before loading the client row', async () => {
    const adminClient = createAdminClient({
      keyRow: createKeyRow({ status: 'revoked' }),
      clientRow: createClientRow(),
    });
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const result = await requireApiClient(createRequest(), {
      requiredScopes: ['public.read'],
    });

    expect(result.error).toMatchObject({
      status: 401,
      message: 'Invalid API credential',
    });
    expect(adminClient.from).not.toHaveBeenCalledWith('api_clients');
    expect(adminClient.keyUpdateSpy).not.toHaveBeenCalled();
  });

  it('rejects expired keys without updating last_used_at', async () => {
    const adminClient = createAdminClient({
      keyRow: createKeyRow({ expires_at: '2020-01-01T00:00:00.000Z' }),
      clientRow: createClientRow(),
    });
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const result = await requireApiClient(createRequest(), {
      requiredScopes: ['public.read'],
    });

    expect(result.error).toMatchObject({
      status: 401,
      message: 'API key expired',
    });
    expect(adminClient.keyUpdateSpy).not.toHaveBeenCalled();
  });

  it('rejects inactive clients even when the key hash matches', async () => {
    const adminClient = createAdminClient({
      keyRow: createKeyRow(),
      clientRow: createClientRow({ status: 'revoked' }),
    });
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const result = await requireApiClient(createRequest(), {
      requiredScopes: ['public.read'],
    });

    expect(result.error).toMatchObject({
      status: 403,
      message: 'API client is not active',
    });
    expect(adminClient.keyUpdateSpy).not.toHaveBeenCalled();
  });

  it('rejects clients that do not have the required scope', async () => {
    const adminClient = createAdminClient({
      keyRow: createKeyRow(),
      clientRow: createClientRow({ granted_scopes: ['bot.self.read'] }),
    });
    mocks.getSupabaseAdminClient.mockReturnValue(adminClient);

    const result = await requireApiClient(createRequest(), {
      requiredScopes: ['public.read'],
    });

    expect(result.error).toMatchObject({
      status: 403,
      message: 'API scope not granted',
    });
    expect(adminClient.keyUpdateSpy).not.toHaveBeenCalled();
  });
});
