import { handlePublicDevApi } from '../../../_lib/devApiResponse.js';
import { fetchSiteOverview } from '../../../_lib/siteOverview.js';

export default async function handler(req, res) {
  return handlePublicDevApi(req, res, {
    rateLimitAction: 'dev_api_catalog',
    handler: ({ adminClient }) => fetchSiteOverview(adminClient, {
      siteUrl: process.env.OFFICIAL_BOT_SITE_URL || process.env.VITE_APP_URL || '',
    }).then((overview) => ({ overview })),
  });
}
