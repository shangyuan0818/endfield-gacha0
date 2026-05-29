import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/admin/poolService.js', () => ({}));

vi.mock('../../../services/admin/publicCacheService.js', () => ({
  invalidatePublicCache: vi.fn(),
}));

vi.mock('../../../stores/index.js', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('../../../utils/characterUtils.js', () => ({
  characterCache: {
    refresh: vi.fn(),
  },
}));

import {
  buildPoolDataFromForm,
  buildPoolDraftDiff,
  normalizeDraftPoolCharacters,
} from '../usePools.js';

const characters = [
  { id: 'char_a', name: '莱万汀', type: 'character', rarity: 6 },
  { id: 'char_b', name: '伊冯', type: 'character', rarity: 6 },
  { id: 'char_c', name: '余烬', type: 'character', rarity: 5 },
  { id: 'weapon_a', name: '武器A', type: 'weapon', rarity: 6 },
];

describe('usePools draft helpers', () => {
  it('builds the same pool payload shape used by save and preview', () => {
    const { normalizedPoolType, poolData } = buildPoolDataFromForm({
      name: '  测试卡池  ',
      name_en: '',
      type: 'limited_character',
      up_character: ' 莱万汀 ',
      featured_characters_text: '不会用于普通池',
      banner_url: '',
      description: '  描述  ',
      start_time: '2026-06-05T12:00',
      end_time: '2026-06-26T12:00',
      is_limited_weapon: false,
      locked: false,
    });

    expect(normalizedPoolType).toBe('limited');
    expect(poolData).toMatchObject({
      name: '测试卡池',
      name_en: null,
      type: 'limited',
      up_character: '莱万汀',
      featured_characters: null,
      banner_url: null,
      description: '描述',
      is_limited_weapon: null,
      locked: false,
    });
    expect(poolData.start_time).toBe(new Date('2026-06-05T12:00').toISOString());
    expect(poolData.end_time).toBe(new Date('2026-06-26T12:00').toISOString());
  });

  it('normalizes roster rows by pool type and featured names', () => {
    expect(normalizeDraftPoolCharacters(
      [
        { character_id: 'char_a', is_up: false },
        { character_id: 'char_a', is_up: false },
        { character_id: 'weapon_a', is_up: true },
      ],
      characters,
      'limited',
      ['莱万汀']
    )).toEqual([
      { character_id: 'char_a', is_up: true },
    ]);
  });

  it('reports field-level and roster-level changes before saving', () => {
    const diff = buildPoolDraftDiff({
      editingPool: {
        pool_id: 'special_manual_old',
        name: '旧卡池',
        name_en: null,
        type: 'limited',
        up_character: '莱万汀',
        featured_characters: null,
        banner_url: null,
        description: null,
        start_time: new Date('2026-06-05T12:00').toISOString(),
        end_time: new Date('2026-06-26T12:00').toISOString(),
        is_limited_weapon: null,
      },
      poolForm: {
        name: '新卡池',
        name_en: '',
        type: 'limited',
        up_character: '伊冯',
        featured_characters_text: '',
        banner_url: '',
        description: '',
        start_time: '2026-06-05T12:00',
        end_time: '2026-06-26T12:00',
        is_limited_weapon: true,
        locked: false,
      },
      originalPoolCharacters: [
        { character_id: 'char_a', is_up: true },
        { character_id: 'char_c', is_up: false },
      ],
      editingPoolCharacters: [
        { character_id: 'char_b', is_up: false },
        { character_id: 'char_c', is_up: true },
      ],
      characters,
    });

    expect(diff.hasChanges).toBe(true);
    expect(diff.fieldChanges.map(change => change.key)).toEqual(['name', 'up_character']);
    expect(diff.roster.added.map(item => item.id)).toEqual(['char_b']);
    expect(diff.roster.removed.map(item => item.id)).toEqual(['char_a']);
    expect(diff.roster.upChanged.map(item => item.id)).toEqual(['char_c']);
    expect(diff.currentRows).toEqual([
      { character_id: 'char_b', is_up: true },
      { character_id: 'char_c', is_up: true },
    ]);
  });
});
