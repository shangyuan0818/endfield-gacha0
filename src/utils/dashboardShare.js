import { calculateCurrentProbability } from './index.js';
import { formatOriginiteEquivalent } from './resourceEconomy.js';
import { SHARE_BRAND_LINK } from './shareBranding.js';
import { formatAppNumber, getAppLocale, getMessage, isEnglishLocale } from '../i18n/index.js';

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

function getPoolTypeLabel(poolType, locale = getAppLocale()) {
  const english = isEnglishLocale(locale);
  if (poolType === 'weapon') {
    return english ? 'Weapon Banner' : '武器池';
  }

  if (poolType === 'standard') {
    return english ? 'Standard Banner' : '常驻池';
  }

  return english ? 'Limited Banner' : '限定池';
}

function getOverviewFilterLabel(filter, locale = getAppLocale()) {
  const english = isEnglishLocale(locale);
  if (filter === 'limited') {
    return english ? 'Limited Banner' : '限定池';
  }

  if (filter === 'weapon') {
    return english ? 'Weapon Banner' : '武器池';
  }

  if (filter === 'standard') {
    return english ? 'Standard Banner' : '常驻池';
  }

  return english ? 'All Banners' : '全部卡池';
}

function buildAverageItems({ stats, poolType, isAllPoolsOverview, locale = getAppLocale() }) {
  const english = isEnglishLocale(locale);
  const items = [
    {
      id: 'avg-5',
      label: english ? '5★ Avg' : '5★ 平均',
      value: formatAverage(stats?.avgPullCost?.[5])
    },
    {
      id: 'avg-6-all',
      label: english ? 'All 6★' : '全部 6★',
      value: formatAverage(stats?.avgPullCost?.['6_all'])
    }
  ];

  if (poolType !== 'standard') {
    items.push({
      id: 'avg-6-target',
      label: isAllPoolsOverview ? (english ? 'Target 6★' : '目标 6★') : (english ? 'UP 6★' : 'UP 6★'),
      value: formatAverage(stats?.avgPullCost?.[6])
    });
  }

  if (poolType === 'limited' || isAllPoolsOverview) {
    items.push({
      id: 'avg-6-limited',
      label: english ? 'Limited 6★' : '限定 6★',
      value: formatAverage(stats?.avgPullCost?.['6_limited'])
    });
  }

  return items;
}

function buildSplitSummaryGroups(overviewSplitStats, locale = getAppLocale()) {
  const english = isEnglishLocale(locale);
  if (!overviewSplitStats) {
    return null;
  }

  return [
    {
      id: 'character',
      label: english ? 'Character Banner Summary' : '角色池汇总',
      items: buildSummaryItems({
        stats: overviewSplitStats.character,
        poolType: 'limited',
        isAllPoolsOverview: true,
        locale
      })
    },
    {
      id: 'weapon',
      label: english ? 'Weapon Banner Summary' : '武器池汇总',
      items: buildSummaryItems({
        stats: overviewSplitStats.weapon,
        poolType: 'weapon',
        isAllPoolsOverview: true,
        locale
      })
    }
  ];
}

function buildSplitAverageGroups(overviewSplitStats, locale = getAppLocale()) {
  const english = isEnglishLocale(locale);
  if (!overviewSplitStats) {
    return null;
  }

  return [
    {
      id: 'character',
      label: english ? 'Character Banner Avg' : '角色池平均',
      items: buildAverageItems({
        stats: overviewSplitStats.character,
        poolType: 'limited',
        isAllPoolsOverview: true,
        locale
      })
    },
    {
      id: 'weapon',
      label: english ? 'Weapon Banner Avg' : '武器池平均',
      items: buildAverageItems({
        stats: overviewSplitStats.weapon,
        poolType: 'weapon',
        isAllPoolsOverview: true,
        locale
      })
    }
  ];
}

function buildSummaryItems({ stats, poolType, isAllPoolsOverview, locale = getAppLocale() }) {
  const english = isEnglishLocale(locale);
  const items = [
    {
      id: 'total-pulls',
      label: english ? 'Total Pulls' : '总抽数',
      value: formatAppNumber(normalizeNumber(stats?.total), locale),
      hint: 'PULLS'
    }
  ];

  if (poolType === 'standard') {
    items.push(
      {
        id: 'six-star-total',
        label: english ? '6★ Total' : '6★ 总数',
        value: formatAppNumber(normalizeNumber(stats?.totalSixStar || stats?.counts?.['6_std']), locale),
        hint: english ? 'All 6★ from standard banner' : '常驻池全部 6★'
      },
      {
        id: 'five-star-count',
        label: english ? '5★ Total' : '5★ 总数',
        value: formatAppNumber(normalizeNumber(stats?.counts?.[5]), locale),
        hint: english ? 'High-rarity drops' : '高稀有节点'
      },
      {
        id: 'four-star-count',
        label: english ? '4★ Total' : '4★ 总数',
        value: formatAppNumber(normalizeNumber(stats?.counts?.[4]), locale),
        hint: english ? 'Base output' : '基础产出'
      }
    );
    return items;
  }

  items.push(
    {
      id: 'target-six',
      label: isAllPoolsOverview ? (english ? 'Target 6★' : '目标 6★') : (english ? 'UP 6★' : 'UP 6★'),
      value: formatAppNumber(normalizeNumber(stats?.counts?.[6]), locale),
      hint: poolType === 'weapon'
        ? (english ? 'Target weapon hits' : '限定武器命中数')
        : (english ? 'Target character hits' : '限定角色命中数')
    },
    {
      id: 'off-six',
      label: isAllPoolsOverview
        ? (english ? 'Standard / Offset 6★' : '常驻 / 偏移 6★')
        : (english ? 'Standard / Off-target 6★' : '常驻 / 歪 6★'),
      value: formatAppNumber(normalizeNumber(stats?.counts?.['6_std']), locale),
      hint: english ? 'Non-target 6★' : '非目标 6★'
    },
    {
      id: 'five-star-count',
      label: english ? '5★ Total' : '5★ 总数',
      value: formatAppNumber(normalizeNumber(stats?.counts?.[5]), locale),
      hint: english ? 'High-rarity drops' : '高稀有节点'
    },
    {
      id: 'four-star-count',
      label: english ? '4★ Total' : '4★ 总数',
      value: formatAppNumber(normalizeNumber(stats?.counts?.[4]), locale),
      hint: english ? 'Base output' : '基础产出'
    }
  );

  if (normalizeNumber(stats?.totalSixStar) > 0) {
    items.push({
      id: 'win-rate',
      label: english ? 'Target Rate' : '不歪率',
      value: formatRate(stats?.winRate),
      hint: english ? 'Target 6★ / All 6★' : '目标 6★ / 全部 6★'
    });
  }

  return items;
}

function buildResourceItems(resources, poolType, locale = getAppLocale()) {
  const english = isEnglishLocale(locale);
  if (!resources) {
    return [];
  }

  const items = [];
  const normalizedPoolType = poolType || 'standard';

  if (normalizedPoolType !== 'weapon') {
    items.push(
      {
        id: 'jade-spent',
        label: english ? 'Oroberyl Spent' : '耗金玉',
        value: formatAppNumber(normalizeNumber(resources.jadeSpent), locale),
        hint: english ? 'Paid pulls only' : '有效抽数换算'
      },
      {
        id: 'originite-equivalent',
        label: english ? 'Origeometry Equivalent' : '衍质折金玉',
        value: formatOriginiteEquivalent(resources.originiteEquivalent || 0),
        hint: english ? 'Current conversion rate' : '按当前换算比例'
      },
      {
        id: 'arsenal-gained',
        label: english ? 'Arsenal Tickets Gained' : '得武库配额',
        value: formatAppNumber(normalizeNumber(resources.arsenalGained), locale),
        hint: english ? 'Converted from 4★ / 5★' : '4★ / 5★ 转化'
      }
    );
  }

  if (normalizedPoolType === 'weapon' || normalizedPoolType === 'all') {
    items.push({
      id: 'arsenal-spent',
      label: english ? 'Arsenal Tickets Spent' : '耗武库配额',
      value: formatAppNumber(normalizeNumber(resources.arsenalSpent), locale),
      hint: english ? 'Weapon banner cost' : '武器池计费'
    });
  }

  return items;
}

function buildSplitResourceGroups(overviewSplitStats, locale = getAppLocale()) {
  const english = isEnglishLocale(locale);
  if (!overviewSplitStats) {
    return null;
  }

  return [
    {
      id: 'character',
      label: english ? 'Character Banner Resources' : '角色池资源',
      items: buildResourceItems(overviewSplitStats.character?.resourceSummary, 'limited', locale)
    },
    {
      id: 'weapon',
      label: english ? 'Weapon Banner Resources' : '武器池资源',
      items: buildResourceItems(overviewSplitStats.weapon?.resourceSummary, 'weapon', locale)
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
} = {}, locale = getAppLocale()) {
  const english = isEnglishLocale(locale);
  const scopeLabel = isAllPoolsOverview
    ? (english ? 'All Banner Overview' : '全部卡池总览')
    : isGroupMode
      ? (english ? 'Group Overview' : '池组总览')
      : (english ? 'Pool Details' : '卡池详情');
  const poolName = currentPool?.name || (english ? 'No pool selected' : '未选择卡池');
  const overviewFilterLabel = isAllPoolsOverview ? getOverviewFilterLabel(overviewPoolFilter, locale) : null;
  const periodLabel = sections.length === 1
    ? sections[0]?.period || (english ? 'Always available' : '长期开放')
    : (english ? `${sections.length} banner stages` : `${sections.length} 个卡池阶段`);
  const totalNodes = sections.reduce((sum, section) => sum + (section?.entries?.length || 0), 0);

  return {
    scopeLabel,
    poolName,
    poolType: normalizedPoolType || 'standard',
    poolTypeLabel: isAllPoolsOverview && overviewPoolFilter === 'all'
      ? (english ? 'Character + Weapon Banners' : '角色池 + 武器池')
      : getPoolTypeLabel(normalizedPoolType, locale),
    overviewFilterLabel,
    featured: currentPool?.up_character || currentPool?.upCharacter || null,
    periodLabel,
    totalNodes,
    totalSections: sections.length,
    hasMergedAccountView,
    summaryGroups: isAllPoolsOverview && overviewPoolFilter === 'all'
      ? buildSplitSummaryGroups(overviewSplitStats, locale)
      : null,
    averageGroups: isAllPoolsOverview && overviewPoolFilter === 'all'
      ? buildSplitAverageGroups(overviewSplitStats, locale)
      : null,
    resourceGroups: isAllPoolsOverview && overviewPoolFilter === 'all'
      ? buildSplitResourceGroups(overviewSplitStats, locale)
      : null,
    summaryItems: buildSummaryItems({ stats, poolType: normalizedPoolType, isAllPoolsOverview, locale }),
    averageItems: buildAverageItems({ stats, poolType: normalizedPoolType, isAllPoolsOverview, locale }),
    resourceItems: buildResourceItems(
      stats?.resourceSummary,
      isAllPoolsOverview && overviewPoolFilter === 'all' ? 'all' : normalizedPoolType,
      locale
    ),
    pitySummary: buildPitySummary({ currentPool, isGroupMode, hasMergedAccountView, analysisPity }),
    notes: hasMergedAccountView
      ? getMessage('share.dashboard.noteMerged', {}, locale)
      : getMessage('share.dashboard.noteDesensitized', {}, locale)
  };
}

export function buildDashboardShareText(payload, locale = getAppLocale()) {
  if (!payload) {
    return '';
  }

  const lines = [
    getMessage('share.dashboard.scope', { scope: payload.scopeLabel }, locale),
    getMessage('share.card.desensitized', {}, locale),
    '',
    getMessage('share.dashboard.currentView', { value: payload.scopeLabel }, locale),
    getMessage('share.dashboard.pool', { value: payload.poolName }, locale),
    getMessage('share.dashboard.poolType', { value: payload.poolTypeLabel }, locale),
    getMessage('share.dashboard.sections', { value: payload.totalSections }, locale),
    getMessage('share.dashboard.nodes', { value: payload.totalNodes }, locale)
  ];

  if (payload.overviewFilterLabel && payload.overviewFilterLabel !== getOverviewFilterLabel('all', locale)) {
    lines.push(getMessage('share.dashboard.filter', { value: payload.overviewFilterLabel }, locale));
  }

  if (payload.featured) {
    lines.push(getMessage('share.dashboard.target', { value: payload.featured }, locale));
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
    lines.push(getMessage('share.dashboard.currentPity6', { value: `${payload.pitySummary.current6}/${payload.pitySummary.max6}` }, locale));
    lines.push(getMessage('share.dashboard.currentPity5', { value: `${payload.pitySummary.current5}/${payload.pitySummary.max5}` }, locale));
    if (payload.pitySummary.probabilityHint) {
      lines.push(payload.pitySummary.probabilityHint);
    }
  }

  lines.push('');
  lines.push(getMessage('share.dashboard.from', {}, locale));
  lines.push(getMessage('share.site', { value: SHARE_BRAND_LINK }, locale));
  lines.push(payload.notes);

  return lines.join('\n');
}

export function buildDashboardShareCardFileName(payload) {
  const safeScope = String(payload?.scopeLabel || '卡池分析').replace(/[\\/:*?"<>|]/g, '');
  const safePoolName = String(payload?.poolName || '分享卡').replace(/[\\/:*?"<>|]/g, '');
  return `${DASHBOARD_SHARE_FILE_PREFIX}_${safeScope}_${safePoolName}_${formatShareTimestamp()}.png`;
}
