import { describe, expect, it, vi } from 'vitest';

import { buildCharacterStats } from '../dashboardCharacterStats.js';

vi.mock('../historyInfoBook.js', () => ({
  isInfoBookHistoryPull: () => false,
}));

describe('dashboardCharacterStats', () => {
  it('inherits pity only for limited-pool entries in mixed overview history', () => {
    const history = [
      { id: 'l1', poolId: 'pool_limited', rarity: 4, item_name: 'A', timestamp: '2026-04-17T10:00:00.000Z' },
      { id: 'l2', poolId: 'pool_limited', rarity: 6, item_name: '限定角色', timestamp: '2026-04-17T10:01:00.000Z', isStandard: false },
      { id: 's1', poolId: 'pool_standard', rarity: 4, item_name: 'B', timestamp: '2026-04-18T10:00:00.000Z' },
      { id: 's2', poolId: 'pool_standard', rarity: 6, item_name: '常驻角色', timestamp: '2026-04-18T10:01:00.000Z', isStandard: true },
    ];

    const stats = buildCharacterStats({
      history,
      crossPoolPityMap: new Map([
        ['l2', { sixStarPity: 31, fiveStarPity: 10 }],
      ]),
      limitedPoolIds: new Set(['pool_limited']),
    });

    expect(stats.find((item) => item.name === '限定角色')?.pities).toEqual([31]);
    expect(stats.find((item) => item.name === '常驻角色')?.pities).toEqual([2]);
  });
});
