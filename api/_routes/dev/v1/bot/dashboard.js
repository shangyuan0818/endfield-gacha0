import { handleOfficialBotSelfApi } from '../../../../_lib/officialBotApi.js';
import { fetchBotDashboard } from '../../../../_lib/botDashboard.js';

export default async function handler(req, res) {
  return handleOfficialBotSelfApi(req, res, {
    handler: ({ adminClient, userId }) => fetchBotDashboard(adminClient, userId),
  });
}
