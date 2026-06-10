import { buildCopyableDiagnostic } from './notificationModel.js';
import { STORAGE_KEYS, markAsViewed } from './storageUtils.js';

export function markTicketsViewed() {
  markAsViewed(STORAGE_KEYS.TICKETS_LAST_VIEWED);
}

export function canReopenTicket(ticket = {}) {
  return ['resolved', 'rejected', 'closed'].includes(String(ticket?.status || '').trim());
}

export function buildTicketDiagnostic(ticket = {}, extra = {}) {
  return buildCopyableDiagnostic({
    phase: 'ticket_support',
    ticket: {
      id: ticket.id || null,
      type: ticket.type || null,
      status: ticket.status || null,
      priority: ticket.priority || null,
      targetRole: ticket.target_role || null,
      createdAt: ticket.created_at || null,
      updatedAt: ticket.updated_at || null,
      workflow: ticket.workflow
        ? {
          queueState: ticket.workflow.queueState || null,
          replyCount: ticket.workflow.replyCount || 0,
          lastReplyAt: ticket.workflow.lastReplyAt || null,
          lastReplyRole: ticket.workflow.lastReplyRole || null,
        }
        : null,
    },
    page: typeof window !== 'undefined'
      ? {
        path: window.location?.pathname || '',
        search: window.location?.search || '',
      }
      : null,
    ...extra,
  });
}

export async function copyTextToClipboard(text) {
  if (!text) {
    return false;
  }

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to the legacy selection path below.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

export default {
  buildTicketDiagnostic,
  canReopenTicket,
  copyTextToClipboard,
  markTicketsViewed,
};
