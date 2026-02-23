import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { useAppStore, useAuthStore, usePoolStore, useHistoryStore } from '../../stores';
import useSiteConfigStore from '../../stores/useSiteConfigStore';
import { characterCache } from '../../utils/characterUtils';
import { RARITY_CONFIG, DEFAULT_POOL_ID } from '../../constants';

/**
 * 应用初始化 Hook
 * 处理会话获取、全局统计、last_seen 更新、characterCache 预加载
 */
export function useAppInitialization({ loadCloudData }) {
  const setUser = useAuthStore(state => state.setUser);
  const setPools = usePoolStore(state => state.setPools);
  const switchPool = usePoolStore(state => state.switchPool);
  const setHistory = useHistoryStore(state => state.setHistory);

  // 使用 ref 存储 currentPoolId，避免将其作为 useEffect 依赖项导致循环
  const currentPoolIdRef = useRef(usePoolStore.getState().currentPoolId);

  // 订阅 currentPoolId 变化，更新 ref（不触发重渲染）
  useEffect(() => {
    const unsubscribe = usePoolStore.subscribe(
      state => state.currentPoolId,
      (newPoolId) => {
        currentPoolIdRef.current = newPoolId;
      }
    );
    return unsubscribe;
  }, []);

  // 加载全局统计数据 (P2: 汇总页统计全局数据)
  // 使用 RPC 函数绕过 RLS 获取全服统计
  const fetchGlobalStats = useCallback(async () => {
    if (!supabase) return;

    const setGlobalStatsLoading = useAppStore.getState().setGlobalStatsLoading;
    const setGlobalStats = useAppStore.getState().setGlobalStats;

    setGlobalStatsLoading(true);
    try {
      // 调用数据库 RPC 函数获取全服统计（绕过 RLS）
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_global_stats');

      if (rpcError) {
        throw rpcError;
      }

      if (rpcData) {
        // 辅助函数：生成饼图数据（带增强显示值）
        const generateChartData = (counts) => {
          if (!counts) return [];
          const rawData = [
            { name: '6星(限定)', value: counts['6'] || 0, color: RARITY_CONFIG[6].color },
            { name: '6星(常驻)', value: counts['6_std'] || 0, color: RARITY_CONFIG['6_std'].color },
            { name: '5星', value: counts['5'] || 0, color: RARITY_CONFIG[5].color },
            { name: '4星', value: counts['4'] || 0, color: RARITY_CONFIG[4].color },
          ].filter(item => item.value > 0);

          const totalValue = rawData.reduce((sum, d) => sum + d.value, 0);
          return rawData.map(item => {
            const currentPercent = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
            let minPercent = 0;
            if (item.name.includes('6星')) minPercent = 15;
            else if (item.name.includes('5星')) minPercent = 20;

            if (currentPercent < minPercent && totalValue > 0) {
              return { ...item, displayValue: Math.ceil(totalValue * minPercent / 100) };
            }
            return { ...item, displayValue: item.value };
          });
        };

        // 辅助函数：处理分布数据
        const processDistribution = (dist) => {
          if (!dist || !Array.isArray(dist)) return [];
          return dist.map(item => ({
            range: item.range,
            limited: Number(item.limited) || 0,
            standard: Number(item.standard) || 0
          }));
        };

        // 处理分类型数据
        const processTypeStats = (typeData) => {
          if (!typeData) return { total: 0, six: 0, counts: {}, distribution: [], chartData: [], avgPity: null, avgPityExcludingFree: null };
          return {
            total: typeData.total || 0,
            six: typeData.six || 0,
            sixStarLimited: typeData.sixStarLimited || 0,
            sixStarStandard: typeData.sixStarStandard || 0,
            avgPity: typeData.avgPity || null,
            avgPityUp: typeData.avgPityUp || null,
            sparkCount: typeData.sparkCount || 0,
            avgPityExcludingFree: typeData.avgPityExcludingFree || null,
            counts: typeData.counts || {},
            distribution: processDistribution(typeData.distribution),
            chartData: generateChartData(typeData.counts)
          };
        };

        // RPC 返回的数据格式
        const stats = {
          totalPulls: rpcData.totalPulls || 0,
          totalPullsWithFree: rpcData.totalPullsWithFree || rpcData.totalPulls || 0,
          freePullCount: rpcData.freePullCount || 0,
          totalUsers: rpcData.totalUsers || 0,
          totalContributors: rpcData.totalContributors || 0,
          sixStarTotal: rpcData.sixStarTotal || 0,
          sixStarLimited: rpcData.sixStarLimited || 0,
          sixStarStandard: rpcData.sixStarStandard || 0,
          fiveStar: rpcData.fiveStar || 0,
          fourStar: rpcData.fourStar || 0,
          counts: rpcData.counts || {},
          distribution: processDistribution(rpcData.distribution),
          chartData: generateChartData(rpcData.counts),
          byType: {
            limited: processTypeStats(rpcData.byType?.limited),
            weapon: processTypeStats(rpcData.byType?.weapon),
            standard: processTypeStats(rpcData.byType?.standard)
          },
          avgPity: rpcData.avgPity || null,
          charGift: rpcData.charGift || 0,
          weaponGiftLimited: rpcData.weaponGiftLimited || 0,
          weaponGiftStandard: rpcData.weaponGiftStandard || 0,
          giftTotal: rpcData.giftTotal || 0
        };

        // 计算合并的角色池数据（限定+常驻）
        const limitedStats = stats.byType.limited;
        const standardStats = stats.byType.standard;
        const limitedSix = limitedStats.six || 0;
        const standardSix = standardStats.six || 0;
        const totalSix = limitedSix + standardSix;

        let characterAvgPity = null;
        if (totalSix > 0 && (limitedStats.avgPity || standardStats.avgPity)) {
          const limitedAvg = Number(limitedStats.avgPity) || 0;
          const standardAvg = Number(standardStats.avgPity) || 0;
          characterAvgPity = ((limitedAvg * limitedSix + standardAvg * standardSix) / totalSix).toFixed(1);
        }

        // 合并分布数据
        const mergeDistributions = (dist1, dist2) => {
          const map = new Map();
          [...(dist1 || []), ...(dist2 || [])].forEach(item => {
            const existing = map.get(item.range);
            if (existing) {
              existing.limited += item.limited || 0;
              existing.standard += item.standard || 0;
            } else {
              map.set(item.range, { range: item.range, limited: item.limited || 0, standard: item.standard || 0 });
            }
          });
          return Array.from(map.values()).sort((a, b) => {
            const getStart = r => parseInt(r.range.split('-')[0]) || 91;
            return getStart(a) - getStart(b);
          });
        };

        let characterAvgPityExclFree = null;
        if (totalSix > 0 && (limitedStats.avgPityExcludingFree || standardStats.avgPityExcludingFree)) {
          const limitedAvgExcl = Number(limitedStats.avgPityExcludingFree) || Number(limitedStats.avgPity) || 0;
          const standardAvgExcl = Number(standardStats.avgPityExcludingFree) || Number(standardStats.avgPity) || 0;
          characterAvgPityExclFree = ((limitedAvgExcl * limitedSix + standardAvgExcl * standardSix) / totalSix).toFixed(1);
        }

        stats.byType.character = {
          total: limitedStats.total + standardStats.total,
          six: limitedStats.six + standardStats.six,
          sixStarLimited: limitedStats.sixStarLimited + standardStats.sixStarLimited,
          sixStarStandard: limitedStats.sixStarStandard + standardStats.sixStarStandard,
          avgPity: characterAvgPity,
          avgPityExcludingFree: characterAvgPityExclFree,
          counts: {
            '6': (limitedStats.counts['6'] || 0) + (standardStats.counts['6'] || 0),
            '6_std': (limitedStats.counts['6_std'] || 0) + (standardStats.counts['6_std'] || 0),
            '5': (limitedStats.counts['5'] || 0) + (standardStats.counts['5'] || 0),
            '4': (limitedStats.counts['4'] || 0) + (standardStats.counts['4'] || 0)
          },
          distribution: mergeDistributions(limitedStats.distribution, standardStats.distribution),
          chartData: generateChartData({
            '6': (limitedStats.counts['6'] || 0) + (standardStats.counts['6'] || 0),
            '6_std': (limitedStats.counts['6_std'] || 0) + (standardStats.counts['6_std'] || 0),
            '5': (limitedStats.counts['5'] || 0) + (standardStats.counts['5'] || 0),
            '4': (limitedStats.counts['4'] || 0) + (standardStats.counts['4'] || 0)
          })
        };

        setGlobalStats(stats);
      }
    } catch (error) {
      const emptyTypeStats = { total: 0, six: 0, counts: {}, distribution: [], chartData: [] };
      setGlobalStats({
        totalPulls: 0,
        totalUsers: 0,
        sixStarTotal: 0,
        sixStarLimited: 0,
        sixStarStandard: 0,
        fiveStar: 0,
        fourStar: 0,
        counts: {},
        distribution: [],
        chartData: [],
        byType: {
          limited: emptyTypeStats,
          weapon: emptyTypeStats,
          standard: emptyTypeStats,
          character: emptyTypeStats
        },
        avgPity: null
      });
    } finally {
      setGlobalStatsLoading(false);
    }
  }, []);

  // 更新用户最后在线时间
  const updateLastSeen = useCallback(async () => {
    if (!supabase) return;
    try {
      await supabase.rpc('update_last_seen');
    } catch (error) {
      // 静默失败，不影响用户体验
    }
  }, []);

  // 主初始化逻辑
  useEffect(() => {
    const initializeApp = async () => {
      if (!supabase) {
        return;
      }

      try {
        // 预加载角色缓存（确保头像数据可用）
        await characterCache.load();

        // 获取当前会话
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);

        // 更新最后在线时间
        if (session?.user) {
          updateLastSeen();
        }

        // 获取全局统计 + 站点配置（并行）
        await Promise.all([
          fetchGlobalStats(),
          useSiteConfigStore.getState().loadConfig()
        ]);

        // 只有登录用户才加载数据
        if (session?.user) {
          const cloudData = await loadCloudData(session.user);
          if (cloudData && cloudData.pools.length > 0) {
            setPools(cloudData.pools);

            // 使用 ref 中的值，避免依赖项循环
            const savedPoolId = currentPoolIdRef.current;
            const hasCurrent = cloudData.pools.some(p => p.id === savedPoolId);
            const defaultPool = cloudData.pools.find(p => p.id === DEFAULT_POOL_ID);
            const fallbackId = hasCurrent
              ? savedPoolId
              : defaultPool
                ? defaultPool.id
                : cloudData.pools[0].id;
            switchPool(fallbackId);
            localStorage.setItem('gacha_current_pool_id', fallbackId);

            if (cloudData.history.length > 0) {
              setHistory(cloudData.history);
            }
          }
        }
      } catch (error) {
        console.error('[useAppInitialization] 初始化失败:', error);
      }
    };

    initializeApp();

    // 监听登录状态变化
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        // 用户状态变化时刷新全局统计
        fetchGlobalStats();
        // 用户登录时更新最后在线时间
        if (session?.user) {
          updateLastSeen();
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [fetchGlobalStats, loadCloudData, updateLastSeen, setUser, setPools, switchPool, setHistory]); // 移除 currentPoolId 依赖，使用 ref 代替

  return {
    fetchGlobalStats,
    updateLastSeen
  };
}

export default useAppInitialization;
