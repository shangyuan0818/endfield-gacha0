import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseAccessToken } from '../../authFetchService.js';
import { fetchJsonWithTimeout } from '../../supabaseRequest.js';
import {
  createAnnouncement,
  deleteAnnouncement,
  loadAnnouncements,
  setAnnouncementActive,
  updateAnnouncement,
} from '../announcementService.js';

vi.mock('../../authFetchService.js', () => ({
  getSupabaseAccessToken: vi.fn(),
}));

vi.mock('../../supabaseRequest.js', () => ({
  fetchJsonWithTimeout: vi.fn(),
}));

describe('announcementService same-origin API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAccessToken.mockResolvedValue(null);
    fetchJsonWithTimeout.mockResolvedValue({
      response: {
        ok: true,
        status: 200,
      },
      data: {
        success: true,
        announcements: [
          {
            id: 'ann-1',
            title: '测试公告',
          },
        ],
      },
    });
  });

  it('loads announcements with same-origin cookies when no native token exists', async () => {
    await expect(loadAnnouncements()).resolves.toEqual([
      {
        id: 'ann-1',
        title: '测试公告',
      },
    ]);

    expect(getSupabaseAccessToken).toHaveBeenCalledWith({
      syncSiteSession: false,
      useSiteSessionCache: true,
      allowSiteSessionToken: false,
    });
    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/admin-announcements', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    }, expect.objectContaining({
      label: 'admin-announcements-load',
    }));
  });

  it('uses a native Supabase token when one is available', async () => {
    getSupabaseAccessToken.mockResolvedValue('native-token');

    await loadAnnouncements();

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/admin-announcements', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer native-token',
      },
    }, expect.any(Object));
  });

  it('creates, updates, toggles and deletes announcements through the admin route', async () => {
    fetchJsonWithTimeout
      .mockResolvedValueOnce({
        response: { ok: true, status: 200 },
        data: {
          success: true,
          announcement: {
            id: 'ann-created',
            title: '新公告',
          },
        },
      })
      .mockResolvedValueOnce({
        response: { ok: true, status: 200 },
        data: {
          success: true,
          updated_at: '2026-06-05T00:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        response: { ok: true, status: 200 },
        data: { success: true },
      })
      .mockResolvedValueOnce({
        response: { ok: true, status: 200 },
        data: { success: true },
      });

    await expect(createAnnouncement({
      title: '新公告',
      content: '正文',
      version: '4.5.2',
    })).resolves.toEqual({
      id: 'ann-created',
      title: '新公告',
    });
    await expect(updateAnnouncement('ann-created', {
      title: '更新公告',
      content: '更新正文',
      version: '4.5.2',
    })).resolves.toBe('2026-06-05T00:00:00.000Z');
    await expect(setAnnouncementActive('ann-created', false)).resolves.toBeUndefined();
    await expect(deleteAnnouncement('ann-created')).resolves.toBeUndefined();

    expect(fetchJsonWithTimeout).toHaveBeenNthCalledWith(1, '/api/admin-announcements', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        title: '新公告',
        content: '正文',
        version: '4.5.2',
      }),
    }), expect.objectContaining({
      label: 'admin-announcement-create',
    }));
    expect(fetchJsonWithTimeout).toHaveBeenNthCalledWith(2, '/api/admin-announcements', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({
        id: 'ann-created',
        title: '更新公告',
        content: '更新正文',
        version: '4.5.2',
      }),
    }), expect.objectContaining({
      label: 'admin-announcement-update',
    }));
    expect(fetchJsonWithTimeout).toHaveBeenNthCalledWith(3, '/api/admin-announcements', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({
        action: 'setActive',
        id: 'ann-created',
        isActive: false,
      }),
    }), expect.objectContaining({
      label: 'admin-announcement-toggle',
    }));
    expect(fetchJsonWithTimeout).toHaveBeenNthCalledWith(4, '/api/admin-announcements', expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify({
        id: 'ann-created',
      }),
    }), expect.objectContaining({
      label: 'admin-announcement-delete',
    }));
  });

  it('throws readable failures when the admin route rejects the request', async () => {
    fetchJsonWithTimeout.mockResolvedValue({
      response: {
        ok: false,
        status: 403,
      },
      data: {
        success: false,
        error: 'Super admin role required',
      },
    });

    await expect(loadAnnouncements()).rejects.toMatchObject({
      message: 'Super admin role required',
      status: 403,
    });
  });
});
