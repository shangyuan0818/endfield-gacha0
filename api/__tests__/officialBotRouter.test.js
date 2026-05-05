import { describe, expect, it, vi } from 'vitest';
import { EndfieldApiError } from '../../bots/official/endfieldApiClient.js';
import { createOfficialBotRouter } from '../../bots/official/router.js';

const ACCOUNT_REF = 'a.MTU0NTYwNjQzMQ';
const POOL_REF = 'p.MTU0NTYwNjQzMXxzcGVjaWFsXzE';

function createAnalysis() {
  return {
    user: { username: '站内用户' },
    navigation: {
      accounts: [
        {
          ref: ACCOUNT_REF,
          display_name: '老鲤船长',
          total_pulls: 1131,
          pools: [
            {
              ref: POOL_REF,
              account_ref: ACCOUNT_REF,
              display_name: '春雷动，万物生',
              pool_type: 'limited',
              current_pity: 33,
              current_probability: 0.008,
              total_pulls: 73,
              status: 'active',
              remaining_label: '剩 2天3小时',
              is_active: true,
              actions: {
                detail_ref: POOL_REF,
                share_ref: POOL_REF,
                log_ref: POOL_REF,
              },
            },
          ],
        },
      ],
    },
    selected: {
      account: {
        ref: ACCOUNT_REF,
        display_name: '老鲤船长',
      },
      pool: {
        ref: POOL_REF,
        display_name: '春雷动，万物生',
        pool_type: 'limited',
        current_pity: 33,
        current_probability: 0.008,
        total_pulls: 73,
      },
      detail: {
        account: {
          ref: ACCOUNT_REF,
          display_name: '老鲤船长',
        },
        pool: {
          ref: POOL_REF,
          display_name: '春雷动，万物生',
          pool_type: 'limited',
          featured: ['庄方宜'],
          status: 'active',
          remaining_label: '剩 2天3小时',
        },
        stats: {
          current_probability: 0.008,
          current_pity: 33,
          current_pity5: 5,
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
        share_payload: {
          averageItems: [{ label: 'UP 6★', value: '73.00 抽' }],
          resourceItems: [{ label: '耗金玉', value: '11760' }],
        },
      },
    },
  };
}

function createApiClient(overrides = {}) {
  return {
    verifyBinding: vi.fn(),
    getAnalysis: vi.fn().mockResolvedValue(createAnalysis()),
    getRecentPulls: vi.fn().mockResolvedValue({ records: [] }),
    getShareCard: vi.fn(),
    getPoolLog: vi.fn(),
    getSiteOverview: vi.fn().mockResolvedValue({}),
    getRankings: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

function createRouter(apiClient) {
  return createOfficialBotRouter({
    provider: 'telegram',
    apiClient,
    siteUrl: 'https://example.com',
  });
}

describe('createOfficialBotRouter API-first implementation', () => {
  it('uses plain binding code as verify command', async () => {
    const apiClient = createApiClient({
      verifyBinding: vi.fn().mockResolvedValue({
        binding: { display_handle: '@tester' },
      }),
    });
    const router = createRouter(apiClient);

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

  it('returns binding guidance when a private query is called before verification', async () => {
    const apiClient = createApiClient({
      getAnalysis: vi.fn().mockRejectedValue(
        new EndfieldApiError('Verified binding not found', { status: 404 })
      ),
    });
    const router = createRouter(apiClient);

    const reply = await router.handleMessage({
      text: '/me',
      platformUserId: '1001',
      displayHandle: '@tester',
      isPrivateChat: true,
    });

    expect(reply.text).toContain('尚未完成绑定');
  });

  it('does not expose raw upstream 500 messages on /start', async () => {
    const apiClient = createApiClient({
      getAnalysis: vi.fn().mockRejectedValue(
        new EndfieldApiError('Internal server error', { status: 500 })
      ),
    });
    const router = createRouter(apiClient);

    const reply = await router.handleMessage({
      text: '/start',
      platformUserId: '1001',
      displayHandle: '@tester',
      isPrivateChat: true,
    });

    expect(reply.text).toContain('BOT 服务暂时异常');
    expect(reply.text).not.toContain('Internal server error');
  });

  it('blocks sensitive commands in group chats', async () => {
    const router = createRouter(createApiClient());

    const reply = await router.handleMessage({
      text: '/log',
      platformUserId: '1001',
      displayHandle: '@tester',
      isPrivateChat: false,
    });

    expect(reply.text).toContain('私聊官方 BOT');
  });

  it('renders account overview from the analysis API without raw identifiers', async () => {
    const apiClient = createApiClient();
    const router = createRouter(apiClient);

    const reply = await router.handleMessage({
      text: '/me',
      platformUserId: '1001',
      displayHandle: '@tester',
      isPrivateChat: true,
    });

    expect(apiClient.getAnalysis).toHaveBeenCalledWith({
      provider: 'telegram',
      platformUserId: '1001',
    });
    expect(reply.text).toContain('老鲤船长 的账号概览');
    expect(reply.text).toContain('春雷动，万物生');
    expect(reply.text).not.toContain('1545606431');
    expect(reply.text).not.toContain('special_1');
  });

  it('renders switchable pool list using short refs instead of raw ids', async () => {
    const router = createRouter(createApiClient());

    const reply = await router.handleMessage({
      text: '/pools',
      platformUserId: '1001',
      displayHandle: '@tester',
      isPrivateChat: true,
    });

    expect(reply.text).toContain('各池列表');
    expect(reply.text).toContain('账号：老鲤船长');
    expect(reply.text).not.toContain('1545606431');
    expect(reply.text).not.toContain('special_1');

    const buttons = reply.replyMarkup.inline_keyboard.flat();
    expect(buttons.some((button) => button.callback_data === `pool|${POOL_REF}`)).toBe(true);
    expect(buttons.some((button) => button.callback_data === `share|${POOL_REF}`)).toBe(true);
    expect(buttons.every((button) => !button.callback_data || button.callback_data.length <= 64)).toBe(true);
  });

  it('switches account through the analysis API accountRef', async () => {
    const apiClient = createApiClient();
    const router = createRouter(apiClient);

    const reply = await router.handleCallback({
      data: `acct|${ACCOUNT_REF}`,
      platformUserId: '1001',
      isPrivateChat: true,
    });

    expect(apiClient.getAnalysis).toHaveBeenCalledWith({
      provider: 'telegram',
      platformUserId: '1001',
      accountRef: ACCOUNT_REF,
    });
    expect(reply.text).toContain('账号：老鲤船长');
  });

  it('uses API action refs for pool detail, share and log callbacks', async () => {
    const analysis = createAnalysis();
    const actionRefs = {
      detail_ref: 'p.detail_action_ref',
      share_ref: 'p.share_action_ref',
      log_ref: 'p.log_action_ref',
    };
    analysis.navigation.accounts[0].pools[0].actions = actionRefs;
    analysis.selected.pool.actions = actionRefs;
    analysis.selected.detail.pool.actions = actionRefs;

    const apiClient = createApiClient({
      getAnalysis: vi.fn().mockResolvedValue(analysis),
      getShareCard: vi.fn().mockResolvedValue({
        kind: 'photo',
        buffer: Buffer.from('png-data'),
        mimeType: 'image/png',
        fileName: 'share.png',
      }),
      getPoolLog: vi.fn().mockResolvedValue({
        kind: 'document',
        buffer: Buffer.from('csv-data'),
        mimeType: 'text/csv; charset=utf-8',
        fileName: 'pool-log.csv',
      }),
    });
    const router = createRouter(apiClient);

    const listReply = await router.handleMessage({
      text: '/pools',
      platformUserId: '1001',
      displayHandle: '@tester',
      isPrivateChat: true,
    });
    const listButtons = listReply.replyMarkup.inline_keyboard.flat();

    expect(listButtons.some((button) => button.callback_data === 'pool|p.detail_action_ref')).toBe(true);
    expect(listButtons.some((button) => button.callback_data === 'share|p.share_action_ref')).toBe(true);
    expect(listButtons.some((button) => button.callback_data === `pool|${POOL_REF}`)).toBe(false);

    const detailReply = await router.handleCallback({
      data: 'pool|p.detail_action_ref',
      platformUserId: '1001',
      isPrivateChat: true,
    });
    const detailButtons = detailReply.replyMarkup.inline_keyboard.flat();

    expect(apiClient.getAnalysis).toHaveBeenCalledWith({
      provider: 'telegram',
      platformUserId: '1001',
      poolRef: 'p.detail_action_ref',
    });
    expect(detailButtons.some((button) => button.callback_data === 'share|p.share_action_ref')).toBe(true);
    expect(detailButtons.some((button) => button.callback_data === 'log|p.log_action_ref|csv')).toBe(true);

    await router.handleCallback({
      data: 'share|p.share_action_ref',
      platformUserId: '1001',
      isPrivateChat: true,
    });
    await router.handleCallback({
      data: 'log|p.log_action_ref|csv',
      platformUserId: '1001',
      isPrivateChat: true,
    });

    expect(apiClient.getShareCard).toHaveBeenCalledWith({
      provider: 'telegram',
      platformUserId: '1001',
      poolRef: 'p.share_action_ref',
    });
    expect(apiClient.getPoolLog).toHaveBeenCalledWith({
      provider: 'telegram',
      platformUserId: '1001',
      poolRef: 'p.log_action_ref',
      format: 'csv',
    });
  });

  it('renders pool detail with timeline and export actions', async () => {
    const apiClient = createApiClient();
    const router = createRouter(apiClient);

    const reply = await router.handleCallback({
      data: `pool|${POOL_REF}`,
      platformUserId: '1001',
      isPrivateChat: true,
    });

    expect(apiClient.getAnalysis).toHaveBeenCalledWith({
      provider: 'telegram',
      platformUserId: '1001',
      poolRef: POOL_REF,
    });
    expect(reply.text).toContain('时间线预览');
    expect(reply.text).toContain('命中目标 6★');
    expect(reply.replyMarkup.inline_keyboard.flat().some((button) => button.text === '导出日志')).toBe(true);
  });

  it('returns media from the API share-card endpoint', async () => {
    const apiClient = createApiClient({
      getShareCard: vi.fn().mockResolvedValue({
        kind: 'photo',
        buffer: Buffer.from('png-data'),
        mimeType: 'image/png',
        fileName: 'share.png',
        caption: '老鲤船长 · 春雷动，万物生',
      }),
    });
    const router = createRouter(apiClient);

    const reply = await router.handleCallback({
      data: `share|${POOL_REF}`,
      platformUserId: '1001',
      isPrivateChat: true,
    });

    expect(apiClient.getShareCard).toHaveBeenCalledWith({
      provider: 'telegram',
      platformUserId: '1001',
      poolRef: POOL_REF,
    });
    expect(reply.media).toMatchObject({
      kind: 'photo',
      fileName: 'share.png',
    });
  });

  it('returns document media from the API pool-log endpoint', async () => {
    const apiClient = createApiClient({
      getPoolLog: vi.fn().mockResolvedValue({
        kind: 'document',
        buffer: Buffer.from('csv-data'),
        mimeType: 'text/csv; charset=utf-8',
        fileName: 'pool-log.csv',
        caption: '老鲤船长 · 春雷动，万物生',
      }),
    });
    const router = createRouter(apiClient);

    const reply = await router.handleCallback({
      data: `log|${POOL_REF}|csv`,
      platformUserId: '1001',
      isPrivateChat: true,
    });

    expect(apiClient.getPoolLog).toHaveBeenCalledWith({
      provider: 'telegram',
      platformUserId: '1001',
      poolRef: POOL_REF,
      format: 'csv',
    });
    expect(reply.media).toMatchObject({
      kind: 'document',
      fileName: 'pool-log.csv',
    });
  });
});
