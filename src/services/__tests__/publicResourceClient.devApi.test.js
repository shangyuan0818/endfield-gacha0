import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('publicResourceClient development API opt-in', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('keeps public API disabled in local development unless the caller opts in', async () => {
    const fetchJsonWithTimeout = vi.fn(async () => ({
      response: { ok: true },
      data: {
        success: true,
        data: { siteAnnouncements: [{ id: 'ann-1' }] },
        meta: { cacheVersion: 'dev' },
      },
    }));

    vi.doMock('../supabaseRequest.js', () => ({
      fetchJsonWithTimeout,
      fetchWithTimeout: vi.fn(),
    }));

    vi.doMock('../../utils/storageUtils.js', () => ({
      readStorageValue: vi.fn(() => null),
      writeStorageValue: vi.fn(),
    }));

    const { fetchPublicApiJson, shouldUsePublicApi } = await import('../publicResourceClient.js');

    expect(shouldUsePublicApi()).toBe(false);
    await expect(fetchPublicApiJson('/api/announcements')).resolves.toBeNull();
    expect(fetchJsonWithTimeout).not.toHaveBeenCalled();

    const payload = await fetchPublicApiJson('/api/announcements', {
      params: { limit: '10' },
      usePublicApiInDev: true,
    });

    expect(payload?.data?.siteAnnouncements).toEqual([{ id: 'ann-1' }]);
    expect(fetchJsonWithTimeout).toHaveBeenCalledWith(
      '/api/announcements?limit=10&v=dev',
      expect.objectContaining({ method: 'GET' }),
      expect.objectContaining({ label: 'public api' })
    );
  });
});
