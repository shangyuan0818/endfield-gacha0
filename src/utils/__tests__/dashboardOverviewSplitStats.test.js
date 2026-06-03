import { describe, expect, it, vi } from 'vitest';

import { buildDashboardOverviewSplitStats } from '../dashboardOverviewSplitStats.js';

vi.mock('../characterUtils.js', () => ({
  resolveCharacterRecordByName: vi.fn((value) => {
    if (value === '歪限定角色' || value === 'chr_off_limited') {
      return { id: 'chr_off_limited', name: '歪限定角色', type: 'character', is_limited: true };
    }
    return null;
  }),
}));

describe('buildDashboardOverviewSplitStats', () => {
  it('counts off-rate limited characters in character split limited six-star averages', () => {
    const stats = buildDashboardOverviewSplitStats({
      selectedPools: [
        { id: 'pool_limited', type: 'limited' },
        { id: 'pool_weapon', type: 'weapon' },
      ],
      history: [
        { id: 1, poolId: 'pool_limited', rarity: 4 },
        { id: 2, poolId: 'pool_limited', rarity: 6, isStandard: false, character_name: '当期UP' },
        { id: 3, poolId: 'pool_limited', rarity: 6, isStandard: true, character_id: 'chr_off_limited' },
        { id: 4, poolId: 'pool_limited', rarity: 6, isStandard: true, character_name: '常驻角色' },
        { id: 5, poolId: 'pool_weapon', rarity: 6, isStandard: false, item_name: 'UP武器' },
      ],
    });

    expect(stats.character.counts).toMatchObject({
      6: 1,
      '6_std': 2,
    });
    expect(stats.character.avgPullCost[6]).toBe('4.00');
    expect(stats.character.avgPullCost['6_limited']).toBe('2.00');
    expect(stats.weapon.avgPullCost['6_limited']).toBe('0');
  });

  it('counts extra banner six stars as character target hits even when legacy records are marked standard', () => {
    const stats = buildDashboardOverviewSplitStats({
      selectedPools: [
        { id: 'pool_extra', type: 'extra' },
      ],
      history: [
        { id: 1, poolId: 'pool_extra', rarity: 4 },
        { id: 2, poolId: 'pool_extra', rarity: 6, isStandard: true, character_name: '莱万汀' },
      ],
    });

    expect(stats.character.counts).toMatchObject({
      6: 1,
      '6_std': 0,
      4: 1,
    });
    expect(stats.character.avgPullCost[6]).toBe('2.00');
    expect(stats.character.avgPullCost['6_limited']).toBe('2.00');
    expect(stats.character.pityStats.distribution[0]).toMatchObject({
      range: '1-10',
      limited: 1,
      standard: 0,
    });
  });

  it('includes free ten-pull results in split stats without advancing paid pity counters', () => {
    const baseInput = {
      selectedPools: [
        { id: 'pool_limited', type: 'limited' },
      ],
      history: [
        { id: 1, poolId: 'pool_limited', rarity: 4 },
        { id: 2, poolId: 'pool_limited', rarity: 6, isStandard: false, isFree: true },
        { id: 3, poolId: 'pool_limited', rarity: 6, isStandard: false },
      ],
    };

    const excluded = buildDashboardOverviewSplitStats(baseInput);
    const included = buildDashboardOverviewSplitStats({
      ...baseInput,
      includeFreePullsInStats: true,
    });

    expect(excluded.character.total).toBe(2);
    expect(excluded.character.counts[6]).toBe(1);
    expect(excluded.character.pityStats.history.map(({ count }) => count)).toEqual([2]);

    expect(included.character.total).toBe(3);
    expect(included.character.counts[6]).toBe(2);
    expect(included.character.pityStats.history.map(({ count }) => count)).toEqual([30, 2]);
    expect(included.character.pityStats.distribution[2]).toMatchObject({
      range: '21-30',
      limited: 1,
    });
  });
});
