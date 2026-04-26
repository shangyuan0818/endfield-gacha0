export class EndfieldApiError extends Error {
  constructor(message, { status = 500, payload = null } = {}) {
    super(message);
    this.name = 'EndfieldApiError';
    this.status = status;
    this.payload = payload;
  }
}

function buildUrl(baseUrl, path, query = {}) {
  const url = new URL(path, `${baseUrl}/`);
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    url.searchParams.set(key, String(value));
  });
  return url;
}

async function parseResponse(response) {
  const rawText = await response.text();
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    const contentType = response.headers?.get?.('content-type') || '';
    const normalizedText = String(rawText).trim();
    const looksLikeHtml = normalizedText.startsWith('<!DOCTYPE html') || normalizedText.startsWith('<html');
    const looksLikeSourceModule = normalizedText.startsWith('import ') || normalizedText.includes('export default');
    const looksLikeNonJsonDevResponse = looksLikeHtml || looksLikeSourceModule;

    return {
      success: false,
      error: looksLikeNonJsonDevResponse
        ? 'BOT API 当前返回了非 JSON 内容。请检查 OFFICIAL_BOT_BASE_URL 是否指向实际 API 服务，或确认本地 dev API 路由已加载。'
        : `BOT API 返回了无法解析的响应（content-type: ${contentType || 'unknown'}）。`,
      meta: {
        contentType: contentType || null,
        nonJson: true,
      },
    };
  }
}

function getPayloadErrorMessage(payload, fallback) {
  if (typeof payload?.error === 'string') {
    return payload.error;
  }

  if (payload?.error?.message) {
    return payload.error.message;
  }

  return fallback;
}

export class EndfieldApiClient {
  constructor(config, fetchImpl = fetch) {
    this.baseUrl = config.baseUrl;
    this.publicApiKey = config.publicApiKey;
    this.verifierSecret = config.verifierSecret;
    this.requestTimeoutMs = config.requestTimeoutMs || 30000;
    this.fetchImpl = fetchImpl;
  }

  async request(path, {
    method = 'GET',
    credential = 'public',
    query = {},
    body,
  } = {}) {
    const secret = credential === 'verifier'
      ? this.verifierSecret
      : this.publicApiKey;

    let response;
    try {
      response = await this.fetchImpl(buildUrl(this.baseUrl, path, query), {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': secret,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (error) {
      throw new EndfieldApiError(
        'BOT API 暂时无法连接。请确认站点服务已启动，或稍后再试。',
        {
          status: 503,
          payload: {
            error: error?.message || 'fetch failed',
            path,
          },
        }
      );
    }

    const payload = await parseResponse(response);
    if (!response.ok || payload?.success !== true) {
      throw new EndfieldApiError(
        getPayloadErrorMessage(payload, `Request failed: ${response.status}`),
        { status: response.status, payload }
      );
    }

    return payload.data ?? null;
  }

  async verifyBinding({ provider, challengeCode, platformUserId, displayHandle }) {
    return this.request('/api/integrations/bindings/verify', {
      method: 'POST',
      credential: 'verifier',
      body: {
        provider,
        challengeCode,
        platformUserId,
        displayHandle,
      },
    });
  }

  async getSelfSummary({ provider, platformUserId }) {
    return this.request('/api/dev/v1/bot/self-summary', {
      query: { provider, platformUserId },
    });
  }

  async getDashboard({ provider, platformUserId }) {
    return this.request('/api/dev/v1/bot/dashboard', {
      query: { provider, platformUserId },
    });
  }

  async getRecentPulls({ provider, platformUserId, limit = 10 }) {
    return this.request('/api/dev/v1/bot/recent-pulls', {
      query: { provider, platformUserId, limit },
    });
  }

  async getPoolStats({ provider, platformUserId }) {
    return this.request('/api/dev/v1/bot/pools', {
      query: { provider, platformUserId },
    });
  }

  async getPoolDetail({ provider, platformUserId, gameUid, poolId }) {
    return this.request('/api/dev/v1/bot/pool-detail', {
      query: { provider, platformUserId, gameUid, poolId },
    });
  }

  async getAnalysis({ provider, platformUserId, accountRef, poolRef }) {
    return this.request('/api/dev/v1/bot/analysis', {
      query: { provider, platformUserId, accountRef, poolRef },
    });
  }

  async getShareCard({ provider, platformUserId, accountRef, poolRef, theme = 'dark' }) {
    const result = await this.request('/api/dev/v1/bot/share-card', {
      query: { provider, platformUserId, accountRef, poolRef, theme },
    });
    const image = result?.image || null;
    if (!image?.content_base64) {
      throw new EndfieldApiError('分享图生成失败：API 未返回图片内容。', { status: 502, payload: result });
    }

    return {
      kind: 'photo',
      buffer: Buffer.from(image.content_base64, 'base64'),
      mimeType: image.mime_type || 'image/png',
      fileName: image.file_name || 'endfield-gacha-share.png',
      caption: [
        result?.account?.display_name,
        result?.pool?.display_name,
      ].filter(Boolean).join(' · ') || '终末地抽卡分析分享图',
    };
  }

  async getPoolLog({ provider, platformUserId, accountRef, poolRef, format = 'csv' }) {
    const result = await this.request('/api/dev/v1/bot/pool-log', {
      query: { provider, platformUserId, accountRef, poolRef, format },
    });
    const file = result?.file || null;
    if (!file?.content_base64) {
      throw new EndfieldApiError('日志导出失败：API 未返回文件内容。', { status: 502, payload: result });
    }

    return {
      kind: 'document',
      buffer: Buffer.from(file.content_base64, 'base64'),
      mimeType: file.mime_type || 'text/csv; charset=utf-8',
      fileName: file.file_name || 'endfield-gacha-pool-log.csv',
      caption: [
        result?.account?.display_name,
        result?.pool?.display_name,
        `共 ${result?.total || 0} 条记录`,
      ].filter(Boolean).join(' · '),
    };
  }

  async getRankings() {
    const result = await this.request('/api/dev/v1/stats/rankings');
    return result?.rankings ?? result?.characterRanking ?? null;
  }

  async getGlobalSummary() {
    const result = await this.request('/api/dev/v1/stats/global');
    return result?.global ?? result?.globalSummary ?? null;
  }

  async getPools() {
    const result = await this.request('/api/dev/v1/pools');
    return result?.pools ?? [];
  }

  async getSiteOverview() {
    const result = await this.request('/api/dev/v1/site/overview');
    return result?.overview ?? null;
  }
}

export default {
  EndfieldApiClient,
  EndfieldApiError,
};
