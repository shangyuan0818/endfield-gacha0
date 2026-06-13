import { createClient } from '@supabase/supabase-js';
import {
  resolveSupabasePublishableKey,
  resolveSupabaseSecretKey,
  resolveSupabaseUrl,
} from './supabaseEnv.js';

const PAGE_SIZE = 200;
const MAX_PAGES = 50;
const PROFILE_FIELDS = 'id, username, email, role, created_at, updated_at, last_seen_at';
const SYNTHETIC_OAUTH_EMAIL_SUFFIX = '@oauth.local.invalid';
// Self-hosted gateways may reject very long PostgREST `in.(...)` query strings.
// Keep profile batches small enough to avoid 502s on auth/profile merge flows.
const PROFILE_CHUNK_SIZE = 25;

export function getSupabaseAdminClient() {
  const supabaseUrl = resolveSupabaseUrl();
  const serviceRoleKey = resolveSupabaseSecretKey();

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
  const supabaseUrl = resolveSupabaseUrl();
  const anonKey = resolveSupabasePublishableKey();

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
  const supabaseUrl = resolveSupabaseUrl();
  const anonKey = resolveSupabasePublishableKey();
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
  const users = await listAllAuthUsers(adminClient);
  return users.find((user) => String(user?.email || '').toLowerCase() === normalizedEmail) || null;
}

export async function loadAuthUserById(adminClient, userId) {
  const getUserById = adminClient?.auth?.admin?.getUserById;
  if (typeof getUserById !== 'function' || !userId) {
    return null;
  }

  const { data, error } = await getUserById.call(adminClient.auth.admin, userId);
  if (error) {
    throw error;
  }
  return data?.user || data || null;
}

export async function listAllAuthUsers(adminClient) {
  const users = [];
  let page = 1;
  let expectedTotal = null;

  while (page <= MAX_PAGES) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE
    });

    if (error) {
      throw error;
    }

    const currentUsers = Array.isArray(data?.users) ? data.users : [];
    users.push(...currentUsers);
    if (Number.isFinite(Number(data?.total))) {
      expectedTotal = Number(data.total);
    }

    const nextPage = Number(data?.nextPage || 0);
    if (expectedTotal !== null && users.length >= expectedTotal) {
      break;
    }

    if (nextPage > page) {
      page = nextPage;
      continue;
    }

    if (currentUsers.length < PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return users;
}

function buildFallbackUsername(authUser) {
  const candidates = [
    String(authUser?.user_metadata?.username || authUser?.raw_user_meta_data?.username || '').trim(),
    String(authUser?.email || '').trim().toLowerCase().split('@')[0] || '',
    `user_${String(authUser?.id || '').replace(/-/g, '').slice(0, 8)}`
  ];

  for (const candidate of candidates) {
    const sanitized = candidate
      .replace(/[^0-9A-Za-z_\-\u4e00-\u9fa5]/g, '')
      .trim();

    if (sanitized.length >= 2) {
      return sanitized.slice(0, 50);
    }
  }

  return `user_${String(authUser?.id || 'account').replace(/-/g, '').slice(0, 8)}`.slice(0, 50);
}

function buildProfileSeed(authUser) {
  const email = String(authUser?.email || '').trim().toLowerCase();
  return {
    id: authUser.id,
    username: buildFallbackUsername(authUser),
    email: email.endsWith(SYNTHETIC_OAUTH_EMAIL_SUFFIX) ? null : email || null,
    role: 'user'
  };
}

async function loadProfilesByIds(adminClient, ids) {
  const profileMap = new Map();
  const normalizedIds = Array.from(new Set((Array.isArray(ids) ? ids : []).filter(Boolean)));

  for (let index = 0; index < normalizedIds.length; index += PROFILE_CHUNK_SIZE) {
    const chunk = normalizedIds.slice(index, index + PROFILE_CHUNK_SIZE);
    const { data, error } = await adminClient
      .from('profiles')
      .select(PROFILE_FIELDS)
      .in('id', chunk);

    if (error) {
      throw error;
    }

    for (const profile of data || []) {
      profileMap.set(profile.id, profile);
    }
  }

  return profileMap;
}

export async function ensureProfileForAuthUser(adminClient, authUser, existingProfile = null) {
  if (!authUser?.id) {
    return existingProfile || null;
  }

  if (existingProfile) {
    return existingProfile;
  }

  const seed = buildProfileSeed(authUser);

  const { data, error } = await adminClient
    .from('profiles')
    .insert(seed)
    .select(PROFILE_FIELDS)
    .single();

  if (error?.code === '23505') {
    const { data: profile, error: loadError } = await adminClient
      .from('profiles')
      .select(PROFILE_FIELDS)
      .eq('id', authUser.id)
      .maybeSingle();

    if (loadError) {
      throw loadError;
    }

    return profile || null;
  }

  if (error) {
    throw error;
  }

  return data || seed;
}

export async function listMergedAdminUsers(adminClient, { repairProfiles = false } = {}) {
  const authUsers = await listAllAuthUsers(adminClient);
  const authUserIds = authUsers.map((user) => user?.id).filter(Boolean);
  const profileMap = await loadProfilesByIds(adminClient, authUserIds);

  if (repairProfiles) {
    for (const authUser of authUsers) {
      if (!authUser?.id || profileMap.has(authUser.id)) {
        continue;
      }

      const repairedProfile = await ensureProfileForAuthUser(adminClient, authUser);
      if (repairedProfile) {
        profileMap.set(authUser.id, repairedProfile);
      }
    }
  }

  return authUsers
    .map((authUser) => {
      const profile = profileMap.get(authUser.id) || null;
      return {
        id: authUser.id,
        username: profile?.username || buildFallbackUsername(authUser),
        email: profile?.email || (String(authUser?.email || '').trim().toLowerCase().endsWith(SYNTHETIC_OAUTH_EMAIL_SUFFIX) ? null : String(authUser?.email || '').trim().toLowerCase() || null),
        role: profile?.role || 'user',
        created_at: profile?.created_at || authUser?.created_at || null,
        updated_at: profile?.updated_at || authUser?.updated_at || null,
        last_seen_at: profile?.last_seen_at || null,
        auth_last_sign_in_at: authUser?.last_sign_in_at || null,
        email_confirmed_at: authUser?.email_confirmed_at || null,
        profile_exists: Boolean(profile)
      };
    })
    .sort((left, right) => {
      const leftTime = left?.created_at ? new Date(left.created_at).getTime() : 0;
      const rightTime = right?.created_at ? new Date(right.created_at).getTime() : 0;
      return rightTime - leftTime;
    });
}
