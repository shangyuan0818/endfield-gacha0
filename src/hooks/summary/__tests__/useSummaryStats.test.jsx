import React from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useSummaryStats } from '../useSummaryStats.js';

vi.mock('../../../utils/gameAccountMetadata.js', () => ({
  classifyGameAccountRegionBucket: vi.fn(() => 'cn'),
}));

describe('useSummaryStats', () => {
  it('counts extra banner pulls separately and merges them into character banner aggregates', () => {
    const user = { id: 'user-1' };
    const pools = [
      { id: 'pool-extra', type: 'extra' },
      { id: 'pool-limited', type: 'limited', up_character: '洛茜' },
      { id: 'pool-standard', type: 'standard' },
    ];
    const history = [
      { id: 1, user_id: 'user-1', pool_id: 'pool-extra', rarity: 4, item_name: '四星A' },
      { id: 2, user_id: 'user-1', pool_id: 'pool-extra', rarity: 6, item_name: '附加六星A', isStandard: true },
      { id: 3, user_id: 'user-1', pool_id: 'pool-limited', rarity: 4, item_name: '四星B' },
      { id: 4, user_id: 'user-1', pool_id: 'pool-limited', rarity: 4, item_name: '四星C' },
      { id: 5, user_id: 'user-1', pool_id: 'pool-limited', rarity: 6, item_name: '洛茜' },
      { id: 6, user_id: 'user-1', pool_id: 'pool-standard', rarity: 6, item_name: '常驻六星A' },
      { id: 7, user_id: 'user-2', pool_id: 'pool-extra', rarity: 6, item_name: '其他人六星' },
    ];

    const { result } = renderHook(() => useSummaryStats(history, pools, user));

    expect(result.current.byType.extra.total).toBe(2);
    expect(result.current.byType.extra.six).toBe(1);
    expect(result.current.byType.extra.limitedSix).toBe(1);
    expect(result.current.byType.extra.counts).toMatchObject({
      6: 1,
      4: 1,
      '6_std': 0,
    });
    expect(result.current.byType.extra.avgPityUp).toBe('2.0');

    expect(result.current.byType.character.total).toBe(6);
    expect(result.current.byType.character.six).toBe(3);
    expect(result.current.byType.character.limitedSix).toBe(2);
    expect(result.current.byType.character.counts).toMatchObject({
      6: 2,
      '6_std': 1,
      4: 3,
    });
    expect(result.current.byType.character.avgPityUp).toBe('2.5');
    expect(result.current.byType.character.avgPityTarget).toBe('2.5');
  });
});
