/**
 * Warfarin Wiki 静态资源代理
 *
 * 用于代理头像图片，避免浏览器直接请求 static.warfarin.wiki 时触发 CORS。
 *
 * 端点: GET /api/wiki-asset-proxy?type=character|weapon&id=xxx
 */

import {
  checkMemoryRateLimit,
  getRequesterKey,
  rejectDisallowedBrowserOrigin
} from './_lib/http.js';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 120;

const REMOTE_IMAGE_URLS = {
  character: (id) => `https://static.warfarin.wiki/v3/charicon/icon_${id}.webp`,
  weapon: (id) => `https://static.warfarin.wiki/v3/itemicon/${id}.webp`,
};

function isValidAssetId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._-]+$/.test(value);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');

  if (rejectDisallowedBrowserOrigin(req, res, { methods: 'GET, OPTIONS' })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  const rateLimit = checkMemoryRateLimit(getRequesterKey(req), {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX
  });

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);

  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', rateLimit.retryAfter);
    return res.status(429).json({
      success: false,
      error: '请求过于频繁，请稍后再试'
    });
  }

  const type = String(req.query?.type || '');
  const id = String(req.query?.id || '');

  if (!(type in REMOTE_IMAGE_URLS) || !isValidAssetId(id)) {
    return res.status(400).json({
      success: false,
      error: '参数错误: 需要合法的 type 和 id'
    });
  }

  try {
    const response = await fetch(REMOTE_IMAGE_URLS[type](id), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8',
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: `获取资源失败: HTTP ${response.status}`
      });
    }

    const contentType = response.headers.get('content-type') || 'image/webp';
    const cacheControl = response.headers.get('cache-control');
    const arrayBuffer = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    if (cacheControl) {
      res.setHeader('Cache-Control', cacheControl);
    }

    return res.status(200).end(Buffer.from(arrayBuffer));
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `代理资源失败: ${error.message}`
    });
  }
}
