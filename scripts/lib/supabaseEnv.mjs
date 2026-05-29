function normalizeEnvValue(value) {
  const trimmed = String(value || '').trim();
  const quoted = trimmed.match(/^(['"])(.*)\1$/);
  return quoted ? quoted[2].trim() : trimmed;
}

function isPlaceholderSupabaseUrl(value) {
  const normalized = normalizeEnvValue(value).toLowerCase();
  return !normalized
    || normalized.includes('your-project-ref')
    || normalized.includes('your-supabase')
    || normalized === 'supabase_url'
    || normalized === 'https://example.supabase.co';
}

function isValidSupabaseUrl(value) {
  if (isPlaceholderSupabaseUrl(value)) {
    return false;
  }

  try {
    const parsed = new URL(normalizeEnvValue(value));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function resolveFirstValidUrl(values = []) {
  return values.map(normalizeEnvValue).find(isValidSupabaseUrl) || '';
}

export function resolveSupabaseUrl(env = process.env) {
  return resolveFirstValidUrl([
    env.SUPABASE_URL,
    env.VITE_SUPABASE_URL,
  ]);
}

export function resolveSupabaseSecretKey(env = process.env) {
  return normalizeEnvValue(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
}

export function resolveSupabasePublishableKey(env = process.env) {
  return normalizeEnvValue(
    env.SUPABASE_PUBLISHABLE_KEY
      || env.VITE_SUPABASE_PUBLISHABLE_KEY
      || env.VITE_SUPABASE_ANON_KEY
      || env.SUPABASE_ANON_KEY
  );
}

export function resolveSupabaseServerKey(env = process.env) {
  return resolveSupabaseSecretKey(env) || resolveSupabasePublishableKey(env);
}
