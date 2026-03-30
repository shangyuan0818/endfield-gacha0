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

  if (tracker.hasSeenHit) {
    tracker.intervals.push({
      count: tracker.pullsSinceLastHit,
      ...payload
    });
  }

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
