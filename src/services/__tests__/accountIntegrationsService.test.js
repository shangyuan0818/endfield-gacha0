import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createBindingChallenge,
  loadOwnBindings,
  notifyOfficialBotImportUpdated,
  revokeBinding,
} from '../accountIntegrationsService.js';
import { getSupabaseAccessToken } from '../authFetchService.js';
import { fetchWithTimeout } from '../supabaseRequest.js';

vi.mock('../authFetchService.js', () => ({
  getSupabaseAccessToken: vi.fn(),
}));

vi.mock('../supabaseRequest.js', () => ({
  fetchWithTimeout: vi.fn(),
}));

function createJsonResponse(payload, {
  ok = true,
  status = 200,
} = {}) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(payload),
  };
}

describe('accountIntegrationsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAccessToken.mockResolvedValue(null);
    fetchWithTimeout.mockResolvedValue(createJsonResponse({
      success: true,
      data: {
        bindings: [
          {
            provider: 'telegram',
          },
        ],
      },
    }));
  });

  it('loads bindings with same-origin cookies when no native token is available', async () => {
    await expect(loadOwnBindings()).resolves.toEqual([
      {
        provider: 'telegram',
      },
    ]);

    expect(getSupabaseAccessToken).toHaveBeenCalledWith({
      syncSiteSession: false,
      useSiteSessionCache: true,
      allowSiteSessionToken: false,
    });
    expect(fetchWithTimeout).toHaveBeenCalledWith('/api/integrations/bindings/me', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {},
    }, expect.objectContaining({
      label: 'binding-status',
    }));
  });

  it('adds Authorization only when a native Supabase token is available', async () => {
    getSupabaseAccessToken.mockResolvedValue('native-token');

    await loadOwnBindings();

    expect(fetchWithTimeout).toHaveBeenCalledWith('/api/integrations/bindings/me', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Authorization: 'Bearer native-token',
      },
    }, expect.any(Object));
  });

  it('creates binding challenges through the same-origin endpoint', async () => {
    fetchWithTimeout.mockResolvedValue(createJsonResponse({
      success: true,
      data: {
        code: '123456',
      },
    }));

    await expect(createBindingChallenge('telegram')).resolves.toEqual({
      code: '123456',
    });

    expect(fetchWithTimeout).toHaveBeenCalledWith('/api/integrations/bindings/challenge', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'telegram',
      }),
    }, expect.objectContaining({
      label: 'binding-challenge',
    }));
  });

  it('revokes bindings through the same-origin endpoint', async () => {
    fetchWithTimeout.mockResolvedValue(createJsonResponse({
      success: true,
      data: {
        revoked: true,
      },
    }));

    await expect(revokeBinding('telegram')).resolves.toEqual({
      revoked: true,
    });

    expect(fetchWithTimeout).toHaveBeenCalledWith('/api/integrations/bindings/revoke', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'telegram',
      }),
    }, expect.objectContaining({
      label: 'binding-revoke',
    }));
  });

  it('returns an authentication skip for optional binding reads and BOT import notifications', async () => {
    fetchWithTimeout.mockResolvedValue(createJsonResponse({
      success: false,
      code: 'authentication_required',
    }, {
      ok: false,
      status: 401,
    }));

    await expect(loadOwnBindings()).resolves.toEqual([]);
    await expect(notifyOfficialBotImportUpdated({
      summary: { saved: 1 },
      userInfo: { username: '博士' },
    })).resolves.toEqual({
      notified: false,
      reason: 'authentication_required',
    });
  });

  it('notifies the official BOT through the same-origin endpoint', async () => {
    fetchWithTimeout.mockResolvedValue(createJsonResponse({
      success: true,
      data: {
        notified: true,
      },
    }));

    await expect(notifyOfficialBotImportUpdated({
      summary: { saved: 1 },
      userInfo: { username: '博士' },
    })).resolves.toEqual({
      notified: true,
    });

    expect(fetchWithTimeout).toHaveBeenCalledWith('/api/integrations/bot/import-notify', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: { saved: 1 },
        userInfo: { username: '博士' },
      }),
    }, expect.objectContaining({
      label: 'official-bot-import-notify',
    }));
  });
});
