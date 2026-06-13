import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSummaryViewState } from '../useSummaryViewState.js';

vi.mock('../../../i18n/index.js', () => ({
  useI18n: () => ({
    t: (_key, _params, fallback) => fallback ?? _key
  })
}));

vi.mock('../useRankingData', () => ({
  useRankingData: () => ({
    characterRanking: [],
    rankingLoading: false,
    userRanking: [],
    userRankingLoading: false
  })
}));

vi.mock('../useSummaryStats', () => ({
  useSummaryStats: () => null
}));

const contributorActivity = {
  windowDays: 30,
  activeUsers: 7,
  newUsers: 3,
  generatedAt: '2026-06-13T00:00:00.000Z'
};

const globalStats = {
  totalPulls: 100,
  sixStarTotal: 5,
  sixStarLimited: 3,
  sixStarStandard: 2,
  avgPity: '42.0',
  counts: {
    6: 3,
    '6_std': 2,
    5: 12,
    4: 83
  },
  byType: {
    limited: {
      total: 40,
      six: 2,
      sixStarLimited: 2,
      sixStarStandard: 0,
      avgPity: '35.5',
      counts: {
        6: 2,
        '6_std': 0,
        5: 5,
        4: 33
      },
      distribution: [],
      resources: null
    }
  },
  totalUsers: 20,
  activeUsers30d: 7,
  newUsers30d: 3,
  totalContributors: 10,
  contributorActivity,
  contributorsByRegion: {
    cn: 6,
    intl: 4
  },
  resources: null,
  meta: {
    source: 'api'
  }
};

function renderSummaryViewState(initialPoolTypeFilter = 'all') {
  return renderHook(() => useSummaryViewState({
    history: [],
    pools: [],
    user: null,
    globalStats,
    fetchGlobalStats: vi.fn(),
    initialDataSource: 'global',
    initialPoolTypeFilter
  }));
}

describe('useSummaryViewState', () => {
  it('passes global activity fields through for all pools', () => {
    const { result } = renderSummaryViewState('all');

    expect(result.current.currentStats).toMatchObject({
      activeUsers30d: 7,
      newUsers30d: 3,
      contributorActivity
    });
  });

  it('keeps global activity fields when filtering by pool type', () => {
    const { result } = renderSummaryViewState('limited');

    expect(result.current.currentStats).toMatchObject({
      subtitle: '限定角色池',
      activeUsers30d: 7,
      newUsers30d: 3,
      contributorActivity
    });
  });
});
