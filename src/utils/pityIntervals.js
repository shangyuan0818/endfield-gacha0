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

  // countOverride: 免费十连等特殊通道使用固定 slot (gui.cpp: slot=30)
  // isFree:       免费十连出货不重置间隔 (gui.cpp: if (!isFree) pity_since_last_up = 0)
  const { countOverride, isFree, ...rest } = payload;
  const count = countOverride ?? tracker.pullsSinceLastHit;

  tracker.intervals.push({
    count,
    ...rest
  });

  tracker.hasSeenHit = true;
  if (!isFree) {
    tracker.pullsSinceLastHit = 0;
  }
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
