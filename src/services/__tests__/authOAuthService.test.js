import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../../supabaseClient.js';
import {
  buildOAuthCallbackUrl,
  buildOAuthStartUrl,
  getEnabledOAuthProviders,
  normalizeOAuthReturnTo,
  startOAuthLogin,
} from '../authOAuthService.js';

vi.mock('../../supabaseClient.js', () => ({
  supabase: {
    auth: {
      signInWithOAuth: vi.fn(),
    },
  },
}));

describe('authOAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/settings?tab=account#login');
  });

  it('exposes enabled providers that are safe to show in the frontend', () => {
    expect(getEnabledOAuthProviders({
      VITE_AUTH_OAUTH_GITHUB_ENABLED: 'true',
      VITE_AUTH_OAUTH_LINUXDO_ENABLED: '1',
      VITE_AUTH_OAUTH_QQ_ENABLED: 'false',
    })).toEqual([
      { key: 'github', label: 'GitHub', strategy: 'supabase' },
    ]);
  });

  it('only exposes Linux.do after the custom provider is verified ready', () => {
    expect(getEnabledOAuthProviders({
      VITE_AUTH_OAUTH_GITHUB_ENABLED: 'true',
      VITE_AUTH_OAUTH_LINUXDO_ENABLED: '1',
      VITE_AUTH_OAUTH_LINUXDO_READY: 'true',
    })).toEqual([
      { key: 'github', label: 'GitHub', strategy: 'supabase' },
      { key: 'linuxdo', label: 'Linux.do', strategy: 'supabase' },
    ]);
  });

  it('keeps OAuth return paths same-origin and relative', () => {
    expect(normalizeOAuthReturnTo('/settings?tab=account', 'https://ef-gacha.mogujun.icu')).toBe('/settings?tab=account');
    expect(normalizeOAuthReturnTo('https://evil.example/path', 'https://ef-gacha.mogujun.icu')).toBe('/');
    expect(normalizeOAuthReturnTo('/auth/callback?code=leak', 'https://ef-gacha.mogujun.icu')).toBe('/');
  });

  it('builds the Supabase callback URL with a safe next path', () => {
    const callbackUrl = new URL(buildOAuthCallbackUrl({
      returnTo: '/settings?tab=account',
      origin: 'https://ef-gacha.mogujun.icu',
    }));

    expect(callbackUrl.origin).toBe('https://ef-gacha.mogujun.icu');
    expect(callbackUrl.pathname).toBe('/auth/callback');
    expect(callbackUrl.searchParams.get('next')).toBe('/settings?tab=account');
  });

  it('keeps QQ on the local bridge start URL', () => {
    const startUrl = new URL(buildOAuthStartUrl('qq', {
      returnTo: '/settings',
      intent: 'login',
      origin: 'https://ef-gacha.mogujun.icu',
    }));

    expect(startUrl.pathname).toBe('/api/auth/oauth/qq/start');
    expect(startUrl.searchParams.get('returnTo')).toBe('/settings');
    expect(startUrl.searchParams.get('intent')).toBe('login');
  });

  it('starts GitHub through Supabase Auth', async () => {
    supabase.auth.signInWithOAuth.mockResolvedValue({ data: { url: 'https://github.com/login/oauth/authorize' }, error: null });

    await startOAuthLogin('github', { returnTo: '/settings', origin: 'https://ef-gacha.mogujun.icu' });

    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'github',
      options: {
        redirectTo: 'https://ef-gacha.mogujun.icu/auth/callback?next=%2Fsettings',
      },
    });
  });

  it('starts Linux.do through the custom Supabase OAuth2 provider', async () => {
    supabase.auth.signInWithOAuth.mockResolvedValue({ data: { url: 'https://connect.linux.do/oauth2/authorize' }, error: null });

    await startOAuthLogin('linuxdo', {
      returnTo: '/settings',
      origin: 'https://ef-gacha.mogujun.icu',
      env: { VITE_AUTH_OAUTH_LINUXDO_READY: 'true' },
    });

    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'custom:linuxdo',
      options: {
        redirectTo: 'https://ef-gacha.mogujun.icu/auth/callback?next=%2Fsettings',
        scopes: 'read',
      },
    });
  });

  it('blocks Linux.do while the custom provider is not verified on Auth', async () => {
    await expect(startOAuthLogin('linuxdo', {
      returnTo: '/settings',
      origin: 'https://ef-gacha.mogujun.icu',
      env: {},
    })).rejects.toThrow('oauth_provider_not_ready');
  });
});
