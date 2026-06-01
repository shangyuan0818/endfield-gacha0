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
      { key: 'github', label: 'GitHub', strategy: 'bridge' },
      { key: 'linuxdo', label: 'Linux.do', strategy: 'bridge' },
    ]);
  });

  it('exposes Linux.do through the site OAuth bridge without Supabase custom provider readiness', () => {
    expect(getEnabledOAuthProviders({
      VITE_AUTH_OAUTH_GITHUB_ENABLED: 'true',
      VITE_AUTH_OAUTH_LINUXDO_ENABLED: '1',
    })).toEqual([
      { key: 'github', label: 'GitHub', strategy: 'bridge' },
      { key: 'linuxdo', label: 'Linux.do', strategy: 'bridge' },
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

  it('starts GitHub through the local OAuth bridge', async () => {
    const assign = vi.fn();

    await startOAuthLogin('github', { returnTo: '/settings', origin: 'https://ef-gacha.mogujun.icu', assign });

    expect(supabase.auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith('https://ef-gacha.mogujun.icu/api/auth/oauth/github/start?returnTo=%2Fsettings&intent=login');
  });

  it('starts Linux.do through the local OAuth bridge', async () => {
    const assign = vi.fn();

    await startOAuthLogin('linuxdo', { returnTo: '/settings', origin: 'https://ef-gacha.mogujun.icu', assign });

    expect(supabase.auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith('https://ef-gacha.mogujun.icu/api/auth/oauth/linuxdo/start?returnTo=%2Fsettings&intent=login');
  });

  it('keeps unsupported providers blocked', async () => {
    await expect(startOAuthLogin('unknown', {
      returnTo: '/settings',
      origin: 'https://ef-gacha.mogujun.icu',
    })).rejects.toThrow('unsupported_oauth_provider');
  });
});
