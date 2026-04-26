import { handleOfficialBotSelfApi } from '../../../../_lib/officialBotApi.js';
import { fetchBotRecentPulls } from '../../../../_lib/botDashboard.js';

export default async function handler(req, res) {
  return handleOfficialBotSelfApi(req, res, {
    handler: ({ adminClient, userId }) => {
      const limit = Number.parseInt(req.query?.limit, 10);
      return fetchBotRecentPulls(adminClient, userId, limit);
    },
  });
}
