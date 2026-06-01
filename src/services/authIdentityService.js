import { supabase } from '../supabaseClient.js';
import { buildOAuthCallbackUrl } from './authOAuthService.js';

export const LOGIN_IDENTITY_PROVIDERS = Object.freeze({
  email: {
    key: 'email',
    label: 'Email',
    canLink: false,
    canUnlink: false,
  },
  github: {
    key: 'github',
    label: 'GitHub',
    canLink: true,
    canUnlink: true,
    supabaseProvider: 'github',
  },
  linuxdo: {
    key: 'linuxdo',
    label: 'Linux.do',
    canLink: true,
    canUnlink: true,
    readyEnv: 'VITE_AUTH_OAUTH_LINUXDO_READY',
    supabaseProvider: 'custom:linuxdo',
    scopes: 'read',
  },
  qq: {
    key: 'qq',
    label: 'QQ',
    canLink: false,
    canUnlink: false,
    planned: true,
  },
});

function normalizeProviderValue(value) {
  return String(value || '').trim().toLowerCase();
}

function isEnvEnabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

export function isLoginIdentityProviderAvailable(providerKey, env = import.meta.env) {
  const meta = LOGIN_IDENTITY_PROVIDERS[providerKey];
  if (!meta) {
    return false;
  }
  if (!meta.readyEnv) {
    return true;
  }
  return isEnvEnabled(env?.[meta.readyEnv]);
}

export function normalizeAuthIdentityProvider(identity) {
  const rawProvider = normalizeProviderValue(identity?.provider || identity?.provider_id);
  const issuer = normalizeProviderValue(identity?.identity_data?.iss || identity?.identity_data?.issuer);

  if (rawProvider === 'github') {
    return 'github';
  }

  if (rawProvider === 'email') {
    return 'email';
  }

  if (
    rawProvider === 'custom:linuxdo'
    || rawProvider === 'linuxdo'
    || rawProvider === 'custom'
    || issuer.includes('connect.linux.do')
  ) {
    return 'linuxdo';
  }

  if (rawProvider === 'qq') {
    return 'qq';
  }

  return rawProvider || 'unknown';
}

export function getIdentityDisplayValue(identity) {
  const data = identity?.identity_data || {};
  return (
    data.preferred_username
    || data.user_name
    || data.username
    || data.name
    || data.full_name
    || data.email
    || identity?.email
    || identity?.id
    || ''
  );
}

export function groupAuthIdentities(identities = []) {
  const grouped = new Map();
  for (const identity of Array.isArray(identities) ? identities : []) {
    const providerKey = normalizeAuthIdentityProvider(identity);
    if (!grouped.has(providerKey)) {
      grouped.set(providerKey, []);
    }
    grouped.get(providerKey).push(identity);
  }
  return grouped;
}

export async function loadAuthIdentities() {
  if (!supabase) {
    throw new Error('supabase_not_configured');
  }

  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) {
    throw error;
  }

  return Array.isArray(data?.identities) ? data.identities : [];
}

export async function linkLoginIdentity(providerKey, {
  returnTo = '/settings',
  env = import.meta.env,
} = {}) {
  if (!supabase) {
    throw new Error('supabase_not_configured');
  }

  const meta = LOGIN_IDENTITY_PROVIDERS[providerKey];
  if (!meta?.canLink || !meta.supabaseProvider) {
    throw new Error('unsupported_identity_provider');
  }

  if (!isLoginIdentityProviderAvailable(providerKey, env)) {
    throw new Error('identity_provider_not_ready');
  }

  const options = {
    redirectTo: buildOAuthCallbackUrl({ returnTo }),
  };
  if (meta.scopes) {
    options.scopes = meta.scopes;
  }

  const { data, error } = await supabase.auth.linkIdentity({
    provider: meta.supabaseProvider,
    options,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function unlinkLoginIdentity(identity) {
  if (!supabase) {
    throw new Error('supabase_not_configured');
  }

  const { data, error } = await supabase.auth.unlinkIdentity(identity);
  if (error) {
    throw error;
  }

  return data;
}
