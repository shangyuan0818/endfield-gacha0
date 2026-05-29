import {
  checkMemoryRateLimit,
  getRequesterKey,
  rejectDisallowedBrowserOrigin
} from '../../_lib/http.js';
import {
  ensureProfileForAuthUser,
  findAuthUserByEmail,
  getSupabaseAdminClient
} from '../../_lib/authAdmin.js';
import {
  evaluateAuthSecurityRisk,
  getRequesterIp,
  persistAuthSecurityEvent,
  serializeAuthSecurityAudit,
  verifyAuthCaptcha,
} from '../../_lib/authSecurityGuards.js';
import { enqueueMailOutboxEvent } from '../../_lib/mailOutbox.js';
import { MAIL_EVENT_TYPES } from '../../_lib/mailAbuseGuards.js';
import {
  buildMailRuntimeControls,
  isRuntimeEventEnabled,
  loadMailRuntimeState,
} from '../../_lib/mailRuntimeConfig.js';
import {
  ACCOUNT_RECOVERY_DELIVERY_CHANNELS,
  ACCOUNT_RECOVERY_NEXT_STEPS,
  appendRecoveryAuditEvent,
  createRecoveryAudit,
  getGenericAccountRecoveryResponse,
  summarizeRecoveryMailResult,
} from '../../../src/utils/accountRecoveryFlow.js';

const REQUEST_LIMIT = {
  windowMs: 60 * 60 * 1000,
  max: 4
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST_TYPES = new Set(['password_reset', 'delete_account']);

function readEnvironment() {
  return globalThis.process?.env || {};
}

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function isAccountRecoveryMailOutboxEnabled(env = readEnvironment(), runtimeState = null) {
  if (runtimeState) {
    return isRuntimeEventEnabled(runtimeState, 'accountRecoveryOutbox');
  }

  return parseBoolean(env.ACCOUNT_RECOVERY_MAIL_OUTBOX_ENABLED)
    && parseBoolean(env.MAIL_OUTBOX_WORKER_ENABLED);
}

async function safeLoadMailRuntimeState(adminClient) {
  try {
    return await loadMailRuntimeState(adminClient);
  } catch {
    return null;
  }
}

function sendGenericRecoveryResponse(res) {
  return res.status(200).json({
    success: true,
    data: getGenericAccountRecoveryResponse(),
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

function normalizeClaims(rawClaims) {
  return (Array.isArray(rawClaims) ? rawClaims : [])
    .slice(0, 5)
    .map((claim) => ({
      gameUid: String(claim?.gameUid || '').trim(),
      nickName: String(claim?.nickName || '').trim()
    }))
    .filter((claim) => claim.gameUid || claim.nickName);
}

function resolveLocale(req, body) {
  const explicitLocale = String(body.locale || body.lang || '').trim();
  if (explicitLocale) {
    return explicitLocale.slice(0, 16);
  }

  const acceptLanguage = String(req.headers?.['accept-language'] || req.headers?.['Accept-Language'] || '').trim();
  if (acceptLanguage.toLowerCase().startsWith('en')) {
    return 'en-US';
  }

  return 'zh-CN';
}

async function updateRecoveryRequestAfterMailAttempt(adminClient, requestId, patch) {
  try {
    const { error } = await adminClient
      .from('account_recovery_requests')
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    return { error };
  } catch (error) {
    return { error };
  }
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

  const body = parseRequestBody(req);
  const {
    email,
    requestType,
    claimedAccountCount,
    verificationClaims,
    note
  } = body;

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedType = String(requestType || '').trim();
  const normalizedNote = String(note || '').trim();
  const normalizedClaims = normalizeClaims(verificationClaims);
  const locale = resolveLocale(req, body);
  const parsedAccountCount = Number.parseInt(claimedAccountCount, 10);
  const requesterKey = getRequesterKey(req);
  const rateLimitResult = checkMemoryRateLimit(`account-recovery:${requesterKey}`, REQUEST_LIMIT);
  const captchaToken = body.captchaToken || body.captcha_token || body.turnstileToken || body.hcaptchaToken;
  const captchaProvider = body.captchaProvider || body.captcha_provider;
  const powPayload = body.powPayload || body.pow_payload;
  const captchaResult = await verifyAuthCaptcha({
    action: 'account_recovery',
    token: captchaToken,
    provider: captchaProvider,
    powPayload,
    requesterIp: getRequesterIp(req),
  });
  const adminClient = getSupabaseAdminClient();
  const risk = evaluateAuthSecurityRisk({
    action: 'account_recovery',
    req,
    email: normalizedEmail,
    rateLimitResult,
    captchaResult,
  });
  const authSecurityAudit = serializeAuthSecurityAudit({
    risk,
    captcha: captchaResult,
    rateLimit: rateLimitResult,
  });
  const persistRecoveryAuthAudit = (outcome, metadata = {}) => persistAuthSecurityEvent(adminClient, {
    eventType: 'account_recovery_request',
    action: 'account_recovery',
    outcome,
    risk,
    captcha: captchaResult,
    rateLimit: rateLimitResult,
    metadata: {
      requestType: normalizedType || undefined,
      ...metadata,
    },
  });

  if (!rateLimitResult.allowed) {
    await persistRecoveryAuthAudit('rate_limited');
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      retry_after: rateLimitResult.retryAfter
    });
  }

  if (!captchaResult.ok) {
    await persistRecoveryAuthAudit('captcha_blocked');
    return res.status(403).json({
      success: false,
      error: 'Captcha verification required',
      code: captchaResult.code || 'captcha_required'
    });
  }

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    await persistRecoveryAuthAudit('invalid_request', { reason: 'invalid_email' });
    return res.status(400).json({ success: false, error: 'Invalid email' });
  }

  if (!REQUEST_TYPES.has(normalizedType)) {
    await persistRecoveryAuthAudit('invalid_request', { reason: 'invalid_request_type' });
    return res.status(400).json({ success: false, error: 'Invalid request type' });
  }

  if (normalizedClaims.length === 0) {
    await persistRecoveryAuthAudit('invalid_request', { reason: 'missing_claims' });
    return res.status(400).json({ success: false, error: 'At least one verification claim is required' });
  }

  const hasIncompleteClaim = normalizedClaims.some((claim) => !claim.gameUid || !claim.nickName);
  if (hasIncompleteClaim) {
    await persistRecoveryAuthAudit('invalid_request', { reason: 'incomplete_claims' });
    return res.status(400).json({ success: false, error: 'Verification claims must include both UID and nickname' });
  }

  if (!Number.isInteger(parsedAccountCount) || parsedAccountCount < 1 || parsedAccountCount > 20) {
    await persistRecoveryAuthAudit('invalid_request', { reason: 'invalid_claimed_account_count' });
    return res.status(400).json({ success: false, error: 'Invalid claimed account count' });
  }

  if (normalizedNote.length > 1000) {
    await persistRecoveryAuthAudit('invalid_request', { reason: 'note_too_long' });
    return res.status(400).json({ success: false, error: 'Note is too long' });
  }

  if (!adminClient) {
    return res.status(503).json({ success: false, error: 'Auth admin not configured' });
  }

  try {
    const runtimeState = await safeLoadMailRuntimeState(adminClient);
    const matchedUser = await findAuthUserByEmail(adminClient, normalizedEmail);
    if (!matchedUser) {
      await persistRecoveryAuthAudit('received_unknown_email');
      return sendGenericRecoveryResponse(res);
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
      await persistRecoveryAuthAudit('received_existing_request');
      return sendGenericRecoveryResponse(res);
    }

    const initialAudit = createRecoveryAudit({
      requestType: normalizedType,
      authSecurity: authSecurityAudit,
    });

    const { data, error } = await adminClient
      .from('account_recovery_requests')
      .insert({
        email: normalizedEmail,
        matched_user_id: matchedUser.id,
        request_type: normalizedType,
        claimed_account_count: parsedAccountCount,
        verification_claims: normalizedClaims,
        note: normalizedNote || null,
        status: 'pending',
        delivery_channel: 'manual',
        next_step: 'manual_review_pending',
        recovery_audit: initialAudit,
      })
      .select('id, status, created_at')
      .single();

    if (error) {
      throw error;
    }

    const requestId = data?.id || null;
    const mailEnabled = isAccountRecoveryMailOutboxEnabled(readEnvironment(), runtimeState);
    if (normalizedType === 'password_reset' && requestId && mailEnabled) {
      let mailResult;
      try {
        mailResult = await enqueueMailOutboxEvent({
          adminClient,
          eventType: MAIL_EVENT_TYPES.PASSWORD_RESET,
          recipientEmail: normalizedEmail,
          requesterIp: getRequesterIp(req),
          userId: '',
          templateKey: 'auth.password-reset',
          locale,
          relatedEntityType: 'account_recovery',
          relatedEntityId: requestId,
          purposeKey: requestId,
          payload: {
            requestType: normalizedType,
            resetLinkMode: 'worker_generate',
            recoveryRequestId: requestId,
            submittedAt: data?.created_at || new Date().toISOString(),
          },
          priority: 3,
          controls: buildMailRuntimeControls(runtimeState, 'accountRecoveryOutbox'),
        });
      } catch (error) {
        mailResult = {
          ok: false,
          queued: false,
          deduped: false,
          action: 'error',
          code: 'mail_enqueue_exception',
          reason: error?.message || 'Mail enqueue failed.',
        };
      }

      const mailSummary = summarizeRecoveryMailResult(mailResult, {
        enabled: mailEnabled,
        attempted: mailEnabled,
      });
      const mailQueued = mailResult?.queued || mailResult?.deduped;
      const nextAudit = appendRecoveryAuditEvent({
        ...initialAudit,
        mail: mailSummary,
      }, {
        type: mailQueued ? 'mail_reset_queued' : 'mail_reset_fallback',
        at: new Date().toISOString(),
        deliveryChannel: mailQueued
          ? ACCOUNT_RECOVERY_DELIVERY_CHANNELS.MAIL_OUTBOX
          : ACCOUNT_RECOVERY_DELIVERY_CHANNELS.MANUAL,
        nextStep: mailQueued
          ? ACCOUNT_RECOVERY_NEXT_STEPS.MAIL_RESET_QUEUED
          : ACCOUNT_RECOVERY_NEXT_STEPS.MANUAL_REVIEW_PENDING,
        mail: mailSummary,
      });

      const { error: mailPatchError } = await updateRecoveryRequestAfterMailAttempt(adminClient, requestId, {
        delivery_channel: mailQueued
          ? ACCOUNT_RECOVERY_DELIVERY_CHANNELS.MAIL_OUTBOX
          : ACCOUNT_RECOVERY_DELIVERY_CHANNELS.MANUAL,
        next_step: mailQueued
          ? ACCOUNT_RECOVERY_NEXT_STEPS.MAIL_RESET_QUEUED
          : ACCOUNT_RECOVERY_NEXT_STEPS.MANUAL_REVIEW_PENDING,
        mail_outbox_id: mailQueued ? mailResult?.outboxId || null : null,
        recovery_audit: nextAudit,
      });

      if (mailPatchError) {
        await updateRecoveryRequestAfterMailAttempt(adminClient, requestId, {
          delivery_channel: ACCOUNT_RECOVERY_DELIVERY_CHANNELS.MANUAL,
          next_step: ACCOUNT_RECOVERY_NEXT_STEPS.MANUAL_REVIEW_PENDING,
          recovery_audit: appendRecoveryAuditEvent(nextAudit, {
            type: 'mail_reset_state_update_failed',
            at: new Date().toISOString(),
            deliveryChannel: ACCOUNT_RECOVERY_DELIVERY_CHANNELS.MANUAL,
            nextStep: ACCOUNT_RECOVERY_NEXT_STEPS.MANUAL_REVIEW_PENDING,
            warning: {
              code: 'mail_recovery_request_update_failed',
              message: mailPatchError.message || 'Failed to update recovery request mail state',
            },
          }),
        });
      }
    }

    await persistRecoveryAuthAudit('received_created');
    return sendGenericRecoveryResponse(res);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to create recovery request'
    });
  }
}
