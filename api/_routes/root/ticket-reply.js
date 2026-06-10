import {
  checkMemoryRateLimit,
  getRequesterKey,
  rejectDisallowedBrowserOrigin,
} from '../../_lib/http.js';
import {
  ensureProfileForAuthUser,
  getSupabaseAdminClient,
} from '../../_lib/authAdmin.js';
import { resolveAuthenticatedRequestUser } from '../../_lib/siteAuth.js';
import { getRequesterIp } from '../../_lib/authSecurityGuards.js';
import { MAIL_EVENT_TYPES } from '../../_lib/mailAbuseGuards.js';
import { enqueueMailOutboxEvent } from '../../_lib/mailOutbox.js';
import {
  buildMailRuntimeControls,
  isRuntimeEventEnabled,
  loadMailRuntimeState,
} from '../../_lib/mailRuntimeConfig.js';
import { serverLogger } from '../../_lib/serverLogger.js';

const REPLY_LIMIT = {
  windowMs: 5 * 60 * 1000,
  max: 20,
};

const MAX_REPLY_LENGTH = 2000;
const TICKET_FIELDS = 'id, user_id, title, status, target_role, updated_at, created_at';
const OWNER_REPLY_REOPEN_STATUSES = new Set(['resolved', 'rejected']);

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

async function maybeSingle(query) {
  if (typeof query?.maybeSingle === 'function') {
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data || null;
  }

  if (typeof query?.single === 'function') {
    const { data, error } = await query.single();
    if (error) throw error;
    return data || null;
  }

  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data || null;
}

function isTicketReplyMailEnabled(env = readEnvironment(), runtimeState = null) {
  if (runtimeState) {
    return isRuntimeEventEnabled(runtimeState, 'ticketReply');
  }

  return parseBoolean(env.TICKET_REPLY_MAIL_OUTBOX_ENABLED, false)
    && parseBoolean(env.MAIL_OUTBOX_WORKER_ENABLED || env.MAIL_WORKER_ENABLED, false);
}

async function safeLoadMailRuntimeState(adminClient) {
  try {
    return await loadMailRuntimeState(adminClient);
  } catch {
    return null;
  }
}

function summarizeMailNotification(result, {
  enabled,
  attempted,
  reason = '',
} = {}) {
  if (!enabled) {
    return {
      enabled: false,
      attempted: false,
      status: 'disabled',
      code: 'ticket_reply_mail_disabled',
    };
  }

  if (!attempted) {
    return {
      enabled: true,
      attempted: false,
      status: 'skipped',
      code: reason || 'ticket_reply_mail_not_applicable',
    };
  }

  if (result?.queued) {
    return {
      enabled: true,
      attempted: true,
      status: 'queued',
      code: result.code || 'mail_outbox_queued',
      outboxId: result.outboxId || null,
    };
  }

  if (result?.deduped) {
    return {
      enabled: true,
      attempted: true,
      status: 'deduped',
      code: result.code || 'mail_idempotency_hit',
      outboxId: result.outboxId || null,
    };
  }

  if (result?.action === 'block') {
    return {
      enabled: true,
      attempted: true,
      status: 'blocked',
      code: result.code || 'mail_blocked',
    };
  }

  return {
    enabled: true,
    attempted: true,
    status: 'error',
    code: result?.code || 'mail_enqueue_failed',
  };
}

function canReplyToTicket(ticket, profile) {
  const role = String(profile?.role || 'user');
  const isOwner = ticket?.user_id === profile?.id;
  const canManage = role === 'super_admin' || (role === 'admin' && ticket?.target_role === 'admin');
  return {
    isOwner,
    canManage,
    allowed: Boolean(isOwner || canManage),
  };
}

function resolveTicketStatusAfterReply(ticket, permission, { isInternal = false } = {}) {
  if (isInternal) {
    return ticket?.status || null;
  }

  if (permission?.canManage && !permission?.isOwner && ticket?.status === 'pending') {
    return 'processing';
  }

  if (permission?.isOwner && OWNER_REPLY_REOPEN_STATUSES.has(String(ticket?.status || '').trim())) {
    return 'pending';
  }

  return ticket?.status || null;
}

async function loadTicket(adminClient, ticketId) {
  const query = adminClient
    .from('tickets')
    .select(TICKET_FIELDS)
    .eq('id', ticketId);

  return maybeSingle(query);
}

async function loadProfile(adminClient, userId) {
  if (!userId) return null;
  const query = adminClient
    .from('profiles')
    .select('id, email, username, role')
    .eq('id', userId);

  return maybeSingle(query);
}

async function enqueueTicketReplyMail({
  req,
  adminClient,
  ticket,
  reply,
  actorProfile,
  permission,
  locale,
  nowIso,
  runtimeState,
} = {}) {
  const enabled = isTicketReplyMailEnabled(readEnvironment(), runtimeState);
  if (!enabled) {
    return summarizeMailNotification(null, { enabled, attempted: false });
  }

  if (!permission?.canManage || permission?.isOwner) {
    return summarizeMailNotification(null, {
      enabled,
      attempted: false,
      reason: 'ticket_reply_mail_only_for_staff_reply',
    });
  }

  let ownerProfile = null;
  try {
    ownerProfile = await loadProfile(adminClient, ticket?.user_id);
  } catch (error) {
    serverLogger.warn('ticket.reply-mail.owner-load-failed', {
      ticketId: ticket?.id || '',
      code: 'owner_profile_load_failed',
      message: String(error?.message || error || 'owner_profile_load_failed').slice(0, 200),
    });
    return summarizeMailNotification({ code: 'owner_profile_load_failed' }, {
      enabled,
      attempted: false,
      reason: 'owner_profile_load_failed',
    });
  }

  if (!ownerProfile?.email) {
    return summarizeMailNotification({ code: 'owner_email_unavailable' }, {
      enabled,
      attempted: false,
      reason: 'owner_email_unavailable',
    });
  }

  let mailResult;
  try {
    mailResult = await enqueueMailOutboxEvent({
      adminClient,
      eventType: MAIL_EVENT_TYPES.TICKET_REPLY,
      recipientEmail: ownerProfile.email,
      requesterIp: getRequesterIp(req),
      userId: actorProfile?.id || '',
      templateKey: 'ticket.reply',
      locale,
      relatedEntityType: 'ticket',
      relatedEntityId: ticket.id,
      purposeKey: reply?.id || nowIso,
      payload: {
        ticketStatus: ticket.status || null,
        targetRole: ticket.target_role || null,
        actorRole: actorProfile?.role || 'user',
        replyId: reply?.id || null,
        repliedAt: reply?.created_at || nowIso,
        titleLength: String(ticket.title || '').length,
      },
      priority: 5,
      controls: buildMailRuntimeControls(runtimeState, 'ticketReply'),
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

  const notification = summarizeMailNotification(mailResult, {
    enabled,
    attempted: true,
  });

  if (!['queued', 'deduped'].includes(notification.status)) {
    serverLogger.warn('ticket.reply-mail.not-queued', {
      ticketId: ticket?.id || '',
      mailStatus: notification.status,
      code: notification.code,
    });
  }

  return notification;
}

async function resolveTicketReplyUser(req, adminClient) {
  const authResult = await resolveAuthenticatedRequestUser(req, { adminClient });
  if (!authResult.ok) {
    return {
      ok: false,
      status: authResult.status || 401,
      error: authResult.error || 'Authentication required',
    };
  }

  return {
    ok: true,
    user: authResult.user,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, {
    methods: 'POST, OPTIONS',
    headers: 'Content-Type, Authorization',
  })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const requesterKey = getRequesterKey(req);
  const rateLimitResult = checkMemoryRateLimit(`ticket-reply:${requesterKey}`, REPLY_LIMIT);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      retry_after: rateLimitResult.retryAfter,
    });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return res.status(503).json({ success: false, error: 'Auth service not configured' });
  }

  const userResult = await resolveTicketReplyUser(req, adminClient);
  if (!userResult.ok) {
    return res.status(userResult.status || 401).json({
      success: false,
      error: userResult.error || 'Authentication required',
    });
  }
  const callerUser = userResult.user;

  const body = parseRequestBody(req);
  const ticketId = String(body.ticketId || body.ticket_id || '').trim();
  const content = String(body.content || '').trim();
  const locale = String(body.locale || body.lang || 'zh-CN').trim().slice(0, 16) || 'zh-CN';
  const isInternal = body.isInternal === true || body.is_internal === true;

  if (!ticketId) {
    return res.status(400).json({ success: false, error: 'Missing ticketId' });
  }

  if (!content || content.length > MAX_REPLY_LENGTH) {
    return res.status(400).json({
      success: false,
      error: `Reply content must be between 1 and ${MAX_REPLY_LENGTH} characters`,
    });
  }

  try {
    const runtimeState = await safeLoadMailRuntimeState(adminClient);
    const callerProfile = await loadProfile(adminClient, callerUser.id)
      || await ensureProfileForAuthUser(adminClient, callerUser);
    const ticket = await loadTicket(adminClient, ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    const permission = canReplyToTicket(ticket, callerProfile);
    if (!permission.allowed) {
      return res.status(403).json({ success: false, error: 'Ticket reply not allowed' });
    }

    if (isInternal && !permission.canManage) {
      return res.status(403).json({
        success: false,
        error: 'Internal note is only available to staff',
        code: 'ticket_internal_note_forbidden',
      });
    }

    if (ticket.status === 'closed' && !isInternal) {
      return res.status(400).json({ success: false, error: 'Ticket is closed' });
    }

    const nowIso = new Date().toISOString();
    const { data: reply, error: insertError } = await adminClient
      .from('ticket_replies')
      .insert({
        ticket_id: ticket.id,
        user_id: callerUser.id,
        content,
        is_internal: isInternal,
      })
      .select('id, ticket_id, is_internal, created_at')
      .single();

    if (insertError) {
      throw insertError;
    }

    const previousStatus = ticket.status || null;
    const nextStatus = resolveTicketStatusAfterReply(ticket, permission, { isInternal });
    let ticketUpdateError = null;
    if (!isInternal) {
      const ticketUpdatePatch = {
        updated_at: nowIso,
      };
      if (nextStatus && nextStatus !== previousStatus) {
        ticketUpdatePatch.status = nextStatus;
      }

      const updateResult = await adminClient
        .from('tickets')
        .update(ticketUpdatePatch)
        .eq('id', ticket.id);
      ticketUpdateError = updateResult?.error || null;
    }

    const effectiveStatus = ticketUpdateError ? previousStatus : nextStatus;
    const ticketForNotification = {
      ...ticket,
      status: effectiveStatus,
      updated_at: ticketUpdateError || isInternal ? ticket.updated_at : nowIso,
    };
    const mailNotification = isInternal
      ? summarizeMailNotification(null, {
        enabled: isTicketReplyMailEnabled(readEnvironment(), runtimeState),
        attempted: false,
        reason: 'ticket_internal_note_no_mail',
      })
      : await enqueueTicketReplyMail({
        req,
        adminClient,
        ticket: ticketForNotification,
        reply,
        actorProfile: callerProfile,
        permission,
        locale,
        nowIso,
        runtimeState,
      });

    return res.status(200).json({
      success: true,
      partial: Boolean(ticketUpdateError),
      reply: {
        id: reply?.id || null,
        ticket_id: reply?.ticket_id || ticket.id,
        is_internal: Boolean(reply?.is_internal || isInternal),
        created_at: reply?.created_at || nowIso,
      },
      ticket: {
        id: ticket.id,
        status: effectiveStatus,
        previousStatus,
        statusChanged: Boolean(!ticketUpdateError && nextStatus && nextStatus !== previousStatus),
      },
      warnings: ticketUpdateError
        ? [{ code: 'ticket_updated_at_failed' }]
        : [],
      mailNotification,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to submit ticket reply',
    });
  }
}

export const __internal = {
  canReplyToTicket,
  isTicketReplyMailEnabled,
  resolveTicketStatusAfterReply,
  summarizeMailNotification,
};
