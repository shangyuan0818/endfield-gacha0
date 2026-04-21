import { describe, expect, it } from 'vitest';

import { getDashboardChartItemKind, localizeDashboardChartItems } from '../dashboardChartLabels.js';

describe('dashboardChartLabels', () => {
  it('prefers explicit kind metadata when present', () => {
    expect(getDashboardChartItemKind({ kind: 'target-six', name: '6星(常驻)' })).toBe('target-six');
  });

  it('localizes shared chart items without depending on Chinese labels only', () => {
    const localized = localizeDashboardChartItems([
      { kind: 'target-six', name: '6星(限定)', value: 3 },
      { kind: 'offrate-six', name: '6星(常驻)', value: 1 },
      { kind: 'five-star', name: '5星', value: 10 },
      { kind: 'four-star', name: '4星', value: 20 },
    ], {
      primarySixStarLabel: 'UP 6★',
      secondarySixStarLabel: 'Standard 6★',
    });

    expect(localized.map((item) => item.name)).toEqual(['UP 6★', 'Standard 6★', '5★', '4★']);
  });
});
