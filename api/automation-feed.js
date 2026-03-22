import {
  handleOfficialAnnouncementsFeed,
} from './_lib/officialAnnouncementsFeed.js';
import { handlePoolScheduleFeed } from './_lib/poolScheduleFeed.js';
import { handleWikiCatalogFeed } from './_lib/wikiCatalogFeed.js';

function readJobParam(req) {
  const requestUrl = req?.url || '';
  const baseUrl = req?.headers?.host ? `http://${req.headers.host}` : 'http://localhost';
  const url = new URL(requestUrl, baseUrl);
  return String(url.searchParams.get('job') || '').trim();
}

export {
  buildOfficialAnnouncementRecords,
  handleOfficialAnnouncementsFeed,
  __internal,
} from './_lib/officialAnnouncementsFeed.js';
export { buildPoolScheduleRecords, handlePoolScheduleFeed } from './_lib/poolScheduleFeed.js';
export { handleWikiCatalogFeed } from './_lib/wikiCatalogFeed.js';

export default async function handler(req, res) {
  switch (readJobParam(req)) {
    case 'official-announcements':
      await handleOfficialAnnouncementsFeed(req, res);
      return;
    case 'pool-schedule':
      await handlePoolScheduleFeed(req, res);
      return;
    case 'wiki-catalog':
      await handleWikiCatalogFeed(req, res);
      return;
    default:
      res.setHeader('Cache-Control', 'no-store');
      res.status(400).json({
        success: false,
        error: 'Unsupported automation feed job',
      });
  }
}
