import { createClient } from '@supabase/supabase-js';
import {
  checkMemoryRateLimit,
  getRequesterKey,
  rejectDisallowedBrowserOrigin
} from '../../_lib/http.js';
import {
  getSupabaseAdminClient,
} from '../../_lib/authAdmin.js';
import {
  resolveSupabasePublishableKey,
  resolveSupabaseUrl,
} from '../../_lib/supabaseEnv.js';
import {
  evaluateAuthSecurityRisk,
  getRequesterIp,
  persistAuthSecurityEvent,
  verifyAuthCaptcha,
} from '../../_lib/authSecurityGuards.js';

const ACTION_LIMITS = {
  login: { windowMs: 30 * 60 * 1000, max: 10 },
  register: { windowMs: 60 * 60 * 1000, max: 5 },
  change_password: { windowMs: 15 * 60 * 1000, max: 5 },
  password_reset: { windowMs: 60 * 60 * 1000, max: 5 },
  resend_verification: { windowMs: 10 * 60 * 1000, max: 3 }
};

function isDevelopmentRuntime() {
  return process.env.NODE_ENV !== 'production';
}

function getSupabaseClient() {
  const supabaseUrl = resolveSupabaseUrl();
  const supabaseKey = resolveSupabasePublishableKey();

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

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

  if (isDevelopmentRuntime()) {
    return res.status(200).json({
      success: true,
      allowed: true,
      retry_after: 0,
      source: 'development'
    });
  }

  const { action } = parseRequestBody(req);
  const limitConfig = ACTION_LIMITS[action];

  if (!limitConfig) {
    return res.status(400).json({ success: false, error: 'Invalid action' });
  }

  const requesterKey = getRequesterKey(req);
  const adminClient = getSupabaseAdminClient();
  const body = parseRequestBody(req);
  const email = body.email;
  const captchaToken = body.captchaToken || body.captcha_token || body.turnstileToken || body.hcaptchaToken;
  const captchaProvider = body.captchaProvider || body.captcha_provider;
  const powPayload = body.powPayload || body.pow_payload;
  const captchaResult = await verifyAuthCaptcha({
    action,
    token: captchaToken,
    provider: captchaProvider,
    powPayload,
    requesterIp: getRequesterIp(req),
  });
  const fallbackResult = checkMemoryRateLimit(`auth:${action}:${requesterKey}`, limitConfig);

  const auditAndRespond = async (payload, statusCode = 200, outcome = 'allowed', riskRateLimitResult = payload) => {
    const risk = evaluateAuthSecurityRisk({
      action,
      req,
      email,
      rateLimitResult: riskRateLimitResult,
      captchaResult,
    });

    await persistAuthSecurityEvent(adminClient, {
      eventType: 'auth_rate_limit_check',
      action,
      outcome,
      risk,
      captcha: captchaResult,
      rateLimit: riskRateLimitResult,
      metadata: {
        source: payload?.source || 'memory',
      },
    });

    return res.status(statusCode).json({
      ...payload,
      risk: {
        bucket: risk.bucket,
        reasons: risk.reasons,
      },
    });
  };

  if (!captchaResult.ok) {
    return auditAndRespond({
      success: true,
      allowed: false,
      retry_after: 0,
      source: 'captcha',
      code: captchaResult.code || 'captcha_failed'
    }, 403, 'captcha_blocked', fallbackResult);
  }

  if (!fallbackResult.allowed) {
    return auditAndRespond({
      success: true,
      allowed: false,
      retry_after: fallbackResult.retryAfter,
      source: 'memory'
    }, 429, 'rate_limited', fallbackResult);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return auditAndRespond({
      success: true,
      allowed: true,
      retry_after: 0,
      source: 'memory'
    }, 200, 'allowed');
  }

  try {
    const { data, error } = await supabase.rpc('check_and_log_rate_limit', {
      p_identifier: requesterKey,
      p_action: action
    });

    if (error) {
      throw error;
    }

    const allowed = data?.allowed !== false;
    const retryAfter = Number(data?.retry_after || 0);

    return auditAndRespond({
      success: true,
      allowed,
      retry_after: retryAfter,
      source: 'supabase'
    }, allowed ? 200 : 429, allowed ? 'allowed' : 'rate_limited');
  } catch {
    return auditAndRespond({
      success: true,
      allowed: true,
      retry_after: 0,
      source: 'memory'
    }, 200, 'fallback_allowed');
  }
}
