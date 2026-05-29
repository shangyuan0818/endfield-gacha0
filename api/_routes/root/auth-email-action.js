import {
  checkMemoryRateLimit,
  getRequesterKey,
  rejectDisallowedBrowserOrigin,
} from '../../_lib/http.js';
import {
  ensureProfileForAuthUser,
  findAuthUserByEmail,
  getSupabaseAdminClient,
} from '../../_lib/authAdmin.js';
import { normalizeGeneratedAuthActionLink } from '../../_lib/authActionLinks.js';
import {
  evaluateAuthSecurityRisk,
  getRequesterIp,
  persistAuthSecurityEvent,
  verifyAuthCaptcha,
} from '../../_lib/authSecurityGuards.js';
import { createMailProviderAdapter } from '../../_lib/mailProviderAdapter.js';
import { renderMailTemplate } from '../../_lib/mailTemplateRenderer.js';
import {
  buildMailRuntimeControls,
  isRuntimeEventEnabled,
  loadMailRuntimeState,
} from '../../_lib/mailRuntimeConfig.js';
import { MAIL_EVENT_TYPES, buildRecipientFingerprint, hashMailIdentifier, sanitizeMailPayload } from '../../_lib/mailAbuseGuards.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACTIONS = Object.freeze({
  REGISTER_CONFIRMATION: 'register_confirmation',
  PASSWORD_RESET: 'password_reset',
  EMAIL_LOGIN: 'email_login',
});

const ACTION_META = {
  [ACTIONS.REGISTER_CONFIRMATION]: {
    captchaAction: 'register',
    eventType: MAIL_EVENT_TYPES.REGISTER_CONFIRMATION,
    linkType: 'signup',
    templateKey: 'auth.register-confirmation',
    priority: 2,
    rateLimit: { windowMs: 60 * 60 * 1000, max: 4 },
  },
  [ACTIONS.PASSWORD_RESET]: {
    captchaAction: 'password_reset',
    eventType: MAIL_EVENT_TYPES.PASSWORD_RESET,
    linkType: 'recovery',
    templateKey: 'auth.password-reset',
    priority: 3,
    rateLimit: { windowMs: 60 * 60 * 1000, max: 5 },
  },
  [ACTIONS.EMAIL_LOGIN]: {
    captchaAction: 'password_reset',
    eventType: MAIL_EVENT_TYPES.EMAIL_LOGIN,
    linkType: 'magiclink',
    templateKey: 'auth.email-login',
    priority: 3,
    rateLimit: { windowMs: 60 * 60 * 1000, max: 5 },
  },
};

function readEnvironment() {
  return globalThis.process?.env || {};
}

function parseBoolean(value, defaultValue = false) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

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

function resolveLocale(req, body) {
  const explicit = String(body.locale || body.lang || '').trim();
  if (explicit) {
    return explicit.slice(0, 16);
  }

  const acceptLanguage = String(req.headers?.['accept-language'] || '').trim();
  return acceptLanguage.toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN';
}

function getAppUrl(env = readEnvironment(), req = null) {
  const configured = String(env.APP_URL || env.VITE_APP_URL || '').trim().replace(/\/$/, '');
  if (configured) {
    return configured;
  }

  const origin = String(req?.headers?.origin || '').trim().replace(/\/$/, '');
  return origin || 'https://ef-gacha.mogujun.icu';
}

function getRedirectTo(action, env, req) {
  const baseUrl = getAppUrl(env, req);
  if (action === ACTIONS.PASSWORD_RESET) {
    return `${baseUrl}/reset-password`;
  }
  return baseUrl;
}

function isAuthMailEnabled(env = readEnvironment(), runtimeState = null) {
  if (runtimeState) {
    return isRuntimeEventEnabled(runtimeState, 'authMailActions');
  }
  return parseBoolean(env.AUTH_MAIL_ACTIONS_ENABLED || env.AUTH_EMAIL_ACTIONS_ENABLED, false)
    && parseBoolean(env.MAIL_OUTBOX_WORKER_ENABLED || env.MAIL_WORKER_ENABLED, false);
}

function isAuthMailPaused(env = readEnvironment(), runtimeState = null) {
  if (runtimeState) {
    return Boolean(runtimeState.controls?.killSwitch);
  }
  return parseBoolean(env.MAIL_OUTBOX_GLOBAL_KILL_SWITCH, false);
}

async function safeLoadMailRuntimeState(adminClient, env) {
  try {
    return await loadMailRuntimeState(adminClient, env);
  } catch {
    return null;
  }
}

function sendGenericResponse(res, {
  status = 'sent_if_available',
  deliveryChannel = 'mail',
  nextStep = 'check_email',
} = {}) {
  return res.status(200).json({
    success: true,
    data: {
      status,
      deliveryChannel,
      nextStep,
    },
  });
}

function normalizeString(value, maxLength = 256) {
  return String(value || '').trim().slice(0, maxLength);
}

function buildGenerateLinkPayload({
  action,
  email,
  password,
  username,
  redirectTo,
}) {
  if (action === ACTIONS.REGISTER_CONFIRMATION) {
    return {
      type: 'signup',
      email,
      password,
      options: {
        data: {
          username: username || email.split('@')[0],
        },
        redirectTo,
      },
    };
  }

  if (action === ACTIONS.EMAIL_LOGIN) {
    return {
      type: 'magiclink',
      email,
      options: {
        redirectTo,
      },
    };
  }

  return {
    type: 'recovery',
    email,
    options: {
      redirectTo,
    },
  };
}

async function generateAuthActionLink(adminClient, payload) {
  const generateLink = adminClient?.auth?.admin?.generateLink;
  if (typeof generateLink !== 'function') {
    return {
      ok: false,
      code: 'auth_generate_link_unavailable',
      reason: 'Auth admin generateLink is unavailable.',
    };
  }

  const { data, error } = await generateLink.call(adminClient.auth.admin, payload);
  if (error) {
    return {
      ok: false,
      code: 'auth_generate_link_failed',
      reason: error.message || 'Failed to generate auth action link.',
      status: error.status,
    };
  }

  const actionLink = normalizeGeneratedAuthActionLink(
    data?.properties?.action_link || data?.action_link || data?.actionLink || ''
  );
  if (!actionLink) {
    return {
      ok: false,
      code: 'auth_generate_link_empty',
      reason: 'Auth admin returned no action link.',
    };
  }

  return {
    ok: true,
    actionLink,
    user: data?.user || null,
  };
}

function isAuthUserEmailConfirmed(user) {
  return Boolean(user?.email_confirmed_at || user?.confirmed_at);
}

async function cleanupUnconfirmedSignup(adminClient, user, { existingUser = null } = {}) {
  if (!user?.id || existingUser?.id || isAuthUserEmailConfirmed(user)) {
    return { skipped: true };
  }

  const deleteUser = adminClient?.auth?.admin?.deleteUser;
  if (typeof deleteUser !== 'function') {
    return { skipped: true, code: 'delete_user_unavailable' };
  }

  try {
    const { error } = await deleteUser.call(adminClient.auth.admin, user.id);
    if (error) {
      return { ok: false, code: 'delete_user_failed', reason: error.message || 'delete_user_failed' };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, code: 'delete_user_failed', reason: error?.message || 'delete_user_failed' };
  }
}

async function insertAuthMailDeliveryEvent(adminClient, {
  action,
  eventType,
  providerResult,
  recipient,
  now,
  payload = {},
}) {
  if (!adminClient?.from) {
    return { ok: false, error: 'admin_client_unavailable' };
  }

  const providerMessageIdHash = providerResult?.providerMessageId
    ? hashMailIdentifier(providerResult.providerMessageId, { prefix: 'provider_message_id' })
    : null;
  const { error } = await adminClient
    .from('mail_delivery_events')
    .insert({
      outbox_id: null,
      provider_key: providerResult?.providerKey || null,
      provider_message_id_hash: providerMessageIdHash,
      event_type: providerResult?.ok ? `${action}_accepted` : `${action}_failed`,
      event_payload_redacted_json: sanitizeMailPayload({
        eventType,
        code: providerResult?.code || 'auth_mail_result',
        reason: providerResult?.reason || '',
        dryRun: Boolean(providerResult?.dryRun),
        retryable: providerResult?.retryable !== false,
        recipientDomain: recipient?.domain || '',
        recipientRedacted: recipient?.redacted || '',
        ...payload,
      }),
      created_at: now.toISOString(),
    });

  return error ? { ok: false, error: error.message || 'mail_delivery_event_insert_failed' } : { ok: true };
}

async function sendAuthActionMail({
  adminClient,
  action,
  meta,
  email,
  actionLink,
  locale,
  env,
  now,
  controls,
}) {
  const adapter = createMailProviderAdapter({ env });
  const providerConfig = adapter.config || {};
  const rendered = renderMailTemplate({
    templateKey: meta.templateKey,
    locale,
    actionUrl: actionLink,
    generatedAt: now,
  });

  const providerResult = await adapter.send({
    from: {
      address: providerConfig.fromAddress,
      name: providerConfig.fromName,
    },
    to: email,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    templateKey: meta.templateKey,
    locale,
    eventType: meta.eventType,
    relatedEntityType: 'auth_action',
    relatedEntityId: action,
    payload: {
      action,
      controls: sanitizeMailPayload(controls || {}),
    },
  });
  const recipient = buildRecipientFingerprint(email);
  const deliveryEvent = await insertAuthMailDeliveryEvent(adminClient, {
    action,
    eventType: meta.eventType,
    providerResult,
    recipient,
    now,
  });

  return {
    providerResult,
    deliveryEvent,
  };
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

  const env = readEnvironment();
  const body = parseRequestBody(req);
  const action = String(body.action || '').trim().toLowerCase();
  const meta = ACTION_META[action];
  if (!meta) {
    return res.status(400).json({ success: false, error: 'Invalid auth email action' });
  }

  const normalizedEmail = String(body.email || '').trim().toLowerCase();
  const locale = resolveLocale(req, body);
  const requesterKey = getRequesterKey(req);
  const rateLimitResult = checkMemoryRateLimit(`auth-email:${action}:${requesterKey}`, meta.rateLimit);
  const captchaToken = body.captchaToken || body.captcha_token || body.turnstileToken || body.hcaptchaToken;
  const captchaProvider = body.captchaProvider || body.captcha_provider;
  const powPayload = body.powPayload || body.pow_payload;
  const captchaResult = await verifyAuthCaptcha({
    action: meta.captchaAction,
    token: captchaToken,
    provider: captchaProvider,
    powPayload,
    requesterIp: getRequesterIp(req),
    env,
  });
  const adminClient = getSupabaseAdminClient();
  const risk = evaluateAuthSecurityRisk({
    action: meta.captchaAction,
    req,
    email: normalizedEmail,
    rateLimitResult,
    captchaResult,
    env,
  });
  const persistAudit = (outcome, metadata = {}) => persistAuthSecurityEvent(adminClient, {
    eventType: 'auth_email_action',
    action: meta.captchaAction,
    outcome,
    risk,
    captcha: captchaResult,
    rateLimit: rateLimitResult,
    metadata: {
      authEmailAction: action,
      ...metadata,
    },
  });

  if (!rateLimitResult.allowed) {
    await persistAudit('rate_limited');
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      retry_after: rateLimitResult.retryAfter,
    });
  }

  if (!captchaResult.ok) {
    await persistAudit('captcha_blocked');
    return res.status(403).json({
      success: false,
      error: 'Captcha verification required',
      code: captchaResult.code || 'captcha_required',
    });
  }

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    await persistAudit('invalid_request', { reason: 'invalid_email' });
    return res.status(400).json({ success: false, error: 'Invalid email' });
  }

  if (!adminClient) {
    return action === ACTIONS.REGISTER_CONFIRMATION
      ? res.status(503).json({ success: false, error: 'Auth admin not configured' })
      : sendGenericResponse(res, {
        status: 'mail_unavailable',
        nextStep: 'manual_recovery_available',
      });
  }

  const runtimeState = await safeLoadMailRuntimeState(adminClient, env);

  if (!isAuthMailEnabled(env, runtimeState)) {
    await persistAudit('mail_disabled');
    return action === ACTIONS.REGISTER_CONFIRMATION
      ? res.status(503).json({
        success: false,
        error: 'Auth mail actions are disabled',
        code: 'auth_mail_disabled',
      })
      : sendGenericResponse(res, {
        status: 'mail_unavailable',
        nextStep: 'manual_recovery_available',
      });
  }

  if (isAuthMailPaused(env, runtimeState)) {
    await persistAudit('mail_paused');
    return action === ACTIONS.REGISTER_CONFIRMATION
      ? res.status(503).json({
        success: false,
        error: 'Auth mail actions are paused',
        code: 'mail_kill_switch_enabled',
      })
      : sendGenericResponse(res, { status: 'mail_paused' });
  }

  try {
    let existingUser = await findAuthUserByEmail(adminClient, normalizedEmail);
    if (action === ACTIONS.REGISTER_CONFIRMATION && isAuthUserEmailConfirmed(existingUser)) {
      await persistAudit('register_existing_email');
      return res.status(409).json({
        success: false,
        error: 'Email already registered',
        code: 'email_already_registered',
      });
    }

    if (action === ACTIONS.REGISTER_CONFIRMATION && existingUser && !isAuthUserEmailConfirmed(existingUser)) {
      const cleanupResult = await cleanupUnconfirmedSignup(adminClient, existingUser);
      await persistAudit(cleanupResult.ok ? 'register_pending_replaced' : 'register_pending_replace_failed', {
        cleanup: cleanupResult,
      });
      if (!cleanupResult.ok) {
        return res.status(409).json({
          success: false,
          error: 'Email confirmation is already pending',
          code: 'email_confirmation_pending',
        });
      }
      existingUser = null;
    }

    if (action !== ACTIONS.REGISTER_CONFIRMATION && !existingUser) {
      await persistAudit('received_unknown_email');
      return sendGenericResponse(res);
    }

    const password = normalizeString(body.password, 100);
    const username = normalizeString(body.username, 50);
    if (action === ACTIONS.REGISTER_CONFIRMATION && password.length < 8) {
      await persistAudit('invalid_request', { reason: 'password_too_short' });
      return res.status(400).json({ success: false, error: 'Invalid password' });
    }

    const linkResult = await generateAuthActionLink(adminClient, buildGenerateLinkPayload({
      action,
      email: normalizedEmail,
      password,
      username,
      redirectTo: getRedirectTo(action, env, req),
    }));

    if (!linkResult.ok) {
      await persistAudit('link_generation_failed', {
        code: linkResult.code,
      });
      if (action === ACTIONS.REGISTER_CONFIRMATION && linkResult.status === 422) {
        return res.status(409).json({
          success: false,
          error: existingUser
            ? 'Email confirmation is already pending'
            : 'Email already registered',
          code: existingUser ? 'email_confirmation_pending' : 'email_already_registered',
        });
      }

      return action === ACTIONS.REGISTER_CONFIRMATION
        ? res.status(500).json({ success: false, error: 'Unable to create account email' })
        : sendGenericResponse(res);
    }

    const now = new Date();
    const mailResult = await sendAuthActionMail({
      adminClient,
      action,
      meta,
      email: normalizedEmail,
      actionLink: linkResult.actionLink,
      locale,
      env,
      now,
      controls: buildMailRuntimeControls(runtimeState, 'authMailActions'),
    });
    const providerResult = mailResult.providerResult || {};

    if (!providerResult.ok) {
      const cleanupResult = action === ACTIONS.REGISTER_CONFIRMATION
        ? await cleanupUnconfirmedSignup(adminClient, linkResult.user, { existingUser })
        : { skipped: true };
      await persistAudit('mail_send_failed', {
        code: providerResult.code,
        cleanup: cleanupResult,
      });
      return action === ACTIONS.REGISTER_CONFIRMATION
        ? res.status(502).json({
          success: false,
          error: 'Unable to send verification email',
          code: providerResult.code || 'mail_send_failed',
        })
        : sendGenericResponse(res, { status: 'mail_failed_or_unavailable' });
    }

    if (action === ACTIONS.REGISTER_CONFIRMATION && (linkResult.user || existingUser)) {
      await ensureProfileForAuthUser(adminClient, linkResult.user || existingUser);
    }

    await persistAudit('mail_sent', {
      dryRun: Boolean(providerResult.dryRun),
      providerKey: providerResult.providerKey,
    });
    return sendGenericResponse(res, {
      status: providerResult.dryRun ? 'dry_run' : 'sent',
      nextStep: action === ACTIONS.REGISTER_CONFIRMATION
        ? 'verify_email'
        : action === ACTIONS.EMAIL_LOGIN
          ? 'open_login_link'
          : 'open_reset_link',
    });
  } catch (error) {
    await persistAudit('exception', {
      message: error?.message || 'auth_email_action_failed',
    });
    return action === ACTIONS.REGISTER_CONFIRMATION
      ? res.status(500).json({ success: false, error: error?.message || 'Auth email action failed' })
      : sendGenericResponse(res);
  }
}

export const __internal = {
  ACTIONS,
  ACTION_META,
  buildGenerateLinkPayload,
  cleanupUnconfirmedSignup,
  generateAuthActionLink,
  isAuthUserEmailConfirmed,
  isAuthMailEnabled,
  isAuthMailPaused,
};
