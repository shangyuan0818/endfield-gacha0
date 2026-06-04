import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadTicketReplyWorkflowSummaries } from '../ticketWorkflowService.js';
import { loadPublicProfilesMap } from '../publicProfileService.js';
import { loadTicketReplyRowsForWorkflow } from '../ticketService.js';

vi.mock('../publicProfileService.js', () => ({
  loadPublicProfilesMap: vi.fn(),
}));

vi.mock('../ticketService.js', () => ({
  loadTicketReplyRowsForWorkflow: vi.fn(),
}));

describe('ticketWorkflowService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadPublicProfilesMap.mockResolvedValue(new Map([
      ['admin-1', { id: 'admin-1', role: 'admin', username: 'admin' }],
      ['user-1', { id: 'user-1', role: 'user', username: 'user' }],
    ]));
    loadTicketReplyRowsForWorkflow.mockResolvedValue([
        {
          id: 'reply-1',
          ticket_id: 'ticket-1',
          user_id: 'admin-1',
          created_at: '2026-06-01T00:00:00.000Z',
        },
        {
          id: 'reply-2',
          ticket_id: 'ticket-1',
          user_id: 'user-1',
          created_at: '2026-06-01T01:00:00.000Z',
        },
    ]);
  });

  it('loads reply summaries through the same-origin ticket service', async () => {
    const summaries = await loadTicketReplyWorkflowSummaries(['ticket-1', 'ticket-1']);

    expect(loadTicketReplyRowsForWorkflow).toHaveBeenCalledWith(['ticket-1']);
    expect(loadPublicProfilesMap).toHaveBeenCalledWith(['admin-1', 'user-1']);
    expect(summaries.get('ticket-1')).toMatchObject({
      replyCount: 2,
      lastReplyUserId: 'user-1',
      lastReplyRole: 'user',
      lastReplyIsStaff: false,
    });
  });

  it('skips database reads when there are no ticket ids', async () => {
    const summaries = await loadTicketReplyWorkflowSummaries([]);

    expect(summaries.size).toBe(0);
    expect(loadTicketReplyRowsForWorkflow).not.toHaveBeenCalled();
  });

  it('throws when the authenticated reply query fails', async () => {
    loadTicketReplyRowsForWorkflow.mockRejectedValue(new Error('permission denied'));

    await expect(loadTicketReplyWorkflowSummaries(['ticket-1'])).rejects.toThrow('permission denied');
  });
});
