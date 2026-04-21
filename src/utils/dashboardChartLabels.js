function normalizeChartName(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function getDashboardChartItemKind(item = {}) {
  const explicitKind = normalizeChartName(item?.kind);
  if (explicitKind) {
    return explicitKind;
  }

  const name = normalizeChartName(item?.name);
  if (name === '6星(限定)' || name === '6星(目标)') {
    return 'target-six';
  }

  if (name === '6星(常驻)' || name === '6星(常驻/偏移)') {
    return 'offrate-six';
  }

  if (name === '5星') {
    return 'five-star';
  }

  if (name === '4星') {
    return 'four-star';
  }

  return '';
}

export function localizeDashboardChartItems(items = [], {
  primarySixStarLabel,
  secondarySixStarLabel,
  fiveStarLabel = '5★',
  fourStarLabel = '4★',
} = {}) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const kind = getDashboardChartItemKind(item);
    if (kind === 'target-six') {
      return { ...item, name: primarySixStarLabel || item?.name };
    }

    if (kind === 'offrate-six') {
      return { ...item, name: secondarySixStarLabel || item?.name };
    }

    if (kind === 'five-star') {
      return { ...item, name: fiveStarLabel };
    }

    if (kind === 'four-star') {
      return { ...item, name: fourStarLabel };
    }

    return item;
  });
}
