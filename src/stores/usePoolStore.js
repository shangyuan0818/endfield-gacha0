import { create } from 'zustand';
import { DEFAULT_POOL_ID } from '../constants';
import { extractDrawerFromPoolName } from '../utils';
import { syncManager } from '../services/syncService';
import { supabase } from '../supabaseClient';
import { generateSemanticPoolId } from '../utils/poolIdGenerator';

/**
 * 获取当前用户ID（用于同步）
 * @returns {string|null}
 */
const getCurrentUserId = () => {
  try {
    // 从 Supabase session 获取
    if (supabase) {
      const session = supabase.auth.getSession();
      return session?.data?.session?.user?.id || null;
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * 卡池状态管理
 * 管理卡池列表、当前选中卡池、卡池搜索、分组等
 */
const usePoolStore = create((set, get) => ({
  // ========== 卡池列表 ==========
  pools: (() => {
    try {
      const saved = localStorage.getItem('gacha_pools');
      let parsed = saved ? JSON.parse(saved) : [{ id: DEFAULT_POOL_ID, name: '限定-42-杨颜', type: 'limited', locked: false }];

      // 迁移：旧的默认池 id=default_pool 或 limited-42-yangyan -> 新的 pool_1764318026209
      parsed = parsed.map(p => {
        if (p.id === 'default_pool' || p.id === 'limited-42-yangyan') {
          return { ...p, id: DEFAULT_POOL_ID, name: '限定-42-杨颜', type: 'limited' };
        }
        return {
          ...p,
          type: p.type || (p.name.includes('常驻') || p.id === DEFAULT_POOL_ID ? 'standard' : 'limited'),
          locked: p.locked || false
        };
      });

      // 确保默认池存在
      if (!parsed.some(p => p.id === DEFAULT_POOL_ID)) {
        parsed.unshift({ id: DEFAULT_POOL_ID, name: '限定-42-杨颜', type: 'limited', locked: false });
      }

      return parsed;
    } catch (e) {
      return [{ id: DEFAULT_POOL_ID, name: '限定-42-杨颜', type: 'limited', locked: false }];
    }
  })(),

  // ========== 当前选中卡池 ==========
  currentPoolId: (() => {
    const saved = localStorage.getItem('gacha_current_pool_id');
    if (!saved || saved === 'default_pool' || saved === 'limited-42-yangyan') return DEFAULT_POOL_ID;
    return saved;
  })(),

  // ========== 卡池搜索 ==========
  poolSearchQuery: '',
  setPoolSearchQuery: (query) => set({ poolSearchQuery: query }),

  // ========== 折叠的抽卡人分组 ==========
  collapsedDrawers: new Set(),
  toggleDrawer: (drawer) => set((state) => {
    const next = new Set(state.collapsedDrawers);
    if (next.has(drawer)) {
      next.delete(drawer);
    } else {
      next.add(drawer);
    }
    return { collapsedDrawers: next };
  }),

  // ========== 操作方法 ==========

  /**
   * 设置卡池列表（同步到 localStorage）
   */
  setPools: (pools) => {
    set({ pools });
    localStorage.setItem('gacha_pools', JSON.stringify(pools));
  },

  /**
   * 切换当前卡池
   */
  switchPool: (poolId) => {
    set({ currentPoolId: poolId });
    localStorage.setItem('gacha_current_pool_id', poolId);
  },

  /**
   * 创建新卡池
   */
  createPool: (poolData) => {
    const { pools } = get();
    const userId = getCurrentUserId();

    // 使用语义化ID生成（如果有userId）
    const poolId = userId
      ? generateSemanticPoolId(poolData, userId, pools)
      : `pool_${Date.now()}`;  // 降级到时间戳ID（未登录时）

    const newPool = {
      id: poolId,
      ...poolData,
      locked: false,
      user_id: userId,  // 添加用户ID
      created_at: new Date().toISOString()
    };

    const updatedPools = [...pools, newPool];
    get().setPools(updatedPools);

    // 加入同步队列
    if (userId) {
      syncManager.enqueue('pools', newPool.id, newPool);
    }

    return newPool;
  },

  /**
   * 删除卡池
   */
  deletePool: (poolId) => {
    const { pools, currentPoolId } = get();
    const updatedPools = pools.filter(p => p.id !== poolId);
    get().setPools(updatedPools);

    // 如果删除的是当前卡池，切换到默认池
    if (currentPoolId === poolId) {
      const fallback = updatedPools.find(p => p.id === DEFAULT_POOL_ID) || updatedPools[0];
      if (fallback) {
        get().switchPool(fallback.id);
      }
    }
  },

  /**
   * 更新卡池
   */
  updatePool: (poolId, updates) => {
    const { pools } = get();
    const userId = getCurrentUserId();

    const updatedPools = pools.map(p =>
      p.id === poolId ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
    );
    get().setPools(updatedPools);

    // 加入同步队列
    if (userId) {
      const updatedPool = updatedPools.find(p => p.id === poolId);
      if (updatedPool) {
        syncManager.enqueue('pools', poolId, { ...updatedPool, user_id: userId });
      }
    }
  },

  /**
   * 获取当前卡池对象
   */
  getCurrentPool: () => {
    const { pools, currentPoolId } = get();
    const byId = pools.find(p => p.id === currentPoolId);
    if (byId) return byId;
    const defaultPool = pools.find(p => p.id === DEFAULT_POOL_ID);
    if (defaultPool) return defaultPool;
    return pools[0];
  },

  /**
   * 获取分组的卡池列表
   */
  getGroupedPools: () => {
    const { pools, poolSearchQuery } = get();

    // 先按搜索词过滤
    const filteredPools = poolSearchQuery.trim()
      ? pools.filter(pool =>
          pool.name.toLowerCase().includes(poolSearchQuery.toLowerCase())
        )
      : pools;

    // 按抽卡人分组
    const groups = {};
    const noDrawerPools = [];

    filteredPools.forEach(pool => {
      const drawer = extractDrawerFromPoolName(pool.name);
      if (drawer) {
        if (!groups[drawer]) {
          groups[drawer] = [];
        }
        groups[drawer].push(pool);
      } else {
        noDrawerPools.push(pool);
      }
    });

    // 转换为数组格式，按抽卡人名称排序
    const result = Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b, 'zh-CN'))
      .map(([drawer, poolList]) => ({
        drawer,
        pools: poolList.sort((a, b) => {
          // 同一抽卡人内按类型排序：限定 > 武器 > 常驻
          const typeOrder = { limited: 0, weapon: 1, standard: 2 };
          return (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0);
        })
      }));

    // 未识别抽卡人的卡池放在最后
    if (noDrawerPools.length > 0) {
      result.push({
        drawer: null,
        pools: noDrawerPools
      });
    }

    return result;
  },

  /**
   * 获取所有已知的抽卡人列表
   */
  getKnownDrawers: () => {
    const { pools } = get();
    const drawers = new Set();
    pools.forEach(pool => {
      const drawer = extractDrawerFromPoolName(pool.name);
      if (drawer) {
        drawers.add(drawer);
      }
    });
    return Array.from(drawers).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  },
}));

export default usePoolStore;
