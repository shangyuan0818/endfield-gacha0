import {
  checkMemoryRateLimit,
  getRequesterKey,
  rejectDisallowedBrowserOrigin
} from './_lib/http.js';
import {
  ensureProfileForAuthUser,
  findAuthUserByEmail,
  getSupabaseAdminClient
} from './_lib/authAdmin.js';

const REQUEST_LIMIT = {
  windowMs: 60 * 60 * 1000,
  max: 4
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST_TYPES = new Set(['password_reset', 'delete_account']);

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

function normalizeClaims(rawClaims) {
  return (Array.isArray(rawClaims) ? rawClaims : [])
    .slice(0, 5)
    .map((claim) => ({
      gameUid: String(claim?.gameUid || '').trim(),
      nickName: String(claim?.nickName || '').trim()
    }))
    .filter((claim) => claim.gameUid || claim.nickName);
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
  const rateLimitResult = checkMemoryRateLimit(`account-recovery:${requesterKey}`, REQUEST_LIMIT);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      retry_after: rateLimitResult.retryAfter
    });
  }

  const {
    email,
    requestType,
    claimedAccountCount,
    verificationClaims,
    note
  } = parseRequestBody(req);

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedType = String(requestType || '').trim();
  const normalizedNote = String(note || '').trim();
  const normalizedClaims = normalizeClaims(verificationClaims);
  const parsedAccountCount = Number.parseInt(claimedAccountCount, 10);

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return res.status(400).json({ success: false, error: 'Invalid email' });
  }

  if (!REQUEST_TYPES.has(normalizedType)) {
    return res.status(400).json({ success: false, error: 'Invalid request type' });
  }

  if (normalizedClaims.length === 0) {
    return res.status(400).json({ success: false, error: 'At least one verification claim is required' });
  }

  const hasIncompleteClaim = normalizedClaims.some((claim) => !claim.gameUid || !claim.nickName);
  if (hasIncompleteClaim) {
    return res.status(400).json({ success: false, error: 'Verification claims must include both UID and nickname' });
  }

  if (!Number.isInteger(parsedAccountCount) || parsedAccountCount < 1 || parsedAccountCount > 20) {
    return res.status(400).json({ success: false, error: 'Invalid claimed account count' });
  }

  if (normalizedNote.length > 1000) {
    return res.status(400).json({ success: false, error: 'Note is too long' });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return res.status(503).json({ success: false, error: 'Auth admin not configured' });
  }

  try {
    const matchedUser = await findAuthUserByEmail(adminClient, normalizedEmail);
    if (!matchedUser) {
      return res.status(404).json({ success: false, error: 'Email not registered' });
    }

    await ensureProfileForAuthUser(adminClient, matchedUser);

    const { data: existingRequests, error: existingError } = await adminClient
      .from('account_recovery_requests')
      .select('id')
      .eq('email', normalizedEmail)
      .in('status', ['pending', 'processing', 'verified'])
      .limit(1);

    if (existingError) {
      throw existingError;
    }

    if (Array.isArray(existingRequests) && existingRequests.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Existing request is still pending'
      });
    }

    const { data, error } = await adminClient
      .from('account_recovery_requests')
      .insert({
        email: normalizedEmail,
        matched_user_id: matchedUser.id,
        request_type: normalizedType,
        claimed_account_count: parsedAccountCount,
        verification_claims: normalizedClaims,
        note: normalizedNote || null,
        status: 'pending'
      })
      .select('id, status, created_at')
      .single();

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to create recovery request'
    });
  }
}
