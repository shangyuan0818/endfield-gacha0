import React from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { usePoolStats } from '../usePoolStats.js';

vi.mock('../../../stores/useHistoryStore.js', () => ({
  default: (selector) => selector({
    manualPityLimit: null,
    historyFilter: 'all',
  }),
}));

vi.mock('../useCurrentPoolGroupedHistory.js', () => ({
  useCurrentPoolGroupedHistory: (history) => ({
    groupedHistory: history.length ? [history] : [],
    filteredGroupedHistory: history.length ? [history] : [],
  }),
}));

vi.mock('../../../utils/resourceEconomy.js', () => ({
  buildPoolResourceSummary: vi.fn(({ totalPulls, chargedPulls }) => ({
    totalPulls,
    chargedPulls,
  })),
}));

vi.mock('../../../utils/characterUtils.js', () => ({
  characterCache: {
    searchByName: vi.fn(() => null),
  },
}));

describe('usePoolStats', () => {
  it('computes current pool stats while excluding free and gift pulls from core counts', () => {
    const normalizedCurrentPoolHistory = [
      {
        id: 'r1',
        rarity: 6,
        isStandard: false,
        poolId: 'pool_current',
        timestamp: '2026-04-15T10:00:00.000Z',
        seqId: '1',
        character_name: '洛茜',
      },
      {
        id: 'r2',
        rarity: 4,
        poolId: 'pool_current',
        timestamp: '2026-04-15T10:01:00.000Z',
        seqId: '2',
      },
      {
        id: 'r3',
        rarity: 5,
        poolId: 'pool_current',
        timestamp: '2026-04-15T10:02:00.000Z',
        seqId: '3',
      },
      {
        id: 'r4',
        rarity: 4,
        poolId: 'pool_current',
        timestamp: '2026-04-15T10:03:00.000Z',
        seqId: '4',
        isFree: true,
      },
      {
        id: 'r5',
        rarity: 6,
        poolId: 'pool_current',
        timestamp: '2026-04-15T10:04:00.000Z',
        seqId: '5',
        specialType: 'gift',
      },
    ];

    const { result } = renderHook(() => usePoolStats({
      normalizedCurrentPoolHistory,
      currentPool: {
        id: 'pool_current',
        type: 'limited',
        isGroupMode: false,
      },
      allLimitedHistory: normalizedCurrentPoolHistory,
      currentPoolId: 'pool_current',
    }));

    expect(result.current.stats.total).toBe(3);
    expect(result.current.stats.counts).toMatchObject({
      6: 1,
      5: 1,
      4: 1,
      '6_std': 0,
    });
    expect(result.current.stats.currentPity).toBe(2);
    expect(result.current.stats.currentPity5).toBe(0);
    expect(result.current.stats.resourceSummary).toEqual({
      totalPulls: 3,
      chargedPulls: 3,
    });
    expect(result.current.effectivePity).toEqual({
      pity6: 2,
      pity5: 0,
      isInherited: false,
    });
  });

  it('uses cross-pool limited history when inherited pity should carry over', () => {
    const allLimitedHistory = [
      {
        id: 'a1',
        rarity: 6,
        isStandard: false,
        poolId: 'pool_old',
        timestamp: '2026-04-10T10:00:00.000Z',
        seqId: '1',
      },
      {
        id: 'a2',
        rarity: 4,
        poolId: 'pool_new',
        timestamp: '2026-04-10T10:01:00.000Z',
        seqId: '2',
      },
      {
        id: 'a3',
        rarity: 4,
        poolId: 'pool_new',
        timestamp: '2026-04-10T10:02:00.000Z',
        seqId: '3',
      },
    ];

    const { result } = renderHook(() => usePoolStats({
      normalizedCurrentPoolHistory: [],
      currentPool: {
        id: 'pool_new',
        type: 'limited',
        isGroupMode: false,
      },
      allLimitedHistory,
      currentPoolId: 'pool_new',
    }));

    expect(result.current.inheritedPityInfo).toEqual({
      inheritedPity: 2,
      inheritedPity5: 2,
      hasInheritedPity: true,
    });
    expect(result.current.effectivePity).toEqual({
      pity6: 2,
      pity5: 2,
      isInherited: true,
    });
  });
});
