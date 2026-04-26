import { describe, expect, it } from 'vitest';
import {
  buildImportNotificationRows,
  buildImportNotificationText,
  resolveCurrentPoolTarget,
} from '../_routes/integrations/bot/import-notify.js';

describe('import notify helpers', () => {
  it('builds import notification text without exposing raw uid and with affected pool names', () => {
    const text = buildImportNotificationText({
      summary: {
        total: 120,
        newRecords: 18,
        duplicates: 102,
        byPool: {
          '春雷动，万物生': 80,
          基础寻访: 40,
        },
        partialPools: [
          { type: 'weapon', poolName: '' },
        ],
        failedPools: [
          { type: 'extra' },
        ],
      },
      userInfo: {
        nickName: '老鲤船长',
        gameUid: '1545606431',
      },
    });

    expect(text).toContain('网页数据已更新');
    expect(text).toContain('账号：老鲤船长');
    expect(text).toContain('受影响卡池：春雷动，万物生 / 基础寻访 / 武器池');
    expect(text).not.toContain('1545606431');
  });

  it('builds action rows for analysis, current pool entry and re-import', () => {
    const rows = buildImportNotificationRows('https://example.com', {
      gameUid: '1545606431',
    });

    expect(rows).toEqual([
      [
        { text: '打开分析', url: 'https://example.com/dashboard?gameUid=1545606431' },
        { text: '当前池', url: 'https://example.com/dashboard?gameUid=1545606431' },
      ],
      [
        { text: '继续导入', url: 'https://example.com/dashboard?import=open' },
      ],
    ]);
  });

  it('resolves current pool target through the official bot API client', async () => {
    const calls = [];
    const apiClient = {
      async getSiteOverview() {
        calls.push('overview');
        return {
          active_pools: [
            { id: 'special_1_2_1' },
            { pool_id: 'weapon_1_2_1' },
          ],
        };
      },
      async getPoolStats({ provider, platformUserId }) {
        calls.push(`${provider}:${platformUserId}`);
        return {
          accounts: [
            {
              pools: [
                {
                  game_uid: '1545606431',
                  pool_id: 'standard',
                },
                {
                  game_uid: '1545606431',
                  pool_id: 'weapon_1_2_1',
                },
              ],
            },
          ],
        };
      },
    };

    await expect(resolveCurrentPoolTarget(apiClient, {
      provider: 'telegram',
      platformUserId: 'tg-10001',
      userInfo: {
        gameUid: '1545606431',
      },
    })).resolves.toEqual({
      gameUid: '1545606431',
      poolId: 'weapon_1_2_1',
    });
    expect(calls).toEqual(['overview', 'telegram:tg-10001']);
  });
});
