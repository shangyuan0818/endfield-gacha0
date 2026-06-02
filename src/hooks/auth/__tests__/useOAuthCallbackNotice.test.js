import { describe, expect, it } from 'vitest';

import { buildOAuthNotice } from '../useOAuthCallbackNotice.js';

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
});
