import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_PUBLISHABLE_KEY = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  || Deno.env.get('SUPABASE_ANON_KEY')
  || '';
const SUPABASE_SECRET_KEY = Deno.env.get('SUPABASE_SECRET_KEY')
  || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  || '';

const BASE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function ensureEnv() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_SECRET_KEY) {
    throw new Error('Missing Supabase function environment variables');
  }
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Missing authorization header');
  }
  return authHeader.slice('Bearer '.length).trim();
}

export function createCorsResponse(status = 204) {
  return new Response(null, {
    status,
    headers: BASE_HEADERS
  });
}

export function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: BASE_HEADERS
  });
}

export function createAdminClient() {
  ensureEnv();
  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export async function requireSuperAdmin(req: Request) {
  ensureEnv();

  const token = getBearerToken(req);
  const callerClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });

  const { data: authData, error: authError } = await callerClient.auth.getUser();
  if (authError || !authData.user) {
    throw new Error('Invalid auth token');
  }

  const adminClient = createAdminClient();
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    throw new Error('Profile not found');
  }

  if (profile.role !== 'super_admin') {
    throw new Error('Permission denied');
  }

  return {
    user: authData.user,
    adminClient
  };
}
