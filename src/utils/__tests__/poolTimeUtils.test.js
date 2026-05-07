import { describe, expect, it, vi } from 'vitest';

import {
  getActiveHomeCountdownPools,
  getHomeRotationPoolSchedule,
  getLimitedPoolScheduleFromDB,
} from '../poolTimeUtils.js';

vi.mock('../characterUtils.js', () => ({
  characterCache: {
    isLoaded: () => false,
    searchByName: () => null,
  },
  getCharacterAvatarUrl: (name) => `/avatars/${name}.webp`,
  resolveCharacterRecordByName: (name) => ({ name }),
}));

describe('poolTimeUtils homepage pool schedule', () => {
  const pools = [
    {
      id: 'limited_1',
      type: 'limited',
      name: '春雷动，万物生',
      up_character: '庄方宜',
      start_time: '2026-05-01T04:00:00.000Z',
      end_time: '2026-05-20T04:00:00.000Z',
    },
    {
      id: 'extra_1',
      type: 'extra',
      name: '辉光庆典',
      featured_characters: ['莱万汀', '艾尔黛拉', '别礼', '洁尔佩塔'],
      start_time: '2026-05-14T04:00:00.000Z',
      end_time: '2026-05-28T04:00:00.000Z',
    },
    {
      id: 'weapon_1',
      type: 'weapon',
      name: '锋刃审锻',
      up_character: '限定武器',
      start_time: '2026-05-14T04:00:00.000Z',
      end_time: '2026-05-28T04:00:00.000Z',
    },
  ];

  it('keeps the legacy limited schedule scoped to limited character pools', () => {
    const schedule = getLimitedPoolScheduleFromDB(pools);

    expect(schedule).toHaveLength(1);
    expect(schedule[0]).toMatchObject({
      name: '庄方宜',
      poolData: expect.objectContaining({ id: 'limited_1' }),
    });
  });

  it('adds extra pools to the homepage rotation schedule without adding weapon pools', () => {
    const schedule = getHomeRotationPoolSchedule(pools);

    expect(schedule.map((pool) => pool.poolType)).toEqual(['limited', 'extra']);
    expect(schedule[1]).toMatchObject({
      id: 'extra_1',
      displayName: '辉光庆典',
      featuredNames: ['莱万汀', '艾尔黛拉', '别礼', '洁尔佩塔'],
      poolType: 'extra',
    });
  });

  it('returns active limited and extra pools for homepage countdowns', () => {
    const activePools = getActiveHomeCountdownPools(pools, new Date('2026-05-15T04:00:00.000Z'));

    expect(activePools.map((pool) => pool.id)).toEqual(['limited_1', 'extra_1']);
    expect(activePools.every((pool) => pool.isActive)).toBe(true);
  });
});
