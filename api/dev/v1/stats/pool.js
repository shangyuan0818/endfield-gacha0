import { handlePublicDevApi } from '../../../_lib/devApiResponse.js';
import { buildPublicSinglePoolStats } from '../../../_lib/publicAnalytics.js';

export default async function handler(req, res) {
  return handlePublicDevApi(req, res, {
    rateLimitAction: 'dev_api_stats_heavy',
    handler: async ({ adminClient }) => {
      const id = String(req.query?.id || '').trim();
      if (!id) {
        throw {
          status: 400,
          message: 'Missing pool id',
        };
      }

      const detail = await buildPublicSinglePoolStats(adminClient, { id });
      if (!detail) {
        throw {
          status: 404,
          message: 'Pool stats not found',
        };
      }

      return detail;
    },
  });
}
