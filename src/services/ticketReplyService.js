import { fetchJsonWithTimeout } from './supabaseRequest.js';
import { getSupabaseAccessToken } from './authFetchService.js';

export async function submitTicketReply({
  ticketId,
  content,
  locale = 'zh-CN',
} = {}) {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error('当前登录已失效，请重新登录后重试');
  }

  const { response, data: payload } = await fetchJsonWithTimeout('/api/tickets/reply', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ticketId,
      content,
      locale,
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
