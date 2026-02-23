import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { syncManager } from '../../services/syncService';
import { useAuthStore, usePoolStore, useHistoryStore } from '../../stores';
import { getPoolTypeFromId } from '../../stores/usePoolStore';

/**
 * 云同步 Hook
 * 处理 loadCloudData/savePoolToCloud/saveHistoryToCloud 等云端数据操作
 * 包含数据归一化、dedupe、isStandard 推断
 */
export function useCloudSync({ showToast }) {
  const user = useAuthStore(state => state.user);
  const setSyncing = useAuthStore(state => state.setSyncing);
  const setSyncError = useAuthStore(state => state.setSyncError);
  const pools = usePoolStore(state => state.pools);
  const setPools = usePoolStore(state => state.setPools);
  const switchPool = usePoolStore(state => state.switchPool);
  const history = useHistoryStore(state => state.history);
  const setHistory = useHistoryStore(state => state.setHistory);

  // DR-B05: 防止并发调用 loadCloudData 导致请求加倍
  const loadingPromiseRef = useRef(null);

  // 从云端加载数据（只加载当前用户的数据）
  const loadCloudData = useCallback(async (targetUser = null) => {
    if (!supabase) return null;

    const currentUser = targetUser || user;
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
        // 加载所有卡池（公共池由超管维护，不再按 user 过滤）
        let poolQuery = supabase
        .from('pools')
        .select('*');

      const { data: cloudPools, error: poolsError } = await poolQuery;
      if (poolsError) throw poolsError;

      // 收集所有 user_id 并查询对应的 profiles 获取用户名
      const userIds = [...new Set(cloudPools.map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, role')
        .in('id', userIds);

      const usernameMap = new Map();
      const roleMap = new Map();
      if (profiles) {
        profiles.forEach(p => {
          usernameMap.set(p.id, p.username);
          roleMap.set(p.id, p.role);
        });
      }

      // 分页加载历史记录（Supabase 默认限制 1000 行）
      const PAGE_SIZE = 1000;
      let allHistory = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let historyQuery = supabase
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

      const normalizeType = (type, isLimitedWeaponFlag) => {
        if (type === 'limited_character') return 'limited';
        if (type === 'limited_weapon') return 'weapon';
        if (type === 'weapon' && isLimitedWeaponFlag === false) return 'weapon';
        return type || 'standard';
      };

      const formattedPools = cloudPools.map(p => ({
        id: p.pool_id,
        name: p.name,
        type: normalizeType(p.type, p.is_limited_weapon),
        locked: p.locked || false,
        isLimitedWeapon: p.is_limited_weapon !== false,
        created_at: p.created_at || null,
        updated_at: p.updated_at || null,
        user_id: p.user_id,
        creator_username: usernameMap.get(p.user_id) || null,
        creator_role: roleMap.get(p.user_id) || null,
        up_character: p.up_character || null,
        description: p.description || null,
        banner_url: p.banner_url || null,
        start_time: p.start_time || null,
        end_time: p.end_time || null,
        featured_characters: p.featured_characters || null
      }));

      const formattedHistory = allHistory.map(h => ({
        id: h.record_id,
        rarity: h.rarity,
        isStandard: h.is_standard,
        specialType: h.special_type,
        timestamp: h.timestamp,
        poolId: h.pool_id,
        user_id: h.user_id,
        name: h.character_name || h.item_name,
        character_name: h.character_name,
        item_name: h.item_name,
        character_id: h.character_id,
        batchId: h.batch_id,
        batch_id: h.batch_id,
        seqId: h.seq_id,
        seq_id: h.seq_id,
        pity: h.pity || 0,
        isNew: h.is_new || false,
        is_new: h.is_new,
        isFree: h.is_free || false,
        is_free: h.is_free,
        gameUid: h.game_uid,
        game_uid: h.game_uid,
        nickName: h.nick_name,
        nick_name: h.nick_name
      }));

      // 补占位池
      const knownPoolIds = new Set(formattedPools.map(p => p.id));
      const historyPoolIds = [...new Set(formattedHistory.map(h => h.poolId))];
      const placeholderPools = historyPoolIds
        .filter(pid => !knownPoolIds.has(pid))
        .map(pid => {
          const inferredType = normalizeType(getPoolTypeFromId(pid));
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
            isLimitedWeapon: inferredType === 'limited_weapon',
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

      // Dedupe: 同一 pool_id 可能有多个 user 版本
      const dedupedPoolsMap = new Map();
      const roleWeight = (p) => {
        const role = p.creator_role;
        if (role === 'super_admin') return 3;
        if (role === 'admin') return 2;
        return 1;
      };
      const score = (p) =>
        (p.up_character ? 3 : 0) +
        (p.banner_url ? 1 : 0) +
        (p.description ? 1 : 0) +
        (p.locked ? 1 : 0) +
        roleWeight(p);
      const chooseBetter = (a, b) => {
        const scoreA = score(a);
        const scoreB = score(b);
        if (scoreA !== scoreB) return scoreA > scoreB ? a : b;
        const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return timeA >= timeB ? a : b;
      };

      [...formattedPools, ...placeholderPools].forEach(p => {
        const existing = dedupedPoolsMap.get(p.id);
        if (!existing) {
          dedupedPoolsMap.set(p.id, p);
        } else {
          dedupedPoolsMap.set(p.id, chooseBetter(existing, p));
        }
      });

      const dedupedPools = Array.from(dedupedPoolsMap.values());

      // 根据池类型回填历史记录的 isStandard
      const poolTypeLookup = new Map(dedupedPools.map(p => [p.id, p.type]));
      const normalizedHistory = formattedHistory.map(h => {
        const poolType = poolTypeLookup.get(h.poolId);
        const inferredIsStandard = (poolType === 'standard' || poolType === 'beginner') ? true
          : (poolType === 'limited' || poolType === 'limited_character' || poolType === 'weapon' || poolType === 'limited_weapon') ? false
          : null;
        const isStandard = inferredIsStandard !== null ? inferredIsStandard : Boolean(h.isStandard);
        return { ...h, isStandard };
      });

      return { pools: dedupedPools, history: normalizedHistory };
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
  }, []);

  // 保存卡池到云端
  const savePoolToCloud = useCallback(async (pool, showNotification = false) => {
    if (!supabase || !user) {
      return false;
    }

    try {
      const targetUserId = pool.user_id || user.id;

      const { error } = await supabase
        .from('pools')
        .upsert({
          user_id: targetUserId,
          pool_id: pool.id,
          name: pool.name,
          type: pool.type,
          locked: pool.locked || false,
          is_limited_weapon: pool.isLimitedWeapon !== false,
          up_character: pool.up_character || null,
          description: pool.description || null,
          banner_url: pool.banner_url || null,
          start_time: pool.start_time || null,
          end_time: pool.end_time || null,
          featured_characters: pool.featured_characters || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'pool_id' });

      if (error) throw error;
      return true;
    } catch (error) {
      setSyncError(error.message);
      return false;
    }
  }, [user]);

  // 保存历史记录到云端
  const saveHistoryToCloud = useCallback(async (records) => {
    if (!supabase || !user || records.length === 0) return;

    try {
      const cloudRecords = records.map(r => ({
        user_id: user.id,
        record_id: r.id,
        pool_id: r.poolId,
        rarity: r.rarity,
        is_standard: r.isStandard,
        character_name: r.character_name || r.name || null,
        item_name: r.item_name || r.name || r.character_name || null,
        batch_id: r.batchId || r.batch_id || null,
        seq_id: r.seqId || r.seq_id || null,
        pity: r.pity || 0,
        is_new: r.isNew || r.is_new || false,
        is_free: r.isFree || r.is_free || false,
        game_uid: r.gameUid || r.game_uid || null,
        timestamp: typeof r.timestamp === 'number'
          ? new Date(r.timestamp).toISOString()
          : r.timestamp,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('history')
        .upsert(cloudRecords, { onConflict: 'user_id,record_id' });

      if (error) throw error;
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
  }, [user]);

  // 从云端删除历史记录
  const deleteHistoryFromCloud = useCallback(async (recordIds) => {
    if (!supabase || !user) return false;

    try {
      const { error } = await supabase
        .from('history')
        .delete()
        .in('record_id', recordIds);

      if (error) throw error;
      return true;
    } catch (error) {
      setSyncError(error.message);
      showToast(`删除失败: ${error.message}`, 'error');
      return false;
    }
  }, [user, showToast]);

  // 从云端删除指定卡池的所有历史记录
  const deletePoolHistoryFromCloud = useCallback(async (poolId) => {
    if (!supabase || !user) return false;

    try {
      const { error } = await supabase
        .from('history')
        .delete()
        .eq('pool_id', poolId);

      if (error) throw error;
      return true;
    } catch (error) {
      setSyncError(error.message);
      showToast(`删除卡池记录失败: ${error.message}`, 'error');
      return false;
    }
  }, [user, showToast]);

  // 从云端删除卡池本身
  const deletePoolFromCloud = useCallback(async (poolId) => {
    if (!supabase || !user) return false;

    try {
      const { error } = await supabase
        .from('pools')
        .delete()
        .eq('pool_id', poolId);

      if (error) throw error;
      return true;
    } catch (error) {
      setSyncError(error.message);
      showToast(`删除卡池失败: ${error.message}`, 'error');
      return false;
    }
  }, [user, showToast]);

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

      return true;
    } catch (error) {
      setSyncError(error.message);
      return false;
    } finally {
      setSyncing(false);
    }
  }, [user, pools, history, savePoolToCloud, saveHistoryToCloud]);

  // 登录后处理：加载当前用户的云端数据
  const handlePostLogin = useCallback(async (loggedInUser) => {
    if (!loggedInUser) return;

    const cloudData = await loadCloudData(loggedInUser);

    if (cloudData) {
      const hasCloudData = cloudData.pools.length > 0 || cloudData.history.length > 0;

      if (hasCloudData) {
        if (cloudData.pools.length > 0) {
          setPools(cloudData.pools);
          switchPool(cloudData.pools[0].id);
        }
        if (cloudData.history.length > 0) {
          setHistory(cloudData.history);
        }
      }
    }
  }, [loadCloudData]);

  // 手动同步数据到云端（设置页面使用）
  const handleManualSync = useCallback(async () => {
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
      showToast(message, 'success');
    } catch (error) {
      showToast('同步失败: ' + error.message, 'error');
    } finally {
      setSyncing(false);
    }
  }, [user, pools, history, savePoolToCloud, saveHistoryToCloud, showToast]);

  // 监听用户登录状态变化，登录后加载云端数据
  const prevUserRef = useRef(null);
  useEffect(() => {
    if (user && !prevUserRef.current) {
      handlePostLogin(user);
    }
    prevUserRef.current = user;
  }, [user, handlePostLogin]);

  // 启动数据同步服务（用户登录后）
  // 使用 ref 防止重复启动/停止
  const syncStartedRef = useRef(false);
  const userIdRef = useRef(null);

  useEffect(() => {
    if (!user || !supabase) {
      // 用户登出时停止同步
      if (syncStartedRef.current) {
        console.log('[useCloudSync] 停止数据同步服务');
        syncManager.stopAutoSync();
        syncStartedRef.current = false;
        userIdRef.current = null;
      }
      return;
    }

    // 只有用户ID变化时才重新启动（避免重复启动）
    if (syncStartedRef.current && userIdRef.current === user.id) {
      return; // 已启动且用户未变化，跳过
    }

    // 如果之前已启动但用户变了，先停止
    if (syncStartedRef.current) {
      syncManager.stopAutoSync();
    }

    console.log('[useCloudSync] 启动数据同步服务...');
    syncManager.startAutoSync((syncState) => {
      // 只在状态实际变化时打印日志（减少日志量）
      if (process.env.NODE_ENV === 'development' && syncState.error) {
        console.log('[SyncManager] 同步错误:', syncState.error);
      }
    });
    syncStartedRef.current = true;
    userIdRef.current = user.id;

    return () => {
      if (syncStartedRef.current) {
        console.log('[useCloudSync] 停止数据同步服务');
        syncManager.stopAutoSync();
        syncStartedRef.current = false;
      }
    };
  }, [user?.id]); // 只依赖 user.id 而不是整个 user 对象

  return {
    loadCloudData,
    savePoolToCloud,
    saveHistoryToCloud,
    deleteHistoryFromCloud,
    deletePoolHistoryFromCloud,
    deletePoolFromCloud,
    migrateLocalToCloud,
    handlePostLogin,
    handleManualSync
  };
}

export default useCloudSync;
