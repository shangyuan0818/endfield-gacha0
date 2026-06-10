// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rejectDisallowedBrowserOrigin: vi.fn(() => false),
  createClient: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

vi.mock('../_lib/http.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    rejectDisallowedBrowserOrigin: mocks.rejectDisallowedBrowserOrigin,
  };
});

import handler from '../_routes/root/site-status.js';
import { buildPublicSiteStatus } from '../_lib/publicSiteStatus.js';

function createJsonResponseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
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

function createRequest({
  method = 'GET',
  url = 'https://example.com/api/site-status',
  headers = {},
} = {}) {
  return {
    method,
    url,
    headers,
  };
}

function createQueryResult(result) {
  const rows = Array.isArray(result) ? result : (result ? [result] : []);
  const error = result instanceof Error ? result : null;
  return {
    order: vi.fn(() => ({
      limit: vi.fn(async () => ({
        data: error ? null : rows,
        error,
      })),
    })),
    eq: vi.fn(() => ({
      limit: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({
          data: error ? null : rows[0] || null,
          error,
        })),
      })),
    })),
  };
}

function createPublicStatusClient({
  analyticsRow = [{
    pool_id: 'pool-1',
    pool_type: 'limited',
    total_pulls: 1200,
    source_version: 'analytics-v1',
    last_pull_at: '2026-06-04T01:00:00.000Z',
    updated_at: '2026-06-04T01:30:00.000Z',
  }],
  trendRow = [{
    metric: 'pulls',
    granularity: 'day',
    period_start: '2026-06-04',
    value: 1200,
    source_version: 'trend-v1',
    updated_at: '2026-06-04T01:40:00.000Z',
  }],
  siteConfigRow = {
    value: JSON.stringify({
      version: 'cache-v1',
      updatedAt: '2026-06-04T00:00:00.000Z',
    }),
  },
  endpointHeartbeatRows = [],
  probeHeartbeatRows = [],
} = {}) {
  return {
    from: vi.fn((table) => {
      if (table === 'public_pool_analytics_cache') {
        return {
          select: vi.fn(() => createQueryResult(analyticsRow)),
        };
      }
      if (table === 'public_pool_trend_cache') {
        return {
          select: vi.fn(() => createQueryResult(trendRow)),
        };
      }
      if (table === 'site_config') {
        return {
          select: vi.fn(() => createQueryResult(siteConfigRow)),
        };
      }
      if (table === 'status_endpoint_heartbeats') {
        return {
          select: vi.fn(() => createQueryResult(endpointHeartbeatRows)),
        };
      }
      if (table === 'status_probe_heartbeats') {
        return {
          select: vi.fn(() => createQueryResult(probeHeartbeatRows)),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe('public site status builder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a public status payload without private operational fields', async () => {
    const status = await buildPublicSiteStatus({
      supabase: createPublicStatusClient(),
      env: {
        MAIL_OUTBOX_WORKER_ENABLED: 'true',
        AUTH_MAIL_ACTIONS_ENABLED: 'true',
        AUTH_CAPTCHA_MODE: 'turnstile_pow',
      },
      now: new Date('2026-06-04T02:00:00.000Z'),
    });

    expect(status.overall.level).toBe('notice');
    expect(status.services.map(service => service.id)).toEqual([
      'site',
      'data',
      'public-stats',
      'mail',
      'import',
      'captcha',
    ]);
    expect(status.services.find(service => service.id === 'data')).toMatchObject({
      status: 'ok',
      summary: '公开数据读取入口可用。',
    });
    expect(status.services.find(service => service.id === 'public-stats')).toMatchObject({
      status: 'ok',
      updatedAt: '2026-06-04T01:40:00.000Z',
      detail: '最近样本池约 1,200 抽；采样缓存行 2',
    });
    expect(status.meta.cacheVersion).toBe('cache-v1');

    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain('smtp');
    expect(serialized).not.toContain('service_role');
    expect(serialized).not.toContain('user_id');
    expect(serialized).not.toContain('game_uid');
    expect(serialized).not.toContain('email@example.com');
    expect(serialized).not.toContain('mail_outbox');
  });

  it('degrades gracefully when public database checks are not configured', async () => {
    const status = await buildPublicSiteStatus({
      supabase: null,
      env: {},
      now: new Date('2026-06-04T02:00:00.000Z'),
    });

    expect(status.overall.level).toBe('notice');
    expect(status.services.find(service => service.id === 'data')).toMatchObject({
      status: 'unknown',
      summary: '当前环境未配置公开数据检查。',
    });
    expect(status.services.find(service => service.id === 'public-stats')).toMatchObject({
      status: 'notice',
      summary: '公共统计缓存暂无可展示数据。',
    });
  });

  it('maps mail emergency stop to a public warning without provider details', async () => {
    const status = await buildPublicSiteStatus({
      supabase: createPublicStatusClient(),
      env: {
        MAIL_OUTBOX_WORKER_ENABLED: 'true',
        MAIL_OUTBOX_GLOBAL_KILL_SWITCH: 'true',
        STALWART_SMTP_PASSWORD: 'smtp-password',
      },
      now: new Date('2026-06-04T02:00:00.000Z'),
    });

    const mail = status.services.find(service => service.id === 'mail');
    expect(mail).toMatchObject({
      status: 'warning',
      summary: '邮件发送当前处于紧急停发状态。',
    });
    expect(JSON.stringify(mail)).not.toContain('smtp-password');
    expect(JSON.stringify(mail)).not.toContain('STALWART');
  });

  it('marks public stats as stale when cache rows are too old', async () => {
    const status = await buildPublicSiteStatus({
      supabase: createPublicStatusClient({
        analyticsRow: [{
          pool_id: 'pool-old',
          pool_type: 'limited',
          total_pulls: 900,
          source_version: 'analytics-old',
          last_pull_at: '2026-06-01T00:00:00.000Z',
          updated_at: '2026-06-01T00:00:00.000Z',
        }],
        trendRow: [{
          metric: 'pulls',
          granularity: 'day',
          period_start: '2026-06-01',
          value: 900,
          source_version: 'trend-old',
          updated_at: '2026-06-01T00:00:00.000Z',
        }],
      }),
      env: {},
      now: new Date('2026-06-04T02:00:00.000Z'),
    });

    expect(status.services.find(service => service.id === 'public-stats')).toMatchObject({
      status: 'warning',
      summary: '公共统计缓存较久未更新。',
      updatedAt: '2026-06-01T00:00:00.000Z',
    });
    expect(status.incidents).toContainEqual(expect.objectContaining({
      serviceId: 'public-stats',
      summary: '公共统计缓存较久未更新。',
    }));
  });

  it('warns when public analytics cache checks fail', async () => {
    const status = await buildPublicSiteStatus({
      supabase: createPublicStatusClient({
        analyticsRow: new Error('relation "public.public_pool_analytics_cache" does not exist'),
        trendRow: new Error('relation "public.public_pool_trend_cache" does not exist'),
      }),
      env: {},
      now: new Date('2026-06-04T02:00:00.000Z'),
    });

    expect(status.services.find(service => service.id === 'data')).toMatchObject({
      status: 'warning',
      summary: '公开数据读取入口检查失败。',
    });
    expect(status.services.find(service => service.id === 'public-stats')).toMatchObject({
      status: 'warning',
      summary: '公共统计缓存当前不可确认。',
    });
  });

  it('uses endpoint heartbeat history to confirm import service without exposing backend details', async () => {
    const status = await buildPublicSiteStatus({
      supabase: createPublicStatusClient({
        endpointHeartbeatRows: [{
          endpoint_id: 'import-backend',
          label: '导入后端',
          status: 'ok',
          summary: 'HTTP 200',
          checked_at: '2026-06-04T01:58:00.000Z',
          response_ms: 168,
          payload: {
            detail: 'https://ef-backend.mogujun.icu/health',
          },
        }],
      }),
      env: {},
      now: new Date('2026-06-04T02:00:00.000Z'),
    });

    const importService = status.services.find(service => service.id === 'import');
    expect(importService).toMatchObject({
      status: 'ok',
      summary: '导入服务最近检查正常。',
      updatedAt: '2026-06-04T01:58:00.000Z',
      detail: '最近检测响应约 168ms',
    });
    expect(importService.history).toEqual([expect.objectContaining({
      status: 'ok',
      summary: '检测正常',
      responseMs: 168,
    })]);

    const serialized = JSON.stringify(importService);
    expect(serialized).not.toContain('ef-backend');
    expect(serialized).not.toContain('/health');
    expect(serialized).not.toContain('HTTP 200');
  });

  it('uses VPS probe backend health checks to confirm import service without exposing probe internals', async () => {
    const status = await buildPublicSiteStatus({
      supabase: createPublicStatusClient({
        probeHeartbeatRows: [{
          probe_id: 'intl-vps',
          label: '国际服 VPS',
          region: 'SG',
          status: 'ok',
          summary: 'VPS 探针运行正常。',
          reported_at: '2026-06-04T01:57:00.000Z',
          received_at: '2026-06-04T01:57:01.000Z',
          payload: {
            system: {
              hostname: 'private-intl-host',
            },
            checks: [{
              id: 'backend-health',
              label: '导入后端',
              status: 'ok',
              summary: 'HTTP 200 https://ef-backend.mogujun.icu/health',
              latencyMs: 92,
            }],
          },
        }],
      }),
      env: {},
      now: new Date('2026-06-04T02:00:00.000Z'),
    });

    const importService = status.services.find(service => service.id === 'import');
    expect(importService).toMatchObject({
      status: 'ok',
      summary: '导入服务最近检查正常。',
      updatedAt: '2026-06-04T01:57:00.000Z',
      detail: '最近检测响应约 92ms',
    });
    expect(importService.history).toEqual([expect.objectContaining({
      status: 'ok',
      summary: '检测正常',
      responseMs: 92,
    })]);

    const serialized = JSON.stringify(importService);
    expect(serialized).not.toContain('intl-vps');
    expect(serialized).not.toContain('private-intl-host');
    expect(serialized).not.toContain('ef-backend');
    expect(serialized).not.toContain('/health');
    expect(serialized).not.toContain('HTTP 200');
  });
});

describe('api/site-status route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.STATUS_ALERT_TELEGRAM_BOT_TOKEN;
    delete process.env.STATUS_ALERT_TELEGRAM_CHAT_ID;
    delete process.env.TELEGRAM_STATUS_BOT_TOKEN;
    delete process.env.TELEGRAM_STATUS_CHAT_ID;
  });

  it('returns public status JSON for GET requests', async () => {
    process.env.SUPABASE_URL = 'https://db.example.test';
    process.env.SUPABASE_SECRET_KEY = 'server-key';
    mocks.createClient.mockReturnValue(createPublicStatusClient());

    const req = createRequest();
    const res = createJsonResponseRecorder();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(mocks.rejectDisallowedBrowserOrigin).toHaveBeenCalledWith(req, res, {
      methods: 'GET, OPTIONS',
    });
    expect(res.body).toMatchObject({
      success: true,
      data: {
        overall: expect.any(Object),
        services: expect.any(Array),
        incidents: expect.any(Array),
      },
      meta: {
        source: 'public-checks',
      },
    });
    expect(JSON.stringify(res.body)).not.toContain('server-key');
  });

  it('handles OPTIONS and unsupported methods', async () => {
    const optionsRes = createJsonResponseRecorder();
    await handler(createRequest({ method: 'OPTIONS' }), optionsRes);

    expect(optionsRes.statusCode).toBe(204);
    expect(optionsRes.ended).toBe(true);

    const postRes = createJsonResponseRecorder();
    await handler(createRequest({ method: 'POST' }), postRes);

    expect(postRes.statusCode).toBe(405);
    expect(postRes.body).toEqual({
      success: false,
      error: 'Method not allowed',
    });
  });
});
