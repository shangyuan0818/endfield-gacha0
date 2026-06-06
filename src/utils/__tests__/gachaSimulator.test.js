import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSimulator } from '../gachaSimulator.js';

describe('gachaSimulator state import', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the current simulator pool type when importing stale saved state', () => {
    const simulator = createSimulator('extra');

    simulator.importState({
      poolType: 'limited',
      totalPulls: 90,
      pullHistory: [
        { pullNumber: 1, rarity: 4, characterName: 'Alpha' },
      ],
    });

    expect(simulator.getState()).toMatchObject({
      poolType: 'extra',
      totalPulls: 90,
    });
    expect(simulator.exportState()).toMatchObject({
      poolType: 'extra',
    });

    simulator.reset();
    expect(simulator.getState()).toMatchObject({
      poolType: 'extra',
      totalPulls: 0,
    });
  });

  it('keeps free ten-pulls from changing pity, paid pulls, target guarantee, or rewards', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    const simulator = createSimulator('limited');
    simulator.updateState({
      sixStarPity: 20,
      fiveStarPity: 8,
      totalPulls: 30,
      sixStarCount: 1,
      fiveStarCount: 2,
      guaranteedLimitedPity: 30,
      hasReceivedGuaranteedLimited: false,
      giftsReceived: 0,
    });

    const results = simulator.pullFreeTen();

    expect(results).toHaveLength(10);
    expect(results.some((result) => result.rarity >= 5)).toBe(true);
    expect(simulator.getState()).toMatchObject({
      sixStarPity: 20,
      fiveStarPity: 8,
      totalPulls: 30,
      sixStarCount: 1,
      fiveStarCount: 2,
      guaranteedLimitedPity: 30,
      hasReceivedGuaranteedLimited: false,
      giftsReceived: 0,
      freeTenPullsReceived: 1,
    });
    expect(simulator.getState().pullHistory).toHaveLength(10);
    expect(simulator.getState().pullHistory.every((pull) => pull.isFreePull === true)).toBe(true);
  });

  it('earns only one free ten-pull from paid limited pulls', () => {
    const simulator = createSimulator('limited');
    simulator.updateState({
      totalPulls: 90,
      freeTenPullsReceived: 0,
    });

    expect(simulator.getStatistics().freeTenPulls).toMatchObject({
      count: 1,
      isNewGift: true,
      nextGiftAt: null,
      remainingPulls: 0,
    });
  });

  it('caps recorded free ten-pull usage at one even if an old caller invokes it repeatedly', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    const simulator = createSimulator('extra');
    simulator.updateState({ totalPulls: 30 });

    simulator.pullFreeTen();
    simulator.pullFreeTen();

    expect(simulator.getState().freeTenPullsReceived).toBe(1);
  });

  it('rejects single pulls for weapon pools because weapons are claimed in sets of ten', () => {
    const simulator = createSimulator('weapon');

    expect(() => simulator.pullSingle()).toThrow('武器池按申领进行');
  });

  it('keeps roster avatar urls on four-star and five-star simulator results', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const roster = {
      up: [{ name: '测试UP', avatarUrl: '/avatars/up.webp' }],
      offBanner: [{ name: '测试常驻', avatarUrl: '/avatars/off.webp' }],
      fiveStar: [{ name: '测试五星', avatarUrl: '/avatars/five.webp' }],
      fourStar: [{ name: '测试四星', avatarUrl: '/avatars/four.webp' }],
    };

    const fiveStarSimulator = createSimulator('limited', null, '测试UP', roster);
    fiveStarSimulator.updateState({ fiveStarPity: 9 });
    expect(fiveStarSimulator.pullSingle()).toMatchObject({
      rarity: 5,
      characterName: '测试五星',
      avatarUrl: '/avatars/five.webp',
    });

    randomSpy.mockReturnValue(0.999);
    const fourStarSimulator = createSimulator('limited', null, '测试UP', roster);
    expect(fourStarSimulator.pullSingle()).toMatchObject({
      rarity: 4,
      characterName: '测试四星',
      avatarUrl: '/avatars/four.webp',
    });
  });

  it('runs weapon ten-pulls as one arsenal claim and advances claim-based pity', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    const simulator = createSimulator('weapon', null, '测试武器', {
      up: [{ name: '测试武器' }],
      offBanner: [{ name: '常驻武器' }],
      fiveStar: [{ name: '测试五星武器' }],
      fourStar: [{ name: '测试四星武器' }],
    });
    simulator.updateState({
      totalPulls: 70,
      sixStarPity: 10,
      guaranteedLimitedPity: 70,
      hasReceivedGuaranteedLimited: false,
    });

    const results = simulator.pullTen();

    expect(results).toHaveLength(10);
    expect(results.some((result) => result.rarity === 6 && result.isUp)).toBe(true);
    expect(simulator.getState()).toMatchObject({
      totalPulls: 80,
      sixStarPity: 0,
      guaranteedLimitedPity: 80,
      hasReceivedGuaranteedLimited: true,
      sixStarCount: 1,
      upSixStarCount: 1,
    });
    expect(simulator.getState().pullHistory).toHaveLength(10);
    expect(simulator.getStatistics().avgPullsPerSixStar).toBe('10.0');
  });
});
