import { handlePublicDevApi } from '../../_lib/devApiResponse.js';
import { buildDevApiOpenApiSpec } from '../../_lib/devApiOpenApi.js';

function getSiteUrl() {
  return String(process.env.OFFICIAL_BOT_SITE_URL || process.env.VITE_APP_URL || '').replace(/\/+$/, '');
}

export default async function handler(req, res) {
  return handlePublicDevApi(req, res, {
    rateLimitAction: 'dev_api_catalog',
    handler: () => ({
      openapi: buildDevApiOpenApiSpec({
        siteUrl: getSiteUrl(),
      }),
    }),
  });
}
