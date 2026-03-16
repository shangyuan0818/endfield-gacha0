import {
  buildOverviewTimelineSections,
  buildSinglePoolTimelineSection
} from './poolTimelineView.js';

function getOverviewPoolFilterType(pool) {
  if (pool?.type === 'weapon' || pool?.type === 'limited_weapon') {
    return 'weapon';
  }

  if (pool?.type === 'limited' || pool?.type === 'limited_character') {
    return 'limited';
  }

  return 'standard';
}

function matchesOverviewPoolFilter(section, overviewPoolFilter) {
  if (overviewPoolFilter === 'all') {
    return true;
  }

  return section.type === overviewPoolFilter;
}

export function buildDashboardTimelineSections({
  currentPool,
  currentPoolHistory = [],
  groupedHistory = [],
  selectedPools = [],
  isGroupMode = false,
  isAllPoolsOverview = false,
  effectivePity = null,
  analysisPity = null,
  overviewAnalysisPityMap = null,
  overviewPoolFilter = 'all',
  hasMergedAccountView = false
}) {
  if (isGroupMode) {
    const visiblePools = isAllPoolsOverview
      ? selectedPools.filter((pool) => matchesOverviewPoolFilter({ type: getOverviewPoolFilterType(pool) }, overviewPoolFilter))
      : selectedPools;

    return buildOverviewTimelineSections({
      pools: visiblePools,
      history: currentPoolHistory,
      analysisPityByPoolId: overviewAnalysisPityMap,
      disablePityState: hasMergedAccountView
    });
  }

  const section = buildSinglePoolTimelineSection({
    pool: currentPool,
    history: currentPoolHistory,
    groupedHistory,
    currentPityOverride: hasMergedAccountView ? null : (analysisPity?.displayPity6 ?? effectivePity?.pity6),
    currentPity5Override: hasMergedAccountView ? null : (analysisPity?.displayPity5 ?? effectivePity?.pity5),
    currentTargetPullsOverride: analysisPity?.maxPity6,
    disablePityState: hasMergedAccountView
  });

  return section ? [section] : [];
}

export function countDashboardTimelineNodes(sections = []) {
  return sections.reduce((sum, section) => sum + (section?.entries?.length || 0), 0);
}

