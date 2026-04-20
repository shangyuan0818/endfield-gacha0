import { describe, expect, it } from 'vitest';

import { buildDashboardSharePayload } from '../dashboardShare.js';
import { buildSimulatorSharePayload } from '../simulatorShare.js';

describe('share featured source unification', () => {
  it('prefers resolved roster for dashboard share featured label', () => {
    const payload = buildDashboardSharePayload({
      currentPool: {
        type: 'extra',
        name: '辉光庆典',
        up_character: '旧名单A',
        featured_characters: ['旧名单A', '旧名单B'],
        resolved_roster: {
          up: ['莱万汀', '洁尔佩塔', '艾尔黛拉', '骏卫'],
        },
      },
      normalizedPoolType: 'extra',
      stats: {},
      sections: [],
    }, 'zh-CN');

    expect(payload.featured).toBe('莱万汀 等4名');
  });

  it('prefers resolved roster for simulator share featured label', () => {
    const payload = buildSimulatorSharePayload({
      currentPoolObj: {
        type: 'extra',
        name: '辉光庆典',
        up_character: '旧名单A',
        featured_characters: ['旧名单A', '旧名单B'],
        resolved_roster: {
          up: ['莱万汀', '洁尔佩塔', '艾尔黛拉', '骏卫'],
        },
      },
      dashboardStats: {
        total: 0,
        sixStarCount: 0,
        counts: { 5: 0 },
        upSixStarCount: 0,
        avgPullCost: {},
        currentPity: 0,
        currentPity5: 0,
      },
      pityInfoWithGuarantee: {},
      resourceLedger: null,
    }, 'zh-CN');

    expect(payload.upCharacter).toBe('莱万汀 等4名');
  });
});
