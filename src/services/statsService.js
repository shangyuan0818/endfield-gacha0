import { supabase } from '../supabaseClient';

/**
 * 统计服务 - 处理"急"按钮点击统计等全局统计数据
 */

const STATS_TABLE = 'global_stats';
const URGENT_BUTTON_KEY = 'urgent_button_clicks';

/**
 * 获取"急"按钮的点击次数
 * @returns {Promise<number>} 点击次数
 */
export async function getUrgentButtonClicks() {
  try {
    if (!supabase) {
      console.warn('Supabase 未配置，返回本地缓存数据');
      // 从 localStorage 获取缓存
      const cached = localStorage.getItem(URGENT_BUTTON_KEY);
      return cached ? parseInt(cached, 10) : 0;
    }

    const { data, error } = await supabase
      .from(STATS_TABLE)
      .select('value')
      .eq('key', URGENT_BUTTON_KEY)
      .single();

    if (error) {
      // 如果记录不存在，返回 0
      if (error.code === 'PGRST116') {
        return 0;
      }
      throw error;
    }

    const clicks = parseInt(data?.value || '0', 10);
    // 缓存到本地
    localStorage.setItem(URGENT_BUTTON_KEY, clicks.toString());
    return clicks;
  } catch (error) {
    console.error('获取急按钮点击次数失败:', error);
    // 返回本地缓存
    const cached = localStorage.getItem(URGENT_BUTTON_KEY);
    return cached ? parseInt(cached, 10) : 0;
  }
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
 * 订阅"急"按钮点击次数的实时更新
 * @param {Function} callback - 当数据更新时的回调函数
 * @returns {Function} 取消订阅的函数
 */
export function subscribeToUrgentButtonClicks(callback) {
  if (!supabase) {
    console.warn('Supabase 未配置，无法订阅实时更新');
    return () => {};
  }

  const subscription = supabase
    .channel('urgent-button-stats')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: STATS_TABLE,
        filter: `key=eq.${URGENT_BUTTON_KEY}`
      },
      (payload) => {
        const newCount = parseInt(payload.new.value || '0', 10);
        // 更新本地缓存
        localStorage.setItem(URGENT_BUTTON_KEY, newCount.toString());
        callback(newCount);
      }
    )
    .subscribe();

  // 返回取消订阅的函数
  return () => {
    supabase.removeChannel(subscription);
  };
}

