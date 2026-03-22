export {
  applyOfficialAnnouncementsRun,
  handleAdminApplyOfficialAnnouncements,
} from './_lib/adminApplyOfficialAnnouncementsRun.js';
export {
  applyPoolScheduleRun,
  handleAdminApplyPoolSchedule,
} from './_lib/adminApplyPoolScheduleRun.js';
export { handleAdminRunOpsAutomation } from './_lib/adminRunOpsAutomation.js';

import { rejectDisallowedBrowserOrigin } from './_lib/http.js';
import { handleAdminApplyOfficialAnnouncements } from './_lib/adminApplyOfficialAnnouncementsRun.js';
import { handleAdminApplyPoolSchedule } from './_lib/adminApplyPoolScheduleRun.js';
import { handleAdminRunOpsAutomation } from './_lib/adminRunOpsAutomation.js';

function readActionParam(req) {
  const requestUrl = req?.url || '';
  const baseUrl = req?.headers?.host ? `http://${req.headers.host}` : 'http://localhost';
  const url = new URL(requestUrl, baseUrl);
  return String(url.searchParams.get('action') || '').trim();
}

export default async function handler(req, res) {
  switch (readActionParam(req)) {
    case 'run':
      await handleAdminRunOpsAutomation(req, res);
      return;
    case 'apply-official-announcements':
      await handleAdminApplyOfficialAnnouncements(req, res);
      return;
    case 'apply-pool-schedule':
      await handleAdminApplyPoolSchedule(req, res);
      return;
    default:
      res.setHeader('Cache-Control', 'no-store');
      if (rejectDisallowedBrowserOrigin(req, res, {
        methods: 'POST, OPTIONS',
        headers: 'Content-Type, Authorization',
      })) {
        return;
      }

      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }

      res.status(400).json({
        success: false,
        error: 'Unsupported admin ops automation action',
      });
  }
}
