// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handleOfficialBotSelfApi: vi.fn(),
  fetchBotAnalysis: vi.fn(),
  fetchBotPoolLog: vi.fn(),
  renderDashboardShareCardImage: vi.fn(),
}));

vi.mock('../_lib/officialBotApi.js', () => ({
  handleOfficialBotSelfApi: mocks.handleOfficialBotSelfApi,
}));

vi.mock('../_lib/botDashboard.js', () => ({
  fetchBotAnalysis: mocks.fetchBotAnalysis,
  fetchBotPoolLog: mocks.fetchBotPoolLog,
}));

vi.mock('../_lib/dashboardShareImage.js', () => ({
  renderDashboardShareCardImage: mocks.renderDashboardShareCardImage,
}));

import analysisHandler from '../_routes/dev/v1/bot/analysis.js';
import poolLogHandler from '../_routes/dev/v1/bot/pool-log.js';
import shareCardHandler from '../_routes/dev/v1/bot/share-card.js';

function createJsonResponseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
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
      return this;
    },
  };
}

function installOfficialBotWrapperMock() {
  mocks.handleOfficialBotSelfApi.mockImplementation(async (req, res, options = {}) => {
    try {
      options.validateQuery?.(req.query || {});
      const data = await options.handler({
        adminClient: { from: vi.fn() },
        userId: 'user-1',
        req,
      });

      return res.status(200).json({
        success: true,
        data,
        meta: { apiVersion: 'v1' },
      });
    } catch (error) {
      return res.status(error?.status || 500).json({
        success: false,
        error: {
          code: error?.status === 400 ? 'bad_request' : 'internal_error',
          message: error?.message || 'Request failed',
        },
        meta: { apiVersion: 'v1' },
      });
    }
  });
}

describe('official bot analysis API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installOfficialBotWrapperMock();
  });

  it('returns API-first analysis navigation without requiring bot formatter code', async () => {
    mocks.fetchBotAnalysis.mockResolvedValue({
      navigation: {
        accounts: [
          {
            ref: 'account-ref',
            display_name: '老鲤船长',
            pools: [
              {
                ref: 'pool-ref',
                display_name: '春雷动，万物生',
                actions: {
                  detail_ref: 'pool-ref',
                  share_ref: 'pool-ref',
                  log_ref: 'pool-ref',
                },
              },
            ],
          },
        ],
      },
      selected: {
        account: { ref: 'account-ref', display_name: '老鲤船长' },
        pool: { ref: 'pool-ref', display_name: '春雷动，万物生' },
        detail: {
          timeline_sections: [{ entries: [{ pulls: 33 }] }],
          share_payload: { poolName: '春雷动，万物生' },
        },
      },
    });

    const req = {
      method: 'GET',
      query: {
        provider: 'telegram',
        platformUserId: 'tg-user',
        poolRef: 'pool-ref',
      },
      headers: {},
    };
    const res = createJsonResponseRecorder();

    await analysisHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mocks.fetchBotAnalysis).toHaveBeenCalledWith(expect.any(Object), 'user-1', expect.objectContaining({
      poolRef: 'pool-ref',
    }));
    expect(JSON.stringify(res.body)).not.toContain('special_');
    expect(JSON.stringify(res.body)).not.toContain('154560');
    expect(res.body.data.selected.detail.share_payload.poolName).toBe('春雷动，万物生');
  });

  it('returns a website-sourced share card image payload', async () => {
    mocks.fetchBotAnalysis.mockResolvedValue({
      selected: {
        detail: {
          account: { ref: 'account-ref', display_name: '老鲤船长' },
          pool: { ref: 'pool-ref', display_name: '春雷动，万物生' },
          timeline_sections: [{ entries: [{ pulls: 33 }] }],
          share_payload: { poolName: '春雷动，万物生' },
        },
      },
    });
    mocks.renderDashboardShareCardImage.mockResolvedValue({
      file_name: 'share.png',
      mime_type: 'image/png',
      buffer: Buffer.from('png-data'),
    });

    const req = {
      method: 'GET',
      query: {
        provider: 'telegram',
        platformUserId: 'tg-user',
        poolRef: 'pool-ref',
      },
      headers: {},
    };
    const res = createJsonResponseRecorder();

    await shareCardHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mocks.renderDashboardShareCardImage).toHaveBeenCalledWith(
      expect.objectContaining({
        share_payload: { poolName: '春雷动，万物生' },
      }),
      { theme: 'dark' }
    );
    expect(res.body.data.image).toMatchObject({
      file_name: 'share.png',
      mime_type: 'image/png',
      encoding: 'base64',
      content_base64: Buffer.from('png-data').toString('base64'),
    });
  });

  it('exports selected pool logs as a file payload', async () => {
    mocks.fetchBotPoolLog.mockResolvedValue({
      file_name: '老鲤船长_春雷动_详细日志',
      account: { ref: 'account-ref', display_name: '老鲤船长' },
      pool: { ref: 'pool-ref', display_name: '春雷动，万物生', pool_type: 'limited' },
      total: 1,
      rows: [
        {
          index: 1,
          time: '2026-04-20T12:00:00.000Z',
          account_name: '老鲤船长',
          pool_name: '春雷动，万物生',
          pool_type: 'limited',
          item_name: '庄方宜',
          rarity: 6,
          is_free: false,
          is_gift: false,
        },
      ],
    });

    const req = {
      method: 'GET',
      query: {
        provider: 'telegram',
        platformUserId: 'tg-user',
        poolRef: 'pool-ref',
        format: 'csv',
      },
      headers: {},
    };
    const res = createJsonResponseRecorder();

    await poolLogHandler(req, res);

    expect(res.statusCode).toBe(200);
    const csv = Buffer.from(res.body.data.file.content_base64, 'base64').toString('utf8');
    expect(csv).toContain('庄方宜');
    expect(csv).toContain('春雷动，万物生');
    expect(csv).not.toContain('special_');
    expect(csv).not.toContain('154560');
  });

  it('rejects share card requests without a pool selector', async () => {
    const req = {
      method: 'GET',
      query: {
        provider: 'telegram',
        platformUserId: 'tg-user',
      },
      headers: {},
    };
    const res = createJsonResponseRecorder();

    await shareCardHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(mocks.renderDashboardShareCardImage).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: 'bad_request',
        message: 'Missing pool selector',
      },
    });
  });
});
