const STAFF_ROLES = new Set(['admin', 'super_admin']);
const ACTIVE_TICKET_STATUSES = new Set(['pending', 'processing']);

function isStaffRole(role) {
  return STAFF_ROLES.has(String(role || '').trim());
}

function isActiveTicketStatus(status) {
  return ACTIVE_TICKET_STATUSES.has(String(status || '').trim());
}

function getProfileRole(profile) {
  return String(profile?.role || 'user').trim() || 'user';
}

function getReplyCreatedTime(reply) {
  const time = new Date(reply?.created_at || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function buildTicketReplySummaries(replies = [], profilesMap = new Map()) {
  const summaries = new Map();
  const visibleReplies = (Array.isArray(replies) ? replies : [])
    .filter((reply) => !reply?.is_internal)
    .slice()
    .sort((a, b) => getReplyCreatedTime(a) - getReplyCreatedTime(b));

  visibleReplies.forEach((reply) => {
    const ticketId = reply?.ticket_id;
    if (!ticketId) {
      return;
    }

    const profile = profilesMap.get(reply.user_id) || null;
    const role = getProfileRole(profile);
    summaries.set(ticketId, {
      replyCount: (summaries.get(ticketId)?.replyCount || 0) + 1,
      lastReplyAt: reply.created_at || null,
      lastReplyUserId: reply.user_id || null,
      lastReplyRole: role,
      lastReplyIsStaff: isStaffRole(role),
      lastReplyProfile: profile,
    });
  });

  return summaries;
}

export function getTicketWorkflowState(ticket, {
  currentUserId = null,
  currentUserRole = 'user',
  replySummary = null,
} = {}) {
  const status = String(ticket?.status || 'pending');
  const canManage = currentUserRole === 'super_admin'
    || (currentUserRole === 'admin' && ticket?.target_role === 'admin');
  const isOwner = Boolean(currentUserId && ticket?.user_id === currentUserId);
  const active = isActiveTicketStatus(status);
  const hasVisibleReply = Boolean(replySummary?.lastReplyAt);
  const lastReplyByOwner = Boolean(replySummary?.lastReplyUserId && replySummary.lastReplyUserId === ticket?.user_id);
  const lastReplyByStaff = Boolean(replySummary?.lastReplyIsStaff);

  let queueState = 'none';
  if (canManage && active) {
    if (status === 'pending' || !hasVisibleReply || lastReplyByOwner || !lastReplyByStaff) {
      queueState = 'needs_staff';
    } else if (lastReplyByStaff) {
      queueState = 'waiting_user';
    }
  } else if (isOwner && active && lastReplyByStaff) {
    queueState = 'staff_replied';
  }

  return {
    canManage,
    isOwner,
    active,
    queueState,
    needsStaffAttention: queueState === 'needs_staff',
    waitingForUser: queueState === 'waiting_user',
    staffRepliedToOwner: queueState === 'staff_replied',
    replyCount: replySummary?.replyCount || 0,
    lastReplyAt: replySummary?.lastReplyAt || null,
    lastReplyUserId: replySummary?.lastReplyUserId || null,
    lastReplyRole: replySummary?.lastReplyRole || null,
    lastReplyIsStaff: Boolean(replySummary?.lastReplyIsStaff),
    lastReplyProfile: replySummary?.lastReplyProfile || null,
  };
}

export function enrichTicketsWithWorkflow(tickets = [], {
  currentUserId = null,
  currentUserRole = 'user',
  replySummaries = new Map(),
} = {}) {
  return (Array.isArray(tickets) ? tickets : []).map((ticket) => ({
    ...ticket,
    workflow: getTicketWorkflowState(ticket, {
      currentUserId,
      currentUserRole,
      replySummary: replySummaries.get(ticket?.id) || null,
    }),
  }));
}

export function getTicketWorkflowCounts(tickets = [], currentUserId = null) {
  const rows = Array.isArray(tickets) ? tickets : [];
  return {
    total: rows.length,
    pending: rows.filter((ticket) => ticket.status === 'pending').length,
    my: rows.filter((ticket) => ticket.user_id === currentUserId).length,
    needsStaff: rows.filter((ticket) => ticket.workflow?.needsStaffAttention).length,
    waitingUser: rows.filter((ticket) => ticket.workflow?.waitingForUser).length,
  };
}

export function filterTicketsByWorkflow(tickets = [], filter = 'all', currentUserId = null) {
  const rows = Array.isArray(tickets) ? tickets : [];
  switch (filter) {
    case 'my':
      return rows.filter((ticket) => ticket.user_id === currentUserId);
    case 'pending':
      return rows.filter((ticket) => ticket.status === 'pending');
    case 'needs_staff':
      return rows.filter((ticket) => ticket.workflow?.needsStaffAttention);
    case 'waiting_user':
      return rows.filter((ticket) => ticket.workflow?.waitingForUser);
    default:
      return rows;
  }
}

export default {
  buildTicketReplySummaries,
  enrichTicketsWithWorkflow,
  filterTicketsByWorkflow,
  getTicketWorkflowCounts,
  getTicketWorkflowState,
};
