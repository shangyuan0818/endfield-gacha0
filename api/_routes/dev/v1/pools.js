import { handlePublicDevApi } from '../../../_lib/devApiResponse.js';
import { buildPoolsCatalog } from '../../../_lib/publicCatalog.js';

export default async function handler(req, res) {
  return handlePublicDevApi(req, res, {
    rateLimitAction: 'dev_api_catalog',
    handler: ({ adminClient }) => buildPoolsCatalog(adminClient, req.query || {}),
  });
}
