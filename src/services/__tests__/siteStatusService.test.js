import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPublicSiteStatus } from '../siteStatusService.js';
import { fetchJsonWithTimeout } from '../supabaseRequest.js';

vi.mock('../supabaseRequest.js', () => ({
  fetchJsonWithTimeout: vi.fn(),
}));

describe('siteStatusService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchJsonWithTimeout.mockResolvedValue({
      response: {
        ok: true,
        status: 200,
      },
      data: {
        success: true,
        data: {
          generatedAt: '2026-06-04T02:00:00.000Z',
          overall: {
            level: 'ok',
            label: '服务运行正常',
            affectedCount: 0,
          },
          services: [
            {
              id: 'site',
              label: '主站',
              status: 'ok',
              summary: '状态页和静态资源可访问。',
              checkedAt: '2026-06-04T02:00:00.000Z',
            },
          ],
          incidents: [],
        },
        meta: {
          cacheVersion: 'cache-v1',
        },
      },
    });
  });

  it('loads public site status through the same-origin endpoint', async () => {
    await expect(loadPublicSiteStatus()).resolves.toMatchObject({
      overall: {
        level: 'ok',
      },
      services: [
        {
          id: 'site',
        },
      ],
      meta: {
        cacheVersion: 'cache-v1',
      },
    });

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/site-status', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    }, expect.objectContaining({
      label: 'site-status',
      retries: 1,
    }));
  });

  it('throws a readable error when the endpoint rejects the request', async () => {
    fetchJsonWithTimeout.mockResolvedValue({
      response: {
        ok: false,
        status: 500,
      },
      data: {
        success: false,
        error: '状态读取失败',
      },
    });

    await expect(loadPublicSiteStatus()).rejects.toThrow('状态读取失败');
  });
});
