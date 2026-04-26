import { handleOfficialBotSelfApi } from '../../../_lib/officialBotApi.js';
import { fetchBotSelfSummary } from '../../../_lib/botSummary.js';

export default async function handler(req, res) {
  return handleOfficialBotSelfApi(req, res, {
    handler: ({ adminClient, userId }) => fetchBotSelfSummary(adminClient, userId),
  });
}
