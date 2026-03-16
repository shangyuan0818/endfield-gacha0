import { useCallback, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { upsertHistory, upsertPools } from '../../services/cloudWriteService';
import { getBootstrapVisiblePools } from '../../services/bootstrapService';
import { loadAllPoolsForCatalog, loadVisiblePools, loadPoolsByIds, normalizeRemotePoolType } from '../../services/poolReadService';
import {
  resolveAliasValue,
  resolveCharacterAliasMap,
  resolvePoolAliasMap,
} from '../../../shared/idAliasService.js';
import { useAuthStore, usePoolStore, useHistoryStore } from '../../stores';
import { getPoolTypeFromId } from '../../stores/usePoolStore';
import { clampHistoryPity } from '../../utils/historyRecordUtils';

async function loadLatestVisiblePools(options = {}) {
  const { preferBootstrap = false } = options;

  if (preferBootstrap) {
    const bootstrapPools = await getBootstrapVisiblePools().catch(() => null);
    if (Array.isArray(bootstrapPools) && bootstrapPools.length > 0) {
      return bootstrapPools;
    }
  }

  const directPools = await loadVisiblePools().catch(() => null);
  if (Array.isArray(directPools) && directPools.length > 0) {
    return directPools;
  }

  if (!preferBootstrap) {
    const bootstrapPools = await getBootstrapVisiblePools().catch(() => null);
    if (Array.isArray(bootstrapPools) && bootstrapPools.length > 0) {
      return bootstrapPools;
    }
  }

  return null;
}

/**
 * 云同步 Hook
 * 处理 loadCloudData/savePoolToCloud/saveHistoryToCloud 等云端数据操作
 * 包含数据归一化、dedupe、isStandard 推断
 */
export function useCloudSync({ showToast }) {
  const user = useAuthStore(state => state.user);
  const setSyncing = useAuthStore(state => state.setSyncing);
  const setSyncError = useAuthStore(state => state.setSyncError);
  const setLastSyncAt = useAuthStore(state => state.setLastSyncAt);
  const pools = usePoolStore(state => state.pools);
  const setPools = usePoolStore(state => state.setPools);
  const history = useHistoryStore(state => state.history);

  // DR-B05: 防止并发调用 loadCloudData 导致请求加倍
  const loadingPromiseRef = useRef(null);

  // 从云端加载数据（只加载当前用户的数据）
  const loadCloudData = useCallback(async (targetUser = null) => {
    if (!supabase) return null;

    const currentUser = targetUser || useAuthStore.getState().user;
    if (!currentUser) {
      return { pools: [], history: [] };
    }

    // DR-B05: 如果已有正在执行的请求，复用同一个 Promise
    if (loadingPromiseRef.current) {
      return loadingPromiseRef.current;
    }

    const doLoad = async () => {
      setSyncing(true);
      setSyncError(null);

      try {
        const fallbackPools = usePoolStore.getState().pools;
        const latestVisiblePools = await loadLatestVisiblePools();
        const catalogPools = await loadAllPoolsForCatalog().catch(() => []);
        const visiblePools = Array.isArray(latestVisiblePools) && latestVisiblePools.length > 0
          ? latestVisiblePools
          : (Array.isArray(fallbackPools) ? fallbackPools : []);

      // 分页加载历史记录（Supabase 默认限制 1000 行）
      const PAGE_SIZE = 1000;
      let allHistory = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const historyQuery = supabase
          .from('history')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('record_id', { ascending: true })
          .range(from, to);

        const { data: pageData, error: historyError } = await historyQuery;
        if (historyError) throw historyError;

        if (pageData && pageData.length > 0) {
          allHistory = allHistory.concat(pageData);
          page++;
          hasMore = pageData.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      const [poolAliasMap, characterAliasMap] = await Promise.all([
        resolvePoolAliasMap(
          supabase,
          allHistory.map(h => h?.pool_id),
          'official_api'
        ),
        resolveCharacterAliasMap(
          supabase,
          allHistory.map(h => h?.character_id),
          'official_api'
        ),
      ]);

      const formattedHistory = allHistory.map(h => ({
        id: h.record_id,
        rarity: h.rarity,
        isStandard: h.is_standard,
        specialType: h.special_type,
        timestamp: h.timestamp,
        poolId: resolveAliasValue(poolAliasMap, h.pool_id),
        user_id: h.user_id,
        name: h.character_name || h.item_name,
        character_name: h.character_name,
        item_name: h.item_name,
        character_id: resolveAliasValue(characterAliasMap, h.character_id),
        batchId: h.batch_id,
        batch_id: h.batch_id,
        seqId: h.seq_id,
        seq_id: h.seq_id,
        pity: clampHistoryPity(h.pity),
        isNew: h.is_new || false,
        is_new: h.is_new,
        isFree: h.is_free || false,
        is_free: h.is_free,
        gameUid: h.game_uid,
        game_uid: h.game_uid,
        nickName: h.nick_name,
        nick_name: h.nick_name
      }));

      const knownPoolsMap = new Map();
      [...catalogPools, ...visiblePools].forEach((pool) => {
        if (pool?.id) {
          knownPoolsMap.set(pool.id, pool);
        }
      });
      const historyPoolIds = [...new Set(formattedHistory.map(h => h.poolId))];
      const missingPoolIds = historyPoolIds.filter(pid => pid && !knownPoolsMap.has(pid));
      const hydratedHistoryPools = missingPoolIds.length > 0
        ? await loadPoolsByIds(missingPoolIds).catch(() => [])
        : [];

      hydratedHistoryPools.forEach((pool) => {
        if (pool?.id) {
          knownPoolsMap.set(pool.id, pool);
        }
      });

      const knownPoolIds = new Set(knownPoolsMap.keys());

      // 补占位池
      const placeholderPools = historyPoolIds
        .filter(pid => !knownPoolIds.has(pid))
        .map(pid => {
          const rawType = getPoolTypeFromId(pid);
          const inferredType = normalizeRemotePoolType(rawType);
          const defaultName = (() => {
            switch (inferredType) {
              case 'limited_character':
              case 'limited':
                return '限定角色池';
              case 'standard':
                return '基础寻访';
              case 'beginner':
                return '启程寻访';
              case 'limited_weapon':
              case 'weapon':
                return '武器池';
              default:
                return pid || '未知卡池';
            }
          })();
          return {
            id: pid,
            name: defaultName,
            type: inferredType === 'unknown' ? 'standard' : inferredType,
            locked: false,
            isLimitedWeapon: rawType === 'limited_weapon' || inferredType === 'weapon',
            created_at: null,
            updated_at: null,
            user_id: null,
            creator_username: null,
            up_character: null,
            description: null,
            banner_url: null,
            start_time: null,
            end_time: null,
            featured_characters: null,
          };
        });

      const allPools = [...knownPoolsMap.values(), ...placeholderPools];

      // 根据池类型回填历史记录的 isStandard
      const poolTypeLookup = new Map(allPools.map(p => [p.id, p.type]));
      const normalizedHistory = formattedHistory.map(h => {
        const poolType = poolTypeLookup.get(h.poolId);
        const inferredIsStandard = (poolType === 'standard' || poolType === 'beginner') ? true
          : (poolType === 'limited' || poolType === 'limited_character' || poolType === 'weapon' || poolType === 'limited_weapon') ? false
          : null;
        const isStandard = inferredIsStandard !== null ? inferredIsStandard : Boolean(h.isStandard);
        return { ...h, isStandard };
      });

      setLastSyncAt(new Date().toISOString());
      return { pools: allPools, history: normalizedHistory };
      } catch (error) {
        setSyncError(error.message);
        return null;
      } finally {
        setSyncing(false);
      }
    };

    // DR-B05: 缓存 Promise，并发调用共享同一个请求
    loadingPromiseRef.current = doLoad();
    try {
      return await loadingPromiseRef.current;
    } finally {
      loadingPromiseRef.current = null;
    }
  }, [setLastSyncAt, setSyncError, setSyncing]);

  // 加载公共卡池数据（无需登录，用于首页轮换计划/倒计时）
  const loadPublicPools = useCallback(async () => {
    try {
      const latestVisiblePools = await loadLatestVisiblePools({ preferBootstrap: true });
      if (Array.isArray(latestVisiblePools) && latestVisiblePools.length > 0) {
        setPools(latestVisiblePools);
        return latestVisiblePools;
      }
    } catch {
      return null;
    }

    return null;
  }, [setPools]);

  const savePoolToCloud = useCallback(async (pool, _showNotification = false) => {
    if (!supabase || !user) {
      return false;
    }

    try {
      await upsertPools(supabase, [pool], user.id);
      return true;
    } catch (error) {
      setSyncError(error.message);
      return false;
    }
  }, [setSyncError, user]);

  // 保存历史记录到云端
  const saveHistoryToCloud = useCallback(async (records) => {
    if (!supabase || !user || records.length === 0) return;

    try {
      await upsertHistory(supabase, records, user.id);
    } catch (error) {
      const errorMessage = error.message || '';
      if (errorMessage.includes('policy') || errorMessage.includes('violates row-level security')) {
        showToast(
          '该卡池已被锁定，只有超级管理员可以修改数据',
          'error',
          '权限不足'
        );
      } else {
        showToast(
          `保存失败: ${errorMessage.substring(0, 100)}`,
          'error',
          '同步错误'
        );
      }

      setSyncError(error.message);
      throw error;
    }
  }, [setSyncError, showToast, user]);

  // 从云端删除历史记录
  const deleteHistoryFromCloud = useCallback(async (recordIds) => {
    if (!supabase || !user) return false;

    try {
      const { error } = await supabase
        .from('history')
        .delete()
        .eq('user_id', user.id)
        .in('record_id', recordIds);

      if (error) throw error;
      return true;
    } catch (error) {
      setSyncError(error.message);
      showToast(`删除失败: ${error.message}`, 'error');
      return false;
    }
  }, [setSyncError, showToast, user]);

  // 从云端删除指定卡池的所有历史记录
  const deletePoolHistoryFromCloud = useCallback(async (poolId) => {
    if (!supabase || !user) return false;

    try {
      const { error } = await supabase
        .from('history')
        .delete()
        .eq('user_id', user.id)
        .eq('pool_id', poolId);

      if (error) throw error;
      return true;
    } catch (error) {
      setSyncError(error.message);
      showToast(`删除卡池记录失败: ${error.message}`, 'error');
      return false;
    }
  }, [setSyncError, showToast, user]);

  // 从云端删除卡池本身
  const deletePoolFromCloud = useCallback(async (poolId) => {
    if (!supabase || !user) return false;

    try {
      const { error } = await supabase
        .from('pools')
        .delete()
        .eq('user_id', user.id)
        .eq('pool_id', poolId);

      if (error) throw error;
      return true;
    } catch (error) {
      setSyncError(error.message);
      showToast(`删除卡池失败: ${error.message}`, 'error');
      return false;
    }
  }, [setSyncError, showToast, user]);

  // 删除当前用户的全部云端抽卡数据（仅作用于本人拥有的数据，不删除账号）
  const deleteUserDataFromCloud = useCallback(async () => {
    if (!supabase || !user) return false;

    try {
      const { error: historyError } = await supabase
        .from('history')
        .delete()
        .eq('user_id', user.id);

      if (historyError) throw historyError;

      const { error: poolError } = await supabase
        .from('pools')
        .delete()
        .eq('user_id', user.id);

      if (poolError) throw poolError;

      return true;
    } catch (error) {
      setSyncError(error.message);
      throw error;
    }
  }, [user, setSyncError]);

  // 迁移本地数据到云端
  const migrateLocalToCloud = useCallback(async () => {
    if (!supabase || !user) return false;

    setSyncing(true);
    setSyncError(null);

    try {
      for (const pool of pools) {
        await savePoolToCloud(pool);
      }

      const batchSize = 100;
      for (let i = 0; i < history.length; i += batchSize) {
        const batch = history.slice(i, i + batchSize);
        await saveHistoryToCloud(batch);
      }

      setLastSyncAt(new Date().toISOString());
      return true;
    } catch (error) {
      setSyncError(error.message);
      return false;
    } finally {
      setSyncing(false);
    }
  }, [history, pools, saveHistoryToCloud, savePoolToCloud, setLastSyncAt, setSyncError, setSyncing, user]);

  // 手动同步数据到云端（设置页面使用）
  const syncToCloud = useCallback(async () => {
    if (!user) {
      showToast('请先登录', 'warning');
      return;
    }

    try {
      setSyncing(true);
      let syncedPools = 0;
      let syncedHistory = 0;
      let skippedPools = 0;
      let skippedHistory = 0;

      const myPools = (pools || []).filter(pool => !pool.user_id || pool.user_id === user.id);
      skippedPools = (pools || []).length - myPools.length;

      for (const pool of myPools) {
        const success = await savePoolToCloud(pool);
        if (success) syncedPools++;
      }

      const myHistory = history.filter(h => !h.user_id || h.user_id === user.id);
      skippedHistory = history.length - myHistory.length;

      const batchSize = 100;
      for (let i = 0; i < myHistory.length; i += batchSize) {
        const batch = myHistory.slice(i, i + batchSize);
        await saveHistoryToCloud(batch);
        syncedHistory += batch.length;
      }

      let message = `同步完成：${syncedPools} 个卡池，${syncedHistory} 条记录`;
      if (skippedPools > 0 || skippedHistory > 0) {
        message += `（跳过其他用户数据：${skippedPools} 卡池，${skippedHistory} 记录）`;
      }
      setLastSyncAt(new Date().toISOString());
      showToast(message, 'success');
    } catch (error) {
      showToast('同步失败: ' + error.message, 'error');
    } finally {
      setSyncing(false);
    }
  }, [history, pools, saveHistoryToCloud, savePoolToCloud, setLastSyncAt, setSyncing, showToast, user]);

  return {
    loadCloudData,
    loadPublicPools,
    savePoolToCloud,
    saveHistoryToCloud,
    deleteHistoryFromCloud,
    deletePoolHistoryFromCloud,
    deletePoolFromCloud,
    deleteUserDataFromCloud,
    migrateLocalToCloud,
    handleManualSync: syncToCloud,
    syncToCloud
  };
}

export default useCloudSync;
