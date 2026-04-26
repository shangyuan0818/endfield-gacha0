import { handlePublicDevApi } from '../../_lib/devApiResponse.js';
import { fetchAnnouncements } from '../../_lib/publicCatalog.js';

export default async function handler(req, res) {
  return handlePublicDevApi(req, res, {
    rateLimitAction: 'dev_api_catalog',
    handler: ({ adminClient }) => fetchAnnouncements(adminClient, req.query || {}),
  });
}
