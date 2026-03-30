import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import useHistoryStore from '../src/stores/useHistoryStore.js';
import { usePoolStats } from '../src/hooks/app/usePoolStats.js';
import { useSummaryStats } from '../src/hooks/summary/useSummaryStats.js';
import { buildDashboardOverviewSplitStats } from '../src/utils/dashboardOverviewSplitStats.js';

const BASE_TIME = Date.parse('2026-02-01T00:00:00.000Z');

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
  rarity = 4,
  isStandard = false,
  name = `记录${id}`
}) {
  const timestamp = new Date(BASE_TIME + id * 1000).toISOString();

  return {
    id,
    record_id: `record-${String(id).padStart(3, '0')}`,
    pool_id: poolId,
    poolId,
    user_id: 'user-1',
    rarity,
    is_standard: isStandard,
    isStandard,
    character_name: name,
    item_name: name,
    timestamp
  };
}

function createFillerRecords({ startId, count, poolId }) {
  return Array.from({ length: count }, (_, index) => createRecord({
    id: startId + index,
    poolId,
    rarity: 4,
    name: `填充${startId + index}`
  }));
}

const pools = [
  {
    id: 'limited_pool',
    pool_id: 'limited_pool',
    type: 'limited_character',
    name: '限定池',
    up_character: '目标A'
  },
  {
    id: 'weapon_pool',
    pool_id: 'weapon_pool',
    type: 'limited_weapon',
    name: '武器池',
    up_character: '目标武器'
  }
];

const history = [
  ...createFillerRecords({ startId: 1, count: 10, poolId: 'limited_pool' }),
  createRecord({ id: 11, poolId: 'limited_pool', rarity: 6, isStandard: false, name: '目标A' }),
  ...createFillerRecords({ startId: 12, count: 9, poolId: 'limited_pool' }),
  createRecord({ id: 21, poolId: 'limited_pool', rarity: 6, isStandard: true, name: '常驻角色' }),
  ...createFillerRecords({ startId: 22, count: 9, poolId: 'limited_pool' }),
  createRecord({ id: 31, poolId: 'limited_pool', rarity: 6, isStandard: false, name: '目标A' }),
  ...createFillerRecords({ startId: 32, count: 5, poolId: 'weapon_pool' }),
  createRecord({ id: 37, poolId: 'weapon_pool', rarity: 6, isStandard: false, name: '目标武器' }),
  ...createFillerRecords({ startId: 38, count: 3, poolId: 'weapon_pool' }),
  createRecord({ id: 41, poolId: 'weapon_pool', rarity: 6, isStandard: true, name: '常驻武器' }),
  ...createFillerRecords({ startId: 42, count: 5, poolId: 'weapon_pool' }),
  createRecord({ id: 47, poolId: 'weapon_pool', rarity: 6, isStandard: false, name: '目标武器' })
];

useHistoryStore.setState({
  manualPityLimit: 80,
  historyFilter: 'all'
});

const currentPoolHistory = history.filter((item) => item.poolId === 'limited_pool');
const poolStatsResult = renderHookResult(
  (props) => usePoolStats(props),
  {
    normalizedCurrentPoolHistory: currentPoolHistory,
    currentPool: {
      id: 'limited_pool',
      type: 'limited_character',
      isGroupMode: false,
      name: '限定池',
      up_character: '目标A'
    },
    allLimitedHistory: currentPoolHistory,
    currentPoolId: 'limited_pool'
  }
);

assert.equal(
  poolStatsResult.stats.avgPullCost[6],
  '20.00',
  '详情页平均 UP 应按上一次目标 6★ -> 下一次目标 6★ 计算'
);

const summaryStats = renderHookResult(
  (props) => useSummaryStats(props.history, props.pools, props.user),
  {
    history,
    pools,
    user: { id: 'user-1' }
  }
);

assert.equal(
  summaryStats.byType.limited.avgPityUp,
  '20.0',
  '统计页限定池平均 UP 应忽略中间歪出的 6★ 重置'
);
assert.equal(
  summaryStats.byType.weapon.avgPityUp,
  '10.0',
  '统计页武器池平均 UP 应按目标武器之间的真实间隔计算'
);

const overviewStats = buildDashboardOverviewSplitStats({
  history,
  selectedPools: pools
});

assert.equal(
  overviewStats.character.avgPullCost[6],
  '20.00',
  '全部卡池总览的角色池目标 6★ 平均应与统一口径一致'
);
assert.equal(
  overviewStats.weapon.avgPullCost[6],
  '10.00',
  '全部卡池总览的武器池目标 6★ 平均应与统一口径一致'
);

console.log('BUG-035 target UP interval verification passed');
