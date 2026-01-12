/**
 * @file characterUtils.js
 * @description 角色数据缓存管理工具
 * @date 2026-01-11
 * @feat FEAT-007 卡池详情系统重构 - 角色映射系统
 */

import { supabase } from '../supabaseClient';

/**
 * 角色数据缓存管理器（单例模式）
 *
 * 功能：
 * 1. 启动时从 Supabase 加载所有角色数据
 * 2. 提供快速查询接口（按ID/名称/别名）
 * 3. 支持本地缓存，减少网络请求
 * 4. 支持实时更新（管理员添加新角色时）
 */
class CharacterCache {
  constructor() {
    /** @type {Map<string, Character>} 角色ID映射表 */
    this.cache = new Map();

    /** @type {Map<string, string>} 别名映射到角色ID */
    this.aliasMap = new Map();

    /** @type {boolean} 是否已加载 */
    this.loaded = false;

    /** @type {boolean} 是否正在加载 */
    this.loading = false;

    /** @type {Array<Function>} 加载完成回调队列 */
    this.loadCallbacks = [];

    /** @type {RealtimeChannel} Supabase实时订阅频道 */
    this.subscription = null;
  }

  /**
   * 初始化角色数据（应用启动时调用一次）
   * @returns {Promise<void>}
   */
  async load() {
    // 防止重复加载
    if (this.loaded) {
      return Promise.resolve();
    }

    // 如果正在加载，返回等待Promise
    if (this.loading) {
      return new Promise((resolve) => {
        this.loadCallbacks.push(resolve);
      });
    }

    this.loading = true;

    try {
      console.log('[CharacterCache] 开始加载角色数据...');
      const startTime = performance.now();

      // 从 Supabase 加载所有角色
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .order('name');

      if (error) {
        throw new Error(`加载角色数据失败: ${error.message}`);
      }

      if (!data || data.length === 0) {
        console.warn('[CharacterCache] ⚠️ characters 表为空，请先执行数据库迁移');
        this.loaded = true;
        this.loading = false;
        return;
      }

      // 构建缓存
      data.forEach((char) => {
        this.cache.set(char.id, char);

        // 构建别名映射
        if (char.aliases && Array.isArray(char.aliases)) {
          char.aliases.forEach((alias) => {
            this.aliasMap.set(alias.toLowerCase(), char.id);
          });
        }

        // 名称也作为别名
        this.aliasMap.set(char.name.toLowerCase(), char.id);
      });

      const loadTime = (performance.now() - startTime).toFixed(2);
      console.log(
        `[CharacterCache] ✅ 加载完成: ${data.length} 个角色, 耗时 ${loadTime}ms`
      );

      this.loaded = true;
      this.loading = false;

      // 触发回调
      this.loadCallbacks.forEach((callback) => callback());
      this.loadCallbacks = [];

      // 启动实时订阅（监听新角色添加）
      this.subscribeToUpdates();
    } catch (error) {
      console.error('[CharacterCache] ❌ 加载失败:', error);
      this.loading = false;

      // 降级处理：使用空缓存，允许应用继续运行
      this.loaded = true;
      this.loadCallbacks.forEach((callback) => callback());
      this.loadCallbacks = [];
    }
  }

  /**
   * 订阅角色表的实时更新
   * @private
   */
  subscribeToUpdates() {
    if (this.subscription) return;

    try {
      this.subscription = supabase
        .channel('characters_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'characters',
          },
          (payload) => {
            console.log('[CharacterCache] 收到角色数据更新:', payload);
            this.handleRealtimeUpdate(payload);
          }
        )
        .subscribe();
    } catch (error) {
      console.warn('[CharacterCache] 实时订阅失败（非致命错误）:', error);
    }
  }

  /**
   * 处理实时更新事件
   * @private
   * @param {Object} payload - Supabase实时更新载荷
   */
  handleRealtimeUpdate(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    switch (eventType) {
      case 'INSERT':
      case 'UPDATE':
        if (newRecord) {
          this.cache.set(newRecord.id, newRecord);
          // 更新别名映射
          if (newRecord.aliases) {
            newRecord.aliases.forEach((alias) => {
              this.aliasMap.set(alias.toLowerCase(), newRecord.id);
            });
          }
          this.aliasMap.set(newRecord.name.toLowerCase(), newRecord.id);
          console.log(`[CharacterCache] 角色已更新: ${newRecord.name}`);
        }
        break;

      case 'DELETE':
        if (oldRecord) {
          this.cache.delete(oldRecord.id);
          // 清理别名映射
          if (oldRecord.aliases) {
            oldRecord.aliases.forEach((alias) => {
              this.aliasMap.delete(alias.toLowerCase());
            });
          }
          this.aliasMap.delete(oldRecord.name.toLowerCase());
          console.log(`[CharacterCache] 角色已删除: ${oldRecord.name}`);
        }
        break;

      default:
        break;
    }
  }

  /**
   * 根据ID获取角色
   * @param {string} charId - 角色ID，如 'char_levantin'
   * @returns {Character|null} 角色对象或null
   */
  getById(charId) {
    if (!charId) return null;
    return this.cache.get(charId) || null;
  }

  /**
   * 根据名称搜索（支持别名、模糊匹配）
   * @param {string} name - 角色名称或别名
   * @param {boolean} fuzzy - 是否启用模糊匹配（默认true）
   * @returns {Character|null} 角色对象或null
   */
  searchByName(name, fuzzy = true) {
    if (!name) return null;

    const lowerName = name.toLowerCase().trim();

    // 1. 精确匹配（通过别名映射）
    const charId = this.aliasMap.get(lowerName);
    if (charId) {
      return this.cache.get(charId);
    }

    // 2. 模糊匹配（遍历所有角色）
    if (fuzzy) {
      for (const char of this.cache.values()) {
        // 匹配名称
        if (char.name.toLowerCase().includes(lowerName)) {
          return char;
        }
        // 匹配别名
        if (
          char.aliases &&
          char.aliases.some((alias) =>
            alias.toLowerCase().includes(lowerName)
          )
        ) {
          return char;
        }
      }
    }

    return null;
  }

  /**
   * 获取所有角色列表
   * @param {Object} filters - 过滤条件
   * @param {number} [filters.rarity] - 稀有度（3-6）
   * @param {string} [filters.type] - 类型（'character'|'weapon'）
   * @param {boolean} [filters.isLimited] - 是否限定
   * @returns {Array<Character>} 角色列表
   */
  getAll(filters = {}) {
    let characters = Array.from(this.cache.values());

    // 应用过滤器
    if (filters.rarity) {
      characters = characters.filter((c) => c.rarity === filters.rarity);
    }
    if (filters.type) {
      characters = characters.filter((c) => c.type === filters.type);
    }
    if (filters.isLimited !== undefined) {
      characters = characters.filter((c) => c.is_limited === filters.isLimited);
    }

    return characters;
  }

  /**
   * 获取6星角色列表（按限定/常驻分组）
   * @returns {Object} { limited: Character[], standard: Character[] }
   */
  get6StarCharacters() {
    const limited = [];
    const standard = [];

    for (const char of this.cache.values()) {
      if (char.rarity === 6 && char.type === 'character') {
        if (char.is_limited) {
          limited.push(char);
        } else {
          standard.push(char);
        }
      }
    }

    return { limited, standard };
  }

  /**
   * 检查缓存是否已加载
   * @returns {boolean}
   */
  isLoaded() {
    return this.loaded;
  }

  /**
   * 清空缓存（测试用）
   */
  clear() {
    this.cache.clear();
    this.aliasMap.clear();
    this.loaded = false;

    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  /**
   * 手动刷新缓存
   * @returns {Promise<void>}
   */
  async refresh() {
    this.loaded = false;
    this.cache.clear();
    this.aliasMap.clear();
    await this.load();
  }
}

// 导出单例实例
export const characterCache = new CharacterCache();

// 开发环境下暴露到 window（方便调试）
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.__characterCache = characterCache;
}

/**
 * @typedef {Object} Character
 * @property {string} id - 角色ID
 * @property {string} name - 角色名称
 * @property {string} [avatar_url] - 头像URL
 * @property {number} rarity - 稀有度（3-6）
 * @property {string} type - 类型（'character'|'weapon'）
 * @property {Array<string>} [aliases] - 别名数组
 * @property {boolean} is_limited - 是否限定
 * @property {string} [release_date] - 上线日期
 * @property {string} created_at - 创建时间
 * @property {string} updated_at - 更新时间
 */
