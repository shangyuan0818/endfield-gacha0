import { describe, expect, it } from 'vitest';

import { __internal as notificationBadgeInternals } from '../useNotificationBadges.js';

describe('useNotificationBadges announcement normalization', () => {
  it('removes the legacy local placeholder announcement before rendering site notices', () => {
    const records = notificationBadgeInternals.normalizeSiteAnnouncementRecords([
      {
        id: '1',
        title: '欢迎使用抽卡分析器',
        is_active: true,
        priority: 999,
        updated_at: '2026-06-05T00:00:00.000Z',
      },
      {
        id: 'real-low',
        title: '真实公告 B',
        is_active: true,
        priority: 1,
        updated_at: '2026-06-04T00:00:00.000Z',
      },
      {
        id: 'real-high',
        title: '真实公告 A',
        is_active: true,
        priority: 10,
        updated_at: '2026-06-03T00:00:00.000Z',
      },
      {
        id: 'inactive',
        title: '已停用公告',
        is_active: false,
        priority: 20,
        updated_at: '2026-06-06T00:00:00.000Z',
      },
    ]);

    expect(records.map(record => record.id)).toEqual(['real-high', 'real-low']);
  });
});
