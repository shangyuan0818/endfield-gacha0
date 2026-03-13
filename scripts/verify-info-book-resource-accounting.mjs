import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import useHistoryStore from '../src/stores/useHistoryStore.js';
import { annotateInfoBookPulls, isInfoBookHistoryPull } from '../src/utils/historyInfoBook.js';
import { useSummaryStats } from '../src/hooks/summary/useSummaryStats.js';
import { usePoolStats } from '../src/hooks/app/usePoolStats.js';
import { normalizeGlobalStats } from '../src/services/statsService.js';

const BASE_TIME = Date.parse('2026-01-01T00:00:00.000Z');

function renderHookResult(hook, props) {
  let hookResult = null;

  function Probe(currentProps) {
    hookResult = hook(currentProps);
    return React.createElement('div', null, 'probe');
  }

  renderToStaticMarkup(React.createElement(Probe, props));
  return hookResult;
}

function createRecord({
  id,
  poolId,
  userId = 'user-1',
  rarity = 4,
  isStandard = false,
  secondsOffset = id
}) {
  const timestamp = new Date(BASE_TIME + secondsOffset * 1000).toISOString();

  return {
    id,
    record_id: id,
    pool_id: poolId,
    poolId,
    user_id: userId,
    rarity,
    is_standard: isStandard,
    isStandard,
    character_name: `角色${id}`,
    item_name: `角色${id}`,
    timestamp
  };
}

const pools = [
  {
    id: 'limited_a',
    pool_id: 'limited_a',
    type: 'limited_character',
    name: '限定池 A',
    up_character: 'A',
    start_time: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'limited_b',
    pool_id: 'limited_b',
    type: 'limited_character',
    name: '限定池 B',
    up_character: 'B',
    start_time: '2026-02-01T00:00:00.000Z',
    created_at: '2026-02-01T00:00:00.000Z'
  },
  {
    id: 'standard',
    pool_id: 'standard',
    type: 'standard',
    name: '常驻池',
    start_time: '2025-01-01T00:00:00.000Z',
    created_at: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'weapon_a',
    pool_id: 'weapon_a',
    type: 'limited_weapon',
    name: '武器池',
    start_time: '2026-03-01T00:00:00.000Z',
    created_at: '2026-03-01T00:00:00.000Z'
  }
];

const history = [
  ...Array.from({ length: 60 }, (_, index) => createRecord({
    id: index + 1,
    poolId: 'limited_a'
  })),
  ...Array.from({ length: 15 }, (_, index) => createRecord({
    id: index + 61,
    poolId: 'limited_b'
  })),
  ...Array.from({ length: 3 }, (_, index) => createRecord({
    id: index + 76,
    poolId: 'standard',
    isStandard: true
  })),
  ...Array.from({ length: 2 }, (_, index) => createRecord({
    id: index + 79,
    poolId: 'weapon_a'
  }))
];

const annotatedHistory = annotateInfoBookPulls(history, pools);
const infoBookPullCount = annotatedHistory.filter(isInfoBookHistoryPull).length;
assert.equal(infoBookPullCount, 10, '应推导出下一限定池前 10 抽为情报书十连');

useHistoryStore.setState({
  manualPityLimit: 80,
  historyFilter: 'all'
});

const localStats = renderHookResult(
  (props) => useSummaryStats(props.history, props.pools, props.user),
  {
    history,
    pools,
    user: { id: 'user-1' }
  }
);

assert.equal(localStats.byType.limited.total, 75, '限定池总抽数应保留情报书十连');
assert.equal(localStats.byType.limited.resources.chargedCharacterPulls, 65, '限定池收费抽数应排除情报书十连');
assert.equal(localStats.byType.limited.resources.jadeSpent, 32500, '限定池耗玉应只按收费抽数计算');
assert.equal(localStats.resources.chargedCharacterPulls, 68, '全局角色池收费抽数应排除情报书十连');
assert.equal(localStats.resources.jadeSpent, 34000, '全局耗玉应排除情报书十连');
assert.equal(localStats.byType.weapon.resources.arsenalSpent, 396, '武器池耗配额应继续按收费抽数计算');

const currentPoolHistory = annotatedHistory.filter((item) => item.poolId === 'limited_b');
const allLimitedHistory = annotatedHistory.filter((item) => item.poolId === 'limited_a' || item.poolId === 'limited_b');
const poolStatsResult = renderHookResult(
  (props) => usePoolStats(props),
  {
    normalizedCurrentPoolHistory: currentPoolHistory,
    currentPool: {
      id: 'limited_b',
      type: 'limited_character',
      isGroupMode: false,
      name: '限定池 B'
    },
    allLimitedHistory,
    currentPoolId: 'limited_b'
  }
);

assert.equal(poolStatsResult.stats.total, 15, '当前池总抽数应保留情报书十连');
assert.equal(poolStatsResult.stats.resourceSummary.chargedCharacterPulls, 5, '当前池收费抽数应只剩真实耗玉部分');
assert.equal(poolStatsResult.stats.resourceSummary.jadeSpent, 2500, '当前池资源统计应排除情报书十连');

const globalStats = normalizeGlobalStats({
  totalPulls: 80,
  totalPullsWithFree: 80,
  freePullCount: 0,
  chargedCharacterPulls: 68,
  chargedWeaponPulls: 2,
  infoBookPullCount: 10,
  totalUsers: 1,
  totalContributors: 1,
  sixStarTotal: 0,
  sixStarLimited: 0,
  sixStarStandard: 0,
  fiveStar: 0,
  fourStar: 80,
  counts: {
    '6': 0,
    '6_std': 0,
    '5': 0,
    '4': 80
  },
  distribution: [],
  byType: {
    limited: {
      total: 75,
      chargedPulls: 65,
      six: 0,
      sixStarLimited: 0,
      sixStarStandard: 0,
      counts: { '6': 0, '6_std': 0, '5': 0, '4': 75 },
      distribution: []
    },
    standard: {
      total: 3,
      chargedPulls: 3,
      six: 0,
      sixStarLimited: 0,
      sixStarStandard: 0,
      counts: { '6': 0, '6_std': 0, '5': 0, '4': 3 },
      distribution: []
    },
    weapon: {
      total: 2,
      chargedPulls: 2,
      six: 0,
      sixStarLimited: 0,
      sixStarStandard: 0,
      counts: { '6': 0, '6_std': 0, '5': 0, '4': 2 },
      distribution: []
    }
  }
});

assert.equal(globalStats.infoBookPullCount, 10, '全服统计应保留情报书抽数元数据');
assert.equal(globalStats.byType.limited.resources.chargedCharacterPulls, 65, '全服限定池资源应吃 RPC 的 chargedPulls');
assert.equal(globalStats.byType.limited.resources.jadeSpent, 32500, '全服限定池耗玉应排除情报书十连');
assert.equal(globalStats.resources.chargedCharacterPulls, 68, '全服角色池收费抽数应排除情报书十连');
assert.equal(globalStats.resources.jadeSpent, 34000, '全服总耗玉应排除情报书十连');

console.log('BUG-026 info-book resource accounting verification passed');
