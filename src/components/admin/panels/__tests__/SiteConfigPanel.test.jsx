import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SiteConfigPanel from '../SiteConfigPanel.jsx';
import { loadAdminSiteConfigItems } from '../../../../services/admin/siteConfigService.js';
import useSiteConfigStore from '../../../../stores/useSiteConfigStore.js';

vi.mock('../../../../services/admin/siteConfigService.js', () => ({
  loadAdminSiteConfigItems: vi.fn(),
}));

const updateConfigMock = vi.fn();

vi.mock('../../../../stores/useSiteConfigStore.js', () => {
  const store = vi.fn();
  store.getState = vi.fn(() => ({
    updateConfig: updateConfigMock,
    updateError: null,
  }));

  return {
    default: store,
    DEFAULT_HOME_NEXT_VERSION_TARGET_DATE: '2026-06-05T12:00:00+08:00',
    DEFAULT_HOME_VERSION_TIMELINE: [
      {
        id: 'pre-summer-2026',
        name: '寻遗散记',
        name_en: 'Lost Heirlooms',
        starts_at: '2026-06-05T12:00:00+08:00',
        ends_at: null,
        enabled: true,
        order: 10,
        pool_ids: [],
      },
    ],
    HOME_NEXT_VERSION_TARGET_CONFIG_KEY: 'home_next_version_target_at',
    HOME_VERSION_TIMELINE_CONFIG_KEY: 'home_version_timeline',
  };
});

describe('SiteConfigPanel version timeline editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateConfigMock.mockResolvedValue(true);
    useSiteConfigStore.getState.mockReturnValue({
      updateConfig: updateConfigMock,
      updateError: null,
    });
    loadAdminSiteConfigItems.mockResolvedValue([
      {
        key: 'home_version_timeline',
        label: '首页版本时间线',
        category: 'content',
        value: JSON.stringify({
          versions: [
            {
              id: 'lost-heirlooms',
              name: '寻遗散记',
              name_en: 'Lost Heirlooms',
              starts_at: '2026-06-05T12:00:00+08:00',
              ends_at: null,
              enabled: true,
              order: 10,
              pool_ids: ['special_001'],
            },
          ],
        }),
      },
    ]);
  });

  it('opens the structured version editor and saves serialized timeline config', async () => {
    const showToast = vi.fn();
    render(<SiteConfigPanel showToast={showToast} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '编辑首页版本时间线' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '编辑首页版本时间线' }));

    expect(screen.getByText('版本节点 1')).toBeInTheDocument();
    expect(screen.getByText('首页预览')).toBeInTheDocument();
    expect(screen.getByDisplayValue('寻遗散记')).toBeInTheDocument();
    expect(screen.getByDisplayValue('special_001')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('寻遗散记'), {
      target: { value: '寻遗散记更新' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(updateConfigMock).toHaveBeenCalledTimes(1);
    });

    const [key, value, meta] = updateConfigMock.mock.calls[0];
    expect(key).toBe('home_version_timeline');
    expect(meta).toMatchObject({
      label: '首页版本时间线',
      category: 'content',
    });
    expect(JSON.parse(value)).toMatchObject({
      versions: [
        {
          id: 'lost-heirlooms',
          name: '寻遗散记更新',
          name_en: 'Lost Heirlooms',
          starts_at: '2026-06-05T12:00:00+08:00',
          enabled: true,
          order: 10,
          pool_ids: ['special_001'],
        },
      ],
    });
    expect(showToast).toHaveBeenCalledWith('配置已更新', 'success');
  });
});
