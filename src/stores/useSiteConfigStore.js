import { create } from 'zustand';
import { executeSupabaseMutation, executeSupabaseRead } from '../services/supabaseRequest';
import { supabase } from '../supabaseClient';

const SITE_CONFIG_SNAPSHOT_KEY = 'site_config_snapshot_v1';

function readSiteConfigSnapshot() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const rawSnapshot = window.localStorage.getItem(SITE_CONFIG_SNAPSHOT_KEY);
    if (!rawSnapshot) {
      return {};
    }

    const parsedSnapshot = JSON.parse(rawSnapshot);
    return parsedSnapshot && typeof parsedSnapshot.config === 'object' && parsedSnapshot.config !== null
      ? parsedSnapshot.config
      : {};
  } catch {
    return {};
  }
}

function writeSiteConfigSnapshot(config) {
  if (typeof window === 'undefined' || !config || typeof config !== 'object') {
    return;
  }

  try {
    window.localStorage.setItem(SITE_CONFIG_SNAPSHOT_KEY, JSON.stringify({
      config,
      fetchedAt: Date.now(),
    }));
  } catch {
    // 本地缓存写入失败时静默降级
  }
}

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
    const snapshot = readSiteConfigSnapshot();

    if (!supabase) {
      set({ config: snapshot, loaded: true });
      return;
    }

    try {
      const { data, error } = await executeSupabaseRead(
        () => supabase
          .from('site_config')
          .select('key, value'),
        {
          label: 'load site config',
          retries: 2,
        }
      );

      if (error) {
        throw error;
      }

      const configMap = {};
      (data || []).forEach(row => {
        configMap[row.key] = row.value;
      });

      writeSiteConfigSnapshot(configMap);
      set({ config: configMap, loaded: true });
    } catch {
      set({ config: snapshot, loaded: true });
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
      const { error } = await executeSupabaseMutation(
        () => supabase
          .from('site_config')
          .update({ value, updated_at: new Date().toISOString() })
          .eq('key', key),
        {
          label: 'update site config'
        }
      );

      if (error) throw error;

      const nextConfig = { ...get().config, [key]: value };
      writeSiteConfigSnapshot(nextConfig);
      set({ config: nextConfig });
      return true;
    } catch {
      return false;
    }
  },
}));

export default useSiteConfigStore;
