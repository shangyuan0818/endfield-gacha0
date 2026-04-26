import { handlePublicDevApi, DEV_API_VERSION } from '../../../_lib/devApiResponse.js';

const PUBLIC_ENDPOINTS = [
  'GET /api/dev/v1/meta',
  'GET /api/dev/v1/openapi',
  'GET /api/dev/v1/pools',
  'GET /api/dev/v1/pool?id=',
  'GET /api/dev/v1/characters',
  'GET /api/dev/v1/character?id=',
  'GET /api/dev/v1/announcements',
  'GET /api/dev/v1/site/overview',
  'GET /api/dev/v1/stats/global',
  'GET /api/dev/v1/stats/rankings',
  'GET /api/dev/v1/stats/pools',
  'GET /api/dev/v1/stats/pool?id=',
  'GET /api/dev/v1/stats/items',
  'GET /api/dev/v1/stats/item?id=',
  'GET /api/dev/v1/stats/trends',
  'GET /api/dev/v1/stats/distributions',
];

function getSiteUrl() {
  return String(process.env.OFFICIAL_BOT_SITE_URL || process.env.VITE_APP_URL || '').replace(/\/+$/, '');
}

export default async function handler(req, res) {
  return handlePublicDevApi(req, res, {
    rateLimitAction: 'dev_api_catalog',
    handler: () => {
      const siteUrl = getSiteUrl();

      return {
        apiVersion: DEV_API_VERSION,
        scope: 'public.read',
        siteUrl,
        documentation: {
          path: '/developer-api',
          url: siteUrl ? `${siteUrl}/developer-api` : '/developer-api',
          openapi: '/api/dev/v1/openapi',
          locales: ['zh-CN', 'en-US'],
          sourceFiles: [
            'docs/developer-api-v1.zh-CN.md',
            'docs/developer-api-v1.en-US.md',
          ],
        },
        endpoints: PUBLIC_ENDPOINTS,
        updatedAt: '2026-04-26',
        notes: [
          'All endpoints require X-API-Key or Authorization: Bearer <key>.',
          'This API only returns public catalog and anonymous aggregate analytics.',
        ],
      };
    },
  });
}
