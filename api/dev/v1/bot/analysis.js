import { handleOfficialBotSelfApi } from '../../../_lib/officialBotApi.js';
import { fetchBotAnalysis } from '../../../_lib/botDashboard.js';

export default async function handler(req, res) {
  return handleOfficialBotSelfApi(req, res, {
    handler: ({ adminClient, userId }) => fetchBotAnalysis(adminClient, userId, {
      accountRef: req.query?.accountRef,
      poolRef: req.query?.poolRef,
      gameUid: req.query?.gameUid,
      poolId: req.query?.poolId,
    }),
  });
}
