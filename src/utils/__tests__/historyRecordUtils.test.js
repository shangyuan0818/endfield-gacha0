import { describe, expect, it } from 'vitest';

import {
  MAX_HISTORY_PITY,
  clampHistoryPity,
  hasCompositeHistoryKey,
  splitHistoryUpsertGroups,
} from '../historyRecordUtils.js';

describe('historyRecordUtils', () => {
  it('clamps pity values into supported range', () => {
    expect(clampHistoryPity(null, 5)).toBe(5);
    expect(clampHistoryPity('12')).toBe(12);
    expect(clampHistoryPity(-3)).toBe(0);
    expect(clampHistoryPity(MAX_HISTORY_PITY + 10)).toBe(MAX_HISTORY_PITY);
    expect(clampHistoryPity('NaN', 7)).toBe(7);
  });

  it('detects composite keys only when uid, pool id and seq id are present', () => {
    expect(hasCompositeHistoryKey({
      game_uid: '10001',
      pool_id: 0,
      seq_id: '12345',
    })).toBe(true);

    expect(hasCompositeHistoryKey({
      game_uid: '10001',
      pool_id: null,
      seq_id: '12345',
    })).toBe(false);

    expect(hasCompositeHistoryKey({
      game_uid: '10001',
      pool_id: 'pool_a',
      seq_id: '',
    })).toBe(false);
  });

  it('splits records into composite-key and legacy groups', () => {
    const records = [
      { id: 1, game_uid: '10001', pool_id: 'pool_a', seq_id: '1' },
      { id: 2, game_uid: '10001', pool_id: null, seq_id: '2' },
      { id: 3, game_uid: '10001', pool_id: 'pool_b', seq_id: '3' },
      { id: 4, game_uid: '10001', pool_id: 'pool_c' },
    ];

    const result = splitHistoryUpsertGroups(records);

    expect(result.compositeKeyRecords).toEqual([records[0], records[2]]);
    expect(result.legacyRecords).toEqual([records[1], records[3]]);
  });
});
