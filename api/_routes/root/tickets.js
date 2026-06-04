import { getSupabaseAdminClient } from '../../_lib/authAdmin.js';
import { rejectDisallowedBrowserOrigin } from '../../_lib/http.js';
import { resolveAuthenticatedRequestUser } from '../../_lib/siteAuth.js';

const MAX_TICKETS = 500;
const MAX_REPLY_ROWS = 1000;
const MAX_TICKET_IDS = 200;
const MAX_TITLE_LENGTH = 100;
const MAX_CONTENT_LENGTH = 2000;

const TICKET_SELECT_FIELDS = '*';
const REPLY_SELECT_FIELDS = 'id, ticket_id, user_id, content, is_internal, created_at';
const REPLY_SUMMARY_FIELDS = 'id, ticket_id, user_id, is_internal, created_at';

const VALID_TYPES = new Set(['bug', 'data', 'feature', 'account', 'question', 'other']);
const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
const VALID_TARGET_ROLES = new Set(['admin', 'super_admin']);
const VALID_STATUSES = new Set(['pending', 'processing', 'resolved', 'rejected', 'closed']);

function parseRequestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body && typeof req.body === 'object' ? req.body : {};
}

function getRequestUrl(req) {
  try {
    return new URL(req.url || '/', 'http://localhost');
  } catch {
    return new URL('/', 'http://localhost');
  }
}

function sendError(res, status, error, code = error) {
  return res.status(status).json({
    success: false,
    error,
    code,
  });
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

function isMissingTicketTableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42P01'
    || error?.code === 'PGRST200'
    || message.includes('does not exist')
    || message.includes('schema cache');
}

async function loadProfile(adminClient, userId) {
  if (!userId) return null;
  const query = adminClient
    .from('profiles')
    .select('id, email, username, role')
    .eq('id', userId);
  return maybeSingle(query);
}

function normalizeRole(profile, fallback = 'user') {
  return String(profile?.role || fallback || 'user').trim() || 'user';
}

function canManageTicket(ticket, profile) {
  const role = normalizeRole(profile);
  return role === 'super_admin' || (role === 'admin' && ticket?.target_role === 'admin');
}

function canReadTicket(ticket, profile) {
  return Boolean(ticket?.user_id && profile?.id && ticket.user_id === profile.id) || canManageTicket(ticket, profile);
}

function canReadInternalReplies(ticket, profile) {
  return canManageTicket(ticket, profile);
}

function filterVisibleTickets(tickets, profile) {
  const role = normalizeRole(profile);
  const userId = profile?.id || '';
  if (role === 'super_admin') {
    return tickets;
  }
  if (role === 'admin') {
    return tickets.filter((ticket) => ticket?.target_role === 'admin' || ticket?.user_id === userId);
  }
  return tickets.filter((ticket) => ticket?.user_id === userId);
}

function normalizeTicketIds(value) {
  const raw = Array.isArray(value)
    ? value
    : String(value || '').split(',');
  return [...new Set(raw
    .map((item) => String(item || '').trim())
    .filter(Boolean))]
    .slice(0, MAX_TICKET_IDS);
}

function normalizeCreatePayload(body, profile) {
  const title = String(body.title || '').trim().slice(0, MAX_TITLE_LENGTH);
  const content = String(body.content || '').trim().slice(0, MAX_CONTENT_LENGTH);
  if (!title) {
    return { ok: false, error: 'Missing ticket title', code: 'ticket_title_required' };
  }
  if (!content) {
    return { ok: false, error: 'Missing ticket content', code: 'ticket_content_required' };
  }

  const type = VALID_TYPES.has(String(body.type || '').trim()) ? String(body.type).trim() : 'question';
  const priority = VALID_PRIORITIES.has(String(body.priority || '').trim()) ? String(body.priority).trim() : 'medium';
  const requestedTargetRole = String(body.target_role || '').trim();
  let targetRole = VALID_TARGET_ROLES.has(requestedTargetRole) ? requestedTargetRole : 'admin';
  if (normalizeRole(profile) === 'user') {
    targetRole = 'admin';
  }

  return {
    ok: true,
    row: {
      type,
      title,
      content,
      priority,
      target_role: targetRole,
      status: 'pending',
      user_id: profile.id,
    },
  };
}

async function loadTicketById(adminClient, ticketId) {
  const query = adminClient
    .from('tickets')
    .select(TICKET_SELECT_FIELDS)
    .eq('id', ticketId);
  return maybeSingle(query);
}

async function handleListTickets(url, res, adminClient, profile) {
  const updatedAfter = String(url?.searchParams?.get('updatedAfter') || '').trim();
  const updatedAfterTime = updatedAfter ? new Date(updatedAfter).getTime() : 0;
  let query = adminClient
    .from('tickets')
    .select(TICKET_SELECT_FIELDS)
    .order('created_at', { ascending: false });

  if (normalizeRole(profile) === 'user') {
    query = query.eq('user_id', profile.id);
  }

  if (Number.isFinite(updatedAfterTime) && updatedAfterTime > 0) {
    query = query.gt('updated_at', new Date(updatedAfterTime).toISOString());
  }

  const { data, error } = await query.limit(MAX_TICKETS);

  if (error) {
    if (isMissingTicketTableError(error)) {
      return res.status(200).json({
        success: true,
        tableExists: false,
        tickets: [],
        meta: {
          count: 0,
          truncated: false,
        },
      });
    }
    throw error;
  }

  const filtered = filterVisibleTickets(Array.isArray(data) ? data : [], profile);
  return res.status(200).json({
    success: true,
    tableExists: true,
    tickets: filtered,
    meta: {
      count: filtered.length,
      truncated: Array.isArray(data) && data.length >= MAX_TICKETS,
    },
  });
}

async function handleCreateTicket(req, res, adminClient, profile) {
  const normalized = normalizeCreatePayload(parseRequestBody(req), profile);
  if (!normalized.ok) {
    return sendError(res, 400, normalized.error, normalized.code);
  }

  const { data, error } = await adminClient
    .from('tickets')
    .insert(normalized.row)
    .select(TICKET_SELECT_FIELDS)
    .single();

  if (error) throw error;

  return res.status(200).json({
    success: true,
    ticket: data || normalized.row,
  });
}

async function handleUpdateTicketStatus(req, res, adminClient, profile) {
  const body = parseRequestBody(req);
  const ticketId = String(body.ticketId || body.ticket_id || '').trim();
  const status = String(body.status || '').trim();
  if (!ticketId) {
    return sendError(res, 400, 'Missing ticketId', 'ticket_id_required');
  }
  if (!VALID_STATUSES.has(status)) {
    return sendError(res, 400, 'Unsupported ticket status', 'ticket_status_invalid');
  }

  const ticket = await loadTicketById(adminClient, ticketId);
  if (!ticket) {
    return sendError(res, 404, 'Ticket not found', 'ticket_not_found');
  }
  if (!canManageTicket(ticket, profile)) {
    return sendError(res, 403, 'Ticket update not allowed', 'ticket_update_forbidden');
  }

  const patch = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'resolved') {
    patch.resolved_by = profile.id;
  }

  const { data, error } = await adminClient
    .from('tickets')
    .update(patch)
    .eq('id', ticket.id)
    .select(TICKET_SELECT_FIELDS)
    .single();

  if (error) throw error;

  return res.status(200).json({
    success: true,
    ticket: data || {
      ...ticket,
      ...patch,
    },
  });
}

async function handleLoadReplies(url, res, adminClient, profile) {
  const ticketId = String(url.searchParams.get('ticketId') || url.searchParams.get('ticket_id') || '').trim();
  if (!ticketId) {
    return sendError(res, 400, 'Missing ticketId', 'ticket_id_required');
  }

  const ticket = await loadTicketById(adminClient, ticketId);
  if (!ticket) {
    return sendError(res, 404, 'Ticket not found', 'ticket_not_found');
  }
  if (!canReadTicket(ticket, profile)) {
    return sendError(res, 403, 'Ticket access denied', 'ticket_access_denied');
  }

  let query = adminClient
    .from('ticket_replies')
    .select(REPLY_SELECT_FIELDS)
    .eq('ticket_id', ticket.id);
  if (!canReadInternalReplies(ticket, profile)) {
    query = query.eq('is_internal', false);
  }
  const { data, error } = await query
    .order('created_at', { ascending: true })
    .limit(MAX_REPLY_ROWS);

  if (error) throw error;

  return res.status(200).json({
    success: true,
    replies: Array.isArray(data) ? data : [],
    meta: {
      count: Array.isArray(data) ? data.length : 0,
      truncated: Array.isArray(data) && data.length >= MAX_REPLY_ROWS,
    },
  });
}

async function handleLoadReplySummaries(url, res, adminClient, profile) {
  const ids = normalizeTicketIds(url.searchParams.get('ticketIds') || url.searchParams.get('ticket_ids'));
  if (ids.length === 0) {
    return res.status(200).json({
      success: true,
      replies: [],
      meta: {
        count: 0,
        allowedTicketCount: 0,
      },
    });
  }

  const { data: tickets, error: ticketError } = await adminClient
    .from('tickets')
    .select('id, user_id, target_role')
    .in('id', ids)
    .limit(MAX_TICKET_IDS);
  if (ticketError) throw ticketError;

  const allowedIds = filterVisibleTickets(Array.isArray(tickets) ? tickets : [], profile)
    .map((ticket) => ticket.id)
    .filter(Boolean);
  if (allowedIds.length === 0) {
    return res.status(200).json({
      success: true,
      replies: [],
      meta: {
        count: 0,
        allowedTicketCount: 0,
      },
    });
  }

  const { data, error } = await adminClient
    .from('ticket_replies')
    .select(REPLY_SUMMARY_FIELDS)
    .in('ticket_id', allowedIds)
    .order('created_at', { ascending: true })
    .limit(MAX_REPLY_ROWS);
  if (error) throw error;

  return res.status(200).json({
    success: true,
    replies: Array.isArray(data) ? data : [],
    meta: {
      count: Array.isArray(data) ? data.length : 0,
      allowedTicketCount: allowedIds.length,
      truncated: Array.isArray(data) && data.length >= MAX_REPLY_ROWS,
    },
  });
}

export default async function ticketsHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, {
    methods: 'GET, POST, PATCH, OPTIONS',
    headers: 'Content-Type, Authorization',
  })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PATCH');
    sendError(res, 405, 'Method not allowed', 'method_not_allowed');
    return;
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    sendError(res, 503, 'Auth service not configured', 'auth_service_not_configured');
    return;
  }

  const authResult = await resolveAuthenticatedRequestUser(req, {
    adminClient,
    touch: true,
  });
  if (!authResult.ok) {
    sendError(
      res,
      authResult.status || 401,
      authResult.error || 'Authentication required',
      authResult.code || 'authentication_required'
    );
    return;
  }

  try {
    const profile = authResult.profile || await loadProfile(adminClient, authResult.user.id) || {
      id: authResult.user.id,
      role: 'user',
    };

    if (req.method === 'POST') {
      await handleCreateTicket(req, res, adminClient, profile);
      return;
    }
    if (req.method === 'PATCH') {
      await handleUpdateTicketStatus(req, res, adminClient, profile);
      return;
    }

    const url = getRequestUrl(req);
    const mode = String(url.searchParams.get('mode') || '').trim();
    if (mode === 'replies') {
      await handleLoadReplies(url, res, adminClient, profile);
      return;
    }
    if (mode === 'reply-summaries') {
      await handleLoadReplySummaries(url, res, adminClient, profile);
      return;
    }
    await handleListTickets(url, res, adminClient, profile);
  } catch (error) {
    const code = req.method === 'GET'
      ? 'tickets_load_failed'
      : req.method === 'POST'
        ? 'ticket_create_failed'
        : 'ticket_update_failed';
    sendError(res, 500, error?.message || 'Failed to process tickets', code);
  }
}

export const __internal = {
  canManageTicket,
  canReadTicket,
  filterVisibleTickets,
  normalizeCreatePayload,
};
