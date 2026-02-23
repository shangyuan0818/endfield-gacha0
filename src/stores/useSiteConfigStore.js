import { create } from 'zustand';
import { supabase } from '../supabaseClient';

/**
 * 站点配置状态管理
 * 从数据库 site_config 表读取可编辑的站点配置（备案号、作者信息等）
 */
const useSiteConfigStore = create((set, get) => ({
  config: {},
  loaded: false,

  /**
   * 从数据库加载所有站点配置
   */
  loadConfig: async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('site_config')
        .select('key, value');

      if (!error && data) {
        const configMap = {};
        data.forEach(row => {
          configMap[row.key] = row.value;
        });
        set({ config: configMap, loaded: true });
      }
    } catch {
      // 静默失败，使用 fallback
    }
  },

  /**
   * 获取配置值，未加载时返回 fallback
   */
  getConfig: (key, fallback = '') => {
    const { config } = get();
    return config[key] ?? fallback;
  },

  /**
   * 管理员更新配置项
   */
  updateConfig: async (key, value) => {
    if (!supabase) return false;
    try {
      const { error } = await supabase
        .from('site_config')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);

      if (error) throw error;

      set(state => ({
        config: { ...state.config, [key]: value }
      }));
      return true;
    } catch {
      return false;
    }
  },
}));

export default useSiteConfigStore;
