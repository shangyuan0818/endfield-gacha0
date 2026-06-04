import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createTicket,
  loadTicketReplies,
  loadTicketReplyRowsForWorkflow,
  loadTickets,
  updateTicketStatus,
} from '../ticketService.js';
import { getSupabaseAccessToken } from '../authFetchService.js';
import { fetchJsonWithTimeout } from '../supabaseRequest.js';

vi.mock('../authFetchService.js', () => ({
  getSupabaseAccessToken: vi.fn(),
}));

vi.mock('../supabaseRequest.js', () => ({
  fetchJsonWithTimeout: vi.fn(),
}));

describe('ticketService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAccessToken.mockResolvedValue(null);
    fetchJsonWithTimeout.mockResolvedValue({
      response: {
        ok: true,
        status: 200,
      },
      data: {
        success: true,
        tableExists: true,
        tickets: [
          {
            id: 'ticket-1',
            user_id: 'user-1',
          },
        ],
        meta: {
          count: 1,
        },
      },
    });
  });

  it('loads tickets with same-origin cookies when no native token is available', async () => {
    await expect(loadTickets()).resolves.toEqual({
      tableExists: true,
      tickets: [
        {
          id: 'ticket-1',
          user_id: 'user-1',
        },
      ],
      meta: {
        count: 1,
      },
    });

    expect(getSupabaseAccessToken).toHaveBeenCalledWith({
      syncSiteSession: false,
      useSiteSessionCache: true,
      allowSiteSessionToken: false,
    });
    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/tickets', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    }, expect.objectContaining({
      label: 'tickets-load',
    }));
  });

  it('uses a native Supabase token when one is available', async () => {
    getSupabaseAccessToken.mockResolvedValue('native-token');

    await loadTickets();

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/tickets', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer native-token',
      },
    }, expect.any(Object));
  });

  it('passes updatedAfter when loading tickets for unread badges', async () => {
    await loadTickets({ updatedAfter: '2026-06-01T01:30:00.000Z' });

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/tickets?updatedAfter=2026-06-01T01%3A30%3A00.000Z', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    }, expect.objectContaining({
      label: 'tickets-load',
    }));
  });

  it('creates tickets through the same-origin endpoint', async () => {
    fetchJsonWithTimeout.mockResolvedValue({
      response: {
        ok: true,
        status: 200,
      },
      data: {
        success: true,
        ticket: {
          id: 'ticket-created',
        },
      },
    });

    await expect(createTicket({
      title: '导入失败',
      content: '无法保存',
    })).resolves.toEqual({
      ticket: {
        id: 'ticket-created',
      },
    });

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/tickets', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: '导入失败',
        content: '无法保存',
      }),
    }, expect.objectContaining({
      label: 'ticket-create',
    }));
  });

  it('updates ticket status through the same-origin endpoint', async () => {
    fetchJsonWithTimeout.mockResolvedValue({
      response: {
        ok: true,
        status: 200,
      },
      data: {
        success: true,
        ticket: {
          id: 'ticket-1',
          status: 'resolved',
        },
      },
    });

    await expect(updateTicketStatus('ticket-1', 'resolved')).resolves.toEqual({
      ticket: {
        id: 'ticket-1',
        status: 'resolved',
      },
    });

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/tickets', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ticketId: 'ticket-1',
        status: 'resolved',
      }),
    }, expect.objectContaining({
      label: 'ticket-status-update',
    }));
  });

  it('loads ticket replies through the same-origin endpoint', async () => {
    fetchJsonWithTimeout.mockResolvedValue({
      response: {
        ok: true,
        status: 200,
      },
      data: {
        success: true,
        replies: [
          {
            id: 'reply-1',
          },
        ],
        meta: {
          count: 1,
        },
      },
    });

    await expect(loadTicketReplies('ticket-1')).resolves.toEqual({
      replies: [
        {
          id: 'reply-1',
        },
      ],
      meta: {
        count: 1,
      },
    });

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/tickets?mode=replies&ticketId=ticket-1', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    }, expect.objectContaining({
      label: 'ticket-replies-load',
    }));
  });

  it('loads reply rows for workflow summaries', async () => {
    fetchJsonWithTimeout.mockResolvedValue({
      response: {
        ok: true,
        status: 200,
      },
      data: {
        success: true,
        replies: [
          {
            id: 'reply-1',
            ticket_id: 'ticket-1',
          },
        ],
      },
    });

    await expect(loadTicketReplyRowsForWorkflow(['ticket-1', 'ticket-1'])).resolves.toEqual([
      {
        id: 'reply-1',
        ticket_id: 'ticket-1',
      },
    ]);

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/tickets?mode=reply-summaries&ticketIds=ticket-1', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    }, expect.objectContaining({
      label: 'ticket-reply-summaries-load',
    }));
  });

  it('surfaces server-side errors with code and status', async () => {
    fetchJsonWithTimeout.mockResolvedValue({
      response: {
        ok: false,
        status: 403,
      },
      data: {
        success: false,
        error: 'Ticket update not allowed',
        code: 'ticket_update_forbidden',
      },
    });

    await expect(updateTicketStatus('ticket-1', 'resolved')).rejects.toMatchObject({
      message: 'Ticket update not allowed',
      code: 'ticket_update_forbidden',
      status: 403,
    });
  });
});
