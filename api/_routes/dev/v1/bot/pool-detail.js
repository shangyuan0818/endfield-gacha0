import { handleOfficialBotSelfApi } from '../../../../_lib/officialBotApi.js';
import { fetchBotPoolDetail, toAnalysisPoolDetail } from '../../../../_lib/botDashboard.js';

export default async function handler(req, res) {
  return handleOfficialBotSelfApi(req, res, {
    validateQuery: (query) => {
      if (!String(query?.poolId || '').trim()) {
        throw {
          status: 400,
          message: 'Missing poolId',
        };
      }
    },
    handler: async ({ adminClient, userId }) => {
      const poolId = String(req.query?.poolId || '').trim();
      const gameUid = String(req.query?.gameUid || '').trim() || null;
      const detail = await fetchBotPoolDetail(adminClient, userId, { gameUid, poolId });

      if (!detail) {
        throw {
          status: 404,
          message: 'Pool detail not found',
        };
      }

      return toAnalysisPoolDetail(detail);
    },
  });
}
