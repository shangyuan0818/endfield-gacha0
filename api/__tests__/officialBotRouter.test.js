import { describe, expect, it, vi } from 'vitest';
import { EndfieldApiError } from '../../bots/official/endfieldApiClient.js';
import { createOfficialBotRouter } from '../../bots/official/router.js';

function createApiClient(overrides = {}) {
  return {
    verifyBinding: vi.fn(),
    getDashboard: vi.fn(),
    getPoolStats: vi.fn(),
    getPoolDetail: vi.fn(),
    getSiteOverview: vi.fn(),
    getRecentPulls: vi.fn(),
    getRankings: vi.fn(),
    ...overrides,
  };
}

describe('createOfficialBotRouter', () => {
  it('uses plain binding code as verify command', async () => {
    const apiClient = createApiClient({
      verifyBinding: vi.fn().mockResolvedValue({
        binding: { display_handle: '@tester' },
      }),
    });

    const router = createOfficialBotRouter({
      provider: 'telegram',
      apiClient,
      siteUrl: 'https://example.com',
    });

    const reply = await router.handleMessage({
      text: 'ABCD2345',
      platformUserId: '1001',
      displayHandle: '@tester',
      isPrivateChat: true,
    });

    expect(apiClient.verifyBinding).toHaveBeenCalledWith({
      provider: 'telegram',
      challengeCode: 'ABCD2345',
      platformUserId: '1001',
      displayHandle: '@tester',
    });
    expect(reply.text).toContain('绑定成功');
  });

  it('returns binding guidance when /me is called before verification', async () => {
    const apiClient = createApiClient({
      getDashboard: vi.fn().mockRejectedValue(
        new EndfieldApiError('Verified binding not found', { status: 404 })
      ),
    });

    const router = createOfficialBotRouter({
      provider: 'telegram',
      apiClient,
      siteUrl: 'https://example.com',
    });

    const reply = await router.handleMessage({
      text: '/me',
      platformUserId: '1001',
      displayHandle: '@tester',
      isPrivateChat: true,
    });

    expect(reply.text).toContain('尚未完成绑定');
  });

  it('blocks sensitive commands in group chats', async () => {
    const apiClient = createApiClient();
    const router = createOfficialBotRouter({
      provider: 'telegram',
      apiClient,
      siteUrl: 'https://example.com',
    });

    const reply = await router.handleMessage({
      text: '/bind',
      platformUserId: '1001',
      displayHandle: '@tester',
      isPrivateChat: false,
    });

    expect(reply.text).toContain('私聊官方 BOT');
  });

  it('formats ranking response with top sections', async () => {
    const apiClient = createApiClient({
      getRankings: vi.fn().mockResolvedValue({
        limited: {
          sixStarUp: [{ name: '狼拍', count: 12 }],
        },
        standard: {
          sixStar: [{ name: '别扎', count: 9 }],
        },
        weapon: {
          sixStarUp: [{ name: '行舟中缀', count: 5 }],
        },
      }),
    });

    const router = createOfficialBotRouter({
      provider: 'telegram',
      apiClient,
      siteUrl: 'https://example.com',
    });

    const reply = await router.handleMessage({
      text: '/rank',
      platformUserId: '1001',
      displayHandle: '@tester',
      isPrivateChat: true,
    });

    expect(reply.text).toContain('公开榜单摘录');
    expect(reply.text).toContain('狼拍');
    expect(reply.text).toContain('行舟中缀');
    expect(reply.replyMarkup?.inline_keyboard?.length).toBeGreaterThan(0);
  });

  it('formats dashboard summary without exposing raw uid or pool id', async () => {
    const apiClient = createApiClient({
      getDashboard: vi.fn().mockResolvedValue({
        user: { username: '站内用户' },
        summary: {
          primary_account_name: '老鲤船长',
          total_pulls: 1131,
          six_star_count: 34,
          five_star_count: 147,
          pool_count: 11,
          latest_pull: {
            item_name: '庄方宜',
            rarity: 6,
            pool_name: '春雷动，万物生',
            account_name: '老鲤船长',
          },
          recommended_pool: {
            game_uid: '1545606431',
            pool_id: 'special_1',
            current_pity: 33,
            current_probability: 0.008,
            display_name: '春雷动，万物生',
          },
        },
      }),
    });

    const router = createOfficialBotRouter({
      provider: 'telegram',
      apiClient,
      siteUrl: 'https://example.com',
    });

    const reply = await router.handleMessage({
      text: '/me',
      platformUserId: '1001',
      displayHandle: '@tester',
      isPrivateChat: true,
    });

    expect(reply.text).toContain('老鲤船长 的账号总览');
    expect(reply.text).toContain('当前推荐入口：春雷动，万物生');
    expect(reply.text).not.toContain('1545606431');
    expect(reply.text).not.toContain('special_1');
  });

  it('renders paged pool list without exposing raw identifiers', async () => {
    const apiClient = createApiClient({
      getPoolStats: vi.fn().mockResolvedValue({
        accounts: [
          {
            game_uid: '1545606431',
            display_name: '老鲤船长',
            pools: [
              {
                game_uid: '1545606431',
                pool_id: 'special_1',
                share_target: { game_uid: '1545606431', pool_id: 'special_1' },
                display_name: '春雷动，万物生',
                pool_type: 'limited',
                current_pity: 33,
                current_probability: 0.008,
                status: 'active',
                remaining_label: '剩 2天3小时',
              },
            ],
          },
        ],
      }),
    });

    const router = createOfficialBotRouter({
      provider: 'telegram',
      apiClient,
      siteUrl: 'https://example.com',
    });

    const reply = await router.handleMessage({
      text: '/pools',
      platformUserId: '1001',
      displayHandle: '@tester',
      isPrivateChat: true,
    });

    expect(reply.text).toContain('各池列表');
    expect(reply.text).toContain('春雷动，万物生');
    expect(reply.text).not.toContain('1545606431');
    expect(reply.text).not.toContain('special_1');
    expect(reply.replyMarkup?.inline_keyboard?.flat().some((item) => item.text.includes('详情'))).toBe(true);
  });

  it('does not use raw game uid as the visible account fallback', async () => {
    const apiClient = createApiClient({
      getPoolStats: vi.fn().mockResolvedValue({
        accounts: [
          {
            game_uid: '1545606431',
            display_name: '',
            pools: [
              {
                game_uid: '1545606431',
                pool_id: 'special_1',
                share_target: { game_uid: '1545606431', pool_id: 'special_1' },
                display_name: '春雷动，万物生',
                pool_type: 'limited',
                current_pity: 33,
                current_probability: 0.008,
              },
            ],
          },
        ],
      }),
    });

    const router = createOfficialBotRouter({
      provider: 'telegram',
      apiClient,
      siteUrl: 'https://example.com',
    });

    const reply = await router.handleMessage({
      text: '/pools',
      platformUserId: '1001',
      displayHandle: '@tester',
      isPrivateChat: true,
    });

    expect(reply.text).toContain('账号：未命名账号');
    expect(reply.text).not.toContain('1545606431');
  });

  it('formats current active pools with probability and website action buttons', async () => {
    const apiClient = createApiClient({
      getSiteOverview: vi.fn().mockResolvedValue({
        active_pools: [
          {
            pool_id: 'special_1',
            name: '春雷动，万物生',
            featured_characters: ['庄方宜'],
            type: 'limited',
            status: 'active',
            countdown: { days: 2, hours: 3, minutes: 0, has_started: false },
          },
        ],
      }),
      getPoolStats: vi.fn().mockResolvedValue({
        latest_pool: {
          game_uid: '1545606431',
          account_name: '老鲤船长',
          pool_id: 'special_1',
        },
        accounts: [
          {
            game_uid: '1545606431',
            display_name: '老鲤船长',
            pools: [
              {
                game_uid: '1545606431',
                pool_id: 'special_1',
                share_target: { game_uid: '1545606431', pool_id: 'special_1' },
                account_name: '老鲤船长',
                display_name: '春雷动，万物生',
                current_pity: 20,
                current_probability: 0.008,
              },
            ],
          },
        ],
      }),
    });

    const router = createOfficialBotRouter({
      provider: 'telegram',
      apiClient,
      siteUrl: 'https://example.com',
    });

    const reply = await router.handleMessage({
      text: '/current',
      platformUserId: '1001',
      displayHandle: '@tester',
      isPrivateChat: true,
    });

    expect(reply.text).toContain('当前活动池');
    expect(reply.text).toContain('当前 6★ 概率 0.8%');
    expect(reply.text).not.toContain('special_1');
    expect(reply.text).not.toContain('1545606431');
    expect(reply.replyMarkup?.inline_keyboard?.flat().some((item) => item.text === '分享卡')).toBe(true);
  });

  it('renders current-pool action buttons for multiple accounts on the same active pool', async () => {
    const apiClient = createApiClient({
      getSiteOverview: vi.fn().mockResolvedValue({
        active_pools: [
          {
            pool_id: 'special_1',
            name: '春雷动，万物生',
            featured_characters: ['庄方宜'],
            type: 'limited',
            status: 'active',
            countdown: { days: 2, hours: 3, minutes: 0, has_started: false },
          },
        ],
      }),
      getPoolStats: vi.fn().mockResolvedValue({
        latest_pool: {
          game_uid: '1545606431',
          account_name: '老鲤船长',
          pool_id: 'special_1',
        },
        accounts: [
          {
            game_uid: '1545606431',
            display_name: '老鲤船长',
            pools: [
              {
                game_uid: '1545606431',
                pool_id: 'special_1',
                share_target: { game_uid: '1545606431', pool_id: 'special_1' },
                account_name: '老鲤船长',
                display_name: '春雷动，万物生',
                current_pity: 20,
                current_probability: 0.008,
              },
            ],
          },
          {
            game_uid: '6884264892',
            display_name: '牛逼',
            pools: [
              {
                game_uid: '6884264892',
                pool_id: 'special_1',
                share_target: { game_uid: '6884264892', pool_id: 'special_1' },
                account_name: '牛逼',
                display_name: '春雷动，万物生',
                current_pity: 41,
                current_probability: 0.008,
              },
            ],
          },
        ],
      }),
    });

    const router = createOfficialBotRouter({
      provider: 'telegram',
      apiClient,
      siteUrl: 'https://example.com',
    });

    const reply = await router.handleMessage({
      text: '/current',
      platformUserId: '1001',
      displayHandle: '@tester',
      isPrivateChat: true,
    });

    const detailButtons = reply.replyMarkup?.inline_keyboard?.flat()
      .filter((item) => item.text.startsWith('详情 · ')) || [];
    expect(detailButtons).toHaveLength(2);
    expect(detailButtons.some((item) => item.callback_data === 'detail|1545606431|special_1')).toBe(true);
    expect(detailButtons.some((item) => item.callback_data === 'detail|6884264892|special_1')).toBe(true);
  });

  it('renders pool detail with timeline preview', async () => {
    const apiClient = createApiClient({
      getPoolDetail: vi.fn().mockResolvedValue({
        pool: {
          display_name: '春雷动，万物生',
          pool_type: 'limited',
          featured: ['庄方宜'],
          share_target: { game_uid: '1545606431', pool_id: 'special_1' },
          status: 'active',
          remaining_label: '剩 2天3小时',
        },
        account: {
          display_name: '老鲤船长',
        },
        stats: {
          current_probability: 0.008,
          current_pity: 33,
          total_pulls: 73,
          six_star_total: 1,
          up_six_star_count: 1,
          off_six_star_count: 0,
          five_star_count: 6,
          win_rate: 100,
        },
        recent_records: [
          { item_name: '庄方宜', rarity: 6 },
        ],
        timeline_sections: [
          {
            entries: [
              {
                dateLabel: '04-20',
                stageLabel: '命中节点',
                pulls: 40,
                resultSummaryWithoutFiveStar: '命中目标 6★「庄方宜」',
              },
            ],
          },
        ],
      }),
    });

    const router = createOfficialBotRouter({
      provider: 'telegram',
      apiClient,
      siteUrl: 'https://example.com',
    });

    const reply = await router.handleCallback({
      data: 'detail|1545606431|special_1',
      platformUserId: '1001',
      isPrivateChat: true,
    });

    expect(reply.text).toContain('春雷动，万物生 · 限定池');
    expect(reply.text).toContain('时间线预览');
    expect(reply.replyMarkup?.inline_keyboard?.flat().some((item) => item.text === '发送分享卡')).toBe(true);
  });

  it('returns media when share callback is triggered', async () => {
    const apiClient = createApiClient();
    const shareCardService = {
      buildPoolShareCard: vi.fn().mockResolvedValue({
        kind: 'photo',
        buffer: Buffer.from('png-data'),
        mimeType: 'image/png',
        fileName: 'share.png',
        caption: '老鲤船长 · 春雷动，万物生',
      }),
    };

    const router = createOfficialBotRouter({
      provider: 'telegram',
      apiClient,
      siteUrl: 'https://example.com',
      shareCardService,
    });

    const reply = await router.handleCallback({
      data: 'share|1545606431|special_1',
      platformUserId: '1001',
      isPrivateChat: true,
    });

    expect(shareCardService.buildPoolShareCard).toHaveBeenCalledWith({
      provider: 'telegram',
      platformUserId: '1001',
      gameUid: '1545606431',
      poolId: 'special_1',
    });
    expect(reply.media?.kind).toBe('photo');
    expect(reply.media?.fileName).toBe('share.png');
  });

  it('drops inline callback buttons when share target is incomplete', async () => {
    const apiClient = createApiClient({
      getPoolDetail: vi.fn().mockResolvedValue({
        pool: {
          display_name: '春雷动，万物生',
          pool_type: 'limited',
          featured: ['庄方宜'],
          share_target: { game_uid: '1545606431', pool_id: null },
          status: 'active',
        },
        account: {
          display_name: '老鲤船长',
        },
        stats: {
          current_probability: 0.008,
          current_pity: 33,
          total_pulls: 73,
          six_star_total: 1,
          up_six_star_count: 1,
          off_six_star_count: 0,
          five_star_count: 6,
          win_rate: 100,
        },
        recent_records: [],
        timeline_sections: [],
      }),
    });

    const router = createOfficialBotRouter({
      provider: 'telegram',
      apiClient,
      siteUrl: 'https://example.com',
    });

    const reply = await router.handleCallback({
      data: 'detail|1545606431|special_1',
      platformUserId: '1001',
      isPrivateChat: true,
    });

    const buttons = reply.replyMarkup?.inline_keyboard?.flat() || [];
    expect(buttons.some((item) => item.text === '发送分享卡')).toBe(false);
    expect(buttons.some((item) => item.text === '返回池列表')).toBe(true);
  });
});
