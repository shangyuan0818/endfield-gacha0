import { describe, expect, it } from 'vitest';

import { buildPendingImportPreview } from '../importPreviewUtils.js';

describe('buildPendingImportPreview', () => {
  it('does not treat endgacha history item names as detected accounts', () => {
    const preview = buildPendingImportPreview({
      data: {
        sourceFormatId: 'endgacha_kwer_top_plain_json',
        accountInfoMissing: true,
        pools: [{ id: 'pool-a', name: '熔铸申领' }],
        history: [
          {
            poolId: 'pool-a',
            name: '宏愿',
            rarity: 6,
            timestamp: '2026-01-22T02:16:29.004Z',
          },
        ],
      },
    });

    expect(preview.accountCount).toBe(0);
    expect(preview.primaryAccount).toBeNull();
    expect(preview.accountInfoMissing).toBe(true);
    expect(preview.rarityCounts[6]).toBe(1);
    expect(preview.sixStarDrops).toEqual([{ name: '宏愿', count: 1 }]);
  });

  it('still allows explicit account names from the accounts list', () => {
    const preview = buildPendingImportPreview({
      data: {
        accounts: [{ name: '手动账号' }],
        history: [],
        pools: [],
      },
    });

    expect(preview.accountCount).toBe(1);
    expect(preview.primaryAccount).toMatchObject({ nickName: '手动账号' });
  });
});
