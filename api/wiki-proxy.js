/**
 * Warfarin Wiki 数据代理
 *
 * 从 warfarin.wiki 获取干员和武器数据
 * 解析 Remix SSR 的 turbo-stream 格式返回干净 JSON
 *
 * 端点: GET /api/wiki-proxy?type=operators|weapons
 */

import {
  checkMemoryRateLimit,
  getRequesterKey,
  rejectDisallowedBrowserOrigin
} from './_lib/http.js';

// 内存缓存（5 分钟）
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20;

/**
 * 递归解码 turbo-stream 索引引用格式
 * @param {Array} arr - turbo-stream 原始数组
 * @param {*} val - 当前值（索引或直接值）
 * @param {Set} visited - 已访问索引（防止循环引用）
 * @returns {*} 解码后的值
 */
function resolveValue(arr, val, visited = new Set()) {
  // 负数索引返回 undefined
  if (typeof val === 'number' && val < 0) return undefined;

  // 数字索引 -> 解引用
  if (typeof val === 'number') {
    if (visited.has(val)) return undefined;
    visited.add(val);
    const item = arr[val];
    return resolveValue(arr, item, visited);
  }

  // 基本类型直接返回
  if (val === null || val === undefined) return val;
  if (typeof val === 'string' || typeof val === 'boolean') return val;

  // 数组 -> 每个元素递归解引用
  if (Array.isArray(val)) {
    return val.map(v => resolveValue(arr, v, new Set(visited)));
  }

  // 对象 -> 解析 _N:M 格式
  if (typeof val === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(val)) {
      if (key.startsWith('_')) {
        const keyIndex = parseInt(key.slice(1), 10);
        const resolvedKey = resolveValue(arr, keyIndex, new Set(visited));
        const resolvedVal = resolveValue(arr, value, new Set(visited));
        if (resolvedKey !== undefined) {
          result[resolvedKey] = resolvedVal;
        }
      } else {
        result[key] = resolveValue(arr, value, new Set(visited));
      }
    }
    return result;
  }

  return val;
}

/**
 * 从 HTML 中提取 turbo-stream 数据并解码
 * @param {string} html - warfarin.wiki 页面 HTML
 * @returns {Object} 解码后的 loaderData
 */
function parseTurboStream(html) {
  // 提取 streamController.enqueue 中的数据
  // 注意：内容包含转义引号 \"，需要用 ((?:[^"\\]|\\.)*)  匹配
  const pattern = /window\.__remixContext\.streamController\.enqueue\("((?:[^"\\]|\\.)*)"\)/g;
  const chunks = [];
  let match;

  while ((match = pattern.exec(html)) !== null) {
    chunks.push(match[1]);
  }

  if (chunks.length === 0) {
    throw new Error('未找到 turbo-stream 数据');
  }

  // 拼接所有 chunk 并解码 JS 字符串转义
  let raw = chunks.join('');
  raw = raw.replace(/\\"/g, '"');
  raw = raw.replace(/\\\\/g, '\\');
  raw = raw.replace(/\\n/g, '\n');
  raw = raw.replace(/\\r/g, '\r');
  raw = raw.replace(/\\t/g, '\t');
  raw = raw.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // 提取 JSON 数组（去掉 turbo-stream 前缀）
  const jsonStart = raw.indexOf('[');
  if (jsonStart === -1) {
    throw new Error('未找到 turbo-stream JSON 数组');
  }

  const jsonStr = raw.slice(jsonStart).trim();
  const arr = JSON.parse(jsonStr);
  return resolveValue(arr, 0);
}

/**
 * 从缓存获取数据（带 stale-on-error 降级）
 */
function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  const isStale = Date.now() - entry.timestamp > CACHE_TTL;
  return { data: entry.data, isStale };
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

function extractRoutePayload(routeData) {
  if (!routeData || typeof routeData !== 'object') {
    return null;
  }

  return routeData.data ?? routeData.response?.data ?? null;
}

/**
 * 主处理函数
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');

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

  const { type } = req.query;
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

  if (!type || !['operators', 'weapons'].includes(type)) {
    return res.status(400).json({
      success: false,
      error: '参数错误: type 必须为 operators 或 weapons'
    });
  }

  const cacheKey = `wiki-${type}`;

  // 检查缓存
  const cached = getFromCache(cacheKey);
  if (cached && !cached.isStale) {
    return res.status(200).json({ success: true, data: cached.data, cached: true });
  }

  try {
    const url = `https://warfarin.wiki/cn/${type}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const decoded = parseTurboStream(html);

    // 提取数据
    let data;
    const loaderData = decoded?.loaderData;

    if (!loaderData) {
      throw new Error('未找到 loaderData');
    }

    if (type === 'operators') {
      const routeData = loaderData['routes/$lang.operators._index'];
      data = extractRoutePayload(routeData);
    } else {
      const routeData = loaderData['routes/$lang.weapons._index'];
      data = extractRoutePayload(routeData);
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      throw new Error(`未能提取 ${type} 数据`);
    }

    // 更新缓存
    setCache(cacheKey, data);

    return res.status(200).json({ success: true, data, cached: false });
  } catch (error) {
    console.error(`[wiki-proxy] 获取 ${type} 失败:`, error.message);

    // stale-on-error 降级：如果有过期缓存，使用过期数据
    if (cached?.data) {
      return res.status(200).json({
        success: true,
        data: cached.data,
        cached: true,
        stale: true,
        warning: `使用缓存数据（获取新数据失败: ${error.message}）`
      });
    }

    return res.status(500).json({
      success: false,
      error: `获取 ${type} 数据失败: ${error.message}`
    });
  }
}
