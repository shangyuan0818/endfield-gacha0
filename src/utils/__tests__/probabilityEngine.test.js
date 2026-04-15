import { describe, expect, it } from 'vitest';

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
} from '../probabilityEngine.js';

describe('probabilityEngine', () => {
  it('keeps limited six-star probability at base rate before soft pity and increases afterwards', () => {
    const beforeSoftPity = calculateSixStarProbability(
      LIMITED_POOL_RULES.sixStarSoftPityStart - 1,
      LIMITED_POOL_RULES,
    );
    const atSoftPity = calculateSixStarProbability(
      LIMITED_POOL_RULES.sixStarSoftPityStart,
      LIMITED_POOL_RULES,
    );

    expect(beforeSoftPity).toBe(LIMITED_POOL_RULES.sixStarBaseProbability);
    expect(atSoftPity).toBeGreaterThan(LIMITED_POOL_RULES.sixStarBaseProbability);
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
});
