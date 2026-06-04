import { loadPublicProfilesMap } from './publicProfileService';
import { loadTicketReplyRowsForWorkflow } from './ticketService.js';
import { buildTicketReplySummaries } from '../utils/ticketWorkflow.js';

export async function loadTicketReplyWorkflowSummaries(ticketIds = []) {
  const ids = [...new Set((Array.isArray(ticketIds) ? ticketIds : []).filter(Boolean))];
  if (ids.length === 0) {
    return new Map();
  }

  const rows = await loadTicketReplyRowsForWorkflow(ids);
  const profilesMap = await loadPublicProfilesMap(rows.map((reply) => reply.user_id));
  return buildTicketReplySummaries(rows, profilesMap);
}

export default {
  loadTicketReplyWorkflowSummaries,
};
