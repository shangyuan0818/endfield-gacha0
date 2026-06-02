import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_SESSION_SYNC_EVENT } from '../../../services/authSessionEvents.js';
import { getCurrentSiteSession } from '../../../services/siteSessionService.js';
import { buildOAuthNotice, useOAuthCallbackNotice } from '../useOAuthCallbackNotice.js';

vi.mock('../../../i18n/index.js', () => ({
  useI18n: () => ({
    isEnglish: false,
  }),
}));

vi.mock('../../../services/siteSessionService.js', () => ({
  getCurrentSiteSession: vi.fn(),
}));

describe('useOAuthCallbackNotice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentSiteSession.mockResolvedValue({
      authenticated: true,
      user: {
        id: 'user-1',
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('syncs the site session and emits a shared event after OAuth sign-in', async () => {
    const navigate = vi.fn();
    const addDurableNotification = vi.fn();
    const onSessionSynced = vi.fn();
    const eventListener = vi.fn();
    window.addEventListener(AUTH_SESSION_SYNC_EVENT, eventListener);

    renderHook(() => useOAuthCallbackNotice({
      location: {
        pathname: '/settings',
        search: '?oauth_status=signed_in&oauth_provider=github&oauth_code=oauth_signed_in',
        hash: '',
      },
      navigate,
      addDurableNotification,
      onSessionSynced,
    }));

    expect(addDurableNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: 'success',
      title: 'GitHub 登录成功',
    }));
    expect(navigate).toHaveBeenCalledWith('/settings', { replace: true });
    await waitFor(() => {
      expect(getCurrentSiteSession).toHaveBeenCalledWith({ syncSupabase: true });
      expect(onSessionSynced).toHaveBeenCalledWith(expect.objectContaining({
        authenticated: true,
      }), expect.objectContaining({
        status: 'signed_in',
        provider: 'github',
      }));
      expect(eventListener).toHaveBeenCalled();
    });

    window.removeEventListener(AUTH_SESSION_SYNC_EVENT, eventListener);
  });

  it('does not treat the legacy verified callback status as a usable login session', async () => {
    const navigate = vi.fn();
    const addDurableNotification = vi.fn();

    renderHook(() => useOAuthCallbackNotice({
      location: {
        pathname: '/settings',
        search: '?oauth_status=verified&oauth_provider=github&oauth_code=oauth_profile_verified',
        hash: '',
      },
      navigate,
      addDurableNotification,
    }));

    expect(addDurableNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: 'info',
      title: 'GitHub 授权已完成',
    }));
    expect(navigate).toHaveBeenCalledWith('/settings', { replace: true });
    expect(getCurrentSiteSession).not.toHaveBeenCalled();
  });
});

describe('buildOAuthNotice', () => {
  it('explains provider callback URL mismatch in Chinese', () => {
    const notice = buildOAuthNotice({
      status: 'error',
      provider: 'github',
      code: 'redirect_uri_mismatch',
    }, false);

    expect(notice).toMatchObject({
      type: 'error',
      category: 'account',
      title: 'GitHub 回调地址不匹配',
    });
    expect(notice.message).toContain('核对平台后台的 OAuth 回调地址');
    expect(notice.message).toContain('邮箱登录');
    expect(notice.diagnostic).toMatchObject({
      provider: 'github',
      code: 'redirect_uri_mismatch',
      expectedCallback: 'https://ef-gacha.mogujun.icu/api/auth/oauth/{provider}/callback',
    });
  });

  it('explains invalid provider credentials in English', () => {
    const notice = buildOAuthNotice({
      status: 'error',
      provider: 'linuxdo',
      code: 'invalid_client',
    }, true);

    expect(notice).toMatchObject({
      type: 'error',
      category: 'account',
      title: 'Linux.do service configuration failed',
    });
    expect(notice.message).toContain('provider credentials');
    expect(notice.message).toContain('email sign-in');
    expect(notice.diagnostic).toEqual({
      provider: 'linuxdo',
      code: 'invalid_client',
    });
  });

  it('explains expired OAuth state with a restart action hint', () => {
    const notice = buildOAuthNotice({
      status: 'error',
      provider: 'github',
      code: 'oauth_state_expired',
    }, false);

    expect(notice.title).toBe('GitHub 授权状态已失效');
    expect(notice.message).toContain('重新发起登录');
    expect(notice.diagnostic).toEqual({
      provider: 'github',
      code: 'oauth_state_expired',
    });
  });

  it('keeps already-linked provider failures actionable', () => {
    const notice = buildOAuthNotice({
      status: 'error',
      provider: 'github',
      code: 'oauth_identity_already_linked',
    }, false);

    expect(notice.title).toBe('GitHub 已绑定到其他账号');
    expect(notice.message).toContain('另一个站内账号');
    expect(notice.actions).toEqual([
      { label: '打开设置', href: '/settings', variant: 'primary' },
    ]);
  });

  it('uses the same concrete copy for disabled providers', () => {
    const notice = buildOAuthNotice({
      status: 'disabled',
      provider: 'linuxdo',
      code: 'oauth_provider_disabled',
    }, false);

    expect(notice.type).toBe('warning');
    expect(notice.title).toBe('Linux.do 服务配置异常');
    expect(notice.message).toContain('服务端凭据或开关配置不正确');
    expect(notice.diagnostic).toEqual({
      provider: 'linuxdo',
      code: 'oauth_provider_disabled',
    });
  });

  it('explains site-session creation failures explicitly', () => {
    const notice = buildOAuthNotice({
      status: 'error',
      provider: 'github',
      code: 'oauth_session_unavailable',
    }, false);

    expect(notice.title).toBe('GitHub 登录状态创建失败');
    expect(notice.message).toContain('站内会话服务配置');
  });
});
