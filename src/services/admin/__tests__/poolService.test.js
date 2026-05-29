import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../supabaseClient.js', () => ({
  supabase: null,
}));

vi.mock('../../supabaseRequest.js', () => ({
  executeSupabaseRead: vi.fn(),
}));

vi.mock('../../../utils/appLogger.js', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { buildPoolAliasRowsForSave } from '../poolService.js';

describe('poolService alias helpers', () => {
  it('builds self aliases for the canonical pool id', () => {
    const rows = buildPoolAliasRowsForSave({
      canonicalPoolId: 'special_manual_limited_test_20260605_abc123',
    });

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pool_id: 'special_manual_limited_test_20260605_abc123',
        source: 'internal',
        alias_id: 'special_manual_limited_test_20260605_abc123',
        is_primary: true,
      }),
      expect.objectContaining({
        pool_id: 'special_manual_limited_test_20260605_abc123',
        source: 'manual_placeholder',
        alias_id: 'special_manual_limited_test_20260605_abc123',
        is_primary: true,
      }),
    ]));
  });

  it('keeps the edited previous id as a non-primary alias when canonical id changes', () => {
    const rows = buildPoolAliasRowsForSave({
      canonicalPoolId: 'special_1001',
      editingPool: {
        pool_id: 'special_manual_limited_laevatain_20260605_abc123',
      },
      poolData: {
        pool_id: 'special_1001',
      },
    });

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pool_id: 'special_1001',
        source: 'official_api',
        alias_id: 'special_1001',
        is_primary: true,
      }),
      expect.objectContaining({
        pool_id: 'special_1001',
        source: 'manual_placeholder',
        alias_id: 'special_manual_limited_laevatain_20260605_abc123',
        is_primary: false,
        note: 'Pool previous id alias',
      }),
    ]));
  });

  it('deduplicates repeated alias rows by source and alias id', () => {
    const rows = buildPoolAliasRowsForSave({
      canonicalPoolId: 'special_manual_limited_test_20260605_abc123',
      editingPool: {
        pool_id: 'special_manual_limited_test_20260605_abc123',
      },
      poolData: {
        pool_id: 'special_manual_limited_test_20260605_abc123',
      },
    });

    const keys = rows.map(row => `${row.source}:${row.alias_id}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
