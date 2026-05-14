function toAverageNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function formatAverage(value) {
  return value === null ? null : value.toFixed(1);
}

function getSixWeight(stats) {
  const numeric = Number(stats?.six ?? stats?.sixStar ?? 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function hasExplicitExcludingFreeAverage(stats) {
  return toAverageNumber(stats?.avgPityExcludingFree) !== null;
}

function weightedAverageBySix(statsList, resolveAverage) {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const stats of statsList) {
    const weight = getSixWeight(stats);
    if (weight === 0) continue;

    const average = resolveAverage(stats);
    if (average === null) {
      return null;
    }

    totalWeight += weight;
    weightedSum += average * weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

function differsEnough(left, right) {
  return left !== null && right !== null && Math.abs(left - right) >= 0.1;
}

export function getCombinedCharacterAverageDisplay({
  characterStats = {},
  extraStats = {},
  limitedStats = {},
  standardStats = {}
} = {}) {
  const poolStats = [extraStats, limitedStats, standardStats];
  const characterAverage = toAverageNumber(characterStats?.avgPity);
  const characterAverageExcludingFree = toAverageNumber(characterStats?.avgPityExcludingFree);
  const weightedAverageWithFree = weightedAverageBySix(
    poolStats,
    (stats) => toAverageNumber(stats?.avgPity)
  );
  const hasPoolExcludingFreeAverage = poolStats.some(hasExplicitExcludingFreeAverage);
  const weightedAverageExcludingFree = hasPoolExcludingFreeAverage
    ? weightedAverageBySix(
      poolStats,
      (stats) => toAverageNumber(stats?.avgPityExcludingFree) ?? toAverageNumber(stats?.avgPity)
    )
    : null;

  const displayAverage = characterAverageExcludingFree
    ?? weightedAverageExcludingFree
    ?? characterAverage
    ?? weightedAverageWithFree;
  const withFreeAverage = (() => {
    const withFreeSource = characterAverage ?? weightedAverageWithFree;
    if (differsEnough(displayAverage, withFreeSource)) {
      return withFreeSource;
    }
    return null;
  })();

  return {
    value: formatAverage(displayAverage) ?? '-',
    withFree: formatAverage(withFreeAverage)
  };
}
