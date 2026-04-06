import { rejectDisallowedBrowserOrigin } from './_lib/http.js';
import {
  authorizeOpsAutomationRequest,
  parseRequestedJobIds,
} from './_lib/opsAutomation.js';
import { runOpsAutomationJobs } from './_lib/runOpsAutomation.js';

function readRequestedJobs(req) {
  if (req.query?.job) {
    return req.query.job;
  }

  try {
    return new URL(req.url || '', 'https://example.com').searchParams.get('job') || 'all';
  } catch {
    return 'all';
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, { methods: 'GET, OPTIONS' })) return;
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const auth = authorizeOpsAutomationRequest(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, error: auth.error });
  }

  let requestedJobIds;
  try {
    requestedJobIds = parseRequestedJobIds(readRequestedJobs(req));
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }

  const runResult = await runOpsAutomationJobs({
    requestedJobIds,
    triggerType: 'cron',
  });

  if (!runResult.ok && runResult.status === 503) {
    return res.status(503).json({ success: false, error: runResult.error });
  }

  return res.status(runResult.status).json({
    success: runResult.ok,
    ...runResult.results,
  });
}
