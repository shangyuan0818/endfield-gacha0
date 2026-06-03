export function createHitIntervalTracker() {
  return {
    hasSeenHit: false,
    pullsSinceLastHit: 0,
    intervals: []
  };
}

export function recordHitIntervalPull(tracker) {
  if (!tracker) {
    return;
  }

  tracker.pullsSinceLastHit += 1;
}

export function recordHitIntervalHit(tracker, payload = {}) {
  if (!tracker) {
    return;
  }

  // gui.cpp 标准: 所有命中的 pity_since_last_up 都计入 sum_up/count_up,
  // 包括第一次 UP。旧逻辑跳过 hasSeenHit=false 的首次命中导致单六星时
  // intervals 为空, avgPullCost 错误 fallback 到 '0'。
  tracker.intervals.push({
    count: tracker.pullsSinceLastHit,
    ...payload
  });

  tracker.hasSeenHit = true;
  tracker.pullsSinceLastHit = 0;
}

export function averageTrackedIntervals(intervals, {
  digits = 2,
  exclude = null
} = {}) {
  if (!Array.isArray(intervals) || intervals.length === 0) {
    return null;
  }

  const filtered = exclude
    ? intervals.filter((item) => !exclude(item))
    : intervals;

  if (filtered.length === 0) {
    return null;
  }

  const total = filtered.reduce((sum, item) => sum + (Number(item?.count) || 0), 0);
  return (total / filtered.length).toFixed(digits);
}
