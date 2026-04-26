// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  applyCors: vi.fn(() => ({ allowed: true, origin: 'http://localhost:5173' })),
  requireApiClient: vi.fn(),
  enforceRateLimit: vi.fn(async () => ({ allowed: true, remaining: 99, retry_after: 0 })),
  buildPoolsCatalog: vi.fn(),
  buildPublicSinglePoolStats: vi.fn(),
  buildPublicSingleItemStats: vi.fn(),
}));

vi.mock('../_lib/http.js', () => ({
  applyCors: mocks.applyCors,
}));

vi.mock('../_lib/devApiAuth.js', () => ({
  requireApiClient: mocks.requireApiClient,
}));

vi.mock('../_lib/devApiRateLimit.js', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

vi.mock('../_lib/publicCatalog.js', async () => {
  const actual = await vi.importActual('../_lib/publicCatalog.js');
  return {
    ...actual,
    buildPoolsCatalog: mocks.buildPoolsCatalog,
  };
});

vi.mock('../_lib/publicAnalytics.js', () => ({
  buildPublicSinglePoolStats: mocks.buildPublicSinglePoolStats,
  buildPublicSingleItemStats: mocks.buildPublicSingleItemStats,
}));

import poolsHandler from '../_routes/dev/v1/pools.js';
import metaHandler from '../_routes/dev/v1/meta.js';
import openApiHandler from '../_routes/dev/v1/openapi.js';
import statsPoolHandler from '../_routes/dev/v1/stats/pool.js';
import statsItemHandler from '../_routes/dev/v1/stats/item.js';
import { toPublicPoolDto } from '../_lib/publicCatalog.js';

function createJsonResponseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    getHeader(name) {
      return this.headers[name];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

describe('public developer API v1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiClient.mockResolvedValue({
      adminClient: { from: vi.fn() },
      client: {
        id: 'client-1',
        client_type: 'developer',
        granted_scopes: ['public.read'],
        rate_limit_tier: 'default',
      },
      key: {
        key_prefix: 'ek_live_test',
      },
    });
    mocks.buildPoolsCatalog.mockResolvedValue({
      pools: [{ id: 'special_1', name: '测试池' }],
      page: { limit: 50, nextCursor: null, hasMore: false, total: 1 },
    });
    mocks.buildPublicSingleItemStats.mockResolvedValue({
      item: {
        id: 'chr_0001_test',
        name: '测试角色',
        type: 'character',
        totalPulls: 12,
        poolTypes: { limited: 12 },
        pools: [],
      },
    });
  });

  it('wraps catalog responses in the v1 envelope and requires public.read', async () => {
    const req = {
      method: 'GET',
      query: {},
      headers: { origin: 'http://localhost:5173' },
    };
    const res = createJsonResponseRecorder();

    await poolsHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mocks.requireApiClient).toHaveBeenCalledWith(req, {
      requiredScopes: ['public.read'],
      clientTypes: [],
    });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      expect.any(Object),
      'api-key:ek_live_test',
      'dev_api_catalog'
    );
    expect(res.body).toMatchObject({
      success: true,
      data: {
        pools: [{ id: 'special_1', name: '测试池' }],
      },
      meta: {
        apiVersion: 'v1',
        cache: expect.any(String),
        rateLimit: {
          action: 'dev_api_catalog',
          allowed: true,
        },
      },
    });
  });

  it('exposes bilingual documentation metadata from the v1 meta endpoint', async () => {
    const req = {
      method: 'GET',
      query: {},
      headers: {},
    };
    const res = createJsonResponseRecorder();

    await metaHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        apiVersion: 'v1',
        scope: 'public.read',
        documentation: {
          path: '/developer-api',
          openapi: '/api/dev/v1/openapi',
          locales: ['zh-CN', 'en-US'],
          sourceFiles: [
            'docs/developer-api-v1.zh-CN.md',
            'docs/developer-api-v1.en-US.md',
          ],
        },
      },
      meta: {
        apiVersion: 'v1',
        rateLimit: {
          action: 'dev_api_catalog',
          allowed: true,
        },
      },
    });
  });

  it('exposes a machine-readable OpenAPI descriptor through the v1 envelope', async () => {
    const req = {
      method: 'GET',
      query: {},
      headers: {},
    };
    const res = createJsonResponseRecorder();

    await openApiHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        openapi: {
          openapi: '3.1.0',
          paths: {
            '/api/dev/v1/stats/item': expect.any(Object),
          },
          components: {
            securitySchemes: {
              ApiKeyAuth: expect.any(Object),
            },
          },
        },
      },
      meta: {
        apiVersion: 'v1',
      },
    });
  });

  it('does not expose internal server errors in failed responses', async () => {
    mocks.requireApiClient.mockResolvedValue({
      error: {
        status: 500,
        message: 'relation "api_client_keys" does not exist at SQL stack',
      },
    });

    const req = {
      method: 'GET',
      query: {},
      headers: {},
    };
    const res = createJsonResponseRecorder();

    await poolsHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: 'internal_error',
        message: 'Internal server error',
      },
      meta: {
        apiVersion: 'v1',
      },
    });
    expect(JSON.stringify(res.body)).not.toContain('api_client_keys');
    expect(JSON.stringify(res.body)).not.toContain('SQL');
  });

  it('returns standard validation errors for single-resource endpoints', async () => {
    const req = {
      method: 'GET',
      query: {},
      headers: {},
    };
    const res = createJsonResponseRecorder();

    await statsPoolHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: 'bad_request',
        message: 'Missing pool id',
      },
      meta: {
        apiVersion: 'v1',
      },
    });
    expect(mocks.buildPublicSinglePoolStats).not.toHaveBeenCalled();
  });

  it('returns single-item aggregate stats without requiring raw history access', async () => {
    const req = {
      method: 'GET',
      query: { id: 'chr_0001_test', type: 'character' },
      headers: {},
    };
    const res = createJsonResponseRecorder();

    await statsItemHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mocks.buildPublicSingleItemStats).toHaveBeenCalledWith(expect.any(Object), {
      id: 'chr_0001_test',
      type: 'character',
    });
    expect(res.body).toMatchObject({
      success: true,
      data: {
        item: {
          id: 'chr_0001_test',
          name: '测试角色',
          totalPulls: 12,
        },
      },
    });
    expect(JSON.stringify(res.body)).not.toContain('user_id');
    expect(JSON.stringify(res.body)).not.toContain('game_uid');
  });

  it('validates single-item stats id', async () => {
    const req = {
      method: 'GET',
      query: {},
      headers: {},
    };
    const res = createJsonResponseRecorder();

    await statsItemHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: 'bad_request',
        message: 'Missing item id',
      },
    });
    expect(mocks.buildPublicSingleItemStats).not.toHaveBeenCalled();
  });

  it('sanitizes pool DTOs for public catalog output', () => {
    const dto = toPublicPoolDto({
      pool_id: 'special_1_2_1',
      name: '春雷动，万物生',
      name_en: 'Spring Thunder',
      type: 'limited_character',
      user_id: 'private-user',
      creator_username: 'admin',
      up_character: '庄方宜',
      start_time: '2026-04-17T04:00:00.000Z',
      end_time: '2026-05-22T04:00:00.000Z',
    }, { nowMs: Date.parse('2026-04-24T00:00:00.000Z') });

    expect(dto).toMatchObject({
      id: 'special_1_2_1',
      pool_id: 'special_1_2_1',
      type: 'limited',
      status: 'active',
      featured: [{ name: '庄方宜', rarity: 6, type: 'character' }],
    });
    expect(dto).not.toHaveProperty('user_id');
    expect(dto).not.toHaveProperty('creator_username');
  });
});
