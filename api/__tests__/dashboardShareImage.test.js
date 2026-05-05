// @vitest-environment node

import { describe, expect, it } from 'vitest';

describe('dashboard share image renderer', () => {
  it('is importable in a plain Node runtime without a JSX loader', async () => {
    const mod = await import('../_lib/dashboardShareImage.js');

    expect(mod.renderDashboardShareCardImage).toEqual(expect.any(Function));
    expect(mod.buildDashboardShareCardHtml).toEqual(expect.any(Function));
  });

  it('builds share-card HTML from API detail payloads without React components', async () => {
    const { buildDashboardShareCardHtml } = await import('../_lib/dashboardShareImage.js');
    const html = buildDashboardShareCardHtml({
      payload: {
        scopeLabel: '卡池详情',
        poolName: '春雷动，万物生',
        poolType: 'limited',
        poolTypeLabel: '限定池',
        periodLabel: '2026/04/20 - 2026/05/05',
        totalSections: 1,
        totalNodes: 1,
        summaryItems: [
          { id: 'total-pulls', label: '总抽数', value: '33', hint: 'PULLS' },
        ],
        averageItems: [
          { id: 'avg-6-target', label: 'UP 6★', value: '33.00 抽' },
        ],
        notes: '已脱敏分享卡',
      },
      sections: [
        {
          id: 'pool-1',
          type: 'limited',
          title: '春雷动，万物生',
          period: '2026/04/20 - 2026/05/05',
          totalPulls: 33,
          currentPity: 12,
          scaleMax: 80,
          entries: [
            {
              id: 'entry-1',
              stageLabel: '第 1 阶段',
              dateLabel: '04/20 12:00',
              resultSummary: '33 抽获得 6★',
              pulls: 33,
              stageKind: 'up',
              dropBadges: [{ label: '庄方宜', rarity: 6, count: 1 }],
            },
          ],
        },
      ],
    });

    expect(html).toContain('share-card-capture-root');
    expect(html).toContain('春雷动，万物生');
    expect(html).toContain('庄方宜');
    expect(html).not.toContain('DashboardShareCard');
  });
});
