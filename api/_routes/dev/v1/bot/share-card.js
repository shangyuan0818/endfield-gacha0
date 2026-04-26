import { handleOfficialBotSelfApi } from '../../../../_lib/officialBotApi.js';
import { fetchBotAnalysis } from '../../../../_lib/botDashboard.js';
import { renderDashboardShareCardImage } from '../../../../_lib/dashboardShareImage.js';

function hasPoolSelector(query = {}) {
  return Boolean(
    String(query.poolRef || '').trim()
    || String(query.poolId || '').trim()
  );
}

export default async function handler(req, res) {
  return handleOfficialBotSelfApi(req, res, {
    validateQuery: (query) => {
      if (!hasPoolSelector(query)) {
        throw {
          status: 400,
          message: 'Missing pool selector',
        };
      }
    },
    handler: async ({ adminClient, userId }) => {
      const analysis = await fetchBotAnalysis(adminClient, userId, {
        accountRef: req.query?.accountRef,
        poolRef: req.query?.poolRef,
        gameUid: req.query?.gameUid,
        poolId: req.query?.poolId,
      });
      const detail = analysis?.selected?.detail || null;
      if (!detail) {
        throw {
          status: 404,
          message: 'Pool detail not found',
        };
      }

      const rendered = await renderDashboardShareCardImage(detail, {
        theme: String(req.query?.theme || 'dark') === 'light' ? 'light' : 'dark',
      });

      return {
        account: detail.account,
        pool: detail.pool,
        image: {
          file_name: rendered.file_name,
          mime_type: rendered.mime_type,
          encoding: 'base64',
          content_base64: rendered.buffer.toString('base64'),
        },
      };
    },
  });
}
