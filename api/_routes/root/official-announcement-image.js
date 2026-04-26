import {
  checkMemoryRateLimit,
  getRequesterKey,
  rejectDisallowedBrowserOrigin,
} from '../../_lib/http.js';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 180;
const ALLOWED_HOSTS = new Set([
  'web.hycdn.cn',
  'bbs.hycdn.cn',
  'endfield.hypergryph.com',
  'web-news.hypergryph.com',
]);

function normalizeTargetUrl(rawValue) {
  const normalizedValue = String(rawValue || '').trim();
  if (!normalizedValue) {
    return null;
  }

  try {
    const parsedUrl = new URL(normalizedValue);
    if (!/^https?:$/i.test(parsedUrl.protocol)) {
      return null;
    }

    if (!ALLOWED_HOSTS.has(parsedUrl.hostname)) {
      return null;
    }

    return parsedUrl;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');

  if (rejectDisallowedBrowserOrigin(req, res, { methods: 'GET, OPTIONS' })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  const rateLimit = checkMemoryRateLimit(getRequesterKey(req), {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
  });

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);

  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', rateLimit.retryAfter);
    return res.status(429).json({
      success: false,
      error: '请求过于频繁，请稍后再试',
    });
  }

  const targetUrl = normalizeTargetUrl(req.query?.url);
  if (!targetUrl) {
    return res.status(400).json({
      success: false,
      error: '参数错误: 需要合法的公告图片 URL',
    });
  }

  try {
    const response = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8',
        'Referer': 'https://endfield.hypergryph.com/',
        'Origin': 'https://endfield.hypergryph.com',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: `获取公告图片失败: HTTP ${response.status}`,
      });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    return res.status(200).end(Buffer.from(arrayBuffer));
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `代理公告图片失败: ${error?.message || 'unknown error'}`,
    });
  }
}
