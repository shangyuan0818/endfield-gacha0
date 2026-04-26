import { handleOfficialBotSelfApi } from '../../../_lib/officialBotApi.js';
import { fetchBotPoolIndex } from '../../../_lib/botDashboard.js';

export default async function handler(req, res) {
  return handleOfficialBotSelfApi(req, res, {
    handler: ({ adminClient, userId }) => fetchBotPoolIndex(adminClient, userId),
  });
}
