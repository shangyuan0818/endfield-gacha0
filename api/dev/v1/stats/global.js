import { handlePublicDevApi } from '../../../_lib/devApiResponse.js';
import { buildPublicGlobalStats } from '../../../_lib/publicAnalytics.js';

export default async function handler(req, res) {
  return handlePublicDevApi(req, res, {
    rateLimitAction: 'dev_api_stats_light',
    handler: ({ adminClient }) => buildPublicGlobalStats(adminClient),
  });
}
