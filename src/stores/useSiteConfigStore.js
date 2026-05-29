import { useMemo } from 'react';
import { create } from 'zustand';
import { invalidatePublicCache } from '../services/admin/publicCacheService.js';
import { executeSupabaseMutation } from '../services/supabaseRequest.js';
import { getBootstrapSiteConfig } from '../services/bootstrapService.js';
import { supabase } from '../supabaseClient.js';
import { APP_BUILD_INFO, APP_VERSION_LABEL } from '../constants/appMeta.js';
import { readStorageValue, STORAGE_KEYS, writeStorageValue } from '../utils/storageUtils.js';

export const HOME_NEXT_VERSION_TARGET_CONFIG_KEY = 'home_next_version_target_at';
export const DEFAULT_HOME_NEXT_VERSION_TARGET_DATE = '2026-06-05T12:00:00+08:00';

const VERSION_CONFIG_METADATA = {
  site_version: { label: '站点版本', category: 'general' },
  build_info: { label: '构建信息', category: 'general' },
};

function isBlankConfigValue(value) {
  return value == null || String(value).trim() === '';
}

function normalizeVersionConfig(config) {
  const normalizedConfig = config && typeof config === 'object' ? { ...config } : {};

  return {
    ...normalizedConfig,
    site_version: isBlankConfigValue(normalizedConfig.site_version)
      ? APP_VERSION_LABEL
      : normalizedConfig.site_version,
    build_info: isBlankConfigValue(normalizedConfig.build_info)
      ? APP_BUILD_INFO
      : normalizedConfig.build_info,
  };
}

function readSiteConfigSnapshot() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const rawSnapshot = readStorageValue(STORAGE_KEYS.SITE_CONFIG_SNAPSHOT_V1, null, { raw: true });
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
    writeStorageValue(STORAGE_KEYS.SITE_CONFIG_SNAPSHOT_V1, JSON.stringify({
      config: normalizeVersionConfig(config),
      fetchedAt: Date.now(),
    }), { raw: true });
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
      const versionMeta = VERSION_CONFIG_METADATA[key];
      const existingValue = Object.prototype.hasOwnProperty.call(get().config, key);
      const request = existingValue && !versionMeta
        ? () => supabase
          .from('site_config')
          .update({ value, updated_at: new Date().toISOString() })
          .eq('key', key)
        : () => supabase
          .from('site_config')
          .upsert({
            key,
            value,
            label: meta.label || versionMeta?.label || key,
            category: meta.category || versionMeta?.category || 'general',
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

      if (key !== 'public_cache_epoch') {
        await invalidatePublicCache('site-config', `admin:site-config:${key}`);
      }

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
