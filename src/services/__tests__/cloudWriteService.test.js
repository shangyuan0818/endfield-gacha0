import { beforeEach, describe, expect, it, vi } from 'vitest';

import { upsertHistory, upsertPools } from '../cloudWriteService.js';
import { saveAccountGachaData } from '../accountGachaDataService.js';

vi.mock('../accountGachaDataService.js', () => ({
  saveAccountGachaData: vi.fn(),
}));

describe('cloudWriteService compatibility proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveAccountGachaData.mockResolvedValue({
      saved: {
        pools: 1,
        history: 1,
      },
      skipped: {
        pools: 0,
        history: 0,
      },
    });
  });

  it('proxies legacy pool upserts to the same-origin account gacha endpoint', async () => {
    const legacyClient = {
      from: vi.fn(),
    };

    await upsertPools(legacyClient, [
      {
        id: 'pool-1',
        name: '测试池',
      },
    ], 'user-1');

    expect(legacyClient.from).not.toHaveBeenCalled();
    expect(saveAccountGachaData).toHaveBeenCalledWith({
      pools: [
        {
          id: 'pool-1',
          name: '测试池',
          user_id: 'user-1',
        },
      ],
    });
  });

  it('proxies legacy history upserts to the same-origin account gacha endpoint', async () => {
    const legacyClient = {
      from: vi.fn(),
    };

    await upsertHistory(legacyClient, [
      {
        id: 1,
        poolId: 'pool-1',
        name: '测试角色',
      },
    ], 'user-1');

    expect(legacyClient.from).not.toHaveBeenCalled();
    expect(saveAccountGachaData).toHaveBeenCalledWith({
      history: [
        {
          id: 1,
          poolId: 'pool-1',
          name: '测试角色',
          user_id: 'user-1',
        },
      ],
    });
  });
});
