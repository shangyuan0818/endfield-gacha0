/**
 * @file syncService.js
 * @description 批量同步服务 - 管理 LocalStorage 与 Supabase 的数据同步
 * @date 2026-01-11
 * @feat FEAT-007 卡池详情系统重构 - 数据同步机制
 */

import { supabase } from '../supabaseClient';

/**
 * 同步管理器（单例模式）
 *
 * 功能：
 * 1. 30秒定时同步（可配置）
 * 2. 页面关闭前强制同步
 * 3. 队列管理（避免重复同步）
 * 4. 批量上传（history 每批100条）
 * 5. 冲突解决（Last-Write-Wins策略）
 * 6. 离线排队（网络恢复后重试）
 */
class SyncManager {
  constructor() {
    /** @type {Map<string, any>} 卡池同步队列 */
    this.syncQueue = {
      pools: new Map(),      // poolId -> poolData
      history: new Map(),    // recordId -> recordData
      characters: new Map(), // charId -> charData (仅超管可同步)
    };

    /** @type {number|null} 定时器ID */
    this.syncTimer = null;

    /** @type {number} 同步间隔（毫秒） */
    this.syncInterval = 30000; // 30秒

    /** @type {boolean} 是否正在同步 */
    this.isSyncing = false;

    /** @type {boolean} 是否已启动 */
    this.isStarted = false;

    /** @type {Function|null} 同步状态回调 */
    this.onSyncStateChange = null;

    /** @type {Object} 统计信息 */
    this.stats = {
      totalSyncs: 0,
      lastSyncTime: null,
      failedSyncs: 0,
      successfulSyncs: 0,
    };
  }

  /**
   * 启动自动同步（30秒定时器）
   * @param {Function} [onStateChange] - 同步状态变化回调
   */
  startAutoSync(onStateChange) {
    if (this.isStarted) {
      console.warn('[SyncManager] 同步服务已启动，跳过重复启动');
      return;
    }

    this.onSyncStateChange = onStateChange;
    this.isStarted = true;

    // 定时同步
    this.syncTimer = setInterval(() => {
      this.flushQueue();
    }, this.syncInterval);

    // 页面关闭前同步（使用 sendBeacon 或同步XHR）
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));

    // 页面可见性变化时同步（用户切换标签页时）
    document.addEventListener(
      'visibilitychange',
      this.handleVisibilityChange.bind(this)
    );

    console.log('[SyncManager] ✅ 自动同步服务已启动（间隔30秒）');
  }

  /**
   * 停止自动同步
   */
  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    this.isStarted = false;
    console.log('[SyncManager] 自动同步服务已停止');
  }

  /**
   * 添加待同步数据到队列
   * @param {'pools'|'history'|'characters'} type - 数据类型
   * @param {string} id - 记录ID
   * @param {Object} data - 数据对象
   */
  enqueue(type, id, data) {
    if (!this.syncQueue[type]) {
      console.error(`[SyncManager] 无效的数据类型: ${type}`);
      return;
    }

    this.syncQueue[type].set(id, data);

    // 触发状态变化回调
    if (this.onSyncStateChange) {
      this.onSyncStateChange({
        queueSize: this.getQueueSize(),
        isSyncing: this.isSyncing,
      });
    }
  }

  /**
   * 获取当前队列大小
   * @returns {number}
   */
  getQueueSize() {
    return (
      this.syncQueue.pools.size +
      this.syncQueue.history.size +
      this.syncQueue.characters.size
    );
  }

  /**
   * 立即执行同步（清空队列）
   * @param {boolean} [sync=false] - 是否使用同步模式（页面关闭时）
   * @returns {Promise<void>}
   */
  async flushQueue(sync = false) {
    // 防止并发同步
    if (this.isSyncing) {
      console.log('[SyncManager] 同步正在进行，跳过本次请求');
      return;
    }

    // 队列为空，跳过
    if (this.getQueueSize() === 0) {
      return;
    }

    this.isSyncing = true;
    this.stats.totalSyncs++;

    // 触发状态变化
    if (this.onSyncStateChange) {
      this.onSyncStateChange({
        queueSize: this.getQueueSize(),
        isSyncing: true,
      });
    }

    try {
      console.log('[SyncManager] 开始同步，队列大小:', this.getQueueSize());
      const startTime = performance.now();

      const { pools, history, characters } = this.syncQueue;

      // 批量同步 pools
      if (pools.size > 0) {
        await this.syncPools(Array.from(pools.values()));
        pools.clear();
      }

      // 批量同步 history（分批100条）
      if (history.size > 0) {
        const records = Array.from(history.values());
        await this.syncHistory(records);
        history.clear();
      }

      // 批量同步 characters（仅超管）
      if (characters.size > 0) {
        await this.syncCharacters(Array.from(characters.values()));
        characters.clear();
      }

      const syncTime = (performance.now() - startTime).toFixed(2);
      this.stats.lastSyncTime = new Date().toISOString();
      this.stats.successfulSyncs++;

      console.log(`[SyncManager] ✅ 同步完成，耗时 ${syncTime}ms`);
    } catch (error) {
      console.error('[SyncManager] ❌ 同步失败:', error);
      this.stats.failedSyncs++;

      // 失败时保留队列数据，下次重试
      // 不清空队列，等待下一次定时同步
    } finally {
      this.isSyncing = false;

      // 触发状态变化
      if (this.onSyncStateChange) {
        this.onSyncStateChange({
          queueSize: this.getQueueSize(),
          isSyncing: false,
        });
      }
    }
  }

  /**
   * 同步卡池数据到 Supabase
   * @private
   * @param {Array<Object>} pools - 卡池数据数组
   * @returns {Promise<void>}
   */
  async syncPools(pools) {
    if (pools.length === 0) return;

    console.log(`[SyncManager] 正在同步 ${pools.length} 个卡池...`);

    const { error } = await supabase.from('pools').upsert(
      pools.map((p) => ({
        user_id: p.user_id,
        pool_id: p.id,
        name: p.name,
        type: p.type,
        locked: p.locked || false,
        is_limited_weapon: p.isLimitedWeapon !== undefined ? p.isLimitedWeapon : true,
        description: p.description || null,
        start_time: p.start_time || null,
        end_time: p.end_time || null,
        banner_url: p.banner_url || null,
        featured_characters: p.featured_characters || null,
        legacy_pool_id: p.legacy_pool_id || null,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'user_id,pool_id' }
    );

    if (error) {
      throw new Error(`卡池同步失败: ${error.message}`);
    }

    console.log(`[SyncManager] ✓ ${pools.length} 个卡池已同步`);
  }

  /**
   * 同步历史记录到 Supabase（分批100条）
   * @private
   * @param {Array<Object>} records - 历史记录数组
   * @returns {Promise<void>}
   */
  async syncHistory(records) {
    if (records.length === 0) return;

    console.log(`[SyncManager] 正在同步 ${records.length} 条历史记录...`);

    const batchSize = 100;
    let syncedCount = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      const { error } = await supabase.from('history').upsert(
        batch.map((r) => ({
          user_id: r.user_id,
          record_id: r.id,
          pool_id: r.poolId,
          rarity: r.rarity,
          is_standard: r.isStandard || false,
          special_type: r.specialType || null,
          item_name: r.itemName || null,
          timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString(),
          character_name: r.character_name || null,
          character_id: r.character_id || null,
          avatar_url: r.avatar_url || null,
          legacy_pool_id: r.legacy_pool_id || null,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'user_id,record_id' }
      );

      if (error) {
        throw new Error(`历史记录同步失败（批次 ${i / batchSize + 1}）: ${error.message}`);
      }

      syncedCount += batch.length;
      console.log(`[SyncManager] ✓ 已同步 ${syncedCount}/${records.length} 条记录`);
    }

    console.log(`[SyncManager] ✓ 全部 ${records.length} 条历史记录已同步`);
  }

  /**
   * 同步角色数据到 Supabase（仅超管可用）
   * @private
   * @param {Array<Object>} characters - 角色数据数组
   * @returns {Promise<void>}
   */
  async syncCharacters(characters) {
    if (characters.length === 0) return;

    console.log(`[SyncManager] 正在同步 ${characters.length} 个角色...`);

    const { error } = await supabase.from('characters').upsert(
      characters.map((c) => ({
        id: c.id,
        name: c.name,
        avatar_url: c.avatar_url || null,
        rarity: c.rarity,
        type: c.type,
        aliases: c.aliases || [],
        is_limited: c.is_limited || false,
        release_date: c.release_date || null,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'id' }
    );

    if (error) {
      // 权限错误不致命，记录警告
      if (error.code === '42501') {
        console.warn('[SyncManager] ⚠️ 角色同步权限不足（需要超管权限）');
      } else {
        throw new Error(`角色同步失败: ${error.message}`);
      }
    } else {
      console.log(`[SyncManager] ✓ ${characters.length} 个角色已同步`);
    }
  }

  /**
   * 页面关闭前同步处理
   * @private
   * @param {Event} event - beforeunload 事件
   */
  handleBeforeUnload(event) {
    if (this.getQueueSize() === 0) return;

    console.log('[SyncManager] 页面关闭，正在同步未保存的数据...');

    // 尝试使用 sendBeacon（异步，不阻塞页面关闭）
    // 注意：sendBeacon 仅支持 POST 请求，需要配合 Supabase Edge Functions
    // 这里使用同步 XHR 作为兜底方案（已废弃但仍可用）

    // 简单实现：直接调用 flushQueue（会尝试异步，但浏览器可能取消请求）
    this.flushQueue(true);

    // 可选：显示警告提示用户等待
    event.preventDefault();
    event.returnValue = '数据正在同步，确定要离开吗？';
  }

  /**
   * 页面可见性变化处理
   * @private
   */
  handleVisibilityChange() {
    // 页面从隐藏变为可见时，立即同步
    if (!document.hidden && this.getQueueSize() > 0) {
      console.log('[SyncManager] 页面恢复可见，触发同步');
      this.flushQueue();
    }
  }

  /**
   * 获取同步统计信息
   * @returns {Object}
   */
  getStats() {
    return {
      ...this.stats,
      queueSize: this.getQueueSize(),
      isRunning: this.isStarted,
      isSyncing: this.isSyncing,
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalSyncs: 0,
      lastSyncTime: null,
      failedSyncs: 0,
      successfulSyncs: 0,
    };
  }
}

// 导出单例实例
export const syncManager = new SyncManager();

// 开发环境下暴露到 window（方便调试）
if (process.env.NODE_ENV === 'development') {
  window.__syncManager = syncManager;
}
