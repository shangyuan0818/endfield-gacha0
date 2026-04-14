import { useMemo } from 'react';
import { create } from 'zustand';
import { executeSupabaseMutation } from '../services/supabaseRequest.js';
import { getBootstrapSiteConfig } from '../services/bootstrapService.js';
import { supabase } from '../supabaseClient.js';
import { APP_BUILD_INFO, APP_VERSION_LABEL } from '../constants/appMeta.js';

const SITE_CONFIG_SNAPSHOT_KEY = 'site_config_snapshot_v1';

function normalizeVersionConfig(config) {
  return {
    ...(config && typeof config === 'object' ? config : {}),
    site_version: APP_VERSION_LABEL,
    build_info: APP_BUILD_INFO,
  };
}

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
      ? normalizeVersionConfig(parsedSnapshot.config)
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
      config: normalizeVersionConfig(config),
      fetchedAt: Date.now(),
    }));
  } catch {
    // 本地缓存写入失败时静默降级
  }
}

const INITIAL_SITE_CONFIG_SNAPSHOT = readSiteConfigSnapshot();

/**
 * 站点配置状态管理
 * 从数据库 site_config 表读取可编辑的站点配置（备案号、作者信息等）
 */
const useSiteConfigStore = create((set, get) => ({
  config: INITIAL_SITE_CONFIG_SNAPSHOT,
  loaded: Object.keys(INITIAL_SITE_CONFIG_SNAPSHOT).length > 0,

  /**
   * 从数据库加载所有站点配置
   */
  loadConfig: async () => {
    const snapshot = readSiteConfigSnapshot();
    const bootstrapConfig = await getBootstrapSiteConfig().catch(() => null);

    if (bootstrapConfig && Object.keys(bootstrapConfig).length > 0) {
      writeSiteConfigSnapshot(bootstrapConfig);
      set({ config: normalizeVersionConfig(bootstrapConfig), loaded: true });
      return;
    }

    if (supabase) {
      try {
        const { data, error } = await executeSupabaseMutation(
          () => supabase
            .from('site_config')
            .select('key, value'),
          {
            label: 'load site config'
          }
        );

        if (!error && Array.isArray(data) && data.length > 0) {
          const nextConfig = data.reduce((config, row) => {
            config[row.key] = row.value;
            return config;
          }, {});
          const normalizedConfig = normalizeVersionConfig(nextConfig);
          writeSiteConfigSnapshot(normalizedConfig);
          set({ config: normalizedConfig, loaded: true });
          return;
        }
      } catch {
        // 本地直连失败时回退到快照
      }
    }

    set({ config: normalizeVersionConfig(snapshot), loaded: true });
  },

  /**
   * 获取配置值，未加载时返回 fallback
   */
  getConfig: (key, fallback = '') => {
    const { config } = get();
    return config[key] ?? fallback;
  },

  /**
   * 获取 JSON 配置值，自动解析，解析失败返回 defaultValue
   */
  getJsonConfig: (key, defaultValue = null) => {
    const { config } = get();
    const raw = config[key];
    if (raw == null || raw === '') return defaultValue;
    if (typeof raw !== 'string') return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return defaultValue;
    }
  },

  /**
   * 管理员更新配置项
   */
  updateConfig: async (key, value, meta = {}) => {
    if (!supabase) return false;
    try {
      const existingValue = Object.prototype.hasOwnProperty.call(get().config, key);
      const request = existingValue
        ? () => supabase
          .from('site_config')
          .update({ value, updated_at: new Date().toISOString() })
          .eq('key', key)
        : () => supabase
          .from('site_config')
          .upsert({
            key,
            value,
            label: meta.label || key,
            category: meta.category || 'general',
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'key'
          });

      const { error } = await executeSupabaseMutation(request, {
        label: existingValue ? 'update site config' : 'upsert site config'
      });

      if (error) throw error;

      const nextConfig = normalizeVersionConfig({ ...get().config, [key]: value });
      writeSiteConfigSnapshot(nextConfig);
      set({ config: nextConfig });
      return true;
    } catch {
      return false;
    }
  },
}));

/**
 * React 19 safe hook: select raw config value and memoize JSON parsing.
 * Avoids creating new object references inside Zustand selectors which
 * breaks useSyncExternalStore's getSnapshot caching.
 */
export function useJsonConfig(key, defaultValue = null) {
  const raw = useSiteConfigStore(s => s.config[key]);
  return useMemo(() => {
    if (raw == null || raw === '') return defaultValue;
    if (typeof raw !== 'string') return raw;
    try { return JSON.parse(raw); } catch { return defaultValue; }
  }, [raw, defaultValue]);
}

export default useSiteConfigStore;
