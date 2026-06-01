import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../../supabaseClient.js';
import {
  groupAuthIdentities,
  isLoginIdentityProviderAvailable,
  linkLoginIdentity,
  normalizeAuthIdentityProvider,
  unlinkLoginIdentity,
} from '../authIdentityService.js';

vi.mock('../../supabaseClient.js', () => ({
  supabase: {
    auth: {
      linkIdentity: vi.fn(),
      unlinkIdentity: vi.fn(),
      getUserIdentities: vi.fn(),
    },
  },
}));

describe('authIdentityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes custom Linux.do identities from provider or issuer', () => {
    expect(normalizeAuthIdentityProvider({ provider: 'custom:linuxdo' })).toBe('linuxdo');
    expect(normalizeAuthIdentityProvider({
      provider: 'custom',
      identity_data: { iss: 'https://connect.linux.do/' },
    })).toBe('linuxdo');
    expect(normalizeAuthIdentityProvider({ provider: 'github' })).toBe('github');
  });

  it('groups identities by normalized provider', () => {
    const grouped = groupAuthIdentities([
      { id: 'email-1', provider: 'email' },
      { id: 'linuxdo-1', provider: 'custom:linuxdo' },
      { id: 'linuxdo-2', provider: 'custom', identity_data: { iss: 'https://connect.linux.do/' } },
    ]);

    expect(grouped.get('email')).toHaveLength(1);
    expect(grouped.get('linuxdo')).toHaveLength(2);
  });

  it('links GitHub through Supabase identity linking', async () => {
    supabase.auth.linkIdentity.mockResolvedValue({ data: { url: 'https://github.com/login/oauth/authorize' }, error: null });

    await linkLoginIdentity('github', { returnTo: '/settings' });

    expect(supabase.auth.linkIdentity).toHaveBeenCalledWith({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=%2Fsettings`,
      },
    });
  });

  it('links Linux.do with custom OAuth2 scope', async () => {
    supabase.auth.linkIdentity.mockResolvedValue({ data: { url: 'https://connect.linux.do/oauth2/authorize' }, error: null });

    await linkLoginIdentity('linuxdo', {
      returnTo: '/settings',
      env: { VITE_AUTH_OAUTH_LINUXDO_READY: 'true' },
    });

    expect(supabase.auth.linkIdentity).toHaveBeenCalledWith({
      provider: 'custom:linuxdo',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=%2Fsettings`,
        scopes: 'read',
      },
    });
  });

  it('keeps Linux.do unavailable until the Auth custom provider is verified ready', async () => {
    expect(isLoginIdentityProviderAvailable('linuxdo', {})).toBe(false);

    await expect(linkLoginIdentity('linuxdo', {
      returnTo: '/settings',
      env: {},
    })).rejects.toThrow('identity_provider_not_ready');
  });

  it('passes the selected identity to Supabase unlinkIdentity', async () => {
    const identity = { id: 'github-1', provider: 'github' };
    supabase.auth.unlinkIdentity.mockResolvedValue({ data: {}, error: null });

    await unlinkLoginIdentity(identity);

    expect(supabase.auth.unlinkIdentity).toHaveBeenCalledWith(identity);
  });
});
