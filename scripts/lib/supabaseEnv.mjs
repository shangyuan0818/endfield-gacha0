function normalizeEnvValue(value) {
  return String(value || '').trim();
}

export function resolveSupabaseUrl(env = process.env) {
  return normalizeEnvValue(env.SUPABASE_URL || env.VITE_SUPABASE_URL);
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
