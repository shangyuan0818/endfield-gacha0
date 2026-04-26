import { handlePublicDevApi } from '../../_lib/devApiResponse.js';
import { buildCharacterDetail } from '../../_lib/publicCatalog.js';

export default async function handler(req, res) {
  return handlePublicDevApi(req, res, {
    rateLimitAction: 'dev_api_catalog',
    handler: async ({ adminClient }) => {
      const id = String(req.query?.id || '').trim();
      if (!id) {
        throw {
          status: 400,
          message: 'Missing character id',
        };
      }

      const detail = await buildCharacterDetail(adminClient, {
        id,
        locale: req.query?.locale,
      });

      if (!detail) {
        throw {
          status: 404,
          message: 'Character not found',
        };
      }

      return detail;
    },
  });
}
