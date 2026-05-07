import { describe, expect, it } from 'vitest';

import { createSimulator } from '../gachaSimulator.js';

describe('gachaSimulator state import', () => {
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
});
