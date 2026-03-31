import { useEffect, useMemo, useState } from 'react';
import { RARITY_CONFIG } from '../../constants';
import { useRankingData } from './useRankingData';
import { useSummaryStats } from './useSummaryStats';

const SUMMARY_COPY = {
  desktop: {
    titleGlobal: '全服数据',
    titleLocal: '我的数据',
    subtitleAll: '全部卡池',
    typeNames: {
      character: '角色池（限定+常驻）',
      limited: '限定角色池',
      weapon: '武器池',
      standard: '常驻池'
    }
  },
  mobile: {
    titleGlobal: '全服统计数据',
    titleLocal: '个人记录',
    subtitleAll: '全卡池汇总',
    typeNames: {
      character: '角色池',
      limited: '限定池',
      weapon: '武器池',
      standard: '常驻池'
    }
  }
};

export const SUMMARY_FILTER_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'limited', label: '限定' },
  { value: 'standard', label: '常驻' },
  { value: 'weapon', label: '武器' }
];

function generateChartDataFromCounts(counts) {
  if (!counts) {
    return [];
  }

  const rawData = [
    { name: '6星(限定)', value: counts[6] || counts['6'] || 0, color: RARITY_CONFIG[6].color },
    { name: '6星(常驻)', value: counts['6_std'] || 0, color: RARITY_CONFIG['6_std'].color },
    { name: '5星', value: counts[5] || counts['5'] || 0, color: RARITY_CONFIG[5].color },
    { name: '4星', value: counts[4] || counts['4'] || 0, color: RARITY_CONFIG[4].color }
  ].filter(item => item.value > 0);

  const totalValue = rawData.reduce((sum, item) => sum + item.value, 0);

  return rawData.map(item => {
    const currentPercent = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
    let minPercent = 0;

    if (item.name.includes('6星')) {
      minPercent = 15;
    } else if (item.name.includes('5星')) {
      minPercent = 20;
    }

    if (currentPercent < minPercent && totalValue > 0) {
      return {
        ...item,
        displayValue: Math.ceil(totalValue * minPercent / 100)
      };
    }

    return {
      ...item,
      displayValue: item.value
    };
  });
}

function mergeDistributions(limited, standard) {
  if (!limited?.length && !standard?.length) {
    return [];
  }

  const merged = {};

  (limited || []).forEach(item => {
    merged[item.range] = {
      range: item.range,
      limited: item.limited || 0,
      standard: item.standard || 0
    };
  });

  (standard || []).forEach(item => {
    if (merged[item.range]) {
      merged[item.range].limited += item.limited || 0;
      merged[item.range].standard += item.standard || 0;
      return;
    }

    merged[item.range] = {
      range: item.range,
      limited: item.limited || 0,
      standard: item.standard || 0
    };
  });

  return Object.values(merged)
    .map(item => ({ ...item, count: item.limited + item.standard }))
    .sort((a, b) => parseInt(a.range, 10) - parseInt(b.range, 10));
}

function getAveragePity(typeData) {
  if (typeData?.avgPity) {
    return typeData.avgPity;
  }

  if (typeData?.pityList?.length > 0) {
    return (typeData.pityList.reduce((sum, item) => sum + item.count, 0) / typeData.pityList.length).toFixed(1);
  }

  return '-';
}

export function useSummaryViewState({
  history,
  pools,
  user,
  globalStats,
  fetchGlobalStats,
  variant = 'desktop'
}) {
  const [dataSource, setDataSource] = useState('global');
  const [poolTypeFilter, setPoolTypeFilter] = useState('all');

  const copy = SUMMARY_COPY[variant] || SUMMARY_COPY.desktop;
  const isGlobalSource = dataSource === 'global';

  const { characterRanking, rankingLoading, userRanking, userRankingLoading } = useRankingData(dataSource, user);
  const localStats = useSummaryStats(history, pools, user);

  useEffect(() => {
    if (!isGlobalSource || !fetchGlobalStats) {
      return;
    }

    fetchGlobalStats();
  }, [fetchGlobalStats, isGlobalSource]);

  const ranking = isGlobalSource ? characterRanking : userRanking;
  const isRankingLoading = isGlobalSource ? rankingLoading : userRankingLoading;

  const currentStats = useMemo(() => {
    const baseStats = isGlobalSource ? globalStats : localStats;

    if (isGlobalSource && !globalStats) {
      return null;
    }

    if (!baseStats) {
      return null;
    }

    if (poolTypeFilter === 'all') {
      return {
        title: isGlobalSource ? copy.titleGlobal : copy.titleLocal,
        subtitle: copy.subtitleAll,
        total: baseStats.totalPulls ?? baseStats.total,
        sixStar: baseStats.sixStarTotal ?? baseStats.sixStar,
        sixStarLimited: baseStats.sixStarLimited ?? baseStats.counts?.[6],
        sixStarStandard: baseStats.sixStarStandard ?? baseStats.counts?.['6_std'],
        avgPity: baseStats.avgPity,
        counts: baseStats.counts,
        byType: baseStats.byType,
        totalUsers: baseStats.totalUsers,
        totalContributors: baseStats.totalContributors,
        contributorsByRegion: baseStats.contributorsByRegion || null,
        charGift: baseStats.charGift || 0,
        weaponGiftLimited: baseStats.weaponGiftLimited || 0,
        weaponGiftStandard: baseStats.weaponGiftStandard || 0,
        giftTotal: baseStats.giftTotal || 0,
        resources: baseStats.resources || null,
        meta: baseStats.meta || null
      };
    }

    const typeData = baseStats.byType?.[poolTypeFilter];
    if (!typeData) {
      return null;
    }

    let avgPityExcludingFree = null;
    if (poolTypeFilter === 'limited' || poolTypeFilter === 'character') {
      if (typeData.avgPityExcludingFree) {
        avgPityExcludingFree = typeData.avgPityExcludingFree;
      } else if (typeData.pityListExcludingFree?.length > 0) {
        avgPityExcludingFree = (
          typeData.pityListExcludingFree.reduce((sum, item) => sum + item.count, 0) /
          typeData.pityListExcludingFree.length
        ).toFixed(1);
      }
    }

    return {
      title: isGlobalSource ? copy.titleGlobal : copy.titleLocal,
      subtitle: copy.typeNames[poolTypeFilter],
      total: typeData.total,
      sixStar: typeData.six ?? typeData.sixStar,
      sixStarLimited: typeData.limitedSix ?? typeData.sixStarLimited ?? typeData.counts?.[6],
      sixStarStandard: typeData.counts?.['6_std'] ?? typeData.sixStarStandard,
      avgPity: getAveragePity(typeData),
      avgPityExcludingFree,
      avgPityUp: typeData.avgPityTarget || typeData.avgPityUp || null,
      counts: typeData.counts,
      distribution: typeData.distribution,
      chartData: typeData.chartData,
      totalUsers: baseStats.totalUsers,
      totalContributors: baseStats.totalContributors,
      contributorsByRegion: baseStats.contributorsByRegion || null,
      byType: baseStats.byType,
      resources: typeData.resources || null,
      meta: baseStats.meta || null
    };
  }, [copy, globalStats, isGlobalSource, localStats, poolTypeFilter]);

  const chartDisplayData = useMemo(() => {
    const baseStats = isGlobalSource ? globalStats : localStats;

    if (!baseStats) {
      return { charts: [], isGlobal: isGlobalSource };
    }

    if (poolTypeFilter !== 'all') {
      const typeData = baseStats.byType?.[poolTypeFilter];
      if (!typeData) {
        return { charts: [], isGlobal: isGlobalSource };
      }

      const typeTitles = {
        character: '角色池',
        limited: '限定池',
        weapon: '武器池',
        standard: '常驻池'
      };
      const typeColors = {
        character: 'rainbow-text',
        limited: 'rainbow-text',
        weapon: 'text-slate-500',
        standard: 'text-indigo-500'
      };

      return {
        isGlobal: isGlobalSource,
        charts: [{
          title: typeTitles[poolTypeFilter],
          color: typeColors[poolTypeFilter],
          data: {
            ...typeData,
            chartData: typeData.chartData || generateChartDataFromCounts(typeData.counts)
          }
        }]
      };
    }

    const limitedCounts = baseStats.byType?.limited?.counts || {};
    const standardCounts = baseStats.byType?.standard?.counts || {};
    const characterCounts = {
      6: (limitedCounts[6] || 0) + (standardCounts[6] || 0),
      '6_std': (limitedCounts['6_std'] || 0) + (standardCounts['6_std'] || 0),
      5: (limitedCounts[5] || 0) + (standardCounts[5] || 0),
      4: (limitedCounts[4] || 0) + (standardCounts[4] || 0)
    };

    return {
      isGlobal: isGlobalSource,
      charts: [
        {
          title: '角色池',
          subtitle: '限定 + 常驻',
          color: 'text-violet-500',
          data: baseStats.byType?.character || {
            total: (baseStats.byType?.limited?.total || 0) + (baseStats.byType?.standard?.total || 0),
            six: (baseStats.byType?.limited?.six || 0) + (baseStats.byType?.standard?.six || 0),
            counts: characterCounts,
            distribution: mergeDistributions(baseStats.byType?.limited?.distribution, baseStats.byType?.standard?.distribution),
            chartData: generateChartDataFromCounts(characterCounts)
          }
        },
        {
          title: '武器池',
          color: 'text-slate-500',
          data: {
            ...(baseStats.byType?.weapon || { total: 0, six: 0, counts: {}, distribution: [] }),
            chartData: baseStats.byType?.weapon?.chartData || generateChartDataFromCounts(baseStats.byType?.weapon?.counts)
          }
        }
      ]
    };
  }, [globalStats, isGlobalSource, localStats, poolTypeFilter]);

  return {
    dataSource,
    setDataSource,
    poolTypeFilter,
    setPoolTypeFilter,
    isGlobalSource,
    localStats,
    currentStats,
    chartDisplayData,
    ranking,
    isRankingLoading,
    filterOptions: SUMMARY_FILTER_OPTIONS
  };
}

export default useSummaryViewState;
