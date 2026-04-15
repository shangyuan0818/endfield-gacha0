import { describe, expect, it } from 'vitest';

import {
  calculateCurrentProbability,
  calculatePity5FromHistory,
  calculatePityFromHistory,
  getPoolRules,
  validatePullData,
} from '../validators.js';

describe('validators', () => {
  it('returns weapon rules for weapon pool', () => {
    expect(getPoolRules('weapon')).toMatchObject({
      hasSoftPity: false,
      sixStarPity: 40,
    });
  });

  it('keeps limited pool probability at base rate before soft pity', () => {
    const result = calculateCurrentProbability(10, 'limited');
    expect(result).toMatchObject({
      isInSoftPity: false,
      hasSoftPity: true,
    });
    expect(result.probability).toBe(getPoolRules('limited').sixStarBaseProbability);
  });

  it('increases limited pool probability after soft pity starts', () => {
    const rules = getPoolRules('limited');
    const result = calculateCurrentProbability(rules.sixStarSoftPityStart, 'limited');

    expect(result.isInSoftPity).toBe(true);
    expect(result.probability).toBeGreaterThan(rules.sixStarBaseProbability);
    expect(result.probability).toBeLessThanOrEqual(1);
  });

  it('validates pull payload structure', () => {
    const invalid = validatePullData({
      rarity: 3,
      poolId: '',
      specialType: 'invalid',
    });

    expect(invalid.isValid).toBe(false);
    expect(invalid.errors).toEqual(expect.arrayContaining([
      '无效的星级: 3',
      '缺少卡池ID',
      '无效的特殊类型: invalid',
    ]));
  });

  it('calculates pity counters from latest six-star and five-star records', () => {
    const pulls = [
      { rarity: 6 },
      { rarity: 4 },
      { rarity: 4 },
      { rarity: 5 },
      { rarity: 4 },
    ];

    expect(calculatePityFromHistory(pulls)).toBe(4);
    expect(calculatePity5FromHistory(pulls)).toBe(1);
  });
});
