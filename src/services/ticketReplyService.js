import { fetchJsonWithTimeout } from './supabaseRequest.js';
import { getSupabaseAccessToken } from './authFetchService.js';

export async function submitTicketReply({
  ticketId,
  content,
  locale = 'zh-CN',
  isInternal = false,
} = {}) {
  const accessToken = await getSupabaseAccessToken({
    syncSiteSession: false,
    useSiteSessionCache: true,
    allowSiteSessionToken: false,
  }).catch(() => null);
  const headers = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const { response, data: payload } = await fetchJsonWithTimeout('/api/tickets/reply', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({
      ticketId,
      content,
      locale,
      isInternal: Boolean(isInternal),
    }),
  }, {
    label: 'ticket-reply',
    timeoutMs: 30000,
  });

  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.error || '发送回复失败');
  }

  return payload;
}

export default {
  submitTicketReply,
};
