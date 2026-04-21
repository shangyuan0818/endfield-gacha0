import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockedPoolCharactersRows = vi.hoisted(() => ({ value: [] }));

vi.mock('../../supabaseClient.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({
          data: mockedPoolCharactersRows.value,
          error: null,
        })),
      })),
    })),
  },
}));

import { characterCache } from '../characterUtils.js';
import { resolvePoolRosterBuckets } from '../poolRoster.js';

describe('poolRoster', () => {
  beforeEach(() => {
    characterCache.clear();
    mockedPoolCharactersRows.value = [];
  });

  afterEach(() => {
    characterCache.clear();
    mockedPoolCharactersRows.value = [];
  });

  it('keeps explicit six-star weapon roster when fallback contains unrelated weapons', async () => {
    characterCache.applyCharacters([
      {
        id: 'weapon_up',
        name: '焰羽火燎',
        rarity: 6,
        type: 'weapon',
        pool_config: { pools: ['weapon'] },
      },
      {
        id: 'weapon_in_pool',
        name: '行舟审锻',
        rarity: 6,
        type: 'weapon',
        pool_config: { pools: ['weapon'] },
      },
      {
        id: 'weapon_outside_pool',
        name: '池外武器',
        rarity: 6,
        type: 'weapon',
        pool_config: { pools: ['weapon'] },
      },
      {
        id: 'weapon_five_star',
        name: '制式副武',
        rarity: 5,
        type: 'weapon',
        pool_config: { pools: ['weapon'] },
      },
    ]);

    mockedPoolCharactersRows.value = [
      {
        is_up: true,
        characters: {
          id: 'weapon_up',
          name: '焰羽火燎',
          rarity: 6,
          type: 'weapon',
          pool_config: { pools: ['weapon'] },
        },
      },
      {
        is_up: false,
        characters: {
          id: 'weapon_in_pool',
          name: '行舟审锻',
          rarity: 6,
          type: 'weapon',
          pool_config: { pools: ['weapon'] },
        },
      },
    ];

    const roster = await resolvePoolRosterBuckets({
      poolId: 'pool_weapon_current',
      expectedType: 'weapon',
      currentUpName: '焰羽火燎',
      poolType: 'weapon',
      mergeStrategy: 'append',
    });

    expect(roster.up.map((entry) => entry.name)).toEqual(['焰羽火燎']);
    expect(roster.offBanner.map((entry) => entry.name)).toEqual(['行舟审锻']);
    expect(roster.sixStar).toEqual(['焰羽火燎', '行舟审锻']);
    expect(roster.fiveStar).toContain('制式副武');
    expect(roster.offBanner.map((entry) => entry.name)).not.toContain('池外武器');
  });
});
