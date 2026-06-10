import { createClient } from '@supabase/supabase-js';
import { checkMemoryRateLimit, getRequesterKey } from '../../_lib/http.js';
import {
  hasStatusProbeConfig,
  verifyStatusProbeRequest,
} from '../../_lib/statusAdminAuth.js';
import { processStatusAlert } from '../../_lib/statusAlertNotifications.js';
import { pruneProbeHeartbeatHistory, upsertProbeReport } from '../../_lib/statusProbeReports.js';
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

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  if (!hasStatusProbeConfig()) {
    return res.status(503).json({
      success: false,
      error: 'status_probe_not_configured',
    });
  }

  const rateLimit = checkMemoryRateLimit(`status-probe:${getRequesterKey(req)}`, {
    windowMs: 60_000,
    max: 30,
  });

  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfter));
    return res.status(429).json({
      success: false,
      error: 'too_many_probe_reports',
    });
  }

  if (!verifyStatusProbeRequest(req)) {
    return res.status(401).json({
      success: false,
      error: 'status_probe_unauthorized',
    });
  }

  try {
    const body = await readJsonBody(req);
    const supabase = getSupabaseClient();
    const report = await upsertProbeReport(supabase, body);
    await processStatusAlert(supabase, {
      type: 'probe',
      id: report.probe_id,
      label: report.label,
      status: report.status,
      summary: report.summary,
    }).catch(() => null);
    await pruneProbeHeartbeatHistory(supabase).catch(() => null);
    return res.status(200).json({
      success: true,
      data: {
        probeId: report.probe_id,
        receivedAt: report.received_at,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      error: error?.message || 'invalid_probe_report',
    });
  }
}
