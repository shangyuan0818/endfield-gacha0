import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../../supabaseClient.js';
import {
  groupAuthIdentities,
  isLoginIdentityProviderAvailable,
  linkLoginIdentity,
  loadAuthIdentities,
  normalizeAuthIdentityProvider,
  unlinkLoginIdentity,
} from '../authIdentityService.js';
import { getCurrentSiteSession } from '../siteSessionService.js';

vi.mock('../../supabaseClient.js', () => ({
  supabase: {
    auth: {
      linkIdentity: vi.fn(),
      unlinkIdentity: vi.fn(),
      getUserIdentities: vi.fn(),
    },
  },
}));

vi.mock('../siteSessionService.js', () => ({
  getCurrentSiteSession: vi.fn(),
}));

describe('authIdentityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentSiteSession.mockResolvedValue({
      authenticated: false,
      identities: [],
    });
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

  it('keeps site-managed OAuth providers visible but blocks old Supabase identity linking', async () => {
    expect(isLoginIdentityProviderAvailable('github', {})).toBe(true);
    expect(isLoginIdentityProviderAvailable('linuxdo', {})).toBe(true);

    await expect(linkLoginIdentity('github', {
      returnTo: '/settings',
      env: {},
    })).rejects.toThrow('unsupported_identity_provider');

    await expect(linkLoginIdentity('linuxdo', {
      returnTo: '/settings',
      env: {},
    })).rejects.toThrow('unsupported_identity_provider');

    expect(supabase.auth.linkIdentity).not.toHaveBeenCalled();
  });

  it('merges Supabase identities with site-managed OAuth identities', async () => {
    supabase.auth.getUserIdentities.mockResolvedValue({
      data: {
        identities: [{ id: 'email-1', provider: 'email', email: 'user@example.test' }],
      },
      error: null,
    });
    getCurrentSiteSession.mockResolvedValue({
      authenticated: true,
      identities: [
        {
          id: 'site-github-1',
          provider: 'github',
          source: 'site_session',
          identity_data: {
            username: 'octo-user',
            site_session: true,
          },
        },
      ],
    });

    const identities = await loadAuthIdentities();

    expect(identities).toHaveLength(2);
    expect(groupAuthIdentities(identities).get('github')?.[0]).toMatchObject({
      id: 'site-github-1',
      source: 'site_session',
    });
  });

  it('passes the selected identity to Supabase unlinkIdentity', async () => {
    const identity = { id: 'github-1', provider: 'github' };
    supabase.auth.unlinkIdentity.mockResolvedValue({ data: {}, error: null });

    await unlinkLoginIdentity(identity);

    expect(supabase.auth.unlinkIdentity).toHaveBeenCalledWith(identity);
  });
});
