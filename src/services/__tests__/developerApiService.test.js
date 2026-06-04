import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadMyDeveloperApplications,
  submitDeveloperApplication,
} from '../developerApiService.js';
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

describe('developerApiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAccessToken.mockResolvedValue(null);
    fetchWithTimeout.mockResolvedValue(createJsonResponse({
      success: true,
      data: {
        applications: [
          {
            id: 'application-1',
          },
        ],
      },
    }));
  });

  it('loads own developer applications with same-origin cookies when no native token is available', async () => {
    await expect(loadMyDeveloperApplications()).resolves.toEqual([
      {
        id: 'application-1',
      },
    ]);

    expect(getSupabaseAccessToken).toHaveBeenCalledWith({
      syncSiteSession: false,
      useSiteSessionCache: true,
      allowSiteSessionToken: false,
    });
    expect(fetchWithTimeout).toHaveBeenCalledWith('/api/dev/applications/me', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {},
    }, expect.objectContaining({
      label: 'dev-applications-me',
    }));
  });

  it('adds Authorization only when a native Supabase token is available', async () => {
    getSupabaseAccessToken.mockResolvedValue('native-token');

    await loadMyDeveloperApplications();

    expect(fetchWithTimeout).toHaveBeenCalledWith('/api/dev/applications/me', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Authorization: 'Bearer native-token',
      },
    }, expect.any(Object));
  });

  it('submits applications through the same-origin endpoint', async () => {
    fetchWithTimeout.mockResolvedValue(createJsonResponse({
      success: true,
      data: {
        application: {
          id: 'application-2',
          requested_scopes: ['public.read'],
        },
      },
    }));

    await expect(submitDeveloperApplication({
      name: '测试应用',
      useCase: '做公开统计展示',
    })).resolves.toEqual({
      id: 'application-2',
      requested_scopes: ['public.read'],
    });

    expect(fetchWithTimeout).toHaveBeenCalledWith('/api/dev/applications', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '测试应用',
        useCase: '做公开统计展示',
        requestedScopes: ['public.read'],
      }),
    }, expect.objectContaining({
      label: 'dev-applications-create',
    }));
  });

  it('surfaces application API errors', async () => {
    fetchWithTimeout.mockResolvedValue(createJsonResponse({
      success: false,
      error: '申请内容不完整',
    }, {
      ok: false,
      status: 400,
    }));

    await expect(loadMyDeveloperApplications()).rejects.toThrow('申请内容不完整');
  });
});
