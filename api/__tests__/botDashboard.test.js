// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchVisiblePools: vi.fn(),
  useHistoryStoreState: {
    historyFilter: 'all',
  },
  usePoolStats: vi.fn(),
  buildDashboardTimelineSections: vi.fn(),
  buildDashboardSharePayload: vi.fn(),
  getPoolAnalysisPityState: vi.fn(),
}));

vi.mock('../_lib/publicCatalog.js', () => ({
  fetchVisiblePools: mocks.fetchVisiblePools,
}));

vi.mock('../../src/stores/useHistoryStore.js', () => ({
  default: {
    getState: () => mocks.useHistoryStoreState,
    setState: vi.fn((nextState) => {
      mocks.useHistoryStoreState = nextState;
    }),
  },
}));

vi.mock('../../src/hooks/app/usePoolStats.js', () => ({
  usePoolStats: mocks.usePoolStats,
}));

vi.mock('../../src/utils/dashboardTimelineSections.js', () => ({
  buildDashboardTimelineSections: mocks.buildDashboardTimelineSections,
}));

vi.mock('../../src/utils/dashboardShare.js', () => ({
  buildDashboardSharePayload: mocks.buildDashboardSharePayload,
}));

vi.mock('../../src/utils/poolAnalysisPity.js', () => ({
  getPoolAnalysisPityState: mocks.getPoolAnalysisPityState,
}));

const { fetchBotAnalysis } = await import('../_lib/botDashboard.js');

function createQueryResult(data, error = null) {
  const result = {
    select: () => result,
    eq: () => result,
    limit: () => result,
    maybeSingle: () => Promise.resolve({ data: Array.isArray(data) ? data[0] || null : data, error }),
    then: (resolve, reject) => Promise.resolve({ data, error }).then(resolve, reject),
  };
  return result;
}

function createAdminClient() {
  return {
    from: vi.fn((tableName) => {
      if (tableName === 'public_profiles') {
        return createQueryResult({ id: 'user-1', username: '站内用户', role: 'user' });
      }

      if (tableName === 'history') {
        return createQueryResult([
          {
            id: 'record-1',
            record_id: 'record-1',
            game_uid: '1545606431',
            pool_id: 'special_1',
            item_name: '庄方宜',
            rarity: 6,
            timestamp: '2026-04-20T12:00:00.000Z',
            is_free: false,
            special_type: null,
            seq_id: 1,
            nick_name: '老鲤船长',
          },
          {
            id: 'record-2',
            record_id: 'record-2',
            game_uid: '1545606431',
            pool_id: 'special_1',
            item_name: '狼卫',
            rarity: 5,
            timestamp: '2026-04-21T12:00:00.000Z',
            is_free: false,
            special_type: null,
            seq_id: 2,
            nick_name: '老鲤船长',
          },
        ]);
      }

      return createQueryResult([]);
    }),
  };
}

describe('fetchBotAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchVisiblePools.mockResolvedValue([
      {
        id: 'special_1',
        pool_id: 'special_1',
        name: '春雷动，万物生',
        type: 'limited',
        up_character: '庄方宜',
        featured_characters: ['special_1', '庄方宜'],
        start_time: '2026-04-17T04:00:00.000Z',
        end_time: '2026-05-22T04:00:00.000Z',
      },
    ]);
    mocks.usePoolStats.mockReturnValue({
      stats: {
        total: 2,
        totalSixStar: 1,
        upSixStarCount: 1,
        stdSixStarCount: 0,
        counts: { 5: 1 },
        winRate: 100,
      },
      groupedHistory: {},
      effectivePity: {
        pity6: 1,
        pity5: 0,
      },
    });
    mocks.getPoolAnalysisPityState.mockReturnValue({
      displayPity6: 1,
      displayPity5: 0,
      normalizedType: 'limited',
    });
    mocks.buildDashboardTimelineSections.mockReturnValue([
      {
        title: '春雷动，万物生',
        entries: [{ pulls: 1, resultSummaryWithoutFiveStar: '命中目标 6★「庄方宜」' }],
      },
    ]);
    mocks.buildDashboardSharePayload.mockReturnValue({
      poolName: '春雷动，万物生',
      summaryItems: [{ label: '目标 6★', value: '1' }],
    });
  });

  it('keeps raw ids only internally while returning selected detail for BOT actions', async () => {
    const analysis = await fetchBotAnalysis(createAdminClient(), 'user-1');
    const body = JSON.stringify(analysis);

    expect(analysis.navigation.accounts).toHaveLength(1);
    expect(analysis.navigation.accounts[0].pools).toHaveLength(1);
    expect(analysis.selected.account.display_name).toBe('老鲤船长');
    expect(analysis.selected.pool.display_name).toBe('春雷动，万物生');
    expect(analysis.selected.detail.timeline_sections).toHaveLength(1);
    expect(analysis.selected.detail.share_payload.poolName).toBe('春雷动，万物生');
    expect(analysis.selected.pool.featured).toEqual(['庄方宜']);
    expect(body).not.toContain('special_1');
    expect(body).not.toContain('1545606431');
  });
});
