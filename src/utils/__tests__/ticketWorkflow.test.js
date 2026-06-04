import { describe, expect, it } from 'vitest';

import {
  buildTicketReplySummaries,
  enrichTicketsWithWorkflow,
  filterTicketsByWorkflow,
  getTicketWorkflowCounts,
} from '../ticketWorkflow.js';

const profiles = new Map([
  ['owner-1', { id: 'owner-1', username: 'owner', role: 'user' }],
  ['admin-1', { id: 'admin-1', username: 'admin', role: 'admin' }],
]);

describe('ticketWorkflow', () => {
  it('marks pending or user-updated tickets as needing staff attention', () => {
    const summaries = buildTicketReplySummaries([
      {
        id: 'reply-1',
        ticket_id: 'ticket-processing',
        user_id: 'admin-1',
        created_at: '2026-06-01T00:00:00.000Z',
      },
      {
        id: 'reply-2',
        ticket_id: 'ticket-processing',
        user_id: 'owner-1',
        created_at: '2026-06-01T01:00:00.000Z',
      },
    ], profiles);

    const tickets = enrichTicketsWithWorkflow([
      {
        id: 'ticket-pending',
        user_id: 'owner-1',
        status: 'pending',
        target_role: 'admin',
      },
      {
        id: 'ticket-processing',
        user_id: 'owner-1',
        status: 'processing',
        target_role: 'admin',
      },
    ], {
      currentUserId: 'admin-1',
      currentUserRole: 'admin',
      replySummaries: summaries,
    });

    expect(tickets.map((ticket) => ticket.workflow.queueState)).toEqual([
      'needs_staff',
      'needs_staff',
    ]);
    expect(getTicketWorkflowCounts(tickets, 'admin-1')).toMatchObject({
      needsStaff: 2,
      waitingUser: 0,
    });
  });

  it('marks staff-replied active tickets as waiting for the user', () => {
    const summaries = buildTicketReplySummaries([
      {
        id: 'reply-1',
        ticket_id: 'ticket-1',
        user_id: 'admin-1',
        created_at: '2026-06-01T01:00:00.000Z',
      },
    ], profiles);

    const [ticket] = enrichTicketsWithWorkflow([
      {
        id: 'ticket-1',
        user_id: 'owner-1',
        status: 'processing',
        target_role: 'admin',
      },
    ], {
      currentUserId: 'admin-1',
      currentUserRole: 'admin',
      replySummaries: summaries,
    });

    expect(ticket.workflow).toMatchObject({
      queueState: 'waiting_user',
      needsStaffAttention: false,
      waitingForUser: true,
      lastReplyRole: 'admin',
      lastReplyIsStaff: true,
    });
  });

  it('ignores internal notes when deciding the visible last reply', () => {
    const summaries = buildTicketReplySummaries([
      {
        id: 'reply-1',
        ticket_id: 'ticket-1',
        user_id: 'owner-1',
        created_at: '2026-06-01T01:00:00.000Z',
      },
      {
        id: 'internal-1',
        ticket_id: 'ticket-1',
        user_id: 'admin-1',
        is_internal: true,
        created_at: '2026-06-01T02:00:00.000Z',
      },
    ], profiles);

    const [ticket] = enrichTicketsWithWorkflow([
      {
        id: 'ticket-1',
        user_id: 'owner-1',
        status: 'processing',
        target_role: 'admin',
      },
    ], {
      currentUserId: 'admin-1',
      currentUserRole: 'admin',
      replySummaries: summaries,
    });

    expect(ticket.workflow).toMatchObject({
      queueState: 'needs_staff',
      lastReplyUserId: 'owner-1',
      lastReplyIsStaff: false,
    });
  });

  it('filters admin queue states without affecting regular views', () => {
    const rows = [
      { id: 'a', user_id: 'owner-1', workflow: { needsStaffAttention: true } },
      { id: 'b', user_id: 'owner-2', workflow: { waitingForUser: true } },
    ];

    expect(filterTicketsByWorkflow(rows, 'needs_staff', 'admin-1').map((ticket) => ticket.id)).toEqual(['a']);
    expect(filterTicketsByWorkflow(rows, 'waiting_user', 'admin-1').map((ticket) => ticket.id)).toEqual(['b']);
    expect(filterTicketsByWorkflow(rows, 'my', 'owner-1').map((ticket) => ticket.id)).toEqual(['a']);
  });
});
