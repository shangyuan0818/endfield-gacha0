import {
  __internal,
  handleOfficialAnnouncementsFeed,
} from './_lib/officialAnnouncementsFeed.js';
import {
  buildPoolScheduleRecords,
  handlePoolScheduleFeed,
} from './_lib/poolScheduleFeed.js';

function readRequestedJob(req) {
  if (req.query?.job) {
    return String(req.query.job).trim();
  }

  try {
    return new URL(req.url || '', 'https://example.com').searchParams.get('job') || 'official-announcements';
  } catch {
    return 'official-announcements';
  }
}

export { __internal, handleOfficialAnnouncementsFeed, buildPoolScheduleRecords, handlePoolScheduleFeed };

export default async function handler(req, res) {
  const jobId = readRequestedJob(req);

  if (jobId === 'pool-schedule') {
    return handlePoolScheduleFeed(req, res);
  }

  if (jobId === 'official-announcements') {
    return handleOfficialAnnouncementsFeed(req, res);
  }

  return res.status(400).json({
    success: false,
    error: `Unsupported automation feed job: ${jobId}`,
  });
}
