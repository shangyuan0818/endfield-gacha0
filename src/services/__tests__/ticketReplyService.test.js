import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseAccessToken } from '../authFetchService.js';
import { fetchJsonWithTimeout } from '../supabaseRequest.js';
import { submitTicketReply } from '../ticketReplyService.js';

vi.mock('../authFetchService.js', () => ({
  getSupabaseAccessToken: vi.fn(),
}));

vi.mock('../supabaseRequest.js', () => ({
  fetchJsonWithTimeout: vi.fn(),
}));

describe('ticketReplyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAccessToken.mockResolvedValue('access-token');
    fetchJsonWithTimeout.mockResolvedValue({
      response: { ok: true, status: 200 },
      data: {
        success: true,
        reply: {
          id: 'reply-1',
          ticket_id: 'ticket-1',
        },
      },
    });
  });

  it('submits ticket replies with a Supabase token when available', async () => {
    await expect(submitTicketReply({
      ticketId: 'ticket-1',
      content: '管理员已回复。',
      locale: 'zh-CN',
    })).resolves.toMatchObject({
      success: true,
      reply: {
        id: 'reply-1',
      },
    });

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/tickets/reply', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer access-token',
      },
      body: JSON.stringify({
        ticketId: 'ticket-1',
        content: '管理员已回复。',
        locale: 'zh-CN',
        isInternal: false,
      }),
    }, expect.objectContaining({
      label: 'ticket-reply',
      timeoutMs: 30000,
    }));
  });

  it('falls back to same-origin cookies when no Supabase token is available', async () => {
    getSupabaseAccessToken.mockResolvedValue(null);

    await submitTicketReply({
      ticketId: 'ticket-1',
      content: '补充一下复现步骤。',
    });

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/tickets/reply', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ticketId: 'ticket-1',
        content: '补充一下复现步骤。',
        locale: 'zh-CN',
        isInternal: false,
      }),
    }, expect.any(Object));
  });

  it('submits internal notes when requested by staff UI', async () => {
    await submitTicketReply({
      ticketId: 'ticket-1',
      content: '内部备注。',
      locale: 'zh-CN',
      isInternal: true,
    });

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/tickets/reply', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer access-token',
      },
      body: JSON.stringify({
        ticketId: 'ticket-1',
        content: '内部备注。',
        locale: 'zh-CN',
        isInternal: true,
      }),
    }, expect.objectContaining({
      label: 'ticket-reply',
      timeoutMs: 30000,
    }));
  });

  it('surfaces the server-side reply error message', async () => {
    fetchJsonWithTimeout.mockResolvedValue({
      response: { ok: false, status: 401 },
      data: {
        success: false,
        error: 'Missing access token',
      },
    });

    await expect(submitTicketReply({
      ticketId: 'ticket-1',
      content: '补充一下。',
    })).rejects.toThrow('Missing access token');
  });
});
