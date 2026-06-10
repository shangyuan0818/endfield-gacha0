import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SiteHealthPanel from '../SiteHealthPanel.jsx';
import { loadSiteHealth } from '../../../../services/admin/siteHealthService.js';

vi.mock('../../../../services/admin/siteHealthService.js', () => ({
  loadSiteHealth: vi.fn(),
}));

const SAMPLE_HEALTH = {
  generatedAt: '2026-06-10T12:00:00+08:00',
  overall: { level: 'notice', label: '有待处理事项', attentionCount: 3 },
  warnings: ['公共统计缓存超过 24 小时未刷新'],
  workbench: {
    countsBySeverity: { danger: 1, warning: 1, notice: 0 },
    actions: [
      {
        id: 'urgent-tickets',
        severity: 'danger',
        title: '紧急工单需要处理',
        description: '有 1 个紧急工单等待回复。',
        count: 1,
        target: 'tickets',
        updatedAt: '2026-06-10T11:00:00+08:00',
      },
    ],
  },
  queues: {
    tickets: { open: 2, urgentOpen: 1 },
    accountRecovery: { pending: 0 },
    developerApi: { pending: 1 },
  },
  dataReadiness: {
    officialId: {
      total: 2,
      characterCount: 1,
      weaponCount: 0,
      poolCount: 1,
      sampledCharacters: 40,
      sampledPools: 12,
      samples: {
        characters: [{ id: 'char_manual_x', name: '占位角色', type: 'character' }],
        pools: [{ id: 'pool_manual_y', name: '占位卡池', type: 'limited' }],
      },
    },
  },
  content: {
    latestAt: '2026-06-10T10:00:00+08:00',
    items: [
      {
        key: 'announcements',
        label: '公告',
        ok: true,
        latestAt: '2026-06-10T10:00:00+08:00',
        latest: { title: '最新公告标题' },
      },
      {
        key: 'pools',
        label: '卡池',
        ok: true,
        latestAt: '2026-06-01T10:00:00+08:00',
        latest: { name: '弭弗' },
      },
    ],
  },
  publicCache: {
    epoch: {
      cacheVersion: '1781083682039',
      scope: 'all',
      reason: 'admin_bump',
      updatedAt: '2026-06-10T09:00:00+08:00',
    },
    analytics: {
      level: 'ok',
      latestAt: '2026-06-10T09:30:00+08:00',
      sampledRows: 28,
      analytics: { sampledRows: 22, totalPullsSample: 17940 },
      trends: { sampledRows: 6 },
      sourceVersions: ['v1781083682039'],
      warnings: [],
    },
    aggregates: [
      {
        key: 'pool-analytics',
        label: '卡池分析缓存',
        ok: true,
        latestAt: '2026-06-10T09:30:00+08:00',
        latest: { poolId: 'special_1_2_1' },
        sampledRows: 22,
        sourceVersions: ['v1781083682039'],
      },
    ],
  },
  ops: {
    countsByStatus: { success: 12, failure: 1, skipped: 2 },
    health: {
      maxConsecutiveFailures: 2,
      worstJobId: 'wiki-catalog',
      worstJobLabel: '图鉴目录同步',
      p95DurationMs: 42000,
      sampledDurations: 15,
      latestSuccessAt: '2026-06-10T08:00:00+08:00',
      latestFailureAt: '2026-06-10T07:00:00+08:00',
      jobs: [
        {
          jobId: 'official-announcements',
          jobLabel: '官方公告',
          sampled: 8,
          latestStatus: 'success',
          consecutiveFailureCount: 0,
          latestFailureType: '',
          latestSuccessAt: '2026-06-10T08:00:00+08:00',
          latestFailureAt: null,
          latestDurationMs: 5200,
          p95DurationMs: 9000,
        },
        {
          jobId: 'wiki-catalog',
          jobLabel: '图鉴目录同步',
          sampled: 6,
          latestStatus: 'failure',
          consecutiveFailureCount: 2,
          latestFailureType: 'upstream_timeout',
          latestSuccessAt: '2026-06-08T08:00:00+08:00',
          latestFailureAt: '2026-06-10T07:00:00+08:00',
          latestDurationMs: 61000,
          p95DurationMs: 64000,
        },
      ],
    },
    cron: {
      missedCount: 0,
      nextExpectedAt: '2026-06-11T03:00:00+08:00',
      schedules: [
        {
          id: 'daily-refresh',
          label: '每日自动刷新',
          status: 'ok',
          scheduleText: '每日 03:00 (UTC+8)',
          graceMinutes: 30,
          lastExpectedAt: '2026-06-10T03:00:00+08:00',
          latestCronAt: '2026-06-10T03:01:00+08:00',
        },
      ],
    },
    latestRuns: [
      {
        id: 'run-1',
        jobId: 'official-announcements',
        jobLabel: '官方公告',
        status: 'success',
        presentationStatus: 'success',
        triggerType: 'cron',
        durationMs: 5200,
        updatedAt: '2026-06-10T08:00:00+08:00',
      },
    ],
  },
  mail: {
    config: {
      workerEnabled: true,
      killSwitch: false,
      dryRun: false,
      stalwartSmtpConfigured: true,
      deliveryFeedbackSecretConfigured: true,
    },
    outbox: {
      sampled: 20,
      dueQueued: 0,
      countsByStatus: { queued: 1, sent: 18, failed: 1 },
    },
    suppression: { active: 0, domains: [] },
    deliveryEvents: { sampled: 9, latestAt: '2026-06-10T06:00:00+08:00' },
  },
};

describe('SiteHealthPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadSiteHealth.mockResolvedValue(SAMPLE_HEALTH);
  });

  it('renders overall status, workbench actions, and key stat cards', async () => {
    render(<SiteHealthPanel showToast={vi.fn()} onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('有待处理事项')).toBeInTheDocument();
    });

    expect(screen.getByText('紧急工单需要处理')).toBeInTheDocument();
    expect(screen.getByText('待处理工单')).toBeInTheDocument();
    expect(screen.getByText('官方 ID 待处理')).toBeInTheDocument();
    expect(screen.getByText('公共统计缓存超过 24 小时未刷新')).toBeInTheDocument();
  });

  it('renders per-job health details with p95 and consecutive failures', async () => {
    render(<SiteHealthPanel showToast={vi.fn()} onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('任务健康明细')).toBeInTheDocument();
    });

    expect(screen.getAllByText('官方公告').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('图鉴目录同步').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('连续失败 2')).toBeInTheDocument();
    expect(screen.getByText('upstream_timeout')).toBeInTheDocument();
    expect(screen.getByText('p95 9.0s')).toBeInTheDocument();
    expect(screen.getByText('p95 64s')).toBeInTheDocument();
  });

  it('renders data source freshness rows and public cache version', async () => {
    render(<SiteHealthPanel showToast={vi.fn()} onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('数据源新鲜度')).toBeInTheDocument();
    });

    expect(screen.getByText('公告')).toBeInTheDocument();
    expect(screen.getByText('最新公告标题')).toBeInTheDocument();
    expect(screen.getByText('1781083682039')).toBeInTheDocument();
    expect(screen.getByText('每日自动刷新')).toBeInTheDocument();
    expect(screen.getByText('已按预期执行')).toBeInTheDocument();
  });

  it('shows the error state when loading fails', async () => {
    loadSiteHealth.mockRejectedValue(new Error('站点健康状态读取失败'));
    const showToast = vi.fn();
    render(<SiteHealthPanel showToast={showToast} onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('站点健康状态读取失败', 'error');
    });
    expect(screen.getByText('站点健康状态读取失败')).toBeInTheDocument();
  });
});
