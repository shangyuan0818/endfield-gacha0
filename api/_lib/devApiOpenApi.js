import { DEV_API_VERSION } from './devApiResponse.js';

const JSON_ENVELOPE_SCHEMA = {
  type: 'object',
  required: ['success', 'data', 'meta'],
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object' },
    meta: { $ref: '#/components/schemas/Meta' },
  },
};

function endpoint(summary, {
  action = 'dev_api_catalog',
  parameters = [],
} = {}) {
  return {
    get: {
      summary,
      security: [
        { ApiKeyAuth: [] },
        { BearerAuth: [] },
      ],
      parameters,
      responses: {
        200: {
          description: 'Successful v1 response envelope',
          content: {
            'application/json': {
              schema: JSON_ENVELOPE_SCHEMA,
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        429: { $ref: '#/components/responses/RateLimited' },
      },
      'x-rate-limit-action': action,
      'x-required-scope': 'public.read',
    },
  };
}

const limitCursorParameters = [
  {
    name: 'limit',
    in: 'query',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
  },
  {
    name: 'cursor',
    in: 'query',
    required: false,
    schema: { type: 'string' },
  },
];

const localeParameter = {
  name: 'locale',
  in: 'query',
  required: false,
  schema: { type: 'string', enum: ['zh-CN', 'en-US'] },
};

const idParameter = (name = 'id') => ({
  name,
  in: 'query',
  required: true,
  schema: { type: 'string' },
});

function buildServers(siteUrl) {
  return [
    {
      url: siteUrl || '/',
      description: siteUrl ? 'Configured production site' : 'Current deployment root',
    },
  ];
}

export function buildDevApiOpenApiSpec({
  siteUrl = '',
} = {}) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Endfield Gacha Public Analytics API',
      version: DEV_API_VERSION,
      description: 'Read-only public catalog and anonymous aggregate analytics API. All endpoints require an approved API key with public.read scope.',
    },
    servers: buildServers(siteUrl),
    security: [
      { ApiKeyAuth: [] },
      { BearerAuth: [] },
    ],
    paths: {
      '/api/dev/v1/meta': endpoint('API metadata and documentation links'),
      '/api/dev/v1/openapi': endpoint('OpenAPI 3.1 descriptor wrapped in the standard v1 response envelope'),
      '/api/dev/v1/pools': endpoint('List public pools', {
        parameters: [
          localeParameter,
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['limited', 'extra', 'standard', 'weapon'] } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'upcoming', 'ended', 'permanent'] } },
          ...limitCursorParameters,
        ],
      }),
      '/api/dev/v1/pool': endpoint('Get one public pool', {
        parameters: [idParameter(), localeParameter],
      }),
      '/api/dev/v1/characters': endpoint('List public characters and weapons', {
        parameters: [
          localeParameter,
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['character', 'weapon'] } },
          { name: 'rarity', in: 'query', schema: { type: 'integer' } },
          { name: 'limited', in: 'query', schema: { type: 'boolean' } },
          { name: 'q', in: 'query', schema: { type: 'string' } },
          ...limitCursorParameters,
        ],
      }),
      '/api/dev/v1/character': endpoint('Get one public character or weapon', {
        parameters: [idParameter(), localeParameter],
      }),
      '/api/dev/v1/announcements': endpoint('List public announcements', {
        parameters: [localeParameter, ...limitCursorParameters],
      }),
      '/api/dev/v1/site/overview': endpoint('Site overview, active pools, and next-version timing'),
      '/api/dev/v1/stats/global': endpoint('Global anonymous aggregate statistics', {
        action: 'dev_api_stats_light',
      }),
      '/api/dev/v1/stats/rankings': endpoint('Public ranking aggregates', {
        action: 'dev_api_stats_light',
      }),
      '/api/dev/v1/stats/pools': endpoint('Pool-level public analytics', {
        action: 'dev_api_stats_heavy',
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['limited', 'extra', 'standard', 'weapon'] } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'upcoming', 'ended', 'permanent'] } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
          ...limitCursorParameters,
        ],
      }),
      '/api/dev/v1/stats/pool': endpoint('Single-pool public analytics', {
        action: 'dev_api_stats_heavy',
        parameters: [idParameter()],
      }),
      '/api/dev/v1/stats/items': endpoint('Item-level public analytics list', {
        action: 'dev_api_stats_heavy',
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['character', 'weapon'] } },
          { name: 'rarity', in: 'query', schema: { type: 'integer' } },
          { name: 'poolType', in: 'query', schema: { type: 'string', enum: ['limited', 'extra', 'standard', 'weapon'] } },
          ...limitCursorParameters,
        ],
      }),
      '/api/dev/v1/stats/item': endpoint('Single-item public analytics', {
        action: 'dev_api_stats_heavy',
        parameters: [
          idParameter(),
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['character', 'weapon'] } },
        ],
      }),
      '/api/dev/v1/stats/trends': endpoint('Public pull trends', {
        action: 'dev_api_stats_heavy',
        parameters: [
          { name: 'metric', in: 'query', schema: { type: 'string', enum: ['pulls', 'six_star', 'five_star'], default: 'pulls' } },
          { name: 'granularity', in: 'query', schema: { type: 'string', enum: ['day', 'week'], default: 'day' } },
          { name: 'days', in: 'query', schema: { type: 'integer', enum: [7, 30, 90], default: 30 } },
        ],
      }),
      '/api/dev/v1/stats/distributions': endpoint('Public pity distribution buckets', {
        action: 'dev_api_stats_heavy',
        parameters: [
          { name: 'poolType', in: 'query', schema: { type: 'string', enum: ['all', 'character', 'limited', 'extra', 'standard', 'weapon'], default: 'all' } },
        ],
      }),
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
      schemas: {
        Meta: {
          type: 'object',
          required: ['apiVersion', 'generatedAt', 'cache'],
          properties: {
            apiVersion: { type: 'string', example: DEV_API_VERSION },
            generatedAt: { type: 'string', format: 'date-time' },
            cache: { type: 'string' },
            requestId: { type: 'string' },
            rateLimit: {
              type: 'object',
              properties: {
                action: { type: 'string' },
                allowed: { type: 'boolean' },
                remaining: { type: ['integer', 'null'] },
                retryAfter: { type: 'integer' },
              },
            },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Missing or invalid API key',
        },
        Forbidden: {
          description: 'API key lacks the required scope or status',
        },
        RateLimited: {
          description: 'Rate limit exceeded',
        },
      },
    },
  };
}

export default {
  buildDevApiOpenApiSpec,
};
