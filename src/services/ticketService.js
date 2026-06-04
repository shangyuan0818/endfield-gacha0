import { getSupabaseAccessToken } from './authFetchService.js';
import { fetchJsonWithTimeout } from './supabaseRequest.js';

async function buildTicketHeaders({ json = false } = {}) {
  const accessToken = await getSupabaseAccessToken({
    syncSiteSession: false,
    useSiteSessionCache: true,
    allowSiteSessionToken: false,
  }).catch(() => null);

  const headers = {
    Accept: 'application/json',
  };
  if (json) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

function createTicketServiceError(data, response, fallbackMessage, fallbackCode) {
  const error = new Error(data?.error || `${fallbackMessage} (${response.status})`);
  error.code = data?.code || fallbackCode;
  error.status = response.status;
  throw error;
}

async function requestTicketJson(path, init = {}, {
  label,
  fallbackMessage,
  fallbackCode,
  retries = 0,
} = {}) {
  const { response, data } = await fetchJsonWithTimeout(path, init, {
    label,
    timeoutMs: 30000,
    retries,
  });

  if (!response.ok || data?.success === false) {
    createTicketServiceError(data, response, fallbackMessage, fallbackCode);
  }

  return data || {};
}

export async function loadTickets({ updatedAfter = '' } = {}) {
  const headers = await buildTicketHeaders();
  const params = new URLSearchParams();
  if (updatedAfter) {
    params.set('updatedAfter', updatedAfter);
  }
  const path = `/api/tickets${params.toString() ? `?${params.toString()}` : ''}`;
  const data = await requestTicketJson(path, {
    method: 'GET',
    credentials: 'same-origin',
    headers,
  }, {
    label: 'tickets-load',
    fallbackMessage: '工单读取失败',
    fallbackCode: 'tickets_load_failed',
    retries: 1,
  });

  return {
    tableExists: data.tableExists !== false,
    tickets: Array.isArray(data.tickets) ? data.tickets : [],
    meta: data.meta || null,
  };
}

export async function createTicket(formData = {}) {
  const headers = await buildTicketHeaders({ json: true });
  const data = await requestTicketJson('/api/tickets', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify(formData),
  }, {
    label: 'ticket-create',
    fallbackMessage: '工单提交失败',
    fallbackCode: 'ticket_create_failed',
  });

  return {
    ticket: data.ticket || null,
  };
}

export async function updateTicketStatus(ticketId, status) {
  const headers = await buildTicketHeaders({ json: true });
  const data = await requestTicketJson('/api/tickets', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({
      ticketId,
      status,
    }),
  }, {
    label: 'ticket-status-update',
    fallbackMessage: '工单状态更新失败',
    fallbackCode: 'ticket_update_failed',
  });

  return {
    ticket: data.ticket || null,
  };
}

export async function loadTicketReplies(ticketId) {
  const headers = await buildTicketHeaders();
  const params = new URLSearchParams({
    mode: 'replies',
    ticketId: String(ticketId || ''),
  });
  const data = await requestTicketJson(`/api/tickets?${params.toString()}`, {
    method: 'GET',
    credentials: 'same-origin',
    headers,
  }, {
    label: 'ticket-replies-load',
    fallbackMessage: '工单回复读取失败',
    fallbackCode: 'ticket_replies_load_failed',
    retries: 1,
  });

  return {
    replies: Array.isArray(data.replies) ? data.replies : [],
    meta: data.meta || null,
  };
}

export async function loadTicketReplyRowsForWorkflow(ticketIds = []) {
  const ids = [...new Set((Array.isArray(ticketIds) ? ticketIds : []).filter(Boolean))];
  if (ids.length === 0) {
    return [];
  }

  const headers = await buildTicketHeaders();
  const params = new URLSearchParams({
    mode: 'reply-summaries',
    ticketIds: ids.join(','),
  });
  const data = await requestTicketJson(`/api/tickets?${params.toString()}`, {
    method: 'GET',
    credentials: 'same-origin',
    headers,
  }, {
    label: 'ticket-reply-summaries-load',
    fallbackMessage: '工单回复摘要读取失败',
    fallbackCode: 'ticket_reply_summaries_load_failed',
    retries: 1,
  });

  return Array.isArray(data.replies) ? data.replies : [];
}

export default {
  createTicket,
  loadTicketReplies,
  loadTicketReplyRowsForWorkflow,
  loadTickets,
  updateTicketStatus,
};
