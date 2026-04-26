// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  applyCors: vi.fn(() => ({ allowed: true, origin: '' })),
  getSupabaseAdminClient: vi.fn(),
  requireApiClient: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  requireVerifierClient: vi.fn(),
  enforceRateLimit: vi.fn(async () => ({ allowed: true, remaining: 99, retry_after: 0 })),
  buildPoolsCatalog: vi.fn(),
  buildPoolDetail: vi.fn(),
  buildCharactersCatalog: vi.fn(),
  buildCharacterDetail: vi.fn(),
  fetchAnnouncements: vi.fn(),
  buildPublicGlobalStats: vi.fn(),
  buildPublicRankings: vi.fn(),
  buildPublicPoolStats: vi.fn(),
  buildPublicSinglePoolStats: vi.fn(),
  buildPublicItemStats: vi.fn(),
  buildPublicSingleItemStats: vi.fn(),
  buildPublicTrends: vi.fn(),
  buildPublicDistributions: vi.fn(),
  fetchSiteOverview: vi.fn(),
  resolveVerifiedBinding: vi.fn(),
  fetchBotSelfSummary: vi.fn(),
  fetchBotDashboard: vi.fn(),
  fetchBotPoolIndex: vi.fn(),
  fetchBotPoolDetail: vi.fn(),
  fetchBotRecentPulls: vi.fn(),
  fetchBotAnalysis: vi.fn(),
  fetchBotPoolLog: vi.fn(),
  toAnalysisPoolDetail: vi.fn((detail) => detail),
  renderDashboardShareCardImage: vi.fn(),
}));

vi.mock('../_lib/http.js', () => ({
  applyCors: mocks.applyCors,
}));

vi.mock('../_lib/devApiAuth.js', () => ({
  requireApiClient: mocks.requireApiClient,
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
  requireVerifierClient: mocks.requireVerifierClient,
}));

vi.mock('../_lib/authAdmin.js', () => ({
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

vi.mock('../_lib/devApiRateLimit.js', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

vi.mock('../_lib/publicCatalog.js', () => ({
  buildPoolsCatalog: mocks.buildPoolsCatalog,
  buildPoolDetail: mocks.buildPoolDetail,
  buildCharactersCatalog: mocks.buildCharactersCatalog,
  buildCharacterDetail: mocks.buildCharacterDetail,
  fetchAnnouncements: mocks.fetchAnnouncements,
}));

vi.mock('../_lib/publicAnalytics.js', () => ({
  buildPublicGlobalStats: mocks.buildPublicGlobalStats,
  buildPublicRankings: mocks.buildPublicRankings,
  buildPublicPoolStats: mocks.buildPublicPoolStats,
  buildPublicSinglePoolStats: mocks.buildPublicSinglePoolStats,
  buildPublicItemStats: mocks.buildPublicItemStats,
  buildPublicSingleItemStats: mocks.buildPublicSingleItemStats,
  buildPublicTrends: mocks.buildPublicTrends,
  buildPublicDistributions: mocks.buildPublicDistributions,
}));

vi.mock('../_lib/siteOverview.js', () => ({
  fetchSiteOverview: mocks.fetchSiteOverview,
}));

vi.mock('../_lib/botSummary.js', () => ({
  resolveVerifiedBinding: mocks.resolveVerifiedBinding,
  fetchBotSelfSummary: mocks.fetchBotSelfSummary,
}));

vi.mock('../_lib/botDashboard.js', () => ({
  fetchBotDashboard: mocks.fetchBotDashboard,
  fetchBotPoolIndex: mocks.fetchBotPoolIndex,
  fetchBotPoolDetail: mocks.fetchBotPoolDetail,
  fetchBotRecentPulls: mocks.fetchBotRecentPulls,
  fetchBotAnalysis: mocks.fetchBotAnalysis,
  fetchBotPoolLog: mocks.fetchBotPoolLog,
  toAnalysisPoolDetail: mocks.toAnalysisPoolDetail,
}));

vi.mock('../_lib/dashboardShareImage.js', () => ({
  renderDashboardShareCardImage: mocks.renderDashboardShareCardImage,
}));

import metaHandler from '../_routes/dev/v1/meta.js';
import openApiHandler from '../_routes/dev/v1/openapi.js';
import poolsHandler from '../_routes/dev/v1/pools.js';
import poolHandler from '../_routes/dev/v1/pool.js';
import charactersHandler from '../_routes/dev/v1/characters.js';
import characterHandler from '../_routes/dev/v1/character.js';
import announcementsHandler from '../_routes/dev/v1/announcements.js';
import siteOverviewHandler from '../_routes/dev/v1/site/overview.js';
import statsGlobalHandler from '../_routes/dev/v1/stats/global.js';
import statsRankingsHandler from '../_routes/dev/v1/stats/rankings.js';
import statsPoolsHandler from '../_routes/dev/v1/stats/pools.js';
import statsPoolHandler from '../_routes/dev/v1/stats/pool.js';
import statsItemsHandler from '../_routes/dev/v1/stats/items.js';
import statsItemHandler from '../_routes/dev/v1/stats/item.js';
import statsTrendsHandler from '../_routes/dev/v1/stats/trends.js';
import statsDistributionsHandler from '../_routes/dev/v1/stats/distributions.js';
import botDashboardHandler from '../_routes/dev/v1/bot/dashboard.js';
import botPoolsHandler from '../_routes/dev/v1/bot/pools.js';
import botPoolDetailHandler from '../_routes/dev/v1/bot/pool-detail.js';
import botRecentPullsHandler from '../_routes/dev/v1/bot/recent-pulls.js';
import botSelfSummaryHandler from '../_routes/dev/v1/bot/self-summary.js';
import botAnalysisHandler from '../_routes/dev/v1/bot/analysis.js';
import botShareCardHandler from '../_routes/dev/v1/bot/share-card.js';
import botPoolLogHandler from '../_routes/dev/v1/bot/pool-log.js';
import bindingChallengeHandler from '../_routes/integrations/bindings/challenge.js';
import bindingMeHandler from '../_routes/integrations/bindings/me.js';
import bindingVerifyHandler from '../_routes/integrations/bindings/verify.js';
import bindingRevokeHandler from '../_routes/integrations/bindings/revoke.js';

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

async function call(handler, {
  method = 'GET',
  query = {},
  body = undefined,
  headers = {},
} = {}) {
  const req = {
    method,
    query,
    body,
    headers,
  };
  const res = createJsonResponseRecorder();
  await handler(req, res);
  return res;
}

function expectV1Success(res) {
  expect(res.statusCode).toBe(200);
  expect(res.body).toMatchObject({
    success: true,
    data: expect.any(Object),
    meta: {
      apiVersion: 'v1',
      generatedAt: expect.any(String),
      cache: expect.any(String),
    },
  });
}

function expectNoPrivateIdentifiers(payload) {
  const serialized = JSON.stringify(payload);
  [
    'user_id',
    'platform_user_id',
    'game_uid',
    'pool_id',
    'record_id',
    'email',
    'tg-private',
    '1545606431',
    'special_1_2_1',
    'history-private',
  ].forEach((token) => {
    expect(serialized).not.toContain(token);
  });
}

function createChain(result = { data: null, error: null }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    order: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
  };
  return chain;
}

function createBindingMeAdminClient() {
  return {
    from: vi.fn((table) => {
      if (table === 'user_platform_bindings') {
        return {
          select: vi.fn(() => {
            const chain = createChain({
              data: [
                {
                  id: 'binding-private',
                  user_id: 'user-private',
                  provider: 'telegram',
                  platform_user_id: 'tg-private',
                  display_handle: '@tester',
                  status: 'verified',
                },
              ],
              error: null,
            });
            return chain;
          }),
        };
      }

      if (table === 'platform_binding_challenges') {
        return {
          select: vi.fn(() => {
            const chain = createChain({
              data: [
                {
                  id: 'challenge-private',
                  user_id: 'user-private',
                  provider: 'discord',
                  challenge_code: 'ABC12345',
                  status: 'pending',
                  expires_at: '2099-01-01T00:00:00.000Z',
                },
              ],
              error: null,
            });
            return chain;
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function createBindingChallengeAdminClient() {
  return {
    from: vi.fn((table) => {
      if (table === 'user_platform_bindings') {
        return {
          select: vi.fn(() => createChain({ data: null, error: null })),
          insert: vi.fn((payload) => ({
            select: vi.fn(() => createChain({
              data: {
                id: 'binding-private',
                ...payload,
              },
              error: null,
            })),
          })),
        };
      }

      if (table === 'platform_binding_challenges') {
        return {
          update: vi.fn(() => createChain({ error: null })),
          insert: vi.fn((payload) => ({
            select: vi.fn(() => createChain({
              data: {
                id: 'challenge-private',
                ...payload,
              },
              error: null,
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function createBindingVerifyAdminClient() {
  return {
    from: vi.fn((table) => {
      if (table === 'platform_binding_challenges') {
        return {
          select: vi.fn(() => createChain({
            data: {
              id: 'challenge-private',
              binding_id: 'binding-private',
              user_id: 'user-private',
              provider: 'telegram',
              status: 'pending',
              expires_at: '2099-01-01T00:00:00.000Z',
            },
            error: null,
          })),
          update: vi.fn(() => createChain({ error: null })),
        };
      }

      if (table === 'user_platform_bindings') {
        return {
          select: vi.fn(() => createChain({ data: null, error: null })),
          update: vi.fn((payload) => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  select: vi.fn(() => createChain({
                    data: {
                      id: 'binding-private',
                      user_id: 'user-private',
                      provider: 'telegram',
                      platform_user_id: payload.platform_user_id,
                      display_handle: payload.display_handle,
                      status: 'verified',
                      verified_at: payload.verified_at,
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function createBindingRevokeAdminClient() {
  return {
    from: vi.fn((table) => {
      if (table === 'user_platform_bindings') {
        return {
          update: vi.fn((payload) => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                neq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    limit: vi.fn(() => createChain({
                      data: {
                        id: 'binding-private',
                        user_id: 'user-private',
                        provider: 'telegram',
                        platform_user_id: 'tg-private',
                        display_handle: '@tester',
                        status: payload.status,
                        revoked_at: payload.revoked_at,
                      },
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          })),
        };
      }

      if (table === 'platform_binding_challenges') {
        return {
          update: vi.fn(() => createChain({ error: null })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function installPublicMocks() {
  mocks.requireApiClient.mockResolvedValue({
    adminClient: { from: vi.fn(), rpc: vi.fn() },
    client: {
      id: 'client-public',
      client_type: 'developer',
      granted_scopes: ['public.read'],
      rate_limit_tier: 'default',
    },
    key: { key_prefix: 'ek_live_public' },
  });

  mocks.buildPoolsCatalog.mockResolvedValue({
    pools: [{ id: 'public_pool', name: '公开卡池', type: 'limited' }],
    page: { limit: 50, nextCursor: null, hasMore: false, total: 1 },
  });
  mocks.buildPoolDetail.mockResolvedValue({
    pool: { id: 'public_pool', name: '公开卡池', type: 'limited' },
  });
  mocks.buildCharactersCatalog.mockResolvedValue({
    characters: [{ id: 'chr_public', name: '公开角色', type: 'character' }],
    page: { limit: 50, nextCursor: null, hasMore: false, total: 1 },
  });
  mocks.buildCharacterDetail.mockResolvedValue({
    character: { id: 'chr_public', name: '公开角色', type: 'character' },
  });
  mocks.fetchAnnouncements.mockResolvedValue({
    announcements: [{ id: 'ann_1', title: '公告' }],
    page: { limit: 50, nextCursor: null, hasMore: false, total: 1 },
  });
  mocks.fetchSiteOverview.mockResolvedValue({
    currentVersion: '1.2',
    nextVersion: { startsAt: '2026-06-04T04:00:00.000Z' },
  });
  mocks.buildPublicGlobalStats.mockResolvedValue({
    global: { totalPulls: 123 },
    analytics: { rowCount: 123 },
  });
  mocks.buildPublicRankings.mockResolvedValue({
    rankings: { limited: { sixStarUp: [] } },
    itemTop: [],
  });
  mocks.buildPublicPoolStats.mockResolvedValue({
    pools: [{ pool: { id: 'public_pool' }, stats: { totalPulls: 10 } }],
    page: { limit: 50, nextCursor: null, hasMore: false, total: 1 },
  });
  mocks.buildPublicSinglePoolStats.mockResolvedValue({
    pool: { pool: { id: 'public_pool' }, stats: { totalPulls: 10 } },
  });
  mocks.buildPublicItemStats.mockResolvedValue({
    items: [{ id: 'chr_public', name: '公开角色', totalPulls: 3 }],
    page: { limit: 50, nextCursor: null, hasMore: false, total: 1 },
  });
  mocks.buildPublicSingleItemStats.mockResolvedValue({
    item: { id: 'chr_public', name: '公开角色', totalPulls: 3 },
  });
  mocks.buildPublicTrends.mockResolvedValue({
    metric: 'pulls',
    granularity: 'day',
    days: 30,
    points: [{ period: '2026-04-22', value: 12 }],
  });
  mocks.buildPublicDistributions.mockResolvedValue({
    poolType: 'all',
    distribution: [{ bucket: '1-10', count: 2 }],
  });
}

function installOfficialBotMocks() {
  mocks.requireApiClient.mockResolvedValue({
    adminClient: { from: vi.fn(), rpc: vi.fn() },
    client: {
      id: 'bot-telegram',
      client_type: 'official_bot',
      provider: 'telegram',
      granted_scopes: ['bot.self.read', 'public.read'],
      rate_limit_tier: 'official_bot',
    },
    key: { key_prefix: 'ek_live_bot' },
  });
  mocks.resolveVerifiedBinding.mockResolvedValue({
    id: 'binding-private',
    user_id: 'user-private',
    provider: 'telegram',
    platform_user_id: 'tg-private',
    display_handle: '@tester',
    status: 'verified',
    verified_at: '2026-04-22T00:00:00.000Z',
  });
  mocks.fetchBotDashboard.mockResolvedValue({
    user: { id: 'user-private', username: '船长', role: 'user' },
    summary: {
      total_pulls: 12,
      latest_pull: {
        id: 'history-private',
        user_id: 'user-private',
        item_name: '庄方宜',
      },
      recommended_pool: {
        game_uid: '1545606431',
        pool_id: 'special_1_2_1',
        display_name: '春雷动，万物生',
      },
    },
  });
  mocks.fetchBotPoolIndex.mockResolvedValue({
    user: { id: 'user-private', username: '船长' },
    total_pool_entries: 1,
    latest_pool: {
      game_uid: '1545606431',
      pool_id: 'special_1_2_1',
      display_name: '春雷动，万物生',
    },
    accounts: [
      {
        game_uid: '1545606431',
        display_name: '老鲤船长',
        pools: [
          {
            game_uid: '1545606431',
            pool_id: 'special_1_2_1',
            display_name: '春雷动，万物生',
          },
        ],
      },
    ],
  });
  mocks.fetchBotPoolDetail.mockResolvedValue({
    user: { id: 'user-private', username: '船长' },
    account: { game_uid: '1545606431', display_name: '老鲤船长' },
    pool: { pool_id: 'special_1_2_1', display_name: '春雷动，万物生' },
    timeline_sections: [{ entries: [{ record_id: 'history-private', pulls: 33 }] }],
  });
  mocks.fetchBotRecentPulls.mockResolvedValue({
    user: { id: 'user-private', username: '船长' },
    records: [
      {
        id: 'history-private',
        game_uid: '1545606431',
        pool_id: 'special_1_2_1',
        item_name: '庄方宜',
      },
    ],
  });
  mocks.fetchBotSelfSummary.mockResolvedValue({
    user: { id: 'user-private', username: '船长' },
    records: [{ id: 'history-private', user_id: 'user-private', item_name: '庄方宜' }],
  });
  mocks.fetchBotAnalysis.mockResolvedValue({
    user: { id: 'user-private', username: '船长' },
    navigation: {
      accounts: [
        {
          ref: 'a.MTU0NTYwNjQzMQ',
          display_name: '老鲤船长',
        },
      ],
    },
    selected: {
      account: { ref: 'a.MTU0NTYwNjQzMQ', display_name: '老鲤船长' },
      pool: {
        ref: 'p.MTU0NTYwNjQzMXxzcGVjaWFsXzFfMl8x',
        display_name: '春雷动，万物生',
        pool_id: 'special_1_2_1',
      },
      detail: {
        account: { game_uid: '1545606431', display_name: '老鲤船长' },
        pool: { pool_id: 'special_1_2_1', display_name: '春雷动，万物生' },
        timeline_sections: [{ entries: [{ record_id: 'history-private', pulls: 33 }] }],
        share_payload: { poolId: 'special_1_2_1', poolName: '春雷动，万物生' },
      },
    },
  });
  mocks.renderDashboardShareCardImage.mockResolvedValue({
    file_name: 'share.png',
    mime_type: 'image/png',
    buffer: Buffer.from('png'),
  });
  mocks.fetchBotPoolLog.mockResolvedValue({
    file_name: '老鲤船长_春雷动_详细日志',
    account: { ref: 'a.MTU0NTYwNjQzMQ', display_name: '老鲤船长' },
    pool: {
      ref: 'p.MTU0NTYwNjQzMXxzcGVjaWFsXzFfMl8x',
      pool_id: 'special_1_2_1',
      display_name: '春雷动，万物生',
    },
    total: 1,
    rows: [
      {
        index: 1,
        time: '2026-04-22T00:00:00.000Z',
        account_name: '老鲤船长',
        pool_name: '春雷动，万物生',
        pool_type: 'limited',
        item_name: '庄方宜',
        rarity: 6,
      },
    ],
  });
}

describe('public API v1 contract and privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installPublicMocks();
  });

  it.each([
    ['meta', metaHandler, {}],
    ['openapi', openApiHandler, {}],
    ['pools', poolsHandler, { type: 'limited' }],
    ['pool', poolHandler, { id: 'public_pool' }],
    ['characters', charactersHandler, { type: 'character' }],
    ['character', characterHandler, { id: 'chr_public' }],
    ['announcements', announcementsHandler, { locale: 'zh-CN' }],
    ['site overview', siteOverviewHandler, {}],
    ['stats global', statsGlobalHandler, {}],
    ['stats rankings', statsRankingsHandler, {}],
    ['stats pools', statsPoolsHandler, { type: 'limited' }],
    ['stats pool', statsPoolHandler, { id: 'public_pool' }],
    ['stats items', statsItemsHandler, { type: 'character' }],
    ['stats item', statsItemHandler, { id: 'chr_public', type: 'character' }],
    ['stats trends', statsTrendsHandler, { metric: 'pulls' }],
    ['stats distributions', statsDistributionsHandler, { poolType: 'all' }],
  ])('%s returns the standard v1 envelope', async (_name, handler, query) => {
    const res = await call(handler, { query });
    expectV1Success(res);
    expectNoPrivateIdentifiers(res.body);
  });

  it('sanitizes internal errors from public endpoints', async () => {
    mocks.buildPoolsCatalog.mockRejectedValue(new Error('SQL relation "history" leaked user_id'));

    const res = await call(poolsHandler);

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
    expectNoPrivateIdentifiers(res.body);
    expect(JSON.stringify(res.body)).not.toContain('SQL');
    expect(JSON.stringify(res.body)).not.toContain('history');
  });
});

describe('official bot API contract and privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installOfficialBotMocks();
  });

  it.each([
    ['dashboard', botDashboardHandler, {}],
    ['pools', botPoolsHandler, {}],
    ['pool-detail', botPoolDetailHandler, { poolId: 'special_1_2_1' }],
    ['recent-pulls', botRecentPullsHandler, { limit: 5 }],
    ['self-summary', botSelfSummaryHandler, {}],
    ['analysis', botAnalysisHandler, { poolRef: 'p.MTU0NTYwNjQzMXxzcGVjaWFsXzFfMl8x' }],
    ['share-card', botShareCardHandler, { poolRef: 'p.MTU0NTYwNjQzMXxzcGVjaWFsXzFfMl8x' }],
    ['pool-log', botPoolLogHandler, { poolRef: 'p.MTU0NTYwNjQzMXxzcGVjaWFsXzFfMl8x', format: 'csv' }],
  ])('%s returns usable data without raw private identifiers', async (_name, handler, extraQuery) => {
    const res = await call(handler, {
      query: {
        provider: 'telegram',
        platformUserId: 'tg-private',
        ...extraQuery,
      },
    });

    expectV1Success(res);
    expect(res.body.data.binding).toMatchObject({
      provider: 'telegram',
      display_handle: '@tester',
      status: 'verified',
    });
    expectNoPrivateIdentifiers(res.body);
  });

  it('blocks cross-provider official bot access', async () => {
    const res = await call(botAnalysisHandler, {
      query: {
        provider: 'discord',
        platformUserId: 'discord-private',
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: 'forbidden',
        message: 'Provider mismatch for official bot client',
      },
    });
    expect(mocks.resolveVerifiedBinding).not.toHaveBeenCalled();
  });
});

describe('platform binding API contract and privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-private' },
      accessToken: 'access-token',
    });
    mocks.requireVerifierClient.mockResolvedValue({
      adminClient: createBindingVerifyAdminClient(),
      client: {
        id: 'official-telegram',
        provider: 'telegram',
      },
    });
  });

  it('creates a binding challenge without exposing platform identifiers', async () => {
    mocks.getSupabaseAdminClient.mockReturnValue(createBindingChallengeAdminClient());

    const res = await call(bindingChallengeHandler, {
      method: 'POST',
      body: { provider: 'telegram' },
    });

    expectV1Success(res);
    expect(res.body.data).toMatchObject({
      binding: {
        id: 'binding-private',
        provider: 'telegram',
        status: 'pending',
      },
      challenge: {
        id: 'challenge-private',
        provider: 'telegram',
        status: 'pending',
        challenge_code: expect.any(String),
      },
    });
    expectNoPrivateIdentifiers(res.body);
  });

  it('loads own binding status without exposing platform identifiers', async () => {
    mocks.getSupabaseAdminClient.mockReturnValue(createBindingMeAdminClient());

    const res = await call(bindingMeHandler);

    expectV1Success(res);
    expect(res.body.data.bindings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        provider: 'telegram',
        binding: expect.objectContaining({
          display_handle: '@tester',
          status: 'verified',
        }),
      }),
      expect.objectContaining({
        provider: 'discord',
        challenge: expect.objectContaining({
          challenge_code: 'ABC12345',
          status: 'pending',
        }),
      }),
    ]));
    expectNoPrivateIdentifiers(res.body);
  });

  it('verifies a challenge with verifier credentials only', async () => {
    const res = await call(bindingVerifyHandler, {
      method: 'POST',
      body: {
        provider: 'telegram',
        challengeCode: 'ABC12345',
        platformUserId: 'tg-private',
        displayHandle: '@tester',
      },
    });

    expectV1Success(res);
    expect(res.body.data.binding).toMatchObject({
      id: 'binding-private',
      provider: 'telegram',
      display_handle: '@tester',
      status: 'verified',
    });
    expect(mocks.requireVerifierClient).toHaveBeenCalled();
    expectNoPrivateIdentifiers(res.body);
  });

  it('revokes an active binding without exposing platform identifiers', async () => {
    mocks.getSupabaseAdminClient.mockReturnValue(createBindingRevokeAdminClient());

    const res = await call(bindingRevokeHandler, {
      method: 'POST',
      body: { provider: 'telegram' },
    });

    expectV1Success(res);
    expect(res.body.data.binding).toMatchObject({
      id: 'binding-private',
      provider: 'telegram',
      display_handle: '@tester',
      status: 'revoked',
    });
    expectNoPrivateIdentifiers(res.body);
  });
});
