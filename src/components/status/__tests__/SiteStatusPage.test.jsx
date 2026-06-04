import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/index.js';
import SiteStatusPage from '../SiteStatusPage.jsx';
import { loadPublicSiteStatus } from '../../../services/siteStatusService.js';

vi.mock('../../../services/siteStatusService.js', () => ({
  loadPublicSiteStatus: vi.fn(),
}));

function renderStatusPage() {
  return render(
    <I18nProvider initialLocale="zh-CN">
      <BrowserRouter>
        <SiteStatusPage />
      </BrowserRouter>
    </I18nProvider>
  );
}

describe('SiteStatusPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadPublicSiteStatus.mockResolvedValue({
      generatedAt: '2026-06-04T02:00:00.000Z',
      overall: {
        level: 'notice',
        label: '部分检查不可确认',
        affectedCount: 1,
      },
      services: [
        {
          id: 'site',
          label: '主站',
          status: 'ok',
          summary: '状态页和静态资源可访问。',
          checkedAt: '2026-06-04T02:00:00.000Z',
        },
        {
          id: 'import',
          label: '数据导入',
          status: 'unknown',
          summary: '导入后端暂未开放公开检查。',
          detail: '导入失败时，请优先查看页面内错误摘要或提交工单。',
          checkedAt: '2026-06-04T02:00:00.000Z',
        },
      ],
      incidents: [],
      meta: {
        cacheVersion: 'cache-v1',
      },
    });
  });

  it('renders public status summary and service rows', async () => {
    renderStatusPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '服务状态' })).toBeInTheDocument();
    });

    expect(screen.getByText('部分检查不可确认')).toBeInTheDocument();
    expect(screen.getByText('主站')).toBeInTheDocument();
    expect(screen.getByText('状态页和静态资源可访问。')).toBeInTheDocument();
    expect(screen.getByText('数据导入')).toBeInTheDocument();
    expect(screen.getByText('导入后端暂未开放公开检查。')).toBeInTheDocument();
    expect(screen.getByText('cache-v1')).toBeInTheDocument();
    expect(screen.getByText('本页面只展示公开服务摘要，不展示内部接口、用户数量、邮箱、Token 或数据库细节。')).toBeInTheDocument();
  });

  it('renders a readable error state when the status endpoint fails', async () => {
    loadPublicSiteStatus.mockRejectedValue(new Error('状态读取失败'));

    renderStatusPage();

    await waitFor(() => {
      expect(screen.getByText('状态页读取失败')).toBeInTheDocument();
    });
    expect(screen.getByText('状态读取失败')).toBeInTheDocument();
  });
});
