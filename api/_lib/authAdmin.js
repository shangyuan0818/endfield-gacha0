import { createClient } from '@supabase/supabase-js';

const PAGE_SIZE = 200;
const MAX_PAGES = 50;

export function getSupabaseAdminClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function getSupabaseAnonServerClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return null;
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function createSupabaseAccessTokenClient(accessToken) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const normalizedAccessToken = String(accessToken || '').trim();

  if (!supabaseUrl || !anonKey || !normalizedAccessToken) {
    return null;
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${normalizedAccessToken}`
      }
    }
  });
}

export function getBearerToken(req) {
  const authorization = req.headers.authorization || req.headers.Authorization || '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  return authorization.slice(7).trim() || null;
}

export async function findAuthUserByEmail(adminClient, normalizedEmail) {
  let page = 1;

  while (page <= MAX_PAGES) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE
    });

    if (error) {
      throw error;
    }

    const users = Array.isArray(data?.users) ? data.users : [];
    const matchedUser = users.find((user) => String(user?.email || '').toLowerCase() === normalizedEmail);
    if (matchedUser) {
      return matchedUser;
    }

    const lastPage = Number(data?.lastPage || 0);
    if ((lastPage > 0 && page >= lastPage) || users.length < PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return null;
}
