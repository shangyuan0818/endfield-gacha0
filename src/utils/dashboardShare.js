import { calculateCurrentProbability } from './index.js';
import { formatOriginiteEquivalent } from './resourceEconomy.js';
import { SHARE_BRAND_LINK } from './shareBranding.js';

const DASHBOARD_SHARE_FILE_PREFIX = '终末地卡池分析分享卡';

function formatShareTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}`;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatAverage(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return '--';
  }

  return `${numericValue.toFixed(2)} 抽`;
}

function formatRate(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return '--';
  }

  return `${numericValue.toFixed(1)}%`;
}

function getPoolTypeLabel(poolType) {
  if (poolType === 'weapon') {
    return '武器池';
  }

  if (poolType === 'standard') {
    return '常驻池';
  }

  return '限定池';
}

function getOverviewFilterLabel(filter) {
  if (filter === 'limited') {
    return '限定池';
  }

  if (filter === 'weapon') {
    return '武器池';
  }

  if (filter === 'standard') {
    return '常驻池';
  }

  return '全部卡池';
}

function buildAverageItems({ stats, poolType, isAllPoolsOverview }) {
  const items = [
    {
      id: 'avg-5',
      label: '5★ 平均',
      value: formatAverage(stats?.avgPullCost?.[5])
    },
    {
      id: 'avg-6-all',
      label: '全部 6★',
      value: formatAverage(stats?.avgPullCost?.['6_all'])
    }
  ];

  if (poolType !== 'standard') {
    items.push({
      id: 'avg-6-target',
      label: isAllPoolsOverview ? '目标 6★' : 'UP 6★',
      value: formatAverage(stats?.avgPullCost?.[6])
    });
  }

  if (poolType === 'limited' || isAllPoolsOverview) {
    items.push({
      id: 'avg-6-limited',
      label: '限定 6★',
      value: formatAverage(stats?.avgPullCost?.['6_limited'])
    });
  }

  return items;
}

function buildSplitSummaryGroups(overviewSplitStats) {
  if (!overviewSplitStats) {
    return null;
  }

  return [
    {
      id: 'character',
      label: '角色池汇总',
      items: buildSummaryItems({
        stats: overviewSplitStats.character,
        poolType: 'limited',
        isAllPoolsOverview: true
      })
    },
    {
      id: 'weapon',
      label: '武器池汇总',
      items: buildSummaryItems({
        stats: overviewSplitStats.weapon,
        poolType: 'weapon',
        isAllPoolsOverview: true
      })
    }
  ];
}

function buildSplitAverageGroups(overviewSplitStats) {
  if (!overviewSplitStats) {
    return null;
  }

  return [
    {
      id: 'character',
      label: '角色池平均',
      items: buildAverageItems({
        stats: overviewSplitStats.character,
        poolType: 'limited',
        isAllPoolsOverview: true
      })
    },
    {
      id: 'weapon',
      label: '武器池平均',
      items: buildAverageItems({
        stats: overviewSplitStats.weapon,
        poolType: 'weapon',
        isAllPoolsOverview: true
      })
    }
  ];
}

function buildSummaryItems({ stats, poolType, isAllPoolsOverview }) {
  const items = [
    {
      id: 'total-pulls',
      label: '总抽数',
      value: normalizeNumber(stats?.total).toLocaleString(),
      hint: 'PULLS'
    }
  ];

  if (poolType === 'standard') {
    items.push(
      {
        id: 'six-star-total',
        label: '6★ 总数',
        value: normalizeNumber(stats?.totalSixStar || stats?.counts?.['6_std']).toLocaleString(),
        hint: '常驻池全部 6★'
      },
      {
        id: 'five-star-count',
        label: '5★ 总数',
        value: normalizeNumber(stats?.counts?.[5]).toLocaleString(),
        hint: '高稀有节点'
      },
      {
        id: 'four-star-count',
        label: '4★ 总数',
        value: normalizeNumber(stats?.counts?.[4]).toLocaleString(),
        hint: '基础产出'
      }
    );
    return items;
  }

  items.push(
    {
      id: 'target-six',
      label: isAllPoolsOverview ? '目标 6★' : 'UP 6★',
      value: normalizeNumber(stats?.counts?.[6]).toLocaleString(),
      hint: poolType === 'weapon' ? '限定武器命中数' : '限定角色命中数'
    },
    {
      id: 'off-six',
      label: isAllPoolsOverview ? '常驻 / 偏移 6★' : '常驻 / 歪 6★',
      value: normalizeNumber(stats?.counts?.['6_std']).toLocaleString(),
      hint: '非目标 6★'
    },
    {
      id: 'five-star-count',
      label: '5★ 总数',
      value: normalizeNumber(stats?.counts?.[5]).toLocaleString(),
      hint: '高稀有节点'
    },
    {
      id: 'four-star-count',
      label: '4★ 总数',
      value: normalizeNumber(stats?.counts?.[4]).toLocaleString(),
      hint: '基础产出'
    }
  );

  if (normalizeNumber(stats?.totalSixStar) > 0) {
    items.push({
      id: 'win-rate',
      label: '不歪率',
      value: formatRate(stats?.winRate),
      hint: '目标 6★ / 全部 6★'
    });
  }

  return items;
}

function buildResourceItems(resources, poolType) {
  if (!resources) {
    return [];
  }

  const items = [];
  const normalizedPoolType = poolType || 'standard';

  if (normalizedPoolType !== 'weapon') {
    items.push(
      {
        id: 'jade-spent',
        label: '耗玉',
        value: normalizeNumber(resources.jadeSpent).toLocaleString(),
        hint: '有效抽数换算'
      },
      {
        id: 'originite-equivalent',
        label: '石折玉',
        value: formatOriginiteEquivalent(resources.originiteEquivalent || 0),
        hint: '按当前换算比例'
      },
      {
        id: 'arsenal-gained',
        label: '得配额',
        value: normalizeNumber(resources.arsenalGained).toLocaleString(),
        hint: '4★ / 5★ 转化'
      }
    );
  }

  if (normalizedPoolType === 'weapon' || normalizedPoolType === 'all') {
    items.push({
      id: 'arsenal-spent',
      label: '耗配额',
      value: normalizeNumber(resources.arsenalSpent).toLocaleString(),
      hint: '武器池计费'
    });
  }

  return items;
}

function buildSplitResourceGroups(overviewSplitStats) {
  if (!overviewSplitStats) {
    return null;
  }

  return [
    {
      id: 'character',
      label: '角色池资源',
      items: buildResourceItems(overviewSplitStats.character?.resourceSummary, 'limited')
    },
    {
      id: 'weapon',
      label: '武器池资源',
      items: buildResourceItems(overviewSplitStats.weapon?.resourceSummary, 'weapon')
    }
  ].filter((group) => group.items.length > 0);
}

function buildPitySummary({ currentPool, isGroupMode, hasMergedAccountView, analysisPity }) {
  if (!currentPool || isGroupMode || hasMergedAccountView || !analysisPity) {
    return null;
  }

  const probabilityInfo = calculateCurrentProbability(
    analysisPity.displayPity6,
    analysisPity.normalizedType
  );

  return {
    current6: normalizeNumber(analysisPity.displayPity6),
    max6: normalizeNumber(analysisPity.maxPity6),
    current5: normalizeNumber(analysisPity.displayPity5),
    max5: normalizeNumber(analysisPity.maxPity5),
    probabilityHint: probabilityInfo?.hasSoftPity && probabilityInfo?.isInSoftPity
      ? `概率提升 ${formatRate((probabilityInfo.probability || 0) * 100)}`
      : null,
    inherited6: Boolean(analysisPity.isInherited6),
    inherited5: Boolean(analysisPity.isInherited5)
  };
}

export function buildDashboardSharePayload({
  currentPool,
  normalizedPoolType,
  isGroupMode = false,
  isAllPoolsOverview = false,
  hasMergedAccountView = false,
  overviewPoolFilter = 'all',
  stats = {},
  analysisPity = null,
  sections = [],
  overviewSplitStats = null
} = {}) {
  const scopeLabel = isAllPoolsOverview
    ? '全部卡池总览'
    : isGroupMode
      ? '池组总览'
      : '卡池详情';
  const poolName = currentPool?.name || '未选择卡池';
  const overviewFilterLabel = isAllPoolsOverview ? getOverviewFilterLabel(overviewPoolFilter) : null;
  const periodLabel = sections.length === 1
    ? sections[0]?.period || '长期开放'
    : `${sections.length} 个卡池阶段`;
  const totalNodes = sections.reduce((sum, section) => sum + (section?.entries?.length || 0), 0);

  return {
    scopeLabel,
    poolName,
    poolType: normalizedPoolType || 'standard',
    poolTypeLabel: isAllPoolsOverview && overviewPoolFilter === 'all'
      ? '角色池 + 武器池'
      : getPoolTypeLabel(normalizedPoolType),
    overviewFilterLabel,
    featured: currentPool?.up_character || currentPool?.upCharacter || null,
    periodLabel,
    totalNodes,
    totalSections: sections.length,
    hasMergedAccountView,
    summaryGroups: isAllPoolsOverview && overviewPoolFilter === 'all'
      ? buildSplitSummaryGroups(overviewSplitStats)
      : null,
    averageGroups: isAllPoolsOverview && overviewPoolFilter === 'all'
      ? buildSplitAverageGroups(overviewSplitStats)
      : null,
    resourceGroups: isAllPoolsOverview && overviewPoolFilter === 'all'
      ? buildSplitResourceGroups(overviewSplitStats)
      : null,
    summaryItems: buildSummaryItems({ stats, poolType: normalizedPoolType, isAllPoolsOverview }),
    averageItems: buildAverageItems({ stats, poolType: normalizedPoolType, isAllPoolsOverview }),
    resourceItems: buildResourceItems(
      stats?.resourceSummary,
      isAllPoolsOverview && overviewPoolFilter === 'all' ? 'all' : normalizedPoolType
    ),
    pitySummary: buildPitySummary({ currentPool, isGroupMode, hasMergedAccountView, analysisPity }),
    notes: hasMergedAccountView
      ? '当前为多账号汇总视图，当前保底与软保底概率已隐藏。'
      : '已脱敏分享卡，不含账号、UID、时间戳与原始抽卡明细。'
  };
}

export function buildDashboardShareText(payload) {
  if (!payload) {
    return '';
  }

  const lines = [
    `【终末地${payload.scopeLabel}分享】`,
    '已脱敏分享卡',
    '',
    `当前视图：${payload.scopeLabel}`,
    `卡池：${payload.poolName}`,
    `池型：${payload.poolTypeLabel}`,
    `阶段数：${payload.totalSections}`,
    `时间线节点：${payload.totalNodes}`
  ];

  if (payload.overviewFilterLabel && payload.overviewFilterLabel !== '全部卡池') {
    lines.push(`筛选：${payload.overviewFilterLabel}`);
  }

  if (payload.featured) {
    lines.push(`当前目标：${payload.featured}`);
  }

  if (Array.isArray(payload.summaryGroups) && payload.summaryGroups.length > 0) {
    payload.summaryGroups.forEach((group) => {
      lines.push(group.label);
      group.items.forEach((item) => {
        lines.push(`${item.label}：${item.value}${item.hint ? `（${item.hint}）` : ''}`);
      });
    });
  } else {
    payload.summaryItems.forEach((item) => {
      lines.push(`${item.label}：${item.value}${item.hint ? `（${item.hint}）` : ''}`);
    });
  }

  if (Array.isArray(payload.averageGroups) && payload.averageGroups.length > 0) {
    payload.averageGroups.forEach((group) => {
      lines.push(group.label);
      group.items.forEach((item) => {
        lines.push(`${item.label}：${item.value}`);
      });
    });
  } else {
    payload.averageItems.forEach((item) => {
      lines.push(`${item.label}：${item.value}`);
    });
  }

  if (Array.isArray(payload.resourceGroups) && payload.resourceGroups.length > 0) {
    payload.resourceGroups.forEach((group) => {
      lines.push(group.label);
      group.items.forEach((item) => {
        lines.push(`${item.label}：${item.value}${item.hint ? `（${item.hint}）` : ''}`);
      });
    });
  } else if (Array.isArray(payload.resourceItems) && payload.resourceItems.length > 0) {
    payload.resourceItems.forEach((item) => {
      lines.push(`${item.label}：${item.value}${item.hint ? `（${item.hint}）` : ''}`);
    });
  }

  if (payload.pitySummary) {
    lines.push(`当前 6★ 保底：${payload.pitySummary.current6}/${payload.pitySummary.max6}`);
    lines.push(`当前 5★ 保底：${payload.pitySummary.current5}/${payload.pitySummary.max5}`);
    if (payload.pitySummary.probabilityHint) {
      lines.push(payload.pitySummary.probabilityHint);
    }
  }

  lines.push('');
  lines.push('来自终末地抽卡分析器');
  lines.push(`网站：${SHARE_BRAND_LINK}`);
  lines.push(payload.notes);

  return lines.join('\n');
}

export function buildDashboardShareCardFileName(payload) {
  const safeScope = String(payload?.scopeLabel || '卡池分析').replace(/[\\/:*?"<>|]/g, '');
  const safePoolName = String(payload?.poolName || '分享卡').replace(/[\\/:*?"<>|]/g, '');
  return `${DASHBOARD_SHARE_FILE_PREFIX}_${safeScope}_${safePoolName}_${formatShareTimestamp()}.png`;
}
