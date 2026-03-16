import { createClient } from '@supabase/supabase-js';
import {
  checkMemoryRateLimit,
  getRequesterKey,
  rejectDisallowedBrowserOrigin
} from './_lib/http.js';

const ACTION_LIMITS = {
  login: { windowMs: 30 * 60 * 1000, max: 10 },
  register: { windowMs: 60 * 60 * 1000, max: 5 },
  password_reset: { windowMs: 60 * 60 * 1000, max: 5 },
  resend_verification: { windowMs: 10 * 60 * 1000, max: 3 }
};

function isDevelopmentRuntime() {
  return process.env.NODE_ENV !== 'production';
}

function getSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

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
  const fallbackResult = checkMemoryRateLimit(`auth:${action}:${requesterKey}`, limitConfig);

  if (!fallbackResult.allowed) {
    return res.status(429).json({
      success: true,
      allowed: false,
      retry_after: fallbackResult.retryAfter,
      source: 'memory'
    });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(200).json({
      success: true,
      allowed: true,
      retry_after: 0,
      source: 'memory'
    });
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

    return res.status(allowed ? 200 : 429).json({
      success: true,
      allowed,
      retry_after: retryAfter,
      source: 'supabase'
    });
  } catch {
    return res.status(200).json({
      success: true,
      allowed: true,
      retry_after: 0,
      source: 'memory'
    });
  }
}
