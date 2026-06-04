import { createClient } from '@supabase/supabase-js';
import { rejectDisallowedBrowserOrigin } from '../../_lib/http.js';
import { PUBLIC_CACHE_CONTROL } from '../../_lib/publicCache.js';
import { buildPublicSiteStatus } from '../../_lib/publicSiteStatus.js';
import {
  resolveSupabaseServerKey,
  resolveSupabaseUrl,
} from '../../_lib/supabaseEnv.js';

function getSupabaseClient() {
  const supabaseUrl = resolveSupabaseUrl();
  const supabaseKey = resolveSupabaseServerKey();

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', PUBLIC_CACHE_CONTROL);

  if (rejectDisallowedBrowserOrigin(req, res, {
    methods: 'GET, OPTIONS',
  })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  const status = await buildPublicSiteStatus({
    supabase: getSupabaseClient(),
  });

  return res.status(200).json({
    success: true,
    data: {
      generatedAt: status.generatedAt,
      overall: status.overall,
      services: status.services,
      incidents: status.incidents,
    },
    meta: status.meta,
  });
}
