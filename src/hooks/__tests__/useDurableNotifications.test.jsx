import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useDurableNotifications } from '../useDurableNotifications.js';
import { STORAGE_KEYS } from '../../utils/storageUtils.js';

const STORAGE_KEY = `gacha_${STORAGE_KEYS.DURABLE_NOTIFICATIONS}`;

describe('useDurableNotifications', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists durable notifications and restores unread state', async () => {
    const { result, unmount } = renderHook(() => useDurableNotifications());

    act(() => {
      result.current.addNotification({
        type: 'warning',
        category: 'import',
        title: '导入部分成功',
        message: '云同步失败',
        dedupeKey: 'import:test',
        diagnostic: {
          phase: 'import',
          email: 'user@example.com',
          token: 'raw-token',
        },
      });
    });

    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.notifications[0].diagnosticText).not.toContain('user@example.com');
    expect(result.current.notifications[0].diagnosticText).not.toContain('raw-token');

    await waitFor(() => {
      const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      expect(persisted).toHaveLength(1);
      expect(persisted[0].title).toBe('导入部分成功');
      expect(persisted[0].diagnosticText).toContain('[redacted]');
    });

    unmount();

    const restored = renderHook(() => useDurableNotifications());
    expect(restored.result.current.notifications).toHaveLength(1);
    expect(restored.result.current.unreadCount).toBe(1);

    act(() => {
      restored.result.current.markAllRead();
    });

    await waitFor(() => expect(restored.result.current.unreadCount).toBe(0));

    act(() => {
      restored.result.current.clearRead();
    });

    await waitFor(() => expect(restored.result.current.notifications).toHaveLength(0));
  });

  it('dedupes notifications by dedupeKey', async () => {
    const { result } = renderHook(() => useDurableNotifications());

    act(() => {
      result.current.addNotification({
        type: 'info',
        category: 'account',
        title: '账号恢复申请已接收',
        message: '第一条',
        dedupeKey: 'account:recovery',
      });
    });
    act(() => {
      result.current.addNotification({
        type: 'success',
        category: 'account',
        title: '账号恢复申请已更新',
        message: '第二条',
        dedupeKey: 'account:recovery',
      });
    });

    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    expect(result.current.notifications[0].title).toBe('账号恢复申请已更新');
    expect(result.current.notifications[0].message).toBe('第二条');
  });
});
