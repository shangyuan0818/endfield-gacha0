import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import NotificationCenter from '../NotificationCenter.jsx';

const noop = vi.fn();

function renderNotificationCenter(notifications) {
  return render(
    <NotificationCenter
      notifications={notifications}
      unreadCount={notifications.filter((item) => !item.readAt).length}
      onMarkRead={noop}
      onMarkAllRead={noop}
      onDismiss={noop}
      onClearRead={noop}
    />
  );
}

describe('NotificationCenter', () => {
  it('auto-opens account error notifications', async () => {
    renderNotificationCenter([
      {
        id: 'oauth-error',
        type: 'error',
        category: 'account',
        priority: 'normal',
        title: 'GitHub 回调地址不匹配',
        message: '请管理员核对回调地址。',
        createdAt: '2026-06-02T10:00:00.000Z',
        updatedAt: '2026-06-02T10:00:00.000Z',
        readAt: null,
        actions: [],
      },
    ]);

    await waitFor(() => {
      expect(screen.getByText('GitHub 回调地址不匹配')).toBeInTheDocument();
    });
  });

  it('does not immediately reopen the same notification after manual close', async () => {
    renderNotificationCenter([
      {
        id: 'oauth-error',
        type: 'warning',
        category: 'account',
        priority: 'normal',
        title: 'Linux.do 服务配置异常',
        message: '请先使用邮箱登录。',
        createdAt: '2026-06-02T10:00:00.000Z',
        updatedAt: '2026-06-02T10:00:00.000Z',
        readAt: null,
        actions: [],
      },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Linux.do 服务配置异常')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('关闭通知中心'));

    await waitFor(() => {
      expect(screen.queryByText('Linux.do 服务配置异常')).not.toBeInTheDocument();
    });
  });
});
