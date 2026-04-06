import { characterCache } from './characterUtils.js';
import {
  isFreeHistoryPull,
  isGiftHistoryPull,
  isInfoBookHistoryPull
} from './historyInfoBook.js';
import { getPoolTimingMeta, normalizePoolGroupType } from './poolSelectorDisplay.js';
import {
  LIMITED_POOL_RULES,
  STANDARD_POOL_RULES,
  WEAPON_POOL_RULES
} from '../constants/index.js';

function normalizePoolType(type) {
  if (type === 'limited_character') return 'limited';
  if (type === 'limited_weapon') return 'weapon';
  if (type === 'beginner') return 'standard';
  return type || 'standard';
}

function getPoolSixStarPity(poolType) {
  if (poolType === 'weapon') {
    return WEAPON_POOL_RULES.sixStarPity;
  }

  if (poolType === 'limited') {
    return LIMITED_POOL_RULES.sixStarPity;
  }

  return STANDARD_POOL_RULES.sixStarPity;
}

function getHistoryPoolId(item) {
  return item?.poolId || item?.pool_id || null;
}

function getHistorySeqId(item) {
  return parseInt(item?.seqId || item?.seq_id || '0', 10) || 0;
}

function getHistoryTimestamp(item) {
  if (typeof item?.timestamp === 'number') {
    return item.timestamp;
  }

  const parsed = new Date(item?.timestamp || item?.gacha_time || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortHistoryAsc(left, right) {
  const timeDiff = getHistoryTimestamp(left) - getHistoryTimestamp(right);
  if (timeDiff !== 0) {
    return timeDiff;
  }

  return getHistorySeqId(left) - getHistorySeqId(right);
}

function roundScaleMax(value, minimum) {
  return Math.max(minimum, Math.ceil(Math.max(value, 0) / 10) * 10);
}

function formatDateLabel(input) {
  const timestamp = getHistoryTimestamp({ timestamp: input });
  if (!timestamp) {
    return '--';
  }

  const date = new Date(timestamp);
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatPeriod(pool) {
  if (!pool?.start_time || !pool?.end_time) {
    return '长期开放';
  }

  return `${formatDateLabel(pool.start_time)} - ${formatDateLabel(pool.end_time)}`;
}

function getItemName(item) {
  return item?.item_name || item?.character_name || item?.name || '未知目标';
}

function formatPrimaryDropLabel(item, fallback = '未知目标') {
  const label = getItemName(item);
  return label || fallback;
}

function getAvatarUrl(name) {
  if (!name) {
    return null;
  }

  return characterCache.searchByName(name, false)?.avatar_url || null;
}

function isActuallyLimited(item) {
  const characterName = getItemName(item);
  return Boolean(characterCache.searchByName(characterName, false)?.is_limited);
}

function createDropBadges(items) {
  const badgeMap = new Map();

  items.forEach((item) => {
    const label = getItemName(item);
    const existing = badgeMap.get(label);
    if (existing) {
      existing.count += 1;
      existing.rarity = Math.max(existing.rarity, Number(item?.rarity) || 0);
      return;
    }

    badgeMap.set(label, {
      label,
      rarity: Number(item?.rarity) || 0,
      count: 1,
      avatarUrl: getAvatarUrl(label)
    });
  });

  return Array.from(badgeMap.values())
    .sort((left, right) => {
      if (left.rarity !== right.rarity) {
        return right.rarity - left.rarity;
      }

      if (left.count !== right.count) {
        return right.count - left.count;
      }

      return left.label.localeCompare(right.label, 'zh-Hans-CN');
    })
    .slice(0, 4);
}

function createLeadBadge(item, fallbackLabel = '?') {
  if (!item) {
    return {
      label: fallbackLabel,
      rarity: 0,
      count: 1,
      avatarUrl: null
    };
  }

  const label = getItemName(item);
  return {
    label,
    rarity: Number(item?.rarity) || 0,
    count: 1,
    avatarUrl: getAvatarUrl(label)
  };
}

function formatBadgeSummary(badges = []) {
  if (!Array.isArray(badges) || badges.length === 0) {
    return '';
  }

  return badges
    .map((badge) => `${badge.rarity > 0 ? `${badge.rarity}★` : ''}「${badge.label}」${badge.count > 1 ? `x${badge.count}` : ''}`)
    .join(' / ');
}

function formatSecondarySixStarNames(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return '';
  }

  const badges = createDropBadges(items.filter((item) => Number(item?.rarity) >= 6));
  if (badges.length === 0) {
    return '';
  }

  const labels = badges.map((badge) => `「${badge.label}」${badge.count > 1 ? `x${badge.count}` : ''}`);
  if (labels.length === 1) {
    return labels[0];
  }

  if (labels.length === 2) {
    return labels.join(' / ');
  }

  return `${labels.slice(0, 2).join(' / ')} 等 ${items.length} 次`;
}

function formatSecondarySegment(prefix, items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const names = formatSecondarySixStarNames(items);
  if (!names) {
    return `${prefix}${items.length}`;
  }

  return `${prefix}${names}`;
}

function classifySixStarStageKind(item) {
  if (!item || Number(item?.rarity) < 6) {
    return 'generic';
  }

  if (item?.isStandard !== true) {
    return 'up';
  }

  return isActuallyLimited(item) ? 'offLimited' : 'offStandard';
}

function mergeBadgeItems(...groups) {
  return groups.flatMap((group) => Array.isArray(group) ? group : []);
}

function buildOrderedTimelineGroups(history = []) {
  const sorted = [...history].sort(sortHistoryAsc);
  const groups = [];
  let currentPaidGroup = [];
  let currentGiftGroup = [];

  const flushGiftGroup = () => {
    if (currentGiftGroup.length > 0) {
      groups.push(currentGiftGroup);
      currentGiftGroup = [];
    }
  };

  const flushPaidGroup = () => {
    if (currentPaidGroup.length > 0) {
      groups.push(currentPaidGroup);
      currentPaidGroup = [];
    }
  };

  sorted.forEach((item) => {
    const isGiftLike = isGiftHistoryPull(item) || isFreeHistoryPull(item);
    const isSixStar = Number(item?.rarity) >= 6;

    if (isGiftLike) {
      currentGiftGroup.push(item);
      return;
    }

    flushGiftGroup();
    currentPaidGroup.push(item);
    if (isSixStar) {
      flushPaidGroup();
    }
  });

  flushGiftGroup();
  flushPaidGroup();

  return groups;
}

function calculateTimelineMetrics(history = []) {
  const validPulls = history.filter((item) => !isGiftHistoryPull(item) && !isFreeHistoryPull(item));
  const sixStars = validPulls.filter((item) => Number(item?.rarity) >= 6);
  const fiveStars = validPulls.filter((item) => Number(item?.rarity) === 5);
  const upSixStars = sixStars.filter((item) => item?.isStandard !== true);
  const currentPity = (() => {
    let pity = 0;
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const item = history[index];
      if (isGiftHistoryPull(item) || isFreeHistoryPull(item)) {
        continue;
      }
      if (Number(item?.rarity) >= 6) {
        break;
      }
      pity += 1;
    }
    return pity;
  })();
  const currentPity5 = (() => {
    let pity = 0;
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const item = history[index];
      if (isGiftHistoryPull(item) || isFreeHistoryPull(item)) {
        continue;
      }
      if (Number(item?.rarity) >= 5) {
        break;
      }
      pity += 1;
    }
    return pity;
  })();

  return {
    totalPulls: validPulls.length,
    sixStarCount: sixStars.length,
    fiveStarCount: fiveStars.length,
    upSixStarCount: upSixStars.length,
    winRate: sixStars.length > 0 ? ((upSixStars.length / sixStars.length) * 100) : 0,
    avgSixStarPulls: sixStars.length > 0 ? (validPulls.length / sixStars.length) : Number.NaN,
    avgFiveStarPulls: fiveStars.length > 0 ? (validPulls.length / fiveStars.length) : Number.NaN,
    avgUpPulls: upSixStars.length > 0 ? (validPulls.length / upSixStars.length) : Number.NaN,
    currentPity,
    currentPity5
  };
}

function summarizeGroup(group = []) {
  const sixStars = group.filter((item) => Number(item?.rarity) >= 6);
  const fiveStars = group.filter((item) => Number(item?.rarity) === 5);
  const highRarityItems = group.filter((item) => Number(item?.rarity) >= 5);
  const paidCount = group.filter((item) => !isGiftHistoryPull(item) && !isFreeHistoryPull(item)).length;
  const hasGift = group.some((item) => isGiftHistoryPull(item) || isFreeHistoryPull(item));
  const hasFreePulls = group.some((item) => isFreeHistoryPull(item));
  const hasGiftPulls = group.some((item) => isGiftHistoryPull(item));
  const hasInfoBook = group.some((item) => isInfoBookHistoryPull(item));
  const upSixStars = sixStars.filter((item) => item?.isStandard !== true);
  const offLimitedSixStars = sixStars.filter((item) => item?.isStandard === true && isActuallyLimited(item));
  const offStandardSixStars = sixStars.filter((item) => item?.isStandard === true && !isActuallyLimited(item));
  const primarySixStar = sixStars.length > 0 ? sixStars[sixStars.length - 1] : null;
  const primaryHighRarity = highRarityItems.length > 0 ? highRarityItems[highRarityItems.length - 1] : null;
  const timestampSource = primarySixStar || primaryHighRarity || group[group.length - 1] || group[0] || null;

  return {
    paidCount,
    hasGift,
    hasFreePulls,
    hasGiftPulls,
    hasInfoBook,
    hasSixStar: sixStars.length > 0,
    hasFiveStar: fiveStars.length > 0,
    sixStars,
    fiveStars,
    upSixStars,
    offLimitedSixStars,
    offStandardSixStars,
    primarySixStar,
    primaryHighRarity,
    highRarityItems,
    dropBadges: createDropBadges(highRarityItems),
    groupSize: group.length,
    timestamp: timestampSource?.timestamp || timestampSource?.gacha_time || null
  };
}

function buildMilestoneSummary(summary, poolType) {
  if (summary.hasGift) {
    const stageLabel = summary.hasFreePulls
      ? (summary.groupSize >= 10 ? '免费十连' : '免费节点')
      : '赠送节点';
    const badgeSummary = formatBadgeSummary(summary.dropBadges);
    return {
      stageLabel,
      resultSummary: badgeSummary
        ? `${stageLabel}结果：${badgeSummary}`
        : `${stageLabel}结果：未出 5★ 及以上`,
      tags: [summary.hasFreePulls ? '免费' : '赠送'],
      stageKind: 'gift',
      leadBadge: summary.hasSixStar
        ? createLeadBadge(summary.primarySixStar)
        : createLeadBadge(summary.primaryHighRarity)
    };
  }

  const primaryStageKind = classifySixStarStageKind(summary.primarySixStar);
  const primaryLabel = formatPrimaryDropLabel(summary.primarySixStar, formatPrimaryDropLabel(summary.primaryHighRarity));
  if (poolType === 'standard') {
    return {
      stageLabel: '6★ 节点',
      resultSummary: `获得 6★「${primaryLabel}」${summary.sixStars.length > 1 ? ` 等 ${summary.sixStars.length} 次` : ''}${summary.fiveStars.length > 0 ? `，附带 ${summary.fiveStars.length} 次 5★` : ''}`,
      tags: [],
      stageKind: primaryStageKind === 'offLimited' ? 'offLimited' : 'offStandard',
      leadBadge: createLeadBadge(summary.primarySixStar)
    };
  }

  const secondarySegments = [];
  if (summary.upSixStars.length > 0 && primaryStageKind !== 'up') {
    secondarySegments.push(formatSecondarySegment('UP', summary.upSixStars));
  }
  if (summary.offLimitedSixStars.length > 0 && primaryStageKind !== 'offLimited') {
    secondarySegments.push(formatSecondarySegment('歪限定', summary.offLimitedSixStars));
  }
  if (summary.offStandardSixStars.length > 0 && primaryStageKind !== 'offStandard') {
    secondarySegments.push(formatSecondarySegment('歪常驻', summary.offStandardSixStars));
  }
  const secondarySummary = secondarySegments.filter(Boolean).length > 0 ? `，同批含 ${secondarySegments.filter(Boolean).join(' / ')}` : '';

  if (primaryStageKind === 'up') {
    return {
      stageLabel: '命中节点',
      resultSummary: `命中目标 6★「${primaryLabel}」${summary.upSixStars.length > 1 ? ` 等 ${summary.upSixStars.length} 次` : ''}${secondarySummary}${summary.fiveStars.length > 0 ? `，附带 ${summary.fiveStars.length} 次 5★` : ''}`,
      tags: ['UP'],
      stageKind: 'up',
      leadBadge: createLeadBadge(summary.primarySixStar)
    };
  }

  if (primaryStageKind === 'offLimited') {
    return {
      stageLabel: '偏移节点',
      resultSummary: `偏移到其他限定「${primaryLabel}」${summary.offLimitedSixStars.length > 1 ? ` 等 ${summary.offLimitedSixStars.length} 次` : ''}${secondarySummary}${summary.fiveStars.length > 0 ? `，附带 ${summary.fiveStars.length} 次 5★` : ''}`,
      tags: ['偏移'],
      stageKind: 'offLimited',
      leadBadge: createLeadBadge(summary.primarySixStar)
    };
  }

  if (primaryStageKind === 'offStandard') {
    return {
      stageLabel: '偏移节点',
      resultSummary: `偏移到常驻 6★「${primaryLabel}」${summary.offStandardSixStars.length > 1 ? ` 等 ${summary.offStandardSixStars.length} 次` : ''}${secondarySummary}${summary.fiveStars.length > 0 ? `，附带 ${summary.fiveStars.length} 次 5★` : ''}`,
      tags: ['歪'],
      stageKind: 'offStandard',
      leadBadge: createLeadBadge(summary.primarySixStar)
    };
  }

  return {
    stageLabel: '阶段节点',
    resultSummary: '阶段节点',
    tags: [],
    stageKind: 'generic',
    leadBadge: createLeadBadge(summary.primaryHighRarity)
  };
}

function getStageTargetPulls(poolType, stageKind, stageSize = 0) {
  if (stageKind === 'gift') {
    return Math.max(stageSize || 10, 10);
  }

  return getPoolSixStarPity(poolType);
}

function buildCurrentStageEntry(pool, pendingPaidCount, currentPityValue, supportItems = [], currentTargetPullsOverride) {
  const targetLabel = '6★ 节点';
  const displayPulls = Number.isFinite(currentPityValue) ? currentPityValue : pendingPaidCount;
  const normalizedType = normalizePoolType(pool?.type);
  const supportBadges = createDropBadges(supportItems.filter((item) => Number(item?.rarity) === 5));

  return {
    id: `${pool?.id || 'pool'}-current-stage`,
    isCurrentStage: true,
    stageKind: 'current',
    dateLabel: '至今',
    stageLabel: '当前推进',
    pulls: displayPulls,
    targetPulls: Number.isFinite(currentTargetPullsOverride)
      ? currentTargetPullsOverride
      : getStageTargetPulls(normalizedType, 'current'),
    resultSummary: displayPulls > 0
      ? `当前仍在推进，尚未触发新的 ${targetLabel}`
      : '当前阶段尚未形成新的高稀有节点',
    metaSummary: null,
    tags: ['当前'],
    leadBadge: createLeadBadge(null, pool?.up_character || pool?.upCharacter || '?'),
    dropBadges: supportBadges
  };
}

function buildStageEntries({
  history,
  pool,
  currentPityOverride,
  currentTargetPullsOverride,
  showCurrentStage = true
}) {
  const ascendingGroups = buildOrderedTimelineGroups(history);
  const stages = [];
  let pendingPaidCount = 0;
  let pendingSupportItems = [];

  ascendingGroups.forEach((group) => {
    const summary = summarizeGroup(group);
    pendingPaidCount += summary.paidCount;
    const normalizedType = normalizePoolType(pool?.type);

    if (summary.hasGift) {
      const milestone = buildMilestoneSummary(summary, normalizedType);
      stages.push({
        id: `${pool?.id || 'pool'}-stage-${stages.length + 1}`,
        stageKind: milestone.stageKind,
        dateLabel: formatDateLabel(summary.timestamp),
        stageLabel: milestone.stageLabel,
        pulls: Math.max(group.length, summary.paidCount),
        targetPulls: getStageTargetPulls(normalizedType, milestone.stageKind, summary.groupSize),
        resultSummary: milestone.resultSummary,
        metaSummary: null,
        tags: milestone.tags,
        leadBadge: milestone.leadBadge || createLeadBadge(summary.primaryHighRarity, pool?.up_character || pool?.upCharacter || '?'),
        dropBadges: createDropBadges(summary.highRarityItems)
      });
      return;
    }

    const shouldEmitMilestone = summary.hasSixStar;
    if (!shouldEmitMilestone) {
      if (summary.fiveStars.length > 0) {
        pendingSupportItems = mergeBadgeItems(pendingSupportItems, summary.fiveStars);
      }
      return;
    }

    const milestone = buildMilestoneSummary(summary, normalizedType);
    const mergedSupportItems = mergeBadgeItems(pendingSupportItems, summary.fiveStars);
    stages.push({
      id: `${pool?.id || 'pool'}-stage-${stages.length + 1}`,
      stageKind: milestone.stageKind,
      dateLabel: formatDateLabel(summary.timestamp),
      stageLabel: milestone.stageLabel,
      pulls: pendingPaidCount,
      targetPulls: getStageTargetPulls(normalizedType, milestone.stageKind, summary.groupSize),
      resultSummary: milestone.resultSummary,
      metaSummary: null,
      tags: milestone.tags,
      leadBadge: milestone.leadBadge || createLeadBadge(summary.primaryHighRarity, pool?.up_character || pool?.upCharacter || '?'),
      dropBadges: createDropBadges(mergedSupportItems)
    });
    pendingPaidCount = 0;
    pendingSupportItems = [];
  });

  const shouldAlwaysShowCurrentStage = normalizePoolType(pool?.type) === 'weapon';

  if (showCurrentStage && (pendingPaidCount > 0 || stages.length === 0 || shouldAlwaysShowCurrentStage)) {
    stages.push(
      buildCurrentStageEntry(
        pool,
        pendingPaidCount,
        currentPityOverride,
        pendingSupportItems,
        currentTargetPullsOverride
      )
    );
  }

  return stages.reverse();
}

function buildTimelineSection({
  pool,
  history,
  currentPityOverride,
  currentPity5Override,
  currentTargetPullsOverride,
  disablePityState = false
}) {
  const normalizedType = normalizePoolType(pool?.type);
  const metrics = calculateTimelineMetrics(history);
  const timing = getPoolTimingMeta(pool);
  const showCurrentStage = !disablePityState && (normalizedType === 'weapon' || !timing.isTimed || timing.isActive);
  const entries = buildStageEntries({
    history,
    pool,
    currentPityOverride,
    currentTargetPullsOverride,
    showCurrentStage
  });
  const maxEntryPulls = entries.reduce((maxValue, entry) => Math.max(maxValue, entry.pulls || 0), 0);
  const minimumScale = normalizedType === 'weapon' ? 40 : 60;

  return {
    id: pool?.id || 'pool-timeline',
    title: pool?.name || '未知卡池',
    type: normalizedType,
    featured: pool?.up_character || pool?.upCharacter || null,
    period: formatPeriod(pool),
    status: timing,
    totalPulls: metrics.totalPulls,
    currentPity: disablePityState ? null : (currentPityOverride ?? metrics.currentPity),
    currentPity5: disablePityState ? null : (currentPity5Override ?? metrics.currentPity5),
    sixStarCount: metrics.sixStarCount,
    fiveStarCount: metrics.fiveStarCount,
    upSixStarCount: metrics.upSixStarCount,
    winRate: metrics.winRate,
    avgSixStarPulls: metrics.avgSixStarPulls,
    avgFiveStarPulls: metrics.avgFiveStarPulls,
    avgUpPulls: metrics.avgUpPulls,
    hidePityState: disablePityState,
    scaleMax: roundScaleMax(Math.max(maxEntryPulls, disablePityState ? 0 : (currentPityOverride ?? metrics.currentPity)), minimumScale),
    entries
  };
}

export function buildSinglePoolTimelineSection({
  pool,
  history = [],
  currentPityOverride,
  currentPity5Override,
  currentTargetPullsOverride,
  disablePityState = false
}) {
  if (!pool) {
    return null;
  }

  return buildTimelineSection({
    pool,
    history,
    currentPityOverride,
    currentPity5Override,
    currentTargetPullsOverride,
    disablePityState
  });
}

export function buildOverviewTimelineSections({
  pools = [],
  history = [],
  analysisPityByPoolId = null,
  disablePityState = false
}) {
  const historyByPoolId = new Map();

  history.forEach((item) => {
    const poolId = getHistoryPoolId(item);
    if (!poolId) {
      return;
    }

    if (!historyByPoolId.has(poolId)) {
      historyByPoolId.set(poolId, []);
    }
    historyByPoolId.get(poolId).push(item);
  });

  return (pools || [])
    .map((pool) => {
      const poolHistory = historyByPoolId.get(pool.id) || [];
      if (poolHistory.length === 0) {
        return null;
      }

      return buildTimelineSection({
        pool: {
          ...pool,
          selectorGroupType: normalizePoolGroupType(pool)
        },
        history: poolHistory,
        currentPityOverride: disablePityState ? null : analysisPityByPoolId?.get(pool.id)?.displayPity6,
        currentPity5Override: disablePityState ? null : analysisPityByPoolId?.get(pool.id)?.displayPity5,
        currentTargetPullsOverride: analysisPityByPoolId?.get(pool.id)?.maxPity6,
        disablePityState
      });
    })
    .filter(Boolean);
}

export default {
  buildSinglePoolTimelineSection,
  buildOverviewTimelineSections
};
