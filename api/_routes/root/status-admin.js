import { createClient } from '@supabase/supabase-js';
import { rejectDisallowedBrowserOrigin } from '../../_lib/http.js';
import { buildStatusAdminOverview } from '../../_lib/statusAdminOverview.js';
import {
  hasStatusAdminConfig,
  verifyStatusAdminRequest,
} from '../../_lib/statusAdminAuth.js';
import {
  resolveSupabaseSecretKey,
  resolveSupabaseUrl,
} from '../../_lib/supabaseEnv.js';

function getSupabaseClient() {
  const supabaseUrl = resolveSupabaseUrl();
  const supabaseKey = resolveSupabaseSecretKey();

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
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, {
    methods: 'GET, OPTIONS',
    headers: 'Content-Type, Authorization',
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

  if (!hasStatusAdminConfig()) {
    return res.status(503).json({
      success: false,
      error: 'status_admin_not_configured',
    });
  }

  if (!verifyStatusAdminRequest(req)) {
    return res.status(401).json({
      success: false,
      error: 'status_admin_unauthorized',
    });
  }

  const overview = await buildStatusAdminOverview({
    supabase: getSupabaseClient(),
  });

  return res.status(200).json({
    success: true,
    data: overview,
  });
}
