import {
  ACCOUNT_RECOVERY_DELIVERY_CHANNELS,
  ACCOUNT_RECOVERY_NEXT_STEPS,
  appendRecoveryAuditEvent,
} from '../../src/utils/accountRecoveryFlow.js';
import { MAIL_EVENT_TYPES, hashMailIdentifier, sanitizeMailPayload } from './mailAbuseGuards.js';
import { normalizeGeneratedAuthActionLink } from './authActionLinks.js';
import { getSupabaseAdminClient } from './authAdmin.js';
import { createMailProviderAdapter } from './mailProviderAdapter.js';
import { renderMailTemplate } from './mailTemplateRenderer.js';
import { loadMailRuntimeState } from './mailRuntimeConfig.js';
import { serverLogger } from './serverLogger.js';

const OUTBOX_FIELDS = [
  'id',
  'event_type',
  'recipient_email_hash',
  'recipient_domain',
  'template_key',
  'locale',
  'payload_redacted_json',
  'priority',
  'status',
  'attempt_count',
  'next_attempt_at',
  'provider_key',
  'provider_message_id_hash',
  'related_entity_type',
  'related_entity_id',
  'created_at',
  'updated_at',
].join(', ');

const RECOVERY_FIELDS = [
  'id',
  'email',
  'matched_user_id',
  'request_type',
  'status',
  'delivery_channel',
  'next_step',
  'recovery_audit',
  'created_at',
].join(', ');

const PROFILE_FIELDS = [
  'id',
  'email',
  'username',
  'role',
].join(', ');

const API_CLIENT_FIELDS = [
  'id',
  'owner_user_id',
  'client_type',
  'name',
  'use_case',
  'status',
  'review_note',
  'granted_scopes',
  'updated_at',
  'created_at',
].join(', ');

const TICKET_FIELDS = [
  'id',
  'user_id',
  'title',
  'status',
  'target_role',
  'updated_at',
  'created_at',
].join(', ');

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

function parseInteger(value, defaultValue, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(max, Math.max(min, parsed));
}

function toIsoTimestamp(value = new Date()) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function normalizeError(error, code = 'mail_worker_error') {
  return {
    code,
    message: String(error?.message || error || 'Mail worker error').slice(0, 300),
  };
}

function normalizeOutboxRow(row) {
  if (!row || typeof row !== 'object') {
    return null;
  }

  return {
    id: row.id,
    eventType: row.event_type || row.eventType,
    recipientEmailHash: row.recipient_email_hash || row.recipientEmailHash || '',
    recipientDomain: row.recipient_domain || row.recipientDomain || '',
    templateKey: row.template_key || row.templateKey || '',
    locale: row.locale || 'zh-CN',
    payloadRedacted: row.payload_redacted_json || row.payloadRedactedJson || {},
    priority: Number(row.priority || 5),
    status: row.status || '',
    attemptCount: Number(row.attempt_count ?? row.attemptCount ?? 0),
    nextAttemptAt: row.next_attempt_at || row.nextAttemptAt || null,
    providerKey: row.provider_key || row.providerKey || null,
    providerMessageIdHash: row.provider_message_id_hash || row.providerMessageIdHash || null,
    relatedEntityType: row.related_entity_type || row.relatedEntityType || '',
    relatedEntityId: row.related_entity_id || row.relatedEntityId || '',
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
    raw: row,
  };
}

function normalizeRecoveryRow(row) {
  if (!row || typeof row !== 'object') {
    return null;
  }

  return {
    id: row.id,
    email: String(row.email || '').trim().toLowerCase(),
    matchedUserId: row.matched_user_id || row.matchedUserId || null,
    requestType: row.request_type || row.requestType || '',
    status: row.status || '',
    deliveryChannel: row.delivery_channel || row.deliveryChannel || '',
    nextStep: row.next_step || row.nextStep || '',
    recoveryAudit: row.recovery_audit || row.recoveryAudit || {},
    createdAt: row.created_at || row.createdAt || null,
  };
}

function normalizeProfileRow(row) {
  if (!row || typeof row !== 'object') {
    return null;
  }

  return {
    id: row.id || '',
    email: String(row.email || '').trim().toLowerCase(),
    username: row.username || '',
    role: row.role || '',
  };
}

function normalizeApiClientRow(row) {
  if (!row || typeof row !== 'object') {
    return null;
  }

  return {
    id: row.id || '',
    ownerUserId: row.owner_user_id || row.ownerUserId || '',
    clientType: row.client_type || row.clientType || '',
    name: row.name || '',
    useCase: row.use_case || row.useCase || '',
    status: row.status || '',
    reviewNote: row.review_note || row.reviewNote || '',
    grantedScopes: row.granted_scopes || row.grantedScopes || [],
    updatedAt: row.updated_at || row.updatedAt || null,
    createdAt: row.created_at || row.createdAt || null,
  };
}

function normalizeTicketRow(row) {
  if (!row || typeof row !== 'object') {
    return null;
  }

  return {
    id: row.id || '',
    userId: row.user_id || row.userId || '',
    title: row.title || '',
    status: row.status || '',
    targetRole: row.target_role || row.targetRole || '',
    updatedAt: row.updated_at || row.updatedAt || null,
    createdAt: row.created_at || row.createdAt || null,
  };
}

export function getMailWorkerConfigFromEnv(env = readEnvironment()) {
  return {
    enabled: parseBoolean(env.MAIL_OUTBOX_WORKER_ENABLED || env.MAIL_WORKER_ENABLED, false),
    killSwitch: parseBoolean(env.MAIL_OUTBOX_GLOBAL_KILL_SWITCH, false),
    batchSize: parseInteger(env.MAIL_WORKER_BATCH_SIZE, 10, { min: 1, max: 50 }),
    maxAttempts: parseInteger(env.MAIL_WORKER_MAX_ATTEMPTS, 3, { min: 1, max: 10 }),
    retryDelaySeconds: parseInteger(env.MAIL_WORKER_RETRY_DELAY_SECONDS, 900, { min: 5, max: 86_400 }),
    appUrl: String(env.APP_URL || env.VITE_APP_URL || '').trim(),
    supabaseUrl: String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim(),
  };
}

function buildNextAttemptAt(now, retryDelaySeconds, attemptCount) {
  const date = now instanceof Date ? now : new Date(now);
  const baseMs = Number.isFinite(date.getTime()) ? date.getTime() : Date.now();
  const multiplier = Math.max(1, 2 ** Math.max(0, attemptCount - 1));
  return new Date(baseMs + retryDelaySeconds * multiplier * 1000).toISOString();
}

function buildActionLinkFallback(config = {}) {
  const baseUrl = String(config.appUrl || '').replace(/\/$/, '') || 'https://example.invalid';
  return `${baseUrl}/reset-password`;
}

function buildAppUrl(config = {}, path = '/') {
  const baseUrl = String(config.appUrl || '').replace(/\/$/, '') || 'https://ef-gacha.mogujun.icu';
  const normalizedPath = String(path || '/').startsWith('/') ? String(path || '/') : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

async function maybeSingle(query) {
  if (typeof query?.maybeSingle === 'function') {
    const { data, error } = await query.maybeSingle();
    if (error) {
      throw error;
    }
    return data || null;
  }

  if (typeof query?.single === 'function') {
    const { data, error } = await query.single();
    if (error) {
      throw error;
    }
    return data || null;
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data[0] || null : data || null;
}

async function loadDueOutboxRows(adminClient, {
  batchSize,
  now,
} = {}) {
  const { data, error } = await adminClient
    .from('mail_outbox')
    .select(OUTBOX_FIELDS)
    .eq('status', 'queued')
    .lte('next_attempt_at', toIsoTimestamp(now))
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (error) {
    throw error;
  }

  return (Array.isArray(data) ? data : []).map(normalizeOutboxRow).filter(Boolean);
}

async function claimOutboxRow(adminClient, row, {
  now,
} = {}) {
  const patch = {
    status: 'sending',
    attempt_count: row.attemptCount + 1,
    updated_at: toIsoTimestamp(now),
  };
  const query = adminClient
    .from('mail_outbox')
    .update(patch)
    .eq('id', row.id)
    .eq('status', 'queued')
    .select(OUTBOX_FIELDS);

  const claimed = await maybeSingle(query);
  return normalizeOutboxRow(claimed);
}

async function loadAccountRecoveryRequest(adminClient, row) {
  if (
    row.eventType !== MAIL_EVENT_TYPES.PASSWORD_RESET
    || row.relatedEntityType !== 'account_recovery'
    || !row.relatedEntityId
  ) {
    return null;
  }

  const query = adminClient
    .from('account_recovery_requests')
    .select(RECOVERY_FIELDS)
    .eq('id', row.relatedEntityId);

  return normalizeRecoveryRow(await maybeSingle(query));
}

async function loadProfileById(adminClient, userId) {
  if (!userId) {
    return null;
  }

  const query = adminClient
    .from('profiles')
    .select(PROFILE_FIELDS)
    .eq('id', userId);

  return normalizeProfileRow(await maybeSingle(query));
}

async function loadApiClientReviewContext(adminClient, row) {
  if (
    row.eventType !== MAIL_EVENT_TYPES.DEVELOPER_API_REVIEW
    || row.relatedEntityType !== 'api_client'
    || !row.relatedEntityId
  ) {
    return null;
  }

  const query = adminClient
    .from('api_clients')
    .select(API_CLIENT_FIELDS)
    .eq('id', row.relatedEntityId);
  const client = normalizeApiClientRow(await maybeSingle(query));
  const owner = await loadProfileById(adminClient, client?.ownerUserId);

  return client && owner ? { type: 'developer_api_review', client, owner } : null;
}

async function loadTicketReplyContext(adminClient, row) {
  if (
    row.eventType !== MAIL_EVENT_TYPES.TICKET_REPLY
    || row.relatedEntityType !== 'ticket'
    || !row.relatedEntityId
  ) {
    return null;
  }

  const query = adminClient
    .from('tickets')
    .select(TICKET_FIELDS)
    .eq('id', row.relatedEntityId);
  const ticket = normalizeTicketRow(await maybeSingle(query));
  const owner = await loadProfileById(adminClient, ticket?.userId);

  return ticket && owner ? { type: 'ticket_reply', ticket, owner } : null;
}

async function loadAdminAlertContext(adminClient, row) {
  if (
    row.eventType !== MAIL_EVENT_TYPES.ADMIN_ALERT
    || !['profile', 'admin_user'].includes(row.relatedEntityType)
    || !row.relatedEntityId
  ) {
    return null;
  }

  const profile = await loadProfileById(adminClient, row.relatedEntityId);
  return profile ? { type: 'admin_alert', profile } : null;
}

async function generatePasswordResetLink(adminClient, recovery, config, {
  dryRun = true,
} = {}) {
  if (dryRun) {
    return {
      ok: true,
      actionLink: buildActionLinkFallback(config),
      source: 'dry_run',
    };
  }

  const generateLink = adminClient?.auth?.admin?.generateLink;
  if (typeof generateLink !== 'function') {
    return {
      ok: false,
      code: 'auth_generate_link_unavailable',
      reason: 'Auth admin generateLink is unavailable.',
    };
  }

  const { data, error } = await generateLink.call(adminClient.auth.admin, {
    type: 'recovery',
    email: recovery.email,
    options: config.appUrl
      ? { redirectTo: `${String(config.appUrl).replace(/\/$/, '')}/reset-password` }
      : undefined,
  });

  if (error) {
    return {
      ok: false,
      code: 'auth_generate_link_failed',
      reason: error.message || 'Failed to generate reset link.',
    };
  }

  const actionLink = normalizeGeneratedAuthActionLink(
    data?.properties?.action_link || data?.action_link || data?.actionLink || '',
    envForAuthLinks(config)
  );
  if (!actionLink) {
    return {
      ok: false,
      code: 'auth_generate_link_empty',
      reason: 'Auth admin returned no reset link.',
    };
  }

  return {
    ok: true,
    actionLink,
    source: 'auth_admin_generate_link',
  };
}

function envForAuthLinks(config = {}) {
  return {
    ...readEnvironment(),
    APP_URL: config.appUrl || readEnvironment().APP_URL,
    SUPABASE_URL: config.supabaseUrl || readEnvironment().SUPABASE_URL,
  };
}

function buildNotificationOverrides(row, context, config) {
  const payload = row.payloadRedacted || {};
  if (context?.type === 'developer_api_review') {
    const status = context.client.status || payload.status || 'reviewed';
    const statusLabel = {
      active: '已通过',
      rejected: '已拒绝',
      revoked: '已撤销',
    }[status] || status;
    const reviewNote = context.client.reviewNote
      ? `\n\n审核备注：${context.client.reviewNote}`
      : '';
    return {
      actionUrl: buildAppUrl(config, '/developer-api'),
      overrides: {
        intro: `开发者 API 申请「${context.client.name || '未命名应用'}」的审核状态已更新为：${statusLabel}。请打开开发者 API 页面查看当前权限、审核备注和后续操作。${reviewNote}`,
        secondary: '邮件不会包含完整 API Key。若申请已通过，初始 Key 仍只会在站内审核结果中一次性展示。',
      },
    };
  }

  if (context?.type === 'ticket_reply') {
    return {
      actionUrl: buildAppUrl(config, '/tickets'),
      overrides: {
        intro: `工单「${context.ticket.title || '未命名工单'}」有新的回复，当前状态为：${context.ticket.status || 'unknown'}。请打开工单页查看完整对话。`,
      },
    };
  }

  if (context?.type === 'admin_alert') {
    return {
      actionUrl: buildAppUrl(config, '/admin'),
      overrides: {
        intro: String(payload.summary || payload.message || '有一条管理员告警需要处理。').slice(0, 300),
        secondary: String(payload.secondary || '此邮件仅用于提醒，请在后台查看脱敏诊断详情。').slice(0, 300),
      },
    };
  }

  return {
    actionUrl: '',
    overrides: {},
  };
}

async function buildMailMessage(adminClient, row, config, providerConfig = {}) {
  let recipientEmail = '';
  let actionUrl = '';
  let overrides = {};
  let context = null;

  if (row.templateKey === 'auth.password-reset') {
    const recovery = await loadAccountRecoveryRequest(adminClient, row);
    const resetLinkResult = await generatePasswordResetLink(adminClient, recovery, config, {
      dryRun: providerConfig?.dryRun !== false,
    });
    context = { type: 'account_recovery', recovery };

    if (!recovery?.email) {
      return {
        ok: false,
        code: 'mail_worker_recipient_unresolved',
        reason: 'Mail worker could not resolve a recipient for this outbox item.',
        context,
      };
    }

    if (!resetLinkResult?.ok) {
      return {
        ok: false,
        code: resetLinkResult?.code || 'mail_worker_reset_link_unavailable',
        reason: resetLinkResult?.reason || 'Password reset link is unavailable.',
        context,
      };
    }

    recipientEmail = recovery.email;
    actionUrl = resetLinkResult.actionLink;
  } else if (row.templateKey === 'developer-api.review') {
    context = await loadApiClientReviewContext(adminClient, row);
    recipientEmail = context?.owner?.email || '';
    ({ actionUrl, overrides } = buildNotificationOverrides(row, context, config));
  } else if (row.templateKey === 'ticket.reply') {
    context = await loadTicketReplyContext(adminClient, row);
    recipientEmail = context?.owner?.email || '';
    ({ actionUrl, overrides } = buildNotificationOverrides(row, context, config));
  } else if (row.templateKey === 'admin.alert') {
    context = await loadAdminAlertContext(adminClient, row);
    recipientEmail = context?.profile?.email || '';
    ({ actionUrl, overrides } = buildNotificationOverrides(row, context, config));
  } else {
    return {
      ok: false,
      code: 'mail_worker_template_unsupported',
      reason: `Unsupported mail template: ${row.templateKey || 'unknown'}`,
      context,
    };
  }

  if (!recipientEmail) {
    return {
      ok: false,
      code: 'mail_worker_recipient_unresolved',
      reason: 'Mail worker could not resolve a recipient for this outbox item.',
      context,
    };
  }

  const locale = String(row.locale || 'zh-CN').toLowerCase();
  const rendered = renderMailTemplate({
    templateKey: row.templateKey,
    locale,
    actionUrl,
    generatedAt: new Date(),
    overrides,
  });

  return {
    ok: true,
    context,
    message: {
      from: {
        address: providerConfig.fromAddress,
        name: providerConfig.fromName,
      },
      to: recipientEmail,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      templateKey: row.templateKey,
      locale: row.locale,
      eventType: row.eventType,
      relatedEntityType: row.relatedEntityType,
      relatedEntityId: row.relatedEntityId,
      payload: sanitizeMailPayload(row.payloadRedacted || {}),
    },
  };
}

async function insertDeliveryEvent(adminClient, {
  row,
  providerResult,
  eventType,
  now,
  payload = {},
} = {}) {
  const event = {
    outbox_id: row.id,
    provider_key: providerResult?.providerKey || null,
    provider_message_id_hash: providerResult?.providerMessageId
      ? hashMailIdentifier(providerResult.providerMessageId, { prefix: 'provider_message_id' })
      : null,
    event_type: eventType,
    event_payload_redacted_json: sanitizeMailPayload({
      code: providerResult?.code || eventType,
      dryRun: Boolean(providerResult?.dryRun),
      retryable: providerResult?.retryable !== false,
      ...payload,
    }),
    created_at: toIsoTimestamp(now),
  };

  const { error } = await adminClient
    .from('mail_delivery_events')
    .insert(event);

  if (error) {
    throw error;
  }
}

async function updateAccountRecoveryForMailResult(adminClient, row, recovery, {
  success,
  terminalFailure,
  providerResult,
  now,
} = {}) {
  if (!recovery?.id) {
    return;
  }

  const nextStep = success
    ? ACCOUNT_RECOVERY_NEXT_STEPS.MAIL_RESET_SENT
    : (terminalFailure ? ACCOUNT_RECOVERY_NEXT_STEPS.MAIL_RESET_FAILED : ACCOUNT_RECOVERY_NEXT_STEPS.MAIL_RESET_QUEUED);
  const eventType = success
    ? 'mail_reset_sent'
    : (terminalFailure ? 'mail_reset_failed' : 'mail_reset_retry_scheduled');
  const nextAudit = appendRecoveryAuditEvent(recovery.recoveryAudit, {
    type: eventType,
    at: toIsoTimestamp(now),
    deliveryChannel: ACCOUNT_RECOVERY_DELIVERY_CHANNELS.MAIL_OUTBOX,
    nextStep,
    mail: {
      status: success ? 'sent' : (terminalFailure ? 'failed' : 'retry_scheduled'),
      code: providerResult?.code || eventType,
      providerKey: providerResult?.providerKey || null,
      dryRun: Boolean(providerResult?.dryRun),
    },
  });

  const { error } = await adminClient
    .from('account_recovery_requests')
    .update({
      delivery_channel: ACCOUNT_RECOVERY_DELIVERY_CHANNELS.MAIL_OUTBOX,
      next_step: nextStep,
      recovery_audit: nextAudit,
      updated_at: toIsoTimestamp(now),
    })
    .eq('id', recovery.id);

  if (error) {
    throw error;
  }
}

async function markOutboxDryRun(adminClient, row, providerResult, {
  now,
  config,
} = {}) {
  const { error } = await adminClient
    .from('mail_outbox')
    .update({
      status: 'queued',
      next_attempt_at: buildNextAttemptAt(now, config?.retryDelaySeconds || 900, row.attemptCount),
      last_error_code: null,
      last_error_redacted_json: sanitizeMailPayload({
        code: providerResult?.code || 'mail_provider_dry_run',
        reason: 'Dry-run verified the mail worker boundary without sending.',
        dryRun: true,
      }),
      provider_key: providerResult?.providerKey || null,
      updated_at: toIsoTimestamp(now),
    })
    .eq('id', row.id);

  if (error) {
    throw error;
  }
}

async function markOutboxSuccess(adminClient, row, providerResult, {
  now,
} = {}) {
  const providerMessageIdHash = providerResult?.providerMessageId
    ? hashMailIdentifier(providerResult.providerMessageId, { prefix: 'provider_message_id' })
    : null;

  const { error } = await adminClient
    .from('mail_outbox')
    .update({
      status: 'sent',
      last_error_code: null,
      last_error_redacted_json: {},
      provider_key: providerResult?.providerKey || null,
      provider_message_id_hash: providerMessageIdHash,
      updated_at: toIsoTimestamp(now),
    })
    .eq('id', row.id);

  if (error) {
    throw error;
  }
}

async function markOutboxFailure(adminClient, row, providerResult, {
  now,
  config,
} = {}) {
  const terminalFailure = row.attemptCount >= config.maxAttempts || providerResult?.retryable === false;
  const nextStatus = terminalFailure ? 'failed' : 'queued';
  const { error } = await adminClient
    .from('mail_outbox')
    .update({
      status: nextStatus,
      next_attempt_at: terminalFailure
        ? row.nextAttemptAt || toIsoTimestamp(now)
        : buildNextAttemptAt(now, config.retryDelaySeconds, row.attemptCount),
      last_error_code: providerResult?.code || 'mail_provider_failed',
      last_error_redacted_json: sanitizeMailPayload({
        code: providerResult?.code || 'mail_provider_failed',
        reason: providerResult?.reason || 'Mail provider failed.',
        retryable: providerResult?.retryable !== false,
        dryRun: Boolean(providerResult?.dryRun),
        diagnostics: providerResult?.diagnostics || {},
      }),
      provider_key: providerResult?.providerKey || null,
      updated_at: toIsoTimestamp(now),
    })
    .eq('id', row.id);

  if (error) {
    throw error;
  }

  return { terminalFailure, nextStatus };
}

async function processOutboxRow({
  adminClient,
  row,
  adapter,
  config,
  now,
} = {}) {
  const claimed = await claimOutboxRow(adminClient, row, { now });
  if (!claimed) {
    return {
      id: row.id,
      status: 'skipped',
      code: 'mail_outbox_claim_missed',
    };
  }

  let context = null;
  let providerResult = null;

  try {
    const rendered = await buildMailMessage(adminClient, claimed, config, adapter.config);
    context = rendered.context || null;

    if (!rendered.ok) {
      providerResult = {
        ok: false,
        accepted: false,
        retryable: false,
        providerKey: adapter.config?.providerKey || adapter.config?.provider || 'mail',
        providerMessageId: '',
        code: rendered.code,
        reason: rendered.reason,
        dryRun: Boolean(adapter.config?.dryRun),
        diagnostics: {},
      };
    } else {
      providerResult = await adapter.send(rendered.message);
    }

    if (providerResult?.ok && providerResult?.dryRun) {
      await markOutboxDryRun(adminClient, claimed, providerResult, { now, config });
      await insertDeliveryEvent(adminClient, {
        row: claimed,
        providerResult,
        eventType: 'dry_run_accepted',
        now,
      });

      return {
        id: claimed.id,
        status: 'dry_run',
        code: providerResult.code,
        dryRun: true,
      };
    }

    if (providerResult?.ok) {
      await markOutboxSuccess(adminClient, claimed, providerResult, { now });
      await insertDeliveryEvent(adminClient, {
        row: claimed,
        providerResult,
        eventType: 'accepted',
        now,
      });
      if (context?.type === 'account_recovery') {
        await updateAccountRecoveryForMailResult(adminClient, claimed, context.recovery, {
          success: true,
          terminalFailure: false,
          providerResult,
          now,
        });
      }

      return {
        id: claimed.id,
        status: 'sent',
        code: providerResult.code,
        dryRun: Boolean(providerResult.dryRun),
      };
    }

    const failure = await markOutboxFailure(adminClient, claimed, providerResult, {
      now,
      config,
    });
    await insertDeliveryEvent(adminClient, {
      row: claimed,
      providerResult,
      eventType: failure.terminalFailure ? 'failed' : 'retry_scheduled',
      now,
      payload: {
        terminalFailure: failure.terminalFailure,
        nextStatus: failure.nextStatus,
      },
    });
    if (context?.type === 'account_recovery') {
      await updateAccountRecoveryForMailResult(adminClient, claimed, context.recovery, {
        success: false,
        terminalFailure: failure.terminalFailure,
        providerResult,
        now,
      });
    }

    return {
      id: claimed.id,
      status: failure.nextStatus,
      code: providerResult?.code || 'mail_provider_failed',
      terminalFailure: failure.terminalFailure,
    };
  } catch (error) {
    const normalizedError = normalizeError(error, 'mail_worker_exception');
    providerResult = {
      ok: false,
      accepted: false,
      retryable: true,
      providerKey: adapter.config?.providerKey || adapter.config?.provider || 'mail',
      providerMessageId: '',
      code: normalizedError.code,
      reason: normalizedError.message,
      dryRun: Boolean(adapter.config?.dryRun),
      diagnostics: normalizedError,
    };
    const failure = await markOutboxFailure(adminClient, claimed, providerResult, {
      now,
      config,
    });
    await insertDeliveryEvent(adminClient, {
      row: claimed,
      providerResult,
      eventType: failure.terminalFailure ? 'failed' : 'retry_scheduled',
      now,
      payload: {
        terminalFailure: failure.terminalFailure,
        nextStatus: failure.nextStatus,
      },
    });

    if (context?.type === 'account_recovery') {
      await updateAccountRecoveryForMailResult(adminClient, claimed, context.recovery, {
        success: false,
        terminalFailure: failure.terminalFailure,
        providerResult,
        now,
      });
    }

    return {
      id: claimed.id,
      status: failure.nextStatus,
      code: normalizedError.code,
      terminalFailure: failure.terminalFailure,
    };
  }
}

export async function runMailOutboxWorker({
  adminClient = getSupabaseAdminClient(),
  adapter = null,
  env = readEnvironment(),
  now = new Date(),
  logger = serverLogger,
} = {}) {
  const config = getMailWorkerConfigFromEnv(env);
  const providerAdapter = adapter || createMailProviderAdapter({ env });
  const startedAt = toIsoTimestamp(now);

  if (!config.enabled) {
    return {
      ok: true,
      skipped: true,
      code: 'mail_worker_disabled',
      startedAt,
      finishedAt: toIsoTimestamp(new Date()),
      stats: {
        loaded: 0,
        processed: 0,
        sent: 0,
        failed: 0,
        retried: 0,
        skipped: 0,
      },
      results: [],
    };
  }

  if (config.killSwitch) {
    return {
      ok: true,
      skipped: true,
      code: 'mail_worker_kill_switch_enabled',
      startedAt,
      finishedAt: toIsoTimestamp(new Date()),
      stats: {
        loaded: 0,
        processed: 0,
        sent: 0,
        failed: 0,
        retried: 0,
        skipped: 0,
      },
      results: [],
    };
  }

  if (!adminClient?.from) {
    return {
      ok: false,
      skipped: true,
      code: 'admin_client_unavailable',
      startedAt,
      finishedAt: toIsoTimestamp(new Date()),
      stats: {
        loaded: 0,
        processed: 0,
        sent: 0,
        failed: 0,
        retried: 0,
        skipped: 0,
      },
      results: [],
    };
  }

  let runtimeState = null;
  try {
    runtimeState = await loadMailRuntimeState(adminClient, env);
  } catch (error) {
    logger?.warn?.('mail-outbox.worker.runtime-config-load-failed', {
      code: 'mail_runtime_config_load_failed',
      message: String(error?.message || error || 'mail_runtime_config_load_failed').slice(0, 200),
    });
  }

  if (runtimeState?.controls?.killSwitch) {
    return {
      ok: true,
      skipped: true,
      code: 'mail_worker_runtime_kill_switch_enabled',
      startedAt,
      finishedAt: toIsoTimestamp(new Date()),
      stats: {
        loaded: 0,
        processed: 0,
        sent: 0,
        failed: 0,
        retried: 0,
        skipped: 0,
      },
      results: [],
    };
  }

  const rows = await loadDueOutboxRows(adminClient, {
    batchSize: config.batchSize,
    now,
  });
  const results = [];

  for (const row of rows) {
    const result = await processOutboxRow({
      adminClient,
      row,
      adapter: providerAdapter,
      config,
      now,
    });
    results.push(result);
  }

  const stats = {
    loaded: rows.length,
    processed: results.filter((result) => result.status !== 'skipped').length,
    sent: results.filter((result) => result.status === 'sent').length,
    dryRun: results.filter((result) => result.status === 'dry_run').length,
    failed: results.filter((result) => result.status === 'failed').length,
    retried: results.filter((result) => result.status === 'queued').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
  };

  logger?.info?.('mail-outbox.worker.finish', {
    providerKey: providerAdapter.config?.providerKey || providerAdapter.config?.provider || 'mail',
    dryRun: Boolean(providerAdapter.config?.dryRun),
    stats,
  });

  return {
    ok: stats.failed === 0,
    skipped: false,
    code: stats.failed === 0 ? 'mail_worker_completed' : 'mail_worker_partial_failure',
    providerKey: providerAdapter.config?.providerKey || providerAdapter.config?.provider || 'mail',
    dryRun: Boolean(providerAdapter.config?.dryRun),
    startedAt,
    finishedAt: toIsoTimestamp(new Date()),
    stats,
    results,
  };
}

export const __internal = {
  buildActionLinkFallback,
  buildNextAttemptAt,
  generatePasswordResetLink,
  loadDueOutboxRows,
  normalizeOutboxRow,
  normalizeRecoveryRow,
  buildMailMessage,
};
