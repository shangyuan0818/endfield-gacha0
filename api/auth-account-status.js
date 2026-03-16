import {
  checkMemoryRateLimit,
  getRequesterKey,
  rejectDisallowedBrowserOrigin
} from './_lib/http.js';
import { findAuthUserByEmail, getSupabaseAdminClient } from './_lib/authAdmin.js';

const EMAIL_LOOKUP_LIMIT = {
  windowMs: 30 * 60 * 1000,
  max: 8
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function parseRequestBody(req) {
  if (!req.body) {
    return {};
  }

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

  if (rejectDisallowedBrowserOrigin(req, res, { methods: 'POST, OPTIONS' })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const requesterKey = getRequesterKey(req);
  const rateLimitResult = checkMemoryRateLimit(`auth-email-status:${requesterKey}`, EMAIL_LOOKUP_LIMIT);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      retry_after: rateLimitResult.retryAfter,
      recoveryAvailable: false
    });
  }

  const { email } = parseRequestBody(req);
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email',
      recoveryAvailable: false
    });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return res.status(503).json({
      success: false,
      error: 'Auth admin not configured',
      recoveryAvailable: false
    });
  }

  try {
    const registered = Boolean(await findAuthUserByEmail(adminClient, normalizedEmail));
    return res.status(200).json({
      success: true,
      registered,
      recoveryAvailable: false
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Lookup failed',
      recoveryAvailable: false
    });
  }
}
