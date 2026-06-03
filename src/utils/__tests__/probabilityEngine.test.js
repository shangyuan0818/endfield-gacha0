import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LIMITED_POOL_RULES,
  WEAPON_POOL_RULES,
} from '../../constants/index.js';
import {
  calculateExpectedPulls,
  calculateFiveStarProbability,
  calculateSixStarProbability,
  checkGiftAvailable,
  checkGuaranteedLimitedTrigger,
  checkInfoBookAvailable,
  simulateCharacterFreeTen,
} from '../probabilityEngine.js';

describe('probabilityEngine', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps limited six-star probability at base rate before soft pity and increases afterwards', () => {
    expect(LIMITED_POOL_RULES.sixStarSoftPityStart).toBe(66);
    expect(calculateSixStarProbability(65, LIMITED_POOL_RULES)).toBe(LIMITED_POOL_RULES.sixStarBaseProbability);
    expect(calculateSixStarProbability(66, LIMITED_POOL_RULES)).toBeGreaterThan(LIMITED_POOL_RULES.sixStarBaseProbability);
    expect(calculateSixStarProbability(LIMITED_POOL_RULES.sixStarPity, LIMITED_POOL_RULES)).toBe(1);
  });

  it('keeps weapon six-star probability fixed until hard pity', () => {
    expect(calculateSixStarProbability(1, WEAPON_POOL_RULES)).toBe(WEAPON_POOL_RULES.sixStarBaseProbability);
    expect(calculateSixStarProbability(WEAPON_POOL_RULES.sixStarPity, WEAPON_POOL_RULES)).toBe(1);
  });

  it('uses five-star base rate until pity and guarantees at pity', () => {
    expect(calculateFiveStarProbability(1, LIMITED_POOL_RULES)).toBe(LIMITED_POOL_RULES.fiveStarBaseProbability);
    expect(calculateFiveStarProbability(LIMITED_POOL_RULES.fiveStarPity, LIMITED_POOL_RULES)).toBe(1);
  });

  it('checks guaranteed limited trigger and reward thresholds', () => {
    expect(checkGuaranteedLimitedTrigger({
      guaranteedLimitedPity: LIMITED_POOL_RULES.guaranteedLimitedPity,
      hasReceivedGuaranteedLimited: false,
    })).toBe(true);

    expect(checkGuaranteedLimitedTrigger({
      guaranteedLimitedPity: LIMITED_POOL_RULES.guaranteedLimitedPity,
      hasReceivedGuaranteedLimited: true,
    })).toBe(false);

    expect(checkGiftAvailable(LIMITED_POOL_RULES.giftInterval, LIMITED_POOL_RULES)).toBe(true);
    expect(checkGiftAvailable(LIMITED_POOL_RULES.giftInterval - 1, LIMITED_POOL_RULES)).toBe(false);

    expect(checkInfoBookAvailable({
      hasReceivedInfoBook: false,
      totalPulls: LIMITED_POOL_RULES.infoBookThreshold,
    }, LIMITED_POOL_RULES)).toBe(true);
    expect(checkInfoBookAvailable({
      hasReceivedInfoBook: true,
      totalPulls: LIMITED_POOL_RULES.infoBookThreshold,
    }, LIMITED_POOL_RULES)).toBe(false);
  });

  it('returns a bounded expected pull count near hard pity', () => {
    expect(calculateExpectedPulls(LIMITED_POOL_RULES.sixStarPity - 1, LIMITED_POOL_RULES)).toBe(1);
    expect(calculateExpectedPulls(0, LIMITED_POOL_RULES)).toBeGreaterThan(0);
  });

  it('guarantees at least one five-star or higher result in character free ten-pulls', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    const results = simulateCharacterFreeTen(
      LIMITED_POOL_RULES,
      'limited',
      '测试UP',
      {
        up: ['测试UP'],
        fiveStar: ['测试五星'],
        fourStar: ['测试四星'],
      }
    );

    expect(results).toHaveLength(10);
    expect(results.some((result) => result.rarity >= 5)).toBe(true);
    expect(results.at(-1)).toMatchObject({
      rarity: 5,
      isUp: false,
      isLimited: false,
    });
  });
});
