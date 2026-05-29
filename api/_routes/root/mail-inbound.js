import { getSupabaseAdminClient } from '../../_lib/authAdmin.js';
import {
  recordMailInboundEvent,
  verifyMailInboundWebhookSecret,
} from '../../_lib/mailInboundEvents.js';

function parseRequestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  const secretResult = verifyMailInboundWebhookSecret(req);
  if (!secretResult.ok) {
    return res.status(secretResult.status).json({
      success: false,
      code: secretResult.code,
    });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return res.status(503).json({
      success: false,
      code: 'admin_client_unavailable',
    });
  }

  try {
    const result = await recordMailInboundEvent({
      adminClient,
      input: parseRequestBody(req),
    });

    return res.status(result.ok ? 200 : 400).json({
      success: result.ok,
      ...result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: 'mail_inbound_failed',
      error: error?.message || 'Failed to record inbound mail event',
    });
  }
}
