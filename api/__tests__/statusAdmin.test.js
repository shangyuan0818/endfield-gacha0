// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rejectDisallowedBrowserOrigin: vi.fn(() => false),
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

import statusAdminHandler from '../_routes/root/status-admin.js';
import statusProbeHandler from '../_routes/root/status-probe.js';

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
  headers = {},
  body = undefined,
} = {}) {
  return {
    method,
    headers,
    body,
    socket: {
      remoteAddress: '127.0.0.1',
    },
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

function createStatusClient({
  probeRows = [{
    probe_id: 'intl-vps',
    label: '国际服 VPS',
    region: 'SG',
    status: 'ok',
    summary: 'VPS 探针运行正常。',
    reported_at: new Date().toISOString(),
    received_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    payload: {
      checks: [{ id: 'host', label: 'VPS 主机', status: 'ok', summary: 'host-a' }],
      metrics: [{ id: 'memory-used', label: '内存使用', value: 42, unit: '%', status: 'ok' }],
    },
  }],
} = {}) {
  const upsert = vi.fn((row) => ({
    select: vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({
        data: {
          ...row,
          received_at: '2026-06-08T01:02:00.000Z',
          updated_at: '2026-06-08T01:02:00.000Z',
        },
        error: null,
      })),
    })),
  }));

  return {
    upsert,
    from: vi.fn((table) => {
      if (table === 'public_pool_analytics_cache') {
        return {
          select: vi.fn(() => createQueryResult([{
            pool_id: 'pool-1',
            pool_type: 'limited',
            total_pulls: 1000,
            source_version: 'analytics-v1',
            last_pull_at: '2026-06-08T00:00:00.000Z',
            updated_at: '2026-06-08T00:10:00.000Z',
          }])),
        };
      }
      if (table === 'public_pool_trend_cache') {
        return {
          select: vi.fn(() => createQueryResult([{
            metric: 'pulls',
            granularity: 'day',
            period_start: '2026-06-08',
            value: 1000,
            source_version: 'trend-v1',
            updated_at: '2026-06-08T00:20:00.000Z',
          }])),
        };
      }
      if (table === 'site_config') {
        return {
          select: vi.fn(() => createQueryResult({
            value: JSON.stringify({ version: 'cache-v1' }),
          })),
        };
      }
      if (table === 'status_probe_reports') {
        return {
          upsert,
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(async () => ({
                data: probeRows,
                error: null,
              })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe('status admin and probe routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://db.example.test';
    process.env.SUPABASE_SECRET_KEY = 'server-key';
    process.env.STATUS_ADMIN_TOKEN = 'admin-token';
    process.env.STATUS_PROBE_TOKEN = 'probe-token';
    process.env.AUTH_CAPTCHA_MODE = 'turnstile_pow';
    process.env.MAIL_OUTBOX_WORKER_ENABLED = 'true';
    process.env.VERCEL_ENV = 'production';
    process.env.VERCEL_REGION = 'hkg1';
    process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef1234567890';
    mocks.createClient.mockReturnValue(createStatusClient());
  });

  it('rejects status admin requests without the independent token', async () => {
    const res = createJsonResponseRecorder();
    await statusAdminHandler(createRequest(), res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: 'status_admin_unauthorized',
    });
  });

  it('returns admin status with public service summaries and probe details', async () => {
    const res = createJsonResponseRecorder();
    await statusAdminHandler(createRequest({
      headers: {
        authorization: 'Bearer admin-token',
      },
    }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        overall: expect.any(Object),
        publicStatus: {
          services: expect.any(Array),
        },
        probes: [{
          id: 'intl-vps',
          label: '国际服 VPS',
          status: 'ok',
          checks: expect.any(Array),
          metrics: expect.any(Array),
        }],
        runtime: {
          deployment: {
            environment: 'production',
            region: 'hkg1',
            gitCommit: 'abcdef123456',
          },
        },
      },
    });
    expect(JSON.stringify(res.body)).not.toContain('server-key');
    expect(JSON.stringify(res.body)).not.toContain('admin-token');
    expect(JSON.stringify(res.body)).not.toContain('probe-token');
  });

  it('accepts normalized VPS probe reports with the probe token', async () => {
    const client = createStatusClient();
    mocks.createClient.mockReturnValue(client);

    const res = createJsonResponseRecorder();
    await statusProbeHandler(createRequest({
      method: 'POST',
      headers: {
        authorization: 'Bearer probe-token',
      },
      body: {
        probeId: 'cn-vps',
        label: '国服 VPS',
        region: 'CN',
        status: 'ok',
        summary: '一切正常',
        checks: [{ id: 'backend', label: '导入后端', status: 'ok', summary: 'HTTP 200' }],
        metrics: [{ id: 'memory', label: '内存', value: 51, unit: '%', status: 'ok' }],
      },
    }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        probeId: 'cn-vps',
      },
    });
    expect(client.upsert).toHaveBeenCalledWith(expect.objectContaining({
      probe_id: 'cn-vps',
      label: '国服 VPS',
      region: 'CN',
      status: 'ok',
      payload: {
        version: '',
        checks: [expect.objectContaining({ id: 'backend', status: 'ok' })],
        metrics: [expect.objectContaining({ id: 'memory', value: 51 })],
      },
    }), { onConflict: 'probe_id' });
  });

  it('rejects VPS probe reports without the probe token', async () => {
    const res = createJsonResponseRecorder();
    await statusProbeHandler(createRequest({
      method: 'POST',
      body: {
        probeId: 'cn-vps',
      },
    }), res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: 'status_probe_unauthorized',
    });
  });
});
