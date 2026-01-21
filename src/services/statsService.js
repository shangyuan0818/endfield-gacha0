import { supabase } from '../supabaseClient';
import { getCachedUrgentClicks } from './cacheService';

/**
 * 统计服务 - 处理"急"按钮点击统计等全局统计数据
 * 优化版：移除 Realtime 订阅，改用智能轮询，减少数据库负载
 * 
 * 架构说明：
 * - 初始加载：Serverless API (60s缓存) -> Supabase -> localStorage
 * - 点击更新：乐观更新 + 2秒防抖批量上传
 * - 数据同步：30秒智能轮询（仅活动标签页）
 */

const STATS_TABLE = 'global_stats';
const URGENT_BUTTON_KEY = 'urgent_button_clicks';
const LAST_FETCH_KEY = 'urgent_button_last_fetch';

/**
 * 获取"急"按钮的点击次数
 * 策略：Serverless API 缓存 -> 直连 Supabase -> 本地缓存
 * @param {boolean} forceRefresh - 是否强制刷新（跳过本地缓存检查）
 * @returns {Promise<number>} 点击次数
 */
export async function getUrgentButtonClicks(forceRefresh = false) {
  try {
    // 1. 优先尝试从 Serverless API 获取（已预缓存）
    try {
      const cachedClicks = await getCachedUrgentClicks(forceRefresh);
      if (cachedClicks !== undefined && cachedClicks !== null) {
        localStorage.setItem(URGENT_BUTTON_KEY, cachedClicks.toString());
        localStorage.setItem(LAST_FETCH_KEY, Date.now().toString());
        return cachedClicks;
      }
    } catch (cacheError) {
      console.warn('Serverless API 不可用，尝试直连数据库:', cacheError.message);
    }

    // 2. 回退到直连 Supabase
    if (!supabase) {
      console.warn('Supabase 未配置，返回本地缓存数据');
      const cached = localStorage.getItem(URGENT_BUTTON_KEY);
      return cached ? parseInt(cached, 10) : 0;
    }

    const { data, error } = await supabase
      .from(STATS_TABLE)
      .select('value')
      .eq('key', URGENT_BUTTON_KEY)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return 0;
      }
      throw error;
    }

    const clicks = parseInt(data?.value || '0', 10);
    localStorage.setItem(URGENT_BUTTON_KEY, clicks.toString());
    localStorage.setItem(LAST_FETCH_KEY, Date.now().toString());
    return clicks;
  } catch (error) {
    console.error('获取急按钮点击次数失败:', error);
    // 3. 最后回退到本地缓存
    const cached = localStorage.getItem(URGENT_BUTTON_KEY);
    return cached ? parseInt(cached, 10) : 0;
  }
}

/**
 * 获取本地缓存的点击次数（不发起网络请求）
 * 用于快速初始化显示
 * @returns {number} 本地缓存的点击次数
 */
export function getLocalUrgentClicks() {
  const cached = localStorage.getItem(URGENT_BUTTON_KEY);
  return cached ? parseInt(cached, 10) : 0;
}

/**
 * 检查是否需要刷新数据
 * @param {number} maxAge - 最大缓存时间（毫秒）
 * @returns {boolean} 是否需要刷新
 */
export function shouldRefreshUrgentClicks(maxAge = 30000) {
  const lastFetch = localStorage.getItem(LAST_FETCH_KEY);
  if (!lastFetch) return true;
  return Date.now() - parseInt(lastFetch, 10) > maxAge;
}

/**
 * 批量增加"急"按钮的点击次数
 * @param {number} count - 要增加的次数
 * @returns {Promise<number>} 更新后的点击次数
 */
export async function incrementUrgentButtonClicksBatch(count = 1) {
  try {
    if (!supabase) {
      console.warn('Supabase 未配置，仅更新本地缓存');
      const cached = localStorage.getItem(URGENT_BUTTON_KEY);
      const current = cached ? parseInt(cached, 10) : 0;
      const newCount = current + count;
      localStorage.setItem(URGENT_BUTTON_KEY, newCount.toString());
      return newCount;
    }

    // 使用 Supabase RPC 函数来原子性地增加计数（批量）
    const { data, error } = await supabase.rpc('increment_urgent_clicks_batch', {
      increment_by: count
    });

    if (error) {
      throw error;
    }

    const newCount = parseInt(data || '0', 10);
    // 更新本地缓存
    localStorage.setItem(URGENT_BUTTON_KEY, newCount.toString());
    return newCount;
  } catch (error) {
    console.error('增加急按钮点击次数失败:', error);
    // 降级方案：仅更新本地缓存
    const cached = localStorage.getItem(URGENT_BUTTON_KEY);
    const current = cached ? parseInt(cached, 10) : 0;
    const newCount = current + count;
    localStorage.setItem(URGENT_BUTTON_KEY, newCount.toString());
    return newCount;
  }
}

/**
 * 增加"急"按钮的点击次数（单次，兼容旧代码）
 * @returns {Promise<number>} 更新后的点击次数
 */
export async function incrementUrgentButtonClicks() {
  return incrementUrgentButtonClicksBatch(1);
}

/**
 * 创建智能轮询器
 * 仅在页面可见时轮询，减少不必要的请求
 * @param {Function} callback - 当数据更新时的回调函数
 * @param {number} interval - 轮询间隔（毫秒），默认 30 秒
 * @returns {Function} 停止轮询的函数
 */
export function createUrgentClicksPoller(callback, interval = 30000) {
  let timerId = null;
  let lastValue = getLocalUrgentClicks();
  let isPolling = false;

  const poll = async () => {
    // 避免重复轮询
    if (isPolling) return;
    
    // 仅在页面可见时轮询
    if (document.hidden) {
      return;
    }

    isPolling = true;
    try {
      const newValue = await getUrgentButtonClicks(true); // 强制刷新
      // 仅当值变化时才回调
      if (newValue !== lastValue) {
        lastValue = newValue;
        callback(newValue);
      }
    } catch (error) {
      console.warn('轮询急按钮数据失败:', error.message);
    } finally {
      isPolling = false;
    }
  };

  // 页面可见性变化时的处理
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      // 页面变为可见，检查是否需要刷新
      if (shouldRefreshUrgentClicks(interval)) {
        poll();
      }
    }
  };

  // 启动轮询
  const start = () => {
    // 立即执行一次（如果需要刷新）
    if (shouldRefreshUrgentClicks(interval)) {
      poll();
    }
    
    // 设置定时器
    timerId = setInterval(poll, interval);
    
    // 监听页面可见性变化
    document.addEventListener('visibilitychange', handleVisibilityChange);
  };

  // 停止轮询
  const stop = () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };

  // 立即启动
  start();

  // 返回停止函数
  return stop;
}

/**
 * @deprecated 已移除 Realtime 订阅，请使用 createUrgentClicksPoller
 * 保留此函数以兼容旧代码，但实际使用轮询
 */
export function subscribeToUrgentButtonClicks(callback) {
  console.warn('[statsService] subscribeToUrgentButtonClicks 已废弃，自动使用智能轮询替代');
  return createUrgentClicksPoller(callback, 30000);
}

