import { handlePublicDevApi } from '../../../../_lib/devApiResponse.js';
import { buildPublicSingleItemStats } from '../../../../_lib/publicAnalytics.js';

export default async function handler(req, res) {
  return handlePublicDevApi(req, res, {
    rateLimitAction: 'dev_api_stats_heavy',
    handler: async ({ adminClient }) => {
      const id = String(req.query?.id || '').trim();
      if (!id) {
        throw {
          status: 400,
          message: 'Missing item id',
        };
      }

      const detail = await buildPublicSingleItemStats(adminClient, {
        id,
        type: req.query?.type,
      });

      if (!detail) {
        throw {
          status: 404,
          message: 'Item stats not found',
        };
      }

      return detail;
    },
  });
}
