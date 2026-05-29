import { supabase } from '../supabaseClient.js';
import { fetchJsonWithTimeout } from './supabaseRequest.js';

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

export async function submitTicketReply({
  ticketId,
  content,
  locale = 'zh-CN',
} = {}) {
  const accessToken = await getAccessToken();
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
