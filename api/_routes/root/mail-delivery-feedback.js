import { getSupabaseAdminClient } from '../../_lib/authAdmin.js';
import {
  recordMailDeliveryFeedbackBatch,
  verifyMailDeliveryFeedbackSecret,
} from '../../_lib/mailDeliveryFeedback.js';

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

  const secretResult = verifyMailDeliveryFeedbackSecret(req);
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
    const result = await recordMailDeliveryFeedbackBatch({
      adminClient,
      input: parseRequestBody(req),
    });

    return res.status(result.ok || result.partial ? 200 : 400).json({
      success: result.ok || result.partial,
      ...result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: 'mail_feedback_failed',
      error: error?.message || 'Failed to record mail delivery feedback',
    });
  }
}
