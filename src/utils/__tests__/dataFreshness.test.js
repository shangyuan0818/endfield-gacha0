import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  formatFreshnessAbsolute,
  formatFreshnessRelative,
  getFreshnessTone,
  getLatestHistoryTimestampMs,
} from '../dataFreshness.js';

describe('dataFreshness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns latest timestamp across records', () => {
    const latest = getLatestHistoryTimestampMs([
      { timestamp: '2026-04-13T10:00:00.000Z' },
      { timestamp: '2026-04-15T11:55:00.000Z' },
      { timestamp: '2026-04-14T09:00:00.000Z' },
    ]);

    expect(latest).toBe(new Date('2026-04-15T11:55:00.000Z').getTime());
  });

  it('formats relative freshness using localized stale copy', () => {
    expect(formatFreshnessRelative('2026-04-15T11:59:30.000Z', null, 'zh-CN')).toBe('刚刚更新');
    expect(formatFreshnessRelative('2026-04-15T11:30:00.000Z', null, 'zh-CN')).toBe('30 分钟未更新');
    expect(formatFreshnessRelative('2026-04-14T12:00:00.000Z', null, 'zh-CN')).toBe('1 天未更新');
  });

  it('maps timestamps to freshness tones', () => {
    expect(getFreshnessTone('2026-04-15T11:00:00.000Z')).toBe('fresh');
    expect(getFreshnessTone('2026-04-10T12:00:00.000Z')).toBe('notice');
    expect(getFreshnessTone('2026-03-10T12:00:00.000Z')).toBe('stale');
    expect(getFreshnessTone(null)).toBe('unknown');
  });

  it('falls back on absolute formatting when timestamp is invalid', () => {
    expect(formatFreshnessAbsolute(null, 'fallback')).toBe('fallback');
    expect(formatFreshnessAbsolute('2026-04-15T11:00:00.000Z')).toContain('2026');
  });
});
