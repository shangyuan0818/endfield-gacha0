import { createClient } from '@supabase/supabase-js';
import { checkMemoryRateLimit, getRequesterKey, rejectDisallowedBrowserOrigin } from '../../_lib/http.js';
import {
  hasStatusEndpointProbeConfig,
  verifyStatusEndpointProbeRequest,
} from '../../_lib/statusAdminAuth.js';
import { processStatusAlert } from '../../_lib/statusAlertNotifications.js';
import {
  pruneEndpointHeartbeatHistory,
  recordEndpointHeartbeats,
} from '../../_lib/statusEndpointHeartbeats.js';
import { runStatusEndpointProbe } from '../../_lib/statusEndpointProbe.js';
import {
  resolveSupabaseSecretKey,
  resolveSupabaseUrl,
} from '../../_lib/supabaseEnv.js';

const MAX_BODY_BYTES = 24 * 1024;

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

async function readJsonBody(req) {
  if (req.method !== 'POST') {
    return {};
  }

  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
      const error = new Error('request_body_too_large');
      error.statusCode = 413;
      throw error;
    }
  }

  if (!body.trim()) {
    return {};
  }

  return JSON.parse(body);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, {
    methods: 'GET, POST, OPTIONS',
    headers: 'Content-Type, Authorization',
  })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  if (!hasStatusEndpointProbeConfig()) {
    return res.status(503).json({
      success: false,
      error: 'status_endpoint_probe_not_configured',
    });
  }

  const rateLimit = checkMemoryRateLimit(`status-endpoint-probe:${getRequesterKey(req)}`, {
    windowMs: 60_000,
    max: 20,
  });

  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfter));
    return res.status(429).json({
      success: false,
      error: 'too_many_endpoint_probe_runs',
    });
  }

  if (!verifyStatusEndpointProbeRequest(req)) {
    return res.status(401).json({
      success: false,
      error: 'status_endpoint_probe_unauthorized',
    });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(503).json({
      success: false,
      error: 'status_endpoint_probe_storage_unavailable',
    });
  }

  try {
    const body = await readJsonBody(req);
    const result = await runStatusEndpointProbe({
      targets: Array.isArray(body.targets) ? body.targets : null,
    });

    await recordEndpointHeartbeats(supabase, result.services, {
      checkedAt: result.checkedAt,
    });

    await Promise.all(
      result.services.map((service) => processStatusAlert(supabase, {
        type: 'endpoint',
        id: service.id,
        label: service.label,
        status: service.status,
        summary: service.summary,
      }).catch(() => null))
    );

    await pruneEndpointHeartbeatHistory(supabase).catch(() => null);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error?.message || 'status_endpoint_probe_failed',
    });
  }
}
