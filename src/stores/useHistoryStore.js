import { create } from 'zustand';
import { DEFAULT_POOL_ID, DEFAULT_DISPLAY_PITY } from '../constants';

/**
 * 抽卡历史记录状态管理
 * 管理所有抽卡记录、筛选、分页等
 */
const useHistoryStore = create((set, get) => ({
  // ========== 历史记录 ==========
  history: (() => {
    try {
      const saved = localStorage.getItem('gacha_history_v2');
      let data = saved ? JSON.parse(saved) : [];

      // 数据迁移：
      // 1. 如果老数据没有 poolId，赋予默认 poolId
      // 2. 如果是6星且没有 isStandard 字段，默认设为 false (假设之前的都是限定，或者让用户自己改)
      let hasMigration = false;
      const migratedData = data.map(item => {
        let newItem = { ...item };
        if (!newItem.poolId) {
          hasMigration = true;
          newItem.poolId = DEFAULT_POOL_ID;
        }
        if (newItem.rarity === 6 && newItem.isStandard === undefined) {
          // 老数据兼容，默认为限定(false)
          newItem.isStandard = false;
        }
        return newItem;
      });

      if (hasMigration) {
        localStorage.setItem('gacha_history_v2', JSON.stringify(migratedData));
      }

      return migratedData;
    } catch (e) {
      return [];
    }
  })(),

  // ========== 筛选和分页 ==========
  manualPityLimit: DEFAULT_DISPLAY_PITY,
  visibleHistoryCount: 20,
  historyFilter: 'all', // 'all' | '6star' | '5star' | 'gift'

  setManualPityLimit: (limit) => set({ manualPityLimit: limit }),
  setVisibleHistoryCount: (count) => set({ visibleHistoryCount: count }),
  setHistoryFilter: (filter) => set({ historyFilter: filter }),
  loadMoreHistory: () => set((state) => ({
    visibleHistoryCount: state.visibleHistoryCount + 20
  })),

  // ========== 操作方法 ==========

  /**
   * 设置历史记录（同步到 localStorage）
   */
  setHistory: (history) => {
    set({ history });
    localStorage.setItem('gacha_history_v2', JSON.stringify(history));
  },

  /**
   * 获取当前卡池的历史记录
   */
  getCurrentPoolHistory: (poolId) => {
    const { history } = get();
    if (!poolId) return [];
    // 只按 poolId 过滤，不区分 user_id
    // 这样所有用户都能看到该卡池的全部录入数据（适合协作场景）
    return history.filter(h => h.poolId === poolId);
  },

  /**
   * 添加单条记录
   */
  addPull: (pull) => {
    const { history } = get();
    const newHistory = [...history, pull];
    get().setHistory(newHistory);
    return pull;
  },

  /**
   * 批量添加记录
   */
  addPulls: (pulls) => {
    const { history } = get();
    const newHistory = [...history, ...pulls];
    get().setHistory(newHistory);
  },

  /**
   * 更新单条记录
   */
  updatePull: (id, updates) => {
    const { history } = get();
    const newHistory = history.map(h =>
      h.id === id ? { ...h, ...updates } : h
    );
    get().setHistory(newHistory);
  },

  /**
   * 删除单条记录
   */
  deletePull: (id) => {
    const { history } = get();
    const newHistory = history.filter(h => h.id !== id);
    get().setHistory(newHistory);
  },

  /**
   * 删除整组记录（十连）
   */
  deleteBatch: (batchId) => {
    const { history } = get();
    const newHistory = history.filter(h => h.batchId !== batchId);
    get().setHistory(newHistory);
  },

  /**
   * 删除指定卡池的所有记录
   */
  deletePoolHistory: (poolId) => {
    const { history } = get();
    const newHistory = history.filter(h => h.poolId !== poolId);
    get().setHistory(newHistory);
  },

  /**
   * 清空所有历史记录
   */
  clearAllHistory: () => {
    get().setHistory([]);
  },

  /**
   * 导入历史记录（替换现有数据）
   */
  importHistory: (importedHistory) => {
    get().setHistory(importedHistory);
  },

  /**
   * 合并历史记录（不重复添加）
   */
  mergeHistory: (importedHistory) => {
    const { history } = get();
    const existingIds = new Set(history.map(h => h.id));
    const newPulls = importedHistory.filter(h => !existingIds.has(h.id));
    const mergedHistory = [...history, ...newPulls];
    get().setHistory(mergedHistory);
  },

  /**
   * 获取过滤后的历史记录
   */
  getFilteredHistory: (poolId) => {
    const { historyFilter } = get();
    const poolHistory = get().getCurrentPoolHistory(poolId);

    switch (historyFilter) {
      case '6star':
        return poolHistory.filter(h => h.rarity === 6);
      case '5star':
        return poolHistory.filter(h => h.rarity === 5);
      case 'gift':
        return poolHistory.filter(h => h.specialType === 'gift');
      default:
        return poolHistory;
    }
  },
}));

export default useHistoryStore;
