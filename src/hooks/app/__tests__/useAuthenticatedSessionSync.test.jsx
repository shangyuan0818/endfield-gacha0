// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthenticatedSessionSync } from '../useAuthenticatedSessionSync.js';
import { useAuthStore, useHistoryStore, usePoolStore } from '../../../stores';

vi.mock('../../../utils/appLogger.js', () => ({
  default: {
    warn: vi.fn(),
  },
}));

describe('useAuthenticatedSessionSync', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({
      user: null,
      userRole: null,
      authResolved: false,
      syncing: false,
      syncError: null,
      lastSyncAt: null,
    });
    usePoolStore.setState({
      pools: [],
      currentPoolId: 'limited_pool',
      currentGameUid: 'game-1',
    });
    useHistoryStore.setState({
      history: [],
    });
  });

  it('applies a site session user and private cloud data to the shared stores', async () => {
    const cloudData = {
      pools: [
        { id: 'limited_pool', name: '特许寻访', type: 'limited_character' },
      ],
      history: [
        {
          id: 'record-1',
          user_id: 'user-1',
          poolId: 'limited_pool',
          gameUid: 'game-1',
          rarity: 6,
        },
      ],
    };
    const loadCloudData = vi.fn().mockResolvedValue(cloudData);
    const { result } = renderHook(() => useAuthenticatedSessionSync({ loadCloudData }));

    let appliedCloudData;
    await act(async () => {
      appliedCloudData = await result.current.applySiteSession({
        authenticated: true,
        user: {
          id: 'user-1',
          email: 'user@example.com',
        },
        supabase: {
          accessToken: 'site-session-token',
        },
      }, {
        source: 'oauth_callback',
      });
    });

    expect(appliedCloudData).toBe(cloudData);
    expect(loadCloudData).toHaveBeenCalledWith(expect.objectContaining({
      id: 'user-1',
    }));
    expect(useAuthStore.getState().user).toMatchObject({
      id: 'user-1',
      email: 'user@example.com',
    });
    expect(useAuthStore.getState().authResolved).toBe(true);
    expect(usePoolStore.getState().pools).toEqual(cloudData.pools);
    expect(usePoolStore.getState().currentPoolId).toBe('limited_pool');
    expect(useHistoryStore.getState().history).toEqual(cloudData.history);
  });

  it('does not load private data when the site session has no compatible Supabase token', async () => {
    const loadCloudData = vi.fn();
    const { result } = renderHook(() => useAuthenticatedSessionSync({ loadCloudData }));

    await act(async () => {
      await result.current.applySiteSession({
        authenticated: true,
        user: {
          id: 'user-1',
        },
        supabaseSessionSynced: false,
        supabase: null,
      });
    });

    expect(useAuthStore.getState().user).toMatchObject({
      id: 'user-1',
    });
    expect(loadCloudData).not.toHaveBeenCalled();
    expect(useHistoryStore.getState().history).toEqual([]);
  });
});
