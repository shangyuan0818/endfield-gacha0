import { describe, expect, it } from 'vitest';

import {
  filterJobIdsBySchedule,
  getScheduleWeekday,
  normalizeOpsAutomationScheduleConfig,
} from '../_lib/opsAutomationScheduleConfig.js';

describe('opsAutomationScheduleConfig', () => {
  it('falls back to enabled-everyday defaults on invalid input', () => {
    for (const raw of [null, undefined, 'not-json', 42, '{"jobs":"broken"}']) {
      const config = normalizeOpsAutomationScheduleConfig(raw);
      expect(config.graceMinutes).toBe(90);
      expect(config.jobs['official-announcements']).toEqual({
        enabled: true,
        weekdays: [0, 1, 2, 3, 4, 5, 6],
      });
      expect(config.jobs['pool-schedule'].enabled).toBe(true);
      expect(config.jobs['wiki-catalog'].enabled).toBe(true);
    }
  });

  it('normalizes job overrides, weekday lists, and grace minutes', () => {
    const config = normalizeOpsAutomationScheduleConfig(JSON.stringify({
      jobs: {
        'official-announcements': { enabled: false },
        'pool-schedule': { weekdays: [1, 1, 3, 9, -1, '5'] },
      },
      graceMinutes: 120.7,
      note: 'x'.repeat(300),
    }));

    expect(config.jobs['official-announcements'].enabled).toBe(false);
    expect(config.jobs['pool-schedule'].weekdays).toEqual([1, 3, 5]);
    expect(config.jobs['wiki-catalog'].weekdays).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(config.graceMinutes).toBe(121);
    expect(config.note).toHaveLength(200);
  });

  it('computes the schedule weekday in UTC+8', () => {
    // 2026-06-10T18:00:00Z = 2026-06-11 02:00 北京时间，星期四 (4)
    expect(getScheduleWeekday(new Date('2026-06-10T18:00:00Z'))).toBe(4);
    // 2026-06-10T12:00:00Z = 2026-06-10 20:00 北京时间，星期三 (3)
    expect(getScheduleWeekday(new Date('2026-06-10T12:00:00Z'))).toBe(3);
  });

  it('filters disabled jobs and weekdays outside the schedule', () => {
    const config = normalizeOpsAutomationScheduleConfig({
      jobs: {
        'official-announcements': { enabled: false },
        'pool-schedule': { weekdays: [1] },
        'wiki-catalog': { weekdays: [3] },
      },
    });
    // 北京时间星期三 (3)
    const now = new Date('2026-06-10T04:00:00Z');
    const gate = filterJobIdsBySchedule(
      ['official-announcements', 'pool-schedule', 'wiki-catalog'],
      config,
      now
    );

    expect(gate.weekday).toBe(3);
    expect(gate.allowed).toEqual(['wiki-catalog']);
    expect(gate.skipped).toEqual([
      { jobId: 'official-announcements', reason: 'disabled_by_schedule_config' },
      { jobId: 'pool-schedule', reason: 'weekday_not_scheduled' },
    ]);
  });

  it('allows everything with the default config', () => {
    const gate = filterJobIdsBySchedule(
      ['official-announcements', 'pool-schedule', 'wiki-catalog'],
      normalizeOpsAutomationScheduleConfig(null),
      new Date('2026-06-10T04:00:00Z')
    );
    expect(gate.allowed).toHaveLength(3);
    expect(gate.skipped).toHaveLength(0);
  });
});
