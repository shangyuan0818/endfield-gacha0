import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('statsService public data boundary', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('does not fallback to direct Supabase RPC for public stats when fallback is disabled', async () => {
    const fetchPublicApiJson = vi.fn(async () => null);
    const executeSupabaseRpc = vi.fn(async () => ({
      data: { totalPulls: 1 },
      error: null,
    }));

    vi.doMock('../../supabaseClient.js', () => ({
      supabase: {
        rpc: vi.fn(),
      },
    }));

    vi.doMock('../publicResourceClient.js', () => ({
      fetchPublicApiJson,
      shouldAllowPublicSupabaseFallback: vi.fn(() => false),
    }));

    vi.doMock('../supabaseRequest.js', () => ({
      SUPABASE_RPC_TIMEOUT_MS: 30000,
      executeSupabaseRpc,
      isRetryableSupabaseError: vi.fn(() => false),
    }));

    vi.doMock('../../utils/appLogger.js', () => ({
      appLogger: {
        warn: vi.fn(),
        error: vi.fn(),
      },
    }));

    vi.doMock('../../utils/storageUtils.js', () => ({
      STORAGE_KEYS: {
        GLOBAL_SUMMARY_STATS_SNAPSHOT: 'global-summary',
        CHARACTER_RANKING_SNAPSHOT: 'character-ranking',
        CHARACTER_CATALOG_SNAPSHOT: 'character-catalog',
        USER_RANKING_SNAPSHOT_PREFIX: 'user-ranking:',
      },
      readStorageValue: vi.fn(() => null),
      writeStorageValue: vi.fn(),
    }));

    const { getGlobalSummaryStats } = await import('../statsService.js');
    const result = await getGlobalSummaryStats(true);

    expect(fetchPublicApiJson).toHaveBeenCalledWith('/api/stats', expect.objectContaining({
      params: { type: 'global_summary' },
    }));
    expect(fetchPublicApiJson).toHaveBeenCalledWith('/api/stats', expect.objectContaining({
      params: { type: 'character_catalog' },
    }));
    expect(executeSupabaseRpc).not.toHaveBeenCalled();
    expect(result?.meta).toMatchObject({
      status: 'unavailable',
      source: 'missing-stats-api',
    });
  });
});
