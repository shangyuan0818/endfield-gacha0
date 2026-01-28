/**
 * 缓存服务 - 通过 Vercel Serverless API 获取预缓存数据
 * 提供更稳定的数据访问，减少客户端直连数据库的问题
 * 
 * 优化版 v3.0.0：
 * - 急按钮数据缓存从 5 分钟降到 30 秒，配合智能轮询
 * - 其他数据保持 5 分钟缓存
 * - 本地开发环境自动跳过 Serverless API
 */

const API_BASE = '/api/stats';
const LOCAL_CACHE_KEY = 'app_cached_data';
const LOCAL_CACHE_TTL = 5 * 60 * 1000; // 5分钟本地缓存（卡池/角色等）
const URGENT_CACHE_TTL = 30 * 1000; // 30秒缓存（急按钮数据）

// 检测是否在本地开发环境（Vite dev server）
const IS_LOCAL_DEV = import.meta.env.DEV || 
  (typeof window !== 'undefined' && 
   (window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1'));

/**
 * 从 localStorage 获取缓存
 * @param {number} maxAge - 可选的自定义最大缓存时间
 */
function getLocalCache(maxAge = LOCAL_CACHE_TTL) {
  try {
    const cached = localStorage.getItem(LOCAL_CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      // 检查是否过期
      if (Date.now() - timestamp < maxAge) {
        return data;
      }
    }
  } catch (e) {
    console.warn('读取本地缓存失败:', e);
  }
  return null;
}

/**
 * 保存到 localStorage
 */
function setLocalCache(data) {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('保存本地缓存失败:', e);
  }
}

/**
 * 从 Serverless API 获取数据（带重试）
 * 本地开发环境直接返回 null，使用 Supabase 直连
 */
async function fetchFromAPI(type, retries = 2) {
  // 本地开发环境跳过 Serverless API（因为不可用）
  if (IS_LOCAL_DEV) {
    return null;
  }

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(`${API_BASE}?type=${type}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        // 检查 Content-Type 是否为 JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.warn(`API 返回非 JSON 响应: ${contentType}`);
          return null;
        }
        
        const result = await response.json();
        if (result.success) {
          return result.data;
        }
      }
    } catch (error) {
      // 仅在非本地环境打印警告
      if (!IS_LOCAL_DEV) {
        console.warn(`API 请求失败 (尝试 ${i + 1}/${retries + 1}):`, error.message);
      }
      if (i < retries) {
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  return null;
}

/**
 * 获取急按钮点击数
 * 优先使用 Serverless API，失败则返回本地缓存
 * @param {boolean} forceRefresh - 是否强制刷新（跳过本地缓存）
 */
export async function getCachedUrgentClicks(forceRefresh = false) {
  // 如果不是强制刷新，先检查本地缓存（30秒有效期）
  if (!forceRefresh) {
    const localCache = getLocalCache(URGENT_CACHE_TTL);
    if (localCache?.urgentClicks !== undefined) {
      return localCache.urgentClicks;
    }
  }
  
  // 尝试从 API 获取
  const apiData = await fetchFromAPI('urgent');
  if (apiData?.urgentClicks !== undefined) {
    // 更新本地缓存
    const localCache = getLocalCache(LOCAL_CACHE_TTL) || {};
    localCache.urgentClicks = apiData.urgentClicks;
    setLocalCache(localCache);
    return apiData.urgentClicks;
  }
  
  // 回退到本地缓存（允许使用过期缓存）
  const expiredCache = getLocalCache(LOCAL_CACHE_TTL);
  if (expiredCache?.urgentClicks !== undefined) {
    return expiredCache.urgentClicks;
  }
  
  // 最后尝试直接从 localStorage 获取旧数据
  const oldCache = localStorage.getItem('urgent_button_clicks');
  return oldCache ? parseInt(oldCache, 10) : 0;
}

/**
 * 获取卡池列表
 */
export async function getCachedPools() {
  const apiData = await fetchFromAPI('pools');
  if (apiData?.pools) {
    const localCache = getLocalCache() || {};
    localCache.pools = apiData.pools;
    setLocalCache(localCache);
    return apiData.pools;
  }
  
  const localCache = getLocalCache();
  return localCache?.pools || [];
}

/**
 * 获取角色列表
 */
export async function getCachedCharacters() {
  const apiData = await fetchFromAPI('characters');
  if (apiData?.characters) {
    const localCache = getLocalCache() || {};
    localCache.characters = apiData.characters;
    setLocalCache(localCache);
    return apiData.characters;
  }
  
  const localCache = getLocalCache();
  return localCache?.characters || [];
}

/**
 * 预加载所有数据（一次性获取）
 * 在应用启动时调用，减少后续请求
 */
export async function preloadAllData() {
  const apiData = await fetchFromAPI('all');
  if (apiData) {
    setLocalCache(apiData);
    return apiData;
  }

  // 返回本地缓存
  const localCache = getLocalCache();
  if (localCache) {
    return localCache;
  }

  return { urgentClicks: 0, pools: [], characters: [] };
}

/**
 * 检查 Serverless API 是否可用
 */
export async function checkAPIAvailability() {
  // 本地开发环境直接返回 false
  if (IS_LOCAL_DEV) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE}?type=urgent`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5秒超时
    });
    return response.ok;
  } catch {
    return false;
  }
}

export default {
  getCachedUrgentClicks,
  getCachedPools,
  getCachedCharacters,
  preloadAllData,
  checkAPIAvailability
};

