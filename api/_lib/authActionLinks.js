import { resolveSupabaseUrl } from './supabaseEnv.js';

function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function isLocalAuthHost(hostname) {
  const normalized = String(hostname || '').toLowerCase();
  return normalized === 'localhost'
    || normalized === '127.0.0.1'
    || normalized === '::1'
    || normalized.endsWith('.localhost');
}

function extractAuthPath(rawLink) {
  const raw = String(rawLink || '').trim();
  if (!raw) {
    return '';
  }

  const strictIndex = raw.indexOf('/auth/v1/');
  if (strictIndex >= 0) {
    return raw.slice(strictIndex);
  }

  const looseIndex = raw.indexOf('auth/v1/');
  if (looseIndex >= 0) {
    return `/${raw.slice(looseIndex)}`;
  }

  return '';
}

function rewriteAuthPathToSupabase(pathAndQuery, env) {
  const supabaseUrl = trimTrailingSlash(resolveSupabaseUrl(env));
  if (!supabaseUrl || !pathAndQuery) {
    return '';
  }

  try {
    return new URL(pathAndQuery, `${supabaseUrl}/`).toString();
  } catch {
    return '';
  }
}

export function normalizeGeneratedAuthActionLink(actionLink, env = process.env) {
  const raw = String(actionLink || '').trim();
  if (!raw) {
    return '';
  }

  try {
    const parsed = new URL(raw);
    if (isLocalAuthHost(parsed.hostname) && parsed.pathname.startsWith('/auth/v1/')) {
      return rewriteAuthPathToSupabase(`${parsed.pathname}${parsed.search}${parsed.hash}`, env) || raw;
    }
    return parsed.toString();
  } catch {
    const extractedAuthPath = extractAuthPath(raw);
    return rewriteAuthPathToSupabase(extractedAuthPath, env) || raw;
  }
}
