import { describe, expect, it } from 'vitest';

import { convertRecord, mapPoolType } from '../endfieldImportAdapter.js';

describe('endfieldImportAdapter', () => {
  it('maps official Joint pool ids to the local extra pool type', () => {
    expect(mapPoolType('joint_1_2_2')).toBe('extra');
  });

  it('marks Joint pool records as limited targets for downstream off-banner logic', () => {
    const record = convertRecord({
      poolId: 'joint_1_2_2',
      poolName: '辉光庆典',
      charId: 'chr_0016_laevat',
      charName: '莱万汀',
      rarity: 6,
      isFree: false,
      isNew: true,
      gachaTs: '1778745600000',
      seqId: '682',
    });

    expect(record.pool).toBe('extra');
    expect(record.isLimited).toBe(true);
    expect(record.pool_id).toBe('joint_1_2_2');
  });
});
