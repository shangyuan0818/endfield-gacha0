export const ACCOUNT_RECOVERY_DELIVERY_CHANNELS = Object.freeze({
  MANUAL: 'manual',
  MAIL_OUTBOX: 'mail_outbox',
  DISABLED: 'disabled',
});

export const ACCOUNT_RECOVERY_NEXT_STEPS = Object.freeze({
  MANUAL_REVIEW_PENDING: 'manual_review_pending',
  TEMPORARY_PASSWORD_ISSUED_FORCE_CHANGE: 'temporary_password_issued_force_change',
  MAIL_RESET_QUEUED: 'mail_reset_queued',
  MAIL_RESET_SENT: 'mail_reset_sent',
  MAIL_RESET_FAILED: 'mail_reset_failed',
});

export const ACCOUNT_RECOVERY_AUDIT_VERSION = 1;
export const DEFAULT_TEMPORARY_PASSWORD_TTL_HOURS = 24;

function readEnvironment() {
  const env = globalThis.process?.env;
  if (env) {
    return env;
  }

  return {};
}

export function getTemporaryPasswordTtlHours(env = readEnvironment()) {
  const rawValue = env?.ACCOUNT_RECOVERY_TEMP_PASSWORD_TTL_HOURS;
  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_TEMPORARY_PASSWORD_TTL_HOURS;
  }

  return Math.min(parsed, 168);
}

export function getGenericAccountRecoveryResponse() {
  return {
    status: 'received',
    deliveryChannel: ACCOUNT_RECOVERY_DELIVERY_CHANNELS.MANUAL,
    nextStep: ACCOUNT_RECOVERY_NEXT_STEPS.MANUAL_REVIEW_PENDING,
    recoveryAvailable: true,
  };
}

export function createRecoveryAudit({
  now = new Date(),
  requestType = 'password_reset',
  source = 'account_recovery_request',
  authSecurity = null,
  deliveryChannel = ACCOUNT_RECOVERY_DELIVERY_CHANNELS.MANUAL,
  nextStep = ACCOUNT_RECOVERY_NEXT_STEPS.MANUAL_REVIEW_PENDING,
  mail = null,
} = {}) {
  const timestamp = now instanceof Date ? now.toISOString() : new Date(now).toISOString();

  return {
    version: ACCOUNT_RECOVERY_AUDIT_VERSION,
    source,
    mail: mail && typeof mail === 'object'
      ? mail
      : {
        status: 'not_configured',
        reason: 'provider_decision_pending',
      },
    authSecurity: authSecurity && typeof authSecurity === 'object' ? authSecurity : null,
    events: [
      {
        type: 'request_received',
        at: timestamp,
        requestType,
        deliveryChannel,
        nextStep,
      },
    ],
  };
}

export function summarizeRecoveryMailResult(result, {
  enabled = false,
  attempted = false,
} = {}) {
  if (!enabled) {
    return {
      status: 'not_configured',
      reason: 'mail_outbox_disabled',
    };
  }

  if (!attempted) {
    return {
      status: 'not_attempted',
      reason: 'request_not_eligible',
    };
  }

  const action = result?.action || 'unknown';
  const code = result?.code || 'unknown';
  const queued = Boolean(result?.queued);
  const deduped = Boolean(result?.deduped);

  if (queued || deduped) {
    return {
      status: queued ? 'queued' : 'deduped',
      action,
      code,
      outboxId: result?.outboxId || null,
    };
  }

  return {
    status: 'manual_fallback',
    action,
    code,
    reason: result?.reason || 'mail_enqueue_unavailable',
  };
}

function normalizeAudit(rawAudit) {
  if (rawAudit && typeof rawAudit === 'object' && !Array.isArray(rawAudit)) {
    return {
      version: rawAudit.version || ACCOUNT_RECOVERY_AUDIT_VERSION,
      ...rawAudit,
      events: Array.isArray(rawAudit.events) ? rawAudit.events : [],
    };
  }

  return {
    version: ACCOUNT_RECOVERY_AUDIT_VERSION,
    events: [],
  };
}

export function appendRecoveryAuditEvent(rawAudit, event) {
  const audit = normalizeAudit(rawAudit);
  const safeEvent = Object.fromEntries(
    Object.entries(event || {}).filter(([, value]) => value !== undefined)
  );

  return {
    ...audit,
    events: [
      ...audit.events,
      safeEvent,
    ].slice(-20),
  };
}

export function buildTemporaryPasswordIssueMetadata({
  actorUserId,
  requestId = null,
  reason = 'account_recovery_temporary_password',
  now = new Date(),
  env,
} = {}) {
  const issuedAtDate = now instanceof Date ? now : new Date(now);
  const ttlHours = getTemporaryPasswordTtlHours(env);
  const expiresAtDate = new Date(issuedAtDate.getTime() + ttlHours * 60 * 60 * 1000);
  const issuedAt = issuedAtDate.toISOString();
  const expiresAt = expiresAtDate.toISOString();

  return {
    issuedAt,
    expiresAt,
    ttlHours,
    forceChangeRequired: true,
    deliveryChannel: ACCOUNT_RECOVERY_DELIVERY_CHANNELS.MANUAL,
    nextStep: ACCOUNT_RECOVERY_NEXT_STEPS.TEMPORARY_PASSWORD_ISSUED_FORCE_CHANGE,
    securityState: {
      password_change_required: true,
      password_change_reason: reason,
      password_change_source: 'account_recovery',
      password_change_requested_at: issuedAt,
      password_change_expires_at: expiresAt,
      password_change_recovery_request_id: requestId,
      password_change_set_by: actorUserId || null,
      updated_at: issuedAt,
    },
    recoveryRequestPatch: {
      delivery_channel: ACCOUNT_RECOVERY_DELIVERY_CHANNELS.MANUAL,
      next_step: ACCOUNT_RECOVERY_NEXT_STEPS.TEMPORARY_PASSWORD_ISSUED_FORCE_CHANGE,
      temporary_password_set_at: issuedAt,
      temporary_password_set_by: actorUserId || null,
      temporary_password_expires_at: expiresAt,
      temporary_password_force_change: true,
    },
    auditEvent: {
      type: 'temporary_password_issued',
      at: issuedAt,
      actorUserId: actorUserId || null,
      requestId,
      expiresAt,
      ttlHours,
      forceChangeRequired: true,
      deliveryChannel: ACCOUNT_RECOVERY_DELIVERY_CHANNELS.MANUAL,
      nextStep: ACCOUNT_RECOVERY_NEXT_STEPS.TEMPORARY_PASSWORD_ISSUED_FORCE_CHANGE,
    },
  };
}

export function buildClearedPasswordChangeState(now = new Date()) {
  const timestamp = now instanceof Date ? now.toISOString() : new Date(now).toISOString();

  return {
    password_change_required: false,
    password_change_reason: null,
    password_change_source: null,
    password_change_requested_at: null,
    password_change_expires_at: null,
    password_change_recovery_request_id: null,
    password_change_set_by: null,
    updated_at: timestamp,
  };
}
