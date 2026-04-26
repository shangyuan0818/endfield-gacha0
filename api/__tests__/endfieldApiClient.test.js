import { describe, expect, it } from 'vitest';
import { EndfieldApiClient, EndfieldApiError } from '../../bots/official/endfieldApiClient.js';

function createClient(fetchImpl) {
  return new EndfieldApiClient({
    baseUrl: 'http://127.0.0.1:5173',
    publicApiKey: 'public-key',
    verifierSecret: 'verifier-secret',
    requestTimeoutMs: 5000,
  }, fetchImpl);
}

describe('EndfieldApiClient', () => {
  it('does not leak raw non-JSON upstream responses back to callers', async () => {
    const client = createClient(async () => ({
      ok: true,
      status: 200,
      headers: {
        get(name) {
          return name === 'content-type' ? 'application/javascript' : null;
        },
      },
      async text() {
        return [
          "import { rejectDisallowedBrowserOrigin } from '../../../_lib/http.js';",
          'export default async function handler(req, res) {}',
        ].join('\n');
      },
    }));

    await expect(
      client.getDashboard({ provider: 'telegram', platformUserId: '123456' })
    ).rejects.toMatchObject({
      name: EndfieldApiError.name,
      message: 'BOT API 当前返回了非 JSON 内容。请检查 OFFICIAL_BOT_BASE_URL 是否指向实际 API 服务，或确认本地 dev API 路由已加载。',
      payload: {
        meta: {
          nonJson: true,
          contentType: 'application/javascript',
        },
      },
    });
  });

  it('wraps network failures as safe service errors', async () => {
    const client = createClient(async () => {
      throw new TypeError('fetch failed');
    });

    await expect(
      client.getDashboard({ provider: 'telegram', platformUserId: '123456' })
    ).rejects.toMatchObject({
      name: EndfieldApiError.name,
      status: 503,
      message: 'BOT API 暂时无法连接。请确认站点服务已启动，或稍后再试。',
      payload: {
        error: 'fetch failed',
        path: '/api/dev/v1/bot/dashboard',
      },
    });
  });

  it('reads analysis, share image and pool log through the API layer', async () => {
    const fetchImpl = async (url) => {
      const pathname = new URL(url).pathname;
      if (pathname === '/api/dev/v1/bot/analysis') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () => JSON.stringify({
            success: true,
            data: { selected: { pool: { ref: 'pool-ref' } } },
          }),
        };
      }
      if (pathname === '/api/dev/v1/bot/share-card') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () => JSON.stringify({
            success: true,
            data: {
              account: { display_name: '老鲤船长' },
              pool: { display_name: '春雷动，万物生' },
              image: {
                file_name: 'share.png',
                mime_type: 'image/png',
                content_base64: Buffer.from('png-data').toString('base64'),
              },
            },
          }),
        };
      }
      if (pathname === '/api/dev/v1/bot/pool-log') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () => JSON.stringify({
            success: true,
            data: {
              account: { display_name: '老鲤船长' },
              pool: { display_name: '春雷动，万物生' },
              total: 1,
              file: {
                file_name: 'log.csv',
                mime_type: 'text/csv; charset=utf-8',
                content_base64: Buffer.from('csv-data').toString('base64'),
              },
            },
          }),
        };
      }

      throw new Error(`Unexpected path: ${pathname}`);
    };
    const client = createClient(fetchImpl);

    await expect(client.getAnalysis({
      provider: 'telegram',
      platformUserId: '123456',
      poolRef: 'pool-ref',
    })).resolves.toMatchObject({
      selected: { pool: { ref: 'pool-ref' } },
    });

    await expect(client.getShareCard({
      provider: 'telegram',
      platformUserId: '123456',
      poolRef: 'pool-ref',
    })).resolves.toMatchObject({
      kind: 'photo',
      fileName: 'share.png',
      buffer: Buffer.from('png-data'),
    });

    await expect(client.getPoolLog({
      provider: 'telegram',
      platformUserId: '123456',
      poolRef: 'pool-ref',
    })).resolves.toMatchObject({
      kind: 'document',
      fileName: 'log.csv',
      buffer: Buffer.from('csv-data'),
    });
  });
});
