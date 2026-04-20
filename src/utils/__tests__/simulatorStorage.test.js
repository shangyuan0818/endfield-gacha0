import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearAllSimulatorStates,
  convertSimulatorHistoryToImportFormat,
  saveSimulatorState,
} from '../simulatorStorage.js';

describe('simulatorStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('clears extra simulator state together with other pool states', () => {
    saveSimulatorState('limited', { pity: 10 });
    saveSimulatorState('extra', { pity: 20 });
    saveSimulatorState('weapon', { pity: 30 });
    saveSimulatorState('standard', { pity: 40 });

    clearAllSimulatorStates();

    expect(localStorage.getItem('gacha_simulator_state_limited')).toBeNull();
    expect(localStorage.getItem('gacha_simulator_state_extra')).toBeNull();
    expect(localStorage.getItem('gacha_simulator_state_weapon')).toBeNull();
    expect(localStorage.getItem('gacha_simulator_state_standard')).toBeNull();
  });

  it('exports extra simulator pulls using extra pool type', () => {
    const result = convertSimulatorHistoryToImportFormat([
      {
        rarity: 6,
        name: '佩丽卡',
        timestamp: 1710000000000,
        isUp: true,
      }
    ], 'sim_extra_demo', 'extra');

    expect(result).toEqual([
      expect.objectContaining({
        pool: 'extra',
        name: '佩丽卡',
        rarity: 6,
        isLimited: true,
      })
    ]);
  });
});
