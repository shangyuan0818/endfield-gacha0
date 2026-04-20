import { describe, expect, it } from 'vitest';

import {
  extractCharNameFromPoolName,
  extractDrawerFromPoolName,
  extractTypeFromPoolName,
  groupPoolsByDrawer,
  normalizeIsStandard,
} from '../poolUtils.js';

describe('poolUtils', () => {
  it('normalizes non-six-star pulls as not standard', () => {
    expect(normalizeIsStandard({ rarity: 5 }, 'limited', '洛茜')).toBe(false);
  });

  it('treats six-stars in standard and beginner pools as standard', () => {
    expect(normalizeIsStandard({ rarity: 6 }, 'standard')).toBe(true);
    expect(normalizeIsStandard({ rarity: 6 }, 'beginner')).toBe(true);
  });

  it('treats six-stars in extra pools like limited banners', () => {
    expect(normalizeIsStandard({ rarity: 6, character_name: '佩丽卡' }, 'extra', '佩丽卡')).toBe(false);
    expect(normalizeIsStandard({ rarity: 6, item_name: '其他六星' }, 'extra', '佩丽卡')).toBe(true);
    expect(normalizeIsStandard({ rarity: 6, isLimited: false }, 'extra')).toBe(true);
  });

  it('derives limited off-banner state from up character name when available', () => {
    expect(normalizeIsStandard({ rarity: 6, character_name: '洛茜' }, 'limited', '洛茜')).toBe(false);
    expect(normalizeIsStandard({ rarity: 6, item_name: '洁尔佩塔' }, 'limited', '洛茜')).toBe(true);
  });

  it('falls back to isLimited when up character is missing', () => {
    expect(normalizeIsStandard({ rarity: 6, isLimited: true }, 'limited')).toBe(false);
    expect(normalizeIsStandard({ rarity: 6, isLimited: false }, 'weapon')).toBe(true);
    expect(normalizeIsStandard({ rarity: 6 }, 'limited')).toBe(false);
  });

  it('extracts drawer, character and type from pool names', () => {
    expect(extractDrawerFromPoolName('限定-洛茜-阿明')).toBe('阿明');
    expect(extractCharNameFromPoolName('限定-洛茜-阿明')).toBe('洛茜');
    expect(extractTypeFromPoolName('附加-四人混池-阿明')).toBe('extra');
    expect(extractTypeFromPoolName('常驻 - 默认卡池')).toBe('standard');
    expect(extractTypeFromPoolName('武器-洛茜专武-阿明')).toBe('weapon');
    expect(extractTypeFromPoolName('洛茜精选')).toBe('limited');
  });

  it('groups pools by extracted drawer and falls back to 未分组', () => {
    const pools = [
      { id: 'a', name: '限定-洛茜-阿明' },
      { id: 'b', name: '武器-阿明' },
      { id: 'c', name: '无分隔名称' },
    ];

    expect(groupPoolsByDrawer(pools)).toEqual({
      阿明: [pools[0], pools[1]],
      未分组: [pools[2]],
    });
  });
});
