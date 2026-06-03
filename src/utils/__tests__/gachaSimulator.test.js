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
});
