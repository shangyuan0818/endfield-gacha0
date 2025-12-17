import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Plus, Trash2, Settings, History, Save, RotateCcw, BarChart3, Star, Calculator, Search, Download, Layers, FolderPlus, ChevronDown, X, AlertCircle, Upload, FileJson, CheckCircle2, LogIn, LogOut, User, Cloud, CloudOff, RefreshCw, UserPlus, Bell, FileText, Shield, Info, Moon, Sun, Monitor, Lock, Unlock, ExternalLink, Heart, Code, Sparkles, AlertTriangle, MessageSquare } from 'lucide-react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import AuthModal from './AuthModal';
import { TicketPanel, AboutPanel, SummaryView, AdminPanel, SettingsPanel, InputSection, BatchCard, PoolSelector, RecordsView, DashboardView, EditItemModal, HomePage, Footer } from './components';
import SimpleMarkdown from './components/SimpleMarkdown';
import { Toast, ConfirmDialog, LoadingBar, NotificationBadge } from './components/ui';
import { useToast, useConfirm } from './hooks';
import { useUIStore, useAuthStore, useAppStore, usePoolStore, useHistoryStore } from './stores';
import { RARITY_CONFIG, DEFAULT_DISPLAY_PITY, DEFAULT_POOL_ID, PRESET_POOLS, POOL_TYPE_KEYWORDS, LIMITED_POOL_RULES, WEAPON_POOL_RULES, LIMITED_POOL_SCHEDULE, getCurrentUpPool } from './constants';
import { validatePullData, validatePoolData, validateBatchAgainstRules, calculateCurrentProbability, calculateInheritedPity, getPoolRules, extractDrawerFromPoolName, extractCharNameFromPoolName, extractTypeFromPoolName, STORAGE_KEYS, hasNewContent, markAsViewed, getStorageItem, setStorageItem } from './utils';


export default function GachaAnalyzer({ themeMode, setThemeMode }) {
  // 检测暗色模式
  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // --- 从 Zustand Stores 获取状态 ---

  // 认证状态
  const user = useAuthStore(state => state.user);
  const userRole = useAuthStore(state => state.userRole);
  const showAuthModal = useAuthStore(state => state.showAuthModal);
  const syncing = useAuthStore(state => state.syncing);
  const syncError = useAuthStore(state => state.syncError);
  const setUser = useAuthStore(state => state.setUser);
  const setUserRole = useAuthStore(state => state.setUserRole);
  const toggleAuthModal = useAuthStore(state => state.toggleAuthModal);
  const openAuthModal = useAuthStore(state => state.openAuthModal);
  const closeAuthModal = useAuthStore(state => state.closeAuthModal);
  const setSyncing = useAuthStore(state => state.setSyncing);
  const setSyncError = useAuthStore(state => state.setSyncError);

  // 应用全局状态
  const globalStats = useAppStore(state => state.globalStats);
  const globalStatsLoading = useAppStore(state => state.globalStatsLoading);
  const announcements = useAppStore(state => state.announcements);
  const showApplyModal = useAppStore(state => state.showApplyModal);
  const applicationStatus = useAppStore(state => state.applicationStatus);
  const setAnnouncements = useAppStore(state => state.setAnnouncements);
  const toggleApplyModal = useAppStore(state => state.toggleApplyModal);
  const setApplicationStatus = useAppStore(state => state.setApplicationStatus);

  // 卡池状态
  const pools = usePoolStore(state => state.pools);
  const currentPoolId = usePoolStore(state => state.currentPoolId);
  const poolSearchQuery = usePoolStore(state => state.poolSearchQuery);
  const collapsedDrawers = usePoolStore(state => state.collapsedDrawers);
  const setPools = usePoolStore(state => state.setPools);
  const switchPool = usePoolStore(state => state.switchPool);
  const setPoolSearchQuery = usePoolStore(state => state.setPoolSearchQuery);
  const toggleDrawer = usePoolStore(state => state.toggleDrawer);
  const createPool = usePoolStore(state => state.createPool);
  const deletePool = usePoolStore(state => state.deletePool);
  const updatePool = usePoolStore(state => state.updatePool);

  // 历史记录状态
  const history = useHistoryStore(state => state.history);
  const manualPityLimit = useHistoryStore(state => state.manualPityLimit);
  const visibleHistoryCount = useHistoryStore(state => state.visibleHistoryCount);
  const historyFilter = useHistoryStore(state => state.historyFilter);
  const setHistory = useHistoryStore(state => state.setHistory);
  const setManualPityLimit = useHistoryStore(state => state.setManualPityLimit);
  const setVisibleHistoryCount = useHistoryStore(state => state.setVisibleHistoryCount);
  const setHistoryFilter = useHistoryStore(state => state.setHistoryFilter);

  // UI 状态
  const activeTab = useUIStore(state => state.activeTab);
  const modalState = useUIStore(state => state.modalState);
  const setModalState = useUIStore(state => state.setModalState);
  const newPoolNameInput = useUIStore(state => state.newPoolNameInput);
  const newPoolTypeInput = useUIStore(state => state.newPoolTypeInput);
  const isLimitedWeaponPool = useUIStore(state => state.isLimitedWeaponPool);
  const drawerName = useUIStore(state => state.drawerName);
  const selectedCharName = useUIStore(state => state.selectedCharName);
  const editItemState = useUIStore(state => state.editItemState);
  const setActiveTab = useUIStore(state => state.setActiveTab);
  const openModal = useUIStore(state => state.openModal);
  const closeModal = useUIStore(state => state.closeModal);
  const setNewPoolNameInput = useUIStore(state => state.setNewPoolNameInput);
  const setNewPoolTypeInput = useUIStore(state => state.setNewPoolTypeInput);
  const setIsLimitedWeaponPool = useUIStore(state => state.setIsLimitedWeaponPool);
  const setDrawerName = useUIStore(state => state.setDrawerName);
  const setSelectedCharName = useUIStore(state => state.setSelectedCharName);
  const setEditItemState = useUIStore(state => state.setEditItemState);

  // 本地 UI 状态（仍然使用 useState）
  const [showPoolMenu, setShowPoolMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // UX-006: 通知气泡状态
  const [pendingApplicationsCount, setPendingApplicationsCount] = useState(0);  // 待审批申请数量（仅超管）
  const [hasNewAnnouncement, setHasNewAnnouncement] = useState(false);          // 是否有新公告
  const [unreadTicketsCount, setUnreadTicketsCount] = useState(0);              // 未读工单数量

  // 0.2 通用弹窗
  const { toasts, showToast, removeToast } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();

  // 权限判断
  const canEdit = userRole === 'admin' || userRole === 'super_admin';
  const isSuperAdmin = userRole === 'super_admin';

  // 当前卡池对象（从 stores 计算）
  const currentPool = useMemo(() => {
    const byId = pools.find(p => p.id === currentPoolId);
    if (byId) return byId;
    const defaultPool = pools.find(p => p.id === DEFAULT_POOL_ID);
    if (defaultPool) return defaultPool;
    return pools[0];
  }, [pools, currentPoolId]);

  // 如果当前选中卡池ID无效，则回退到默认池
  useEffect(() => {
    const exists = pools.some(p => p.id === currentPoolId);
    if (!exists) {
      const fallback = pools.find(p => p.id === DEFAULT_POOL_ID) || pools[0];
      if (fallback) {
        switchPool(fallback.id);
      }
    }
  }, [pools, currentPoolId, switchPool]);

  // 当前卡池是否可编辑（锁定的卡池只有超管能改）
  const canEditCurrentPool = useMemo(() => {
    if (!canEdit) return false;
    if (currentPool?.locked && !isSuperAdmin) return false;
    return true;
  }, [canEdit, currentPool?.locked, isSuperAdmin]);

  // 按抽卡人分组的卡池列表（支持搜索）
  const groupedPools = useMemo(() => {
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
  }, [pools, poolSearchQuery]);

  // 获取所有已知的抽卡人列表
  const knownDrawers = useMemo(() => {
    const drawers = new Set();
    pools.forEach(pool => {
      const drawer = extractDrawerFromPoolName(pool.name);
      if (drawer) {
        drawers.add(drawer);
      }
    });
    return Array.from(drawers).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [pools]);

  // 当前卡池的历史记录（方案A：完全开放模式，显示该卡池的所有数据）
  const currentPoolHistory = useMemo(() => {
    if (!currentPool) return [];
    // 只按 poolId 过滤，不区分 user_id
    // 这样所有用户都能看到该卡池的全部录入数据（适合协作场景）
    return history.filter(h => h.poolId === currentPoolId);
  }, [history, currentPoolId, currentPool]);

  // 文件上传 Ref
  const fileInputRef = useRef(null);

  // --- Effects ---

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
        // RPC调用失败，回退到旧方法（可能因为函数还没部署）
        throw rpcError;
      }

      if (rpcData) {
        // 辅助函数：生成饼图数据
        const generateChartData = (counts) => {
          if (!counts) return [];
          return [
            { name: '6星(限定)', value: counts['6'] || 0, color: '#FF5F00' },
            { name: '6星(常驻)', value: counts['6_std'] || 0, color: '#EF4444' },
            { name: '5星', value: counts['5'] || 0, color: '#EAB308' },
            { name: '4星', value: counts['4'] || 0, color: '#A855F7' },
          ].filter(item => item.value > 0);
        };

        // 辅助函数：处理分布数据（确保格式正确）
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
          if (!typeData) return { total: 0, six: 0, counts: {}, distribution: [], chartData: [], avgPity: null };
          return {
            total: typeData.total || 0,
            six: typeData.six || 0,
            sixStarLimited: typeData.sixStarLimited || 0,
            sixStarStandard: typeData.sixStarStandard || 0,
            avgPity: typeData.avgPity || null,
            counts: typeData.counts || {},
            distribution: processDistribution(typeData.distribution),
            chartData: generateChartData(typeData.counts)
          };
        };

        // RPC 返回的数据格式（包含图表所需的详细数据）
        const stats = {
          totalPulls: rpcData.totalPulls || 0,
          totalUsers: rpcData.totalUsers || 0,
          sixStarTotal: rpcData.sixStarTotal || 0,
          sixStarLimited: rpcData.sixStarLimited || 0,
          sixStarStandard: rpcData.sixStarStandard || 0,
          fiveStar: rpcData.fiveStar || 0,
          fourStar: rpcData.fourStar || 0,
          // 全局统计的 counts 和 distribution（用于图表）
          counts: rpcData.counts || {},
          distribution: processDistribution(rpcData.distribution),
          chartData: generateChartData(rpcData.counts),
          byType: {
            limited: processTypeStats(rpcData.byType?.limited),
            weapon: processTypeStats(rpcData.byType?.weapon),
            standard: processTypeStats(rpcData.byType?.standard)
          },
          // 使用数据库计算的精确平均出货（每个6星的垫刀数平均）
          avgPity: rpcData.avgPity || null,
          // 赠送数量
          charGift: rpcData.charGift || 0,
          weaponGiftLimited: rpcData.weaponGiftLimited || 0,
          weaponGiftStandard: rpcData.weaponGiftStandard || 0,
          giftTotal: rpcData.giftTotal || 0
        };

        // 计算合并的角色池数据（限定+常驻）
        const limitedStats = stats.byType.limited;
        const standardStats = stats.byType.standard;

        // 计算合并的平均出货（加权平均）
        const limitedSix = limitedStats.six || 0;
        const standardSix = standardStats.six || 0;
        const totalSix = limitedSix + standardSix;
        let characterAvgPity = null;
        if (totalSix > 0 && (limitedStats.avgPity || standardStats.avgPity)) {
          const limitedAvg = Number(limitedStats.avgPity) || 0;
          const standardAvg = Number(standardStats.avgPity) || 0;
          characterAvgPity = ((limitedAvg * limitedSix + standardAvg * standardSix) / totalSix).toFixed(1);
        }

        // 合并限定池和常驻池的 distribution（按 range 合并）
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
          // 按 range 排序
          return Array.from(map.values()).sort((a, b) => {
            const getStart = r => parseInt(r.range.split('-')[0]) || 91;
            return getStart(a) - getStart(b);
          });
        };

        stats.byType.character = {
          total: limitedStats.total + standardStats.total,
          six: limitedStats.six + standardStats.six,
          sixStarLimited: limitedStats.sixStarLimited + standardStats.sixStarLimited,
          sixStarStandard: limitedStats.sixStarStandard + standardStats.sixStarStandard,
          avgPity: characterAvgPity,
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
      // 设置为空统计而不是 null，避免显示加载中
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

  // 从云端加载数据（方案A：所有用户包括游客都能查看所有数据）
  const loadCloudData = useCallback(async () => {
    if (!supabase) return null;

    setSyncing(true);
    setSyncError(null);

    try {
      // 方案A：所有用户（包括游客）都加载所有卡池（查看权限完全开放）
      // RLS 策略已设置为 true，允许匿名访问
      let poolQuery = supabase
        .from('pools')
        .select('*');

      const { data: cloudPools, error: poolsError } = await poolQuery;

      if (poolsError) throw poolsError;

      // 收集所有 user_id 并查询对应的 profiles 获取用户名
      const userIds = [...new Set(cloudPools.map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

      // 创建 user_id -> username 的映射
      const usernameMap = new Map();
      if (profiles) {
        profiles.forEach(p => usernameMap.set(p.id, p.username));
      }

      // 分页加载历史记录（Supabase 默认限制 1000 行）
      const PAGE_SIZE = 1000;
      let allHistory = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        // 方案A：加载所有历史记录（不限制 user_id）
        let historyQuery = supabase
          .from('history')
          .select('*')
          .order('record_id', { ascending: true })
          .range(from, to);

        const { data: pageData, error: historyError } = await historyQuery;

        if (historyError) throw historyError;

        if (pageData && pageData.length > 0) {
          allHistory = allHistory.concat(pageData);
          page++;
          // 如果返回的数据少于 PAGE_SIZE，说明没有更多了
          hasMore = pageData.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      // 转换数据格式（云端字段名可能不同）
      // 使用 usernameMap 获取创建人用户名
      const formattedPools = cloudPools.map(p => ({
        id: p.pool_id,
        name: p.name,
        type: p.type,
        locked: p.locked || false,
        isLimitedWeapon: p.is_limited_weapon !== false,  // 武器池类型：限定/常驻
        created_at: p.created_at || null,
        user_id: p.user_id,  // 保留 user_id 用于判断是否为当前用户创建
        creator_username: usernameMap.get(p.user_id) || null  // 从 profiles 查询得到的用户名
      }));

      const formattedHistory = allHistory.map(h => ({
        id: h.record_id,
        rarity: h.rarity,
        isStandard: h.is_standard,
        specialType: h.special_type,
        timestamp: h.timestamp,
        poolId: h.pool_id,
        user_id: h.user_id  // 保留 user_id 用于判断归属
      }));

      return { pools: formattedPools, history: formattedHistory };
    } catch (error) {
      setSyncError(error.message);
      return null;
    } finally {
      setSyncing(false);
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

  // 监听用户登录状态
  useEffect(() => {
    const initializeApp = async () => {
      if (!supabase) {
        return;
      }

      try {
        // 获取当前会话
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);

        // 更新最后在线时间
        if (session?.user) {
          updateLastSeen();
        }

        // 获取全局统计（使用 RPC 函数，无需等待认证同步）
        await fetchGlobalStats();

        // 方案A：加载云端数据（包括游客）
        const cloudData = await loadCloudData();
        if (cloudData && cloudData.pools.length > 0) {
          setPools(cloudData.pools);

          const hasCurrent = cloudData.pools.some(p => p.id === currentPoolId);
          const defaultPool = cloudData.pools.find(p => p.id === DEFAULT_POOL_ID);
          const fallbackId = hasCurrent
            ? currentPoolId
            : defaultPool
              ? defaultPool.id
              : cloudData.pools[0].id;
          switchPool(fallbackId);
          localStorage.setItem('gacha_current_pool_id', fallbackId);

          if (cloudData.history.length > 0) {
            setHistory(cloudData.history);
          }
        }
      } catch (error) {
      }
    };

    initializeApp();

    // 监听登录状态变化
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        // 用户状态变化时刷新全局统计（RPC 函数不受 RLS 限制）
        fetchGlobalStats();
        // 用户登录时更新最后在线时间
        if (session?.user) {
          updateLastSeen();
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [fetchGlobalStats, loadCloudData, updateLastSeen]);

  // 实时监听卡池变化（解决锁定不立即生效的问题）
  useEffect(() => {
    if (!supabase) return;

    // 订阅 pools 表的所有变化
    const channel = supabase
      .channel('pools-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // 监听所有事件：INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'pools'
        },
        (payload) => {
          // 卡池数据变化监听
          if (payload.eventType === 'UPDATE') {
            // 更新本地卡池状态
            const updatedPool = payload.new;
            setPools(prev => prev.map(p => {
              if (p.id === updatedPool.pool_id) {
                return {
                  ...p,
                  locked: updatedPool.locked,
                  name: updatedPool.name,
                  type: updatedPool.type
                };
              }
              return p;
            }));

            // 如果更新的是当前卡池，显示通知
            if (updatedPool.pool_id === currentPoolId) {
              if (updatedPool.locked && canEdit && !isSuperAdmin) {
                showToast(`卡池「${updatedPool.name}」已被超级管理员锁定`, 'warning', '卡池已锁定');
              } else if (!updatedPool.locked) {
                showToast(`卡池「${updatedPool.name}」已解锁`, 'success', '卡池已解锁');
              }
            }
          } else if (payload.eventType === 'INSERT') {
            // 新增卡池（其他用户创建）
            const newPool = payload.new;
            setPools(prev => {
              // 避免重复添加
              if (prev.some(p => p.id === newPool.pool_id)) return prev;
              return [...prev, {
                id: newPool.pool_id,
                name: newPool.name,
                type: newPool.type,
                locked: newPool.locked || false,
                created_at: newPool.created_at,
                user_id: newPool.user_id
              }];
            });
          } else if (payload.eventType === 'DELETE') {
            // 删除卡池
            const deletedPool = payload.old;
            setPools(prev => prev.filter(p => p.id !== deletedPool.pool_id));
          }
        }
      )
      .subscribe();

    // 清理订阅
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentPoolId, canEdit, isSuperAdmin, showToast]);

  // 获取用户角色
  useEffect(() => {
    if (!supabase || !user) {
      setUserRole(null);
      setApplicationStatus(null);
      return;
    }

    const fetchUserRole = async () => {
      try {
        // 获取用户角色（使用 maybeSingle 避免无记录时报错）
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (error) throw error;

        // 如果 profile 不存在，尝试创建一个
        if (!profile) {
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({ id: user.id, username: user.email?.split('@')[0], role: 'user' });
          // 创建profile失败时，依然设置默认role，不影响用户使用
          setUserRole('user');
        } else {
          setUserRole(profile.role || 'user');
        }

        // 获取申请状态（移除排序避免列名问题）
        const { data: application } = await supabase
          .from('admin_applications')
          .select('status')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        setApplicationStatus(application?.status || null);
      } catch (error) {
        setUserRole('user');
      }
    };

    fetchUserRole();
  }, [user]);

  // 加载公告 - 优先从 Supabase 加载，失败则回退到本地 JSON
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        let data = null;

        // 优先尝试从 Supabase 加载
        if (supabase) {
          const { data: dbData, error } = await supabase
            .from('announcements')
            .select('*')
            .eq('is_active', true)
            .order('priority', { ascending: false });

          if (!error && dbData && dbData.length > 0) {
            data = dbData;
          }
        }

        // 回退到本地 JSON
        if (!data) {
          const response = await fetch('/announcements.json');
          if (response.ok) {
            const jsonData = await response.json();
            data = jsonData.filter(a => a.is_active).sort((a, b) => b.priority - a.priority);
          }
        }

        if (data && data.length > 0) {
          setAnnouncements(data);
          // UX-006: 检测是否有新公告
          const latestAnnouncement = data[0];
          if (latestAnnouncement?.updated_at) {
            const isNew = hasNewContent(STORAGE_KEYS.ANNOUNCEMENT_LAST_VIEWED, latestAnnouncement.updated_at);
            setHasNewAnnouncement(isNew);
          }
        } else {
          setAnnouncements([]);
          setHasNewAnnouncement(false);
        }
      } catch (error) {
        setAnnouncements([]);
        setHasNewAnnouncement(false);
      }
    };

    fetchAnnouncements();
  }, []);

  // UX-006: 获取待审批管理员申请数量（仅超管）
  useEffect(() => {
    const fetchPendingApplications = async () => {
      if (!supabase || !isSuperAdmin) {
        setPendingApplicationsCount(0);
        return;
      }

      try {
        const { count, error } = await supabase
          .from('admin_applications')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        if (!error) {
          setPendingApplicationsCount(count || 0);
        }
      } catch (error) {
        // 静默失败
      }
    };

    fetchPendingApplications();
  }, [isSuperAdmin]);

  // UX-006: 获取未读工单数量
  useEffect(() => {
    const fetchUnreadTickets = async () => {
      if (!supabase || !user) {
        setUnreadTicketsCount(0);
        return;
      }

      try {
        // 获取用户上次查看工单的时间
        const lastViewed = getStorageItem(STORAGE_KEYS.TICKETS_LAST_VIEWED, 0);
        const lastViewedDate = lastViewed ? new Date(lastViewed).toISOString() : '1970-01-01T00:00:00Z';

        // 查询更新时间晚于上次查看时间的工单
        // 对于普通用户：查询自己创建的工单
        // 对于超管：查询所有工单
        let query = supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .gt('updated_at', lastViewedDate);

        if (!isSuperAdmin) {
          query = query.eq('user_id', user.id);
        }

        const { count, error } = await query;

        if (!error) {
          setUnreadTicketsCount(count || 0);
        }
      } catch (error) {
        // 静默失败
      }
    };

    fetchUnreadTickets();
  }, [user, isSuperAdmin]);

  // 登出处理
  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setUserRole(null);
    setApplicationStatus(null);
  };

  // 提交管理员申请
  const handleApplyAdmin = async (reason) => {
    if (!supabase || !user) return false;

    try {
      const { error } = await supabase
        .from('admin_applications')
        .insert({
          user_id: user.id,
          reason: reason
        });

      if (error) throw error;
      setApplicationStatus('pending');
      setShowApplyModal(false);
      return true;
    } catch (error) {
      return false;
    }
  };

  // --- 云同步函数 ---

  // 迁移弹窗状态
  const [showMigrateModal, setShowMigrateModal] = useState(false);

  // 保存卡池到云端
  const savePoolToCloud = useCallback(async (pool, showNotification = false) => {
    if (!supabase || !user) {
      return false;
    }

    try {
      // 使用卡池的 user_id（创建者ID），如果不存在则使用当前登录用户ID
      // 这样确保超管锁定时更新的是原创建者的记录
      const targetUserId = pool.user_id || user.id;

      const { error } = await supabase
        .from('pools')
        .upsert({
          user_id: targetUserId,
          pool_id: pool.id,
          name: pool.name,
          type: pool.type,
          locked: pool.locked || false,
          is_limited_weapon: pool.isLimitedWeapon !== false,  // 武器池类型：限定/常驻
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,pool_id' });

      if (error) throw error;

      // 同步成功，不记录日志
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
        special_type: r.specialType,
        timestamp: r.timestamp,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('history')
        .upsert(cloudRecords, { onConflict: 'user_id,record_id' });

      if (error) throw error;
    } catch (error) {

      // 检测是否为RLS策略拒绝 (locked卡池保护)
      const errorMessage = error.message || '';
      if (errorMessage.includes('policy') || errorMessage.includes('violates row-level security')) {
        showToast(
          '该卡池已被锁定，只有超级管理员可以修改数据',
          'error',
          '权限不足'
        );
      } else {
        // 其他错误
        showToast(
          `保存失败: ${errorMessage.substring(0, 100)}`,
          'error',
          '同步错误'
        );
      }

      setSyncError(error.message);

      // 修复ERROR-NEW-001: 重新抛出错误，让调用者能够捕获并回滚
      throw error;
    }
  }, [user]);

  // 从云端删除历史记录
  const deleteHistoryFromCloud = useCallback(async (recordIds) => {
    if (!supabase || !user) return false;

    try {
      // 直接删除，权限由 RLS 策略控制
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
      // 直接删除，权限由 RLS 策略控制
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
      // 直接删除，权限由 RLS 策略控制
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
      // 保存所有卡池
      for (const pool of pools) {
        await savePoolToCloud(pool);
      }

      // 分批保存历史记录（每次100条）
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

  // 登录后处理：检查云端数据并决定是否迁移（方案A：所有用户都加载所有数据）
  const handlePostLogin = useCallback(async (loggedInUser) => {
    if (!loggedInUser) return;

    // 方案A：所有用户都加载所有数据（游客模式下已在初始化时加载）
    const cloudData = await loadCloudData();

    if (cloudData) {
      const hasCloudData = cloudData.pools.length > 0 || cloudData.history.length > 0;
      const hasLocalData = history.length > 0;

      if (hasCloudData) {
        // 云端有数据，直接加载云端数据
        if (cloudData.pools.length > 0) {
          setPools(cloudData.pools);
          switchPool(cloudData.pools[0].id);
        }
        if (cloudData.history.length > 0) {
          setHistory(cloudData.history);
        }
      } else if (hasLocalData) {
        // 云端无数据但本地有，询问是否迁移
        setShowMigrateModal(true);
      }
    }
  }, [history, loadCloudData]);

  // 监听用户登录状态变化，登录后加载云端数据
  const prevUserRef = useRef(null);
  useEffect(() => {
    if (user && !prevUserRef.current) {
      // 用户刚登录
      handlePostLogin(user);
    }
    prevUserRef.current = user;
  }, [user, handlePostLogin]);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('gacha_history_v2', JSON.stringify(history));
    }, 1000);
    return () => clearTimeout(timer);
  }, [history]);

  useEffect(() => {
    localStorage.setItem('gacha_pools', JSON.stringify(pools));
  }, [pools]);

  useEffect(() => {
    localStorage.setItem('gacha_current_pool_id', currentPoolId);
  }, [currentPoolId]);

  // --- 核心计算逻辑 ---
  // 为当前卡池历史记录添加全局序号
  const currentPoolHistoryWithIndex = useMemo(() => {
    // 基于 currentPoolHistory（已处理多用户过滤），添加全局序号
    // 确保按 id 排序（id 基于时间戳生成，代表录入顺序）
    return [...currentPoolHistory]
      .sort((a, b) => a.id - b.id)
      .map((item, index) => ({ ...item, globalIndex: index + 1 }));
  }, [currentPoolHistory]);

  // 将历史记录按时间戳聚合，用于展示十连
  const groupedHistory = useMemo(() => {
    const groups = [];
    // 优化：数据默认按录入时间顺序，直接倒序即可，避免耗时的 sort
    const sorted = [...currentPoolHistoryWithIndex].reverse();

    if (sorted.length === 0) return [];

    let currentGroup = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i-1];
      const curr = sorted[i];

      // 判断是否为同一批次：时间差在 2 秒内视为同一批次
      // 使用时间差而非字符串比较，因为数据库返回的时间戳格式可能与前端不同
      const prevTime = new Date(prev.timestamp).getTime();
      const currTime = new Date(curr.timestamp).getTime();
      const timeDiff = Math.abs(currTime - prevTime);

      if (timeDiff <= 2000) { // 2秒内视为同一批次
        currentGroup.push(curr);
      } else {
        groups.push(currentGroup);
        currentGroup = [curr];
      }
    }
    groups.push(currentGroup);

    // 组与组之间按时间倒序（最新的组在前面）
    // 但组内元素，我们需要恢复为时间正序（从左到右显示 第1抽->第10抽）
    return groups.map(g => g.reverse());
  }, [currentPoolHistoryWithIndex]);

  // 筛选后的历史记录
  const filteredGroupedHistory = useMemo(() => {
    if (historyFilter === 'all') return groupedHistory;

    // 筛选时，每个符合条件的记录单独成组（方便查看出货抽数）
    const result = [];
    groupedHistory.forEach(group => {
      group.forEach(item => {
        const match =
          (historyFilter === '6star' && item.rarity === 6) ||
          (historyFilter === '5star' && item.rarity === 5) ||
          (historyFilter === 'gift' && item.specialType === 'gift');
        if (match) result.push([item]);
      });
    });
    return result;
  }, [groupedHistory, historyFilter]);

  const stats = useMemo(() => {
    // 过滤掉赠送的记录来计算有效抽数
    const validPullsList = currentPoolHistory.filter(item => item.specialType !== 'gift');
    const total = validPullsList.length;
    
    // 统计 counts (包含赠送，展示用)
    const counts = { 6: 0, '6_std': 0, 5: 0, 4: 0 };
    // 统计 gift 数量
    const giftCounts = { 6: 0 }; 

    let currentPity = 0;
    let currentPity5 = 0;
    
    // 1. 计算当前6星保底 (忽略 gift)
    // 我们需要在完整历史中倒序查找，遇到 gift 跳过，遇到非 gift 的 6星 则停止
    for (let i = currentPoolHistory.length - 1; i >= 0; i--) {
      const item = currentPoolHistory[i];
      if (item.specialType === 'gift') continue; // 跳过赠送，不影响垫刀
      
      if (item.rarity === 6) {
        break; // 遇到非赠送的6星，保底重置
      }
      currentPity++;
    }

    // 2. 计算当前5星保底 (忽略 gift)
    for (let i = currentPoolHistory.length - 1; i >= 0; i--) {
      const item = currentPoolHistory[i];
      if (item.specialType === 'gift') continue;

      if (item.rarity >= 5) {
        break;
      }
      currentPity5++;
    }

    // 3. 统计各稀有度数量
    currentPoolHistory.forEach(pull => {
      let r = pull.rarity;
      
      if (pull.specialType === 'gift') {
        if (r === 6) giftCounts[6]++;
      }

      if (r === 6) {
        if (pull.isStandard) {
          counts['6_std']++;
        } else {
          counts[6]++;
        }
      } else {
        if (r < 4) r = 4;
        if (counts[r] !== undefined) counts[r]++;
      }
    });

    const totalSixStar = counts[6] + counts['6_std'];
    const validSixStar = totalSixStar - giftCounts[6]; // (这个变量暂时没用到，但逻辑是对的)
    
    // --- 修正不歪率计算 ---
    // 必须排除手动录入的 gift 和后续计算的 bonus gift
    // 我们重新统计一下“真实抽到的”数量
    let realLimited = 0;
    let realStandard = 0;
    currentPoolHistory.forEach(pull => {
       if (pull.rarity === 6 && pull.specialType !== 'gift') {
          if (pull.isStandard) realStandard++;
          else realLimited++;
       }
    });
    const realTotalSix = realLimited + realStandard;
    const winRate = realTotalSix > 0 ? (realLimited / realTotalSix * 100).toFixed(1) : 0;

    // 计算额外赠送机制 (240抽 / 武器池)
    let bonusGiftsLimited = 0;
    let bonusGiftsStandard = 0;

    if (currentPool.type === 'limited') {
      bonusGiftsLimited = Math.floor(total / 240);
    } else if (currentPool.type === 'weapon') {
      // 武器池赠送逻辑：100(常) -> 180(限) -> 260(常) -> 340(限) ...
      if (total >= 100) bonusGiftsStandard++; // 100抽送常驻
      if (total >= 180) {
        bonusGiftsLimited++; // 180抽送限定
        
        // 超过180后，每80抽交替
        const extraPulls = total - 180;
        const extraCycles = Math.floor(extraPulls / 80);
        
        // 循环顺序：常驻(260), 限定(340), 常驻(420)...
        // cycle 1 (260): Standard
        // cycle 2 (340): Limited
        bonusGiftsStandard += Math.ceil(extraCycles / 2);
        bonusGiftsLimited += Math.floor(extraCycles / 2);
      }
    } else if (currentPool.type === 'standard') {
      // 常驻池：首次300抽赠送
      if (total >= 300) {
        bonusGiftsStandard++;
      }
    }

    // 将机制赠送加到显示统计中
    counts[6] += bonusGiftsLimited;
    counts['6_std'] += bonusGiftsStandard;
    
    const displayTotalSixStar = totalSixStar + bonusGiftsLimited + bonusGiftsStandard;

    // 4. 统计历史6星出货分布 (仅统计非赠送)
    const sixStarPulls = [];
    let tempCounter = 0;
    
    // 正序遍历计算垫刀
    // 需要注意：gift 不占位，不重置
    // 我们可以只遍历 validPullsList
    validPullsList.forEach(pull => {
      tempCounter++;
      if (pull.rarity === 6) {
        sixStarPulls.push({ 
          count: tempCounter, 
          isStandard: pull.isStandard,
          isGuaranteed: pull.specialType === 'guaranteed'
        });
        tempCounter = 0;
      }
    });

    // 计算推测数据
    const pullCounts = sixStarPulls.map(s => s.count);
    const maxPityRecorded = pullCounts.length > 0 ? Math.max(...pullCounts) : 0;
    const minPityRecorded = pullCounts.length > 0 ? Math.min(...pullCounts) : 0;
    const avgPityRecorded = pullCounts.length > 0 
      ? (pullCounts.reduce((a, b) => a + b, 0) / pullCounts.length).toFixed(1) 
      : 0;

    // 5. 计算平均出货抽数 (排除赠送)
    const avgPullCost = {
      6: validSixStar > 0 ? (total / validSixStar).toFixed(2) : '0', 
      5: counts[5] > 0 ? (total / counts[5]).toFixed(2) : '0',
    };

    // 6. 饼图数据
    const chartData = [
      ...(currentPool.type !== 'standard' ? [{ name: '6星(限定)', value: counts[6], color: RARITY_CONFIG[6].color }] : []),
      { name: '6星(常驻)', value: counts['6_std'], color: RARITY_CONFIG['6_std'].color },
      { name: '5星', value: counts[5], color: RARITY_CONFIG[5].color },
      { name: '4星', value: counts[4], color: RARITY_CONFIG[4].color },
    ].filter(item => item.value > 0);

    // 7. 出货分布直方图
    const distributionData = [];
    if (sixStarPulls.length > 0) {
      const maxRange = Math.ceil(Math.max(manualPityLimit, maxPityRecorded) / 10) * 10;
      for (let i = 0; i < maxRange; i += 10) {
        const rangeStart = i + 1;
        const rangeEnd = i + 10;
        const items = sixStarPulls.filter(p => p.count >= rangeStart && p.count <= rangeEnd);
        distributionData.push({
          range: `${rangeStart}-${rangeEnd}`,
          count: items.length,
          limited: items.filter(p => !p.isStandard).length,
          standard: items.filter(p => p.isStandard).length,
          guaranteed: items.filter(p => p.isGuaranteed).length
        });
      }
    }

    // 计算概率递增信息
    const probabilityInfo = calculateCurrentProbability(currentPity, currentPool.type);

    // 计算情报书（仅限定池，且仅获得1次）
    const infoBookThreshold = LIMITED_POOL_RULES.infoBookThreshold; // 60抽
    const hasInfoBook = currentPool.type === 'limited' && total >= infoBookThreshold;
    const pullsUntilInfoBook = currentPool.type === 'limited' && !hasInfoBook
      ? infoBookThreshold - total
      : 0;

    return {
      total, // 有效抽数
      counts, // 包含赠送的总数
      totalSixStar,
      validSixStar,
      winRate, // 使用修正后的不歪率
      currentPity,
      currentPity5,
      avgPullCost,
      chartData,
      pityStats: {
        history: sixStarPulls,
        max: maxPityRecorded,
        min: minPityRecorded,
        avg: avgPityRecorded,
        distribution: distributionData
      },
      // 新增：概率递增信息
      probabilityInfo,
      // 新增：情报书（仅获得1次）
      hasInfoBook,
      pullsUntilInfoBook
    };
  }, [currentPoolHistory, manualPityLimit, currentPool.type]);

  // 跨池保底继承计算（仅限定池之间继承）
  const inheritedPityInfo = useMemo(() => {
    // 只有限定池才需要计算继承
    if (currentPool.type !== 'limited') {
      return { inheritedPity: 0, inheritedPity5: 0, hasInheritedPity: false };
    }

    // 获取所有限定池
    const allLimitedPools = pools.filter(p => p.type === 'limited');

    // 如果当前池有记录，不需要考虑继承（继承只在空池时生效）
    if (currentPoolHistory.length > 0) {
      return { inheritedPity: 0, inheritedPity5: 0, hasInheritedPity: false };
    }

    // 计算继承的保底
    const { inheritedPity, inheritedPity5 } = calculateInheritedPity(
      allLimitedPools,
      history,
      currentPoolId
    );

    return {
      inheritedPity,
      inheritedPity5,
      hasInheritedPity: inheritedPity > 0 || inheritedPity5 > 0
    };
  }, [currentPool.type, pools, currentPoolHistory.length, history, currentPoolId]);

  // 计算实际有效的保底数（当前池 + 继承）
  const effectivePity = useMemo(() => {
    // 如果当前池有记录，使用当前池的保底
    if (currentPoolHistory.length > 0) {
      return {
        pity6: stats.currentPity,
        pity5: stats.currentPity5,
        isInherited: false
      };
    }
    // 否则使用继承的保底
    return {
      pity6: inheritedPityInfo.inheritedPity,
      pity5: inheritedPityInfo.inheritedPity5,
      isInherited: inheritedPityInfo.hasInheritedPity
    };
  }, [currentPoolHistory.length, stats.currentPity, stats.currentPity5, inheritedPityInfo]);

  // --- 操作函数 ---

  const openCreatePoolModal = () => {
    // 自动识别抽卡人：使用 extractDrawerFromPoolName 从已有卡池名称中提取
    // 统计每个抽卡人出现的次数，选择最常见的
    const drawerCounts = {};
    pools.forEach(pool => {
      const drawer = extractDrawerFromPoolName(pool.name);
      if (drawer) {
        drawerCounts[drawer] = (drawerCounts[drawer] || 0) + 1;
      }
    });

    // 找到出现最多的抽卡人名称
    let detectedDrawer = '';
    let maxCount = 0;
    Object.entries(drawerCounts).forEach(([name, count]) => {
      if (count > maxCount) {
        maxCount = count;
        detectedDrawer = name;
      }
    });

    setDrawerName(detectedDrawer);
    setSelectedCharName('');
    setNewPoolTypeInput('limited');

    // 根据识别的抽卡人生成默认卡池名称
    const defaultName = detectedDrawer ? `限定-${detectedDrawer}` : '';
    setNewPoolNameInput(defaultName);

    setModalState({ type: 'createPool', data: null });
    setShowPoolMenu(false);
    setPoolSearchQuery(''); // 清空搜索词
  };

  const confirmCreatePool = async () => {
    if (!newPoolNameInput.trim()) return;
    const newId = 'pool_' + Date.now();
    const newPool = {
      id: newId,
      name: newPoolNameInput.trim(),
      type: newPoolTypeInput,
      locked: false,
      user_id: user?.id,  // 保存创建者ID
      // 武器池特有字段：是否为限定武器池（有额外获取内容）
      isLimitedWeapon: newPoolTypeInput === 'weapon' ? isLimitedWeaponPool : undefined
    };

    // P1: 前端数据校验
    const validation = validatePoolData(newPool);
    if (!validation.isValid) {
      showToast(`卡池创建失败: ${validation.errors.join(', ')}`, 'error');
      return;
    }

    setPools(prev => [...prev, newPool]);
    switchPool(newId);
    setModalState({ type: null, data: null });

    // 同步到云端
    if (user) {
      const success = await savePoolToCloud(newPool, true);
      if (success) {
        showToast(`卡池「${newPool.name}」已创建并同步到云端`, 'success');
      } else {
        showToast(`卡池「${newPool.name}」已创建，但同步到云端失败`, 'warning');
      }
    } else {
      showToast(`卡池「${newPool.name}」已创建（本地）`, 'success');
    }
  };

  const openEditPoolModal = (e, pool) => {
    e.stopPropagation();
    setNewPoolNameInput(pool.name);
    setNewPoolTypeInput(pool.type || 'standard');
    // 设置武器池限定状态（默认为 true）
    setIsLimitedWeaponPool(pool.isLimitedWeapon !== false);
    setModalState({ type: 'editPool', data: pool });
    setShowPoolMenu(false);
  };

  const confirmEditPool = async () => {
     if (!newPoolNameInput.trim() || !modalState.data) return;

     const updatedPool = {
       id: modalState.data.id,
       name: newPoolNameInput.trim(),
       type: newPoolTypeInput,
       locked: modalState.data.locked || false,  // 保留锁定状态
       created_at: modalState.data.created_at || null,  // 保留创建时间
       user_id: modalState.data.user_id || null,  // 保留创建者ID
       creator_username: modalState.data.creator_username || null,  // 保留创建人用户名
       // 武器池特有字段：是否为限定武器池
       isLimitedWeapon: newPoolTypeInput === 'weapon' ? isLimitedWeaponPool : undefined
     };

     setPools(prev => prev.map(p => {
       if (p.id === modalState.data.id) {
         return updatedPool;
       }
       return p;
     }));
     setModalState({ type: null, data: null });

     // 同步到云端
     if (user) {
       await savePoolToCloud(updatedPool);
     }
  };

  // 切换卡池锁定状态（仅超管可用）
  const togglePoolLock = async (poolId) => {
    if (!isSuperAdmin) return;

    const pool = pools.find(p => p.id === poolId);
    if (!pool) return;

    const updatedPool = { ...pool, locked: !pool.locked };

    setPools(prev => prev.map(p =>
      p.id === poolId ? updatedPool : p
    ));

    // 同步到云端
    if (user) {
      await savePoolToCloud(updatedPool);
    }

    showToast(
      updatedPool.locked ? `卡池「${pool.name}」已锁定` : `卡池「${pool.name}」已解锁`,
      updatedPool.locked ? 'warning' : 'success'
    );
  };

  // 打开删除卡池确认弹窗
  const openDeletePoolModal = (pool) => {
    setModalState({ type: 'deletePool', data: pool });
    setShowPoolMenu(false);
  };

  // 确认删除卡池（包括所有记录）
  const confirmDeletePool = async () => {
    const poolToDelete = modalState.data;
    if (!poolToDelete) return;

    const poolId = poolToDelete.id;
    const poolName = poolToDelete.name;

    // 删除该卡池的所有历史记录
    setHistory(prev => prev.filter(item => item.poolId !== poolId));

    // 删除卡池本身
    setPools(prev => prev.filter(p => p.id !== poolId));

    // 如果删除的是当前选中的卡池，切换到第一个卡池
    if (currentPoolId === poolId) {
      const remainingPools = pools.filter(p => p.id !== poolId);
      if (remainingPools.length > 0) {
        switchPool(remainingPools[0].id);
      }
    }

    setModalState({ type: null, data: null });

    // 同步到云端
    if (user) {
      const historySuccess = await deletePoolHistoryFromCloud(poolId);
      const poolSuccess = await deletePoolFromCloud(poolId);

      if (historySuccess && poolSuccess) {
        showToast(`卡池「${poolName}」已删除并同步到云端`, 'success');
      } else {
        showToast(`卡池「${poolName}」已删除，但云端同步失败`, 'warning');
      }
    } else {
      showToast(`卡池「${poolName}」已删除`, 'success');
    }
  };

  const openDeleteConfirmModal = () => {
    const currentPoolName = pools.find(p=>p.id===currentPoolId)?.name;
    setModalState({ type: 'deleteConfirm', data: { poolName: currentPoolName } });
  };

  const confirmDeleteData = async () => {
    setHistory(prev => prev.filter(item => item.poolId !== currentPoolId));
    setModalState({ type: null, data: null });

    // 同步到云端
    if (user) {
      await deletePoolHistoryFromCloud(currentPoolId);
    }
  };

  // 删除当前账号的所有卡池数据（设置页面使用）
  const deleteAllUserData = async () => {
    if (!user) return;

    try {
      setSyncing(true);

      // 删除云端所有卡池的历史记录
      for (const pool of pools) {
        await deletePoolHistoryFromCloud(pool.id);
        await deletePoolFromCloud(pool.id);
      }

      // 清空本地数据
      setPools([]);
      setHistory([]);
      // currentPoolId 会由 useEffect 自动处理 fallback

      showToast('所有数据已删除', 'success');
    } catch (error) {
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  // 手动同步数据到云端（设置页面使用）
  // 只同步当前用户创建的数据，不会重复上传其他用户的数据
  const handleManualSync = async () => {
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

      // 只同步当前用户创建的卡池（user_id 等于当前用户，或者是本地创建的没有 user_id）
      const myPools = pools.filter(pool => !pool.user_id || pool.user_id === user.id);
      const otherUserPools = pools.length - myPools.length;
      skippedPools = otherUserPools;

      for (const pool of myPools) {
        const success = await savePoolToCloud(pool);
        if (success) syncedPools++;
      }

      // 只同步当前用户创建的历史记录
      const myHistory = history.filter(h => !h.user_id || h.user_id === user.id);
      const otherUserHistory = history.length - myHistory.length;
      skippedHistory = otherUserHistory;

      // 分批同步历史记录
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
  };

  // 关闭弹窗并清理编辑状态的辅助函数
  const closeModalAndClear = () => {
    closeModal();
    setEditItemState(null);
  };

  // 添加单抽 (支持 isStandard)
  const addSinglePull = async (rarity, isStandard = false) => {
    // 提交前验证：检查卡池是否已被锁定
    if (currentPool?.locked && !isSuperAdmin) {
      showToast('卡池已被锁定，无法录入数据', 'error', '操作被阻止');
      return;
    }

    const currentPoolPulls = currentPoolHistory;
    const currentPoolTotal = currentPoolPulls.length;
    const isLimitedPool = currentPool.type === 'limited';
    const isWeaponPool = currentPool.type === 'weapon';
    let specialType = null;

    // 辅助函数：检查前 N 抽是否已经出过限定
    const hasLimitedInFirstN = (n) => {
      // 注意：这里 currentPoolPulls 是乱序的还是按时间？
      // history 是 append 的，filter 出来的应该大体有序，但最好 sort 一下确保准确
      // 不过这里主要是 check 是否存在，顺序不严格影响“是否存在”，
      // 关键是 index < n。
      // 更严谨的做法：
      const sorted = [...currentPoolPulls].sort((a, b) => a.id - b.id); // 假设id是递增的(timestamp可能重复)
      // 或者直接用 slice(0, n) 如果我们认为 filter 顺序就是录入顺序
      return sorted.slice(0, n).some(item => item.rarity === 6 && !item.isStandard);
    };

    // 限定池 120 抽保底 (如果前119抽没出过限定)
    if (isLimitedPool && (currentPoolTotal + 1) === 120 && rarity === 6) {
       if (!hasLimitedInFirstN(119)) {
         specialType = 'guaranteed';
       }
    }
    
    // 武器池 80 抽首轮保底 (如果前79抽没出过限定)
    if (isWeaponPool && (currentPoolTotal + 1) === 80 && rarity === 6) {
       if (!hasLimitedInFirstN(79)) {
         specialType = 'guaranteed';
       }
    }

    const newPull = {
      id: Date.now() + Math.random(),
      rarity: rarity,
      isStandard: rarity === 6 ? isStandard : false, // 确保非6星不带 isStandard
      specialType: specialType,
      timestamp: new Date().toISOString(),
      poolId: currentPoolId
    };

    // P1: 前端数据校验
    const validation = validatePullData(newPull);
    if (!validation.isValid) {
      showToast(`数据校验失败: ${validation.errors.join(', ')}`, 'error');
      return;
    }

    // 修复ERROR-NEW-001: 先同步到云端，成功后再更新本地状态
    if (user) {
      try {
        await saveHistoryToCloud([newPull]);
        // 云端保存成功，更新本地状态
        setHistory(prev => [...prev, newPull]);
      } catch (error) {
        // 云端保存失败，已在saveHistoryToCloud中显示错误，不更新本地状态
      }
    } else {
      // 未登录用户，仅更新本地状态
      setHistory(prev => [...prev, newPull]);
    }
  };

  // 提交十连
  const submitBatch = async (inputData, customTimestamp = null) => {
    // 提交前验证：检查卡池是否已被锁定
    if (currentPool?.locked && !isSuperAdmin) {
      showToast('卡池已被锁定，无法录入数据', 'error', '操作被阻止');
      return;
    }

    // ========== 新增：卡池规则验证 ==========
    const ruleValidation = validateBatchAgainstRules({
      batchData: inputData,
      existingPulls: currentPoolHistory,
      pool: currentPool
    });

    // 显示警告（但不阻止录入）
    if (ruleValidation.warnings.length > 0) {
      ruleValidation.warnings.forEach(warning => {
        showToast(warning, 'warning', '规则提示');
      });
    }

    // 显示错误并阻止录入
    if (!ruleValidation.isValid) {
      ruleValidation.errors.forEach(error => {
        showToast(error, 'error', '录入错误');
      });
      return;
    }
    // ========================================

    // 使用传入的时间戳或生成新的时间戳（确保同一批次时间戳完全一致）
    const nowStr = customTimestamp
      ? new Date(customTimestamp).toISOString()
      : new Date().toISOString();
    const currentPoolPulls = currentPoolHistory;
    const currentPoolTotal = currentPoolPulls.length; // 已有的数量
    const isLimitedPool = currentPool.type === 'limited';
    const isWeaponPool = currentPool.type === 'weapon';

    // 检查已有记录中，前 N 抽是否包含限定
    const hasLimitedInExisting = (n) => {
       const sorted = [...currentPoolPulls].sort((a, b) => a.id - b.id);
       return sorted.slice(0, n).some(item => item.rarity === 6 && !item.isStandard);
    };

    // 此次十连中是否已经出现了限定 (用于判断同一十连中后续的保底失效)
    let limitedFoundInBatch = false;

    const newPulls = inputData.map((item, index) => {
      let specialType = item.specialType || null;
      const globalIndex = currentPoolTotal + index + 1; // 1-based

      const isLimitedItem = item.rarity === 6 && !item.isStandard;

      // 限定池 120 抽保底
      if (isLimitedPool && globalIndex === 120 && item.rarity === 6) {
         // 检查：已有记录前119没有 && 本次十连前面的也没有
         const alreadyHad = hasLimitedInExisting(119);
         if (!alreadyHad && !limitedFoundInBatch) {
            specialType = 'guaranteed';
         }
      }

      // 武器池 80 抽首轮保底
      if (isWeaponPool && globalIndex === 80 && item.rarity === 6) {
         // 检查：已有记录前79没有 && 本次十连前面的也没有
         const alreadyHad = hasLimitedInExisting(79);
         if (!alreadyHad && !limitedFoundInBatch) {
            specialType = 'guaranteed';
         }
      }

      // 如果当前这个就是限定，标记 flag，后续（index更大）的即使到了阈值也不能算保底了
      if (isLimitedItem) {
        limitedFoundInBatch = true;
      }

      return {
        id: Date.now() + index,
        rarity: item.rarity,
        isStandard: item.rarity === 6 ? item.isStandard : false, // 确保非6星不带 isStandard
        specialType: specialType,
        timestamp: nowStr,
        poolId: currentPoolId
      };
    });

    // P1: 前端数据校验
    for (const pull of newPulls) {
      const validation = validatePullData(pull);
      if (!validation.isValid) {
        showToast(`数据校验失败: ${validation.errors.join(', ')}`, 'error');
        return;
      }
    }

    // 修复ERROR-NEW-001: 先同步到云端，成功后再更新本地状态
    if (user) {
      try {
        await saveHistoryToCloud(newPulls);
        // 云端保存成功，更新本地状态
        setHistory(prev => [...prev, ...newPulls]);
      } catch (error) {
        // 云端保存失败，已在saveHistoryToCloud中显示错误，不更新本地状态
      }
    } else {
      // 未登录用户，仅更新本地状态
      setHistory(prev => [...prev, ...newPulls]);
    }
  };

  // 编辑记录
  const handleUpdateItem = async (id, newConfig) => {
    // 提交前验证：检查卡池是否已被锁定
    if (currentPool?.locked && !isSuperAdmin) {
      showToast('卡池已被锁定，无法修改数据', 'error', '操作被阻止');
      return;
    }

    // 查找要更新的记录
    const itemToUpdate = history.find(item => item.id === id);
    if (!itemToUpdate) return;

    const updatedItem = { ...itemToUpdate, ...newConfig };

    // 修复ERROR-NEW-001: 先同步到云端，成功后再更新本地状态
    if (user) {
      try {
        await saveHistoryToCloud([updatedItem]);
        // 云端保存成功，更新本地状态
        setHistory(prev => prev.map(item => item.id === id ? updatedItem : item));
        setEditItemState(null);
      } catch (error) {
        // 云端保存失败，已在saveHistoryToCloud中显示错误，不更新本地状态
      }
    } else {
      // 未登录用户，仅更新本地状态
      setHistory(prev => prev.map(item => item.id === id ? updatedItem : item));
      setEditItemState(null);
    }
  };

  // 删除单条记录 (触发弹窗)
  const handleDeleteItem = (id) => {
    setModalState({ type: 'deleteItem', data: id });
  };

  const confirmRealDeleteItem = async () => {
    // 提交前验证：检查卡池是否已被锁定
    if (currentPool?.locked && !isSuperAdmin) {
      showToast('卡池已被锁定，无法删除数据', 'error', '操作被阻止');
      setModalState({ type: null, data: null });
      return;
    }

    const idToDelete = modalState.data;
    setHistory(prev => prev.filter(item => item.id !== idToDelete));
    setEditItemState(null);
    setModalState({ type: null, data: null });

    // 同步到云端
    if (user) {
      const success = await deleteHistoryFromCloud([idToDelete]);
      if (success) {
        showToast('记录已删除并同步到云端', 'success');
      } else {
        showToast('记录已删除，但云端同步失败', 'warning');
      }
    }
  };

  // 删除整组记录 (触发弹窗)
  const handleDeleteGroup = (items) => {
    setModalState({ type: 'deleteGroup', data: items });
  };

  const confirmRealDeleteGroup = async () => {
    // 提交前验证：检查卡池是否已被锁定
    if (currentPool?.locked && !isSuperAdmin) {
      showToast('卡池已被锁定，无法删除数据', 'error', '操作被阻止');
      setModalState({ type: null, data: null });
      return;
    }

    const itemsToDelete = modalState.data;
    const idsToDelete = new Set(itemsToDelete.map(i => i.id));
    setHistory(prev => prev.filter(item => !idsToDelete.has(item.id)));
    setModalState({ type: null, data: null });

    // 同步到云端
    if (user) {
      const success = await deleteHistoryFromCloud(Array.from(idsToDelete));
      if (success) {
        showToast(`已删除 ${itemsToDelete.length} 条记录并同步到云端`, 'success');
      } else {
        showToast(`已删除 ${itemsToDelete.length} 条记录，但云端同步失败`, 'warning');
      }
    }
  };


  // 通用导出函数
  const handleExportJSON = (scope) => {
    let exportPools = pools;
    let exportHistory = history;

    if (scope === 'current') {
      exportPools = pools.filter(p => p.id === currentPoolId);
      exportHistory = currentPoolHistory;
    }

    // 计算统计摘要
    const calculateStats = (historyData, poolsData) => {
      const stats = {
        totalPulls: 0,
        sixStarTotal: 0,
        sixStarLimited: 0,
        sixStarStandard: 0,
        fiveStar: 0,
        fourStar: 0,
        byPool: {}
      };

      // 按卡池分组计算
      poolsData.forEach(pool => {
        const poolHistory = historyData.filter(h => h.poolId === pool.id && h.specialType !== 'gift');
        stats.byPool[pool.name] = {
          type: pool.type,
          total: poolHistory.length,
          sixStar: poolHistory.filter(h => h.rarity === 6).length,
          sixStarLimited: poolHistory.filter(h => h.rarity === 6 && !h.isStandard).length,
          sixStarStandard: poolHistory.filter(h => h.rarity === 6 && h.isStandard).length
        };
      });

      // 全局统计（排除gift）
      const validHistory = historyData.filter(h => h.specialType !== 'gift');
      stats.totalPulls = validHistory.length;
      stats.sixStarTotal = validHistory.filter(h => h.rarity === 6).length;
      stats.sixStarLimited = validHistory.filter(h => h.rarity === 6 && !h.isStandard).length;
      stats.sixStarStandard = validHistory.filter(h => h.rarity === 6 && h.isStandard).length;
      stats.fiveStar = validHistory.filter(h => h.rarity === 5).length;
      stats.fourStar = validHistory.filter(h => h.rarity <= 4).length;

      return stats;
    };

    const exportObj = {
      version: "2.1",
      scope: scope,
      exportTime: new Date().toISOString(),
      summary: calculateStats(exportHistory, exportPools),
      pools: exportPools,
      history: exportHistory
    };

    const dataStr = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const timeStr = `${now.getFullYear().toString().slice(-2)}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    link.download = `endfield-gacha-${timeStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const handleExportCSV = (scope) => {
    let dataToExport = [];

    // 辅助函数：为历史记录添加序号和垫刀数
    const processHistoryWithIndex = (historyData, poolId) => {
      const filtered = historyData.filter(h => h.poolId === poolId);
      const sorted = [...filtered].sort((a, b) => a.id - b.id);

      let pityCounter = 0;
      return sorted.map((item, index) => {
        // 计算垫刀（排除gift）
        if (item.specialType !== 'gift') {
          pityCounter++;
        }

        const result = {
          ...item,
          globalIndex: index + 1,
          pityAtPull: item.specialType === 'gift' ? '-' : pityCounter
        };

        // 如果是6星，重置垫刀
        if (item.rarity === 6 && item.specialType !== 'gift') {
          pityCounter = 0;
        }

        return result;
      });
    };

    if (scope === 'current') {
      if (currentPoolHistory.length === 0) {
        showToast("当前卡池无数据", 'warning');
        return;
      }
      // 当前卡池已有globalIndex，需要添加垫刀数
      const sortedHistory = [...currentPoolHistory].sort((a, b) => a.id - b.id);
      let pityCounter = 0;
      dataToExport = sortedHistory.map((item, index) => {
        if (item.specialType !== 'gift') {
          pityCounter++;
        }
        const result = {
          ...item,
          globalIndex: index + 1,
          pityAtPull: item.specialType === 'gift' ? '-' : pityCounter
        };
        if (item.rarity === 6 && item.specialType !== 'gift') {
          pityCounter = 0;
        }
        return result;
      });
    } else {
      if (history.length === 0) {
        showToast("无数据可导出", 'warning');
        return;
      }
      // 全部导出：为每个卡池单独计算序号和垫刀
      pools.forEach(pool => {
        const poolData = processHistoryWithIndex(history, pool.id);
        dataToExport.push(...poolData);
      });
      // 按时间排序
      dataToExport.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    // CSV表头（中英文）
    const headers = ["卡池名称(Pool)", "卡池类型(Type)", "序号(No)", "星级(Rarity)", "限定/常驻(Limited/Std)", "特殊标记(Special)", "垫刀数(Pity)", "时间(Time)"];

    const rows = dataToExport.map(item => {
      const pool = pools.find(p => p.id === item.poolId);
      const poolName = pool?.name || 'Unknown';
      const poolType = pool?.type === 'limited' ? '限定池' : pool?.type === 'weapon' ? '武器池' : '常驻池';

      let limitedStr = '-';
      if (item.rarity === 6) {
        limitedStr = item.isStandard ? '常驻(Std)' : '限定(Ltd)';
      }

      let specialStr = '-';
      if (item.specialType === 'guaranteed') specialStr = '保底(Pity)';
      else if (item.specialType === 'gift') specialStr = '赠送(Gift)';

      // 处理可能包含逗号的字段，用引号包裹
      const escapeCsv = (str) => {
        if (typeof str === 'string' && (str.includes(',') || str.includes('"') || str.includes('\n'))) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      return [
        escapeCsv(poolName),
        poolType,
        item.globalIndex,
        `${item.rarity}星`,
        limitedStr,
        specialStr,
        item.pityAtPull,
        new Date(item.timestamp).toLocaleString()
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const timeStr = `${now.getFullYear().toString().slice(-2)}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    link.download = `endfield-gacha-${timeStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  // 导入数据处理 - 使用状态存储待导入数据
  const [pendingImport, setPendingImport] = useState(null);

  // 数据导入验证函数
  const validateImportData = (data) => {
    const errors = [];
    
    // 1. 基础结构验证
    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['无效的数据格式'] };
    }
    
    if (!Array.isArray(data.pools)) {
      errors.push('缺少 pools 字段或格式错误');
    }
    
    if (!Array.isArray(data.history)) {
      errors.push('缺少 history 字段或格式错误');
    }
    
    if (errors.length > 0) {
      return { valid: false, errors };
    }
    
    // 2. 卡池数据验证
    const validPoolIds = new Set();
    data.pools.forEach((pool, idx) => {
      if (!pool.id || typeof pool.id !== 'string') {
        errors.push(`卡池 #${idx + 1}: 缺少有效的 id`);
      } else {
        validPoolIds.add(pool.id);
      }
      
      if (!pool.name || typeof pool.name !== 'string') {
        errors.push(`卡池 #${idx + 1}: 缺少名称 (name)`);
      }
      
      if (!pool.type || !['limited', 'standard', 'weapon'].includes(pool.type)) {
        errors.push(`卡池 #${idx + 1}: 无效的类型 (type)，应为 limited/standard/weapon`);
      }
    });
    
    // 3. 历史记录验证
    const historyIds = new Set();
    data.history.forEach((record, idx) => {
      if (!record.id || typeof record.id !== 'string') {
        errors.push(`记录 #${idx + 1}: 缺少有效的 id`);
      } else {
        if (historyIds.has(record.id)) {
          errors.push(`记录 #${idx + 1}: id 重复 (${record.id})`);
        }
        historyIds.add(record.id);
      }
      
      if (!record.pool_id || typeof record.pool_id !== 'string') {
        errors.push(`记录 #${idx + 1}: 缺少 pool_id`);
      } else if (!validPoolIds.has(record.pool_id) && !pools.some(p => p.id === record.pool_id)) {
        // 检查 pool_id 是否存在于导入数据或现有数据中
        errors.push(`记录 #${idx + 1}: pool_id (${record.pool_id}) 引用的卡池不存在`);
      }
      
      if (!record.rarity || typeof record.rarity !== 'number' || record.rarity < 3 || record.rarity > 6) {
        errors.push(`记录 #${idx + 1}: rarity 应为 3-6 的数字`);
      }
      
      if (!record.item_name || typeof record.item_name !== 'string') {
        errors.push(`记录 #${idx + 1}: 缺少 item_name`);
      }
    });
    
    // 限制错误数量显示
    const maxErrors = 10;
    if (errors.length > maxErrors) {
      const totalErrors = errors.length;
      errors.length = maxErrors;
      errors.push(`... 还有 ${totalErrors - maxErrors} 个错误`);
    }
    
    return { 
      valid: errors.length === 0, 
      errors,
      stats: {
        poolCount: data.pools.length,
        historyCount: data.history.length
      }
    };
  };

  const handleImportFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 文件大小限制 (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast("文件过大，最大支持 10MB", 'error');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);

        // 详细数据验证
        const validation = validateImportData(importedData);
        if (!validation.valid) {
          showToast(`数据验证失败：\n${validation.errors.slice(0, 3).join('\n')}`, 'error');
          return;
        }

        const willSyncToCloud = !!(user && supabase);

        // 存储待导入数据，显示确认弹窗
        setPendingImport({ 
          data: importedData, 
          willSyncToCloud,
          stats: validation.stats
        });

      } catch (error) {
        showToast("导入失败：文件解析错误。请确保是合法的JSON文件。", 'error');
      }
      // 清空 input 允许重复导入同一文件
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  // 确认导入
  const confirmImport = async () => {
    if (!pendingImport) return;

    const { data: importedData, willSyncToCloud } = pendingImport;

    // 1. 合并 Pools (去重)
    const newPools = [...pools];
    const addedPools = [];
    importedData.pools.forEach(impPool => {
      if (!newPools.some(p => p.id === impPool.id)) {
        newPools.push(impPool);
        addedPools.push(impPool);
      }
    });

    // 2. 合并 History (去重)
    const newHistory = [...history];
    const existingIds = new Set(newHistory.map(h => h.id));
    const addedHistory = [];

    importedData.history.forEach(impItem => {
      if (!existingIds.has(impItem.id)) {
        newHistory.push(impItem);
        addedHistory.push(impItem);
      }
    });

    setPools(newPools);
    setHistory(newHistory);
    setPendingImport(null);

    // 3. 同步到云端（如果已登录）
    if (willSyncToCloud && (addedPools.length > 0 || addedHistory.length > 0)) {
      setSyncing(true);
      try {
        // 同步新增的卡池
        for (const pool of addedPools) {
          await savePoolToCloud(pool);
        }
        // 分批同步新增的历史记录
        const batchSize = 100;
        for (let i = 0; i < addedHistory.length; i += batchSize) {
          const batch = addedHistory.slice(i, i + batchSize);
          await saveHistoryToCloud(batch);
        }
        showToast(`导入完成！新增了 ${addedHistory.length} 条记录，已同步到云端。`, 'success', '导入成功');
      } catch (syncError) {
        showToast(`新增了 ${addedHistory.length} 条记录，但云端同步失败: ${syncError.message}`, 'warning', '部分成功');
      } finally {
        setSyncing(false);
      }
    } else {
      showToast(`导入完成！新增了 ${addedHistory.length} 条记录。`, 'success', '导入成功');
    }
  };

  // --- 组件 ---
  

  // 卡池时间信息组件

  // ... (inside GachaAnalyzer render)

  const StatBox = ({ title, value, subValue, colorClass, icon: Icon, isAnimated }) => (
    <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 flex items-center gap-4 relative overflow-hidden">
      <div className={`
        p-3 rounded-none ${colorClass} relative shadow-sm
        ${isAnimated ? 'glow-border' : ''}
      `}>
        {isAnimated && <div className="absolute inset-0 shine-effect rounded-none"></div>}
        {Icon && <Icon size={24} className="text-white relative z-10" />}
      </div>
      <div>
        <p className="text-xs text-slate-500 dark:text-zinc-500 uppercase font-bold">{title}</p>
        <p className="text-2xl font-bold text-slate-800 dark:text-zinc-100">{value}</p>
        {subValue && <p className="text-xs text-slate-400 dark:text-zinc-500">{subValue}</p>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 font-sans pb-20 md:pb-10 relative">
      {/* 全局加载进度条 */}
      <LoadingBar isLoading={syncing || globalStatsLoading} />

      {/* 顶部导航 */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* 左侧：Logo + 卡池切换器 */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <img
                src="/endfield-logo.svg"
                alt="终末地"
                className="h-10 w-auto dark:invert"
              />
              <div className="hidden sm:block h-8 w-px bg-slate-200"></div>
              <div className="hidden sm:flex items-center gap-1.5 text-slate-600 dark:text-zinc-400">
                <BarChart3 size={18} className="text-indigo-500" />
                <h1 className="font-bold">抽卡分析器</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* 卡池选择器组件 */}
              <PoolSelector
                onOpenCreatePoolModal={openCreatePoolModal}
                onOpenEditPoolModal={openEditPoolModal}
                onOpenDeletePoolModal={openDeletePoolModal}
                onTogglePoolLock={togglePoolLock}
              />

              {/* UP池时间信息 - 仅限定池显示 */}
              {currentPool.type === 'limited' && (
                <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500 bg-slate-50 dark:bg-zinc-800 px-3 py-1.5 rounded-none border border-zinc-200 dark:border-zinc-700 shrink-0">
                  {(() => {
                    const upPool = getCurrentUpPool();
                    const isExpired = upPool.isExpired;
                    const remainingDays = upPool.remainingDays ?? 0;
                    const remainingHours = upPool.remainingHours ?? 0;
                    const isEndingSoon = remainingDays <= 3 && !isExpired;
                    const isNotStarted = upPool.startsIn > 0;

                    return (
                      <>
                        <span className="text-orange-500 font-medium">{upPool.name}</span>
                        <span className="text-slate-300 dark:text-zinc-600">|</span>
                        {isNotStarted ? (
                          <span className="text-blue-500">{upPool.startsIn}天{upPool.startsInHours}小时后开始</span>
                        ) : isExpired ? (
                          <span className="text-red-500">已结束</span>
                        ) : isEndingSoon ? (
                          <span className="text-amber-500 animate-pulse">剩余 {remainingDays}天{remainingHours}小时</span>
                        ) : (
                          <span className="text-green-500">剩余 {remainingDays}天{remainingHours}小时</span>
                        )}
                        <span className="text-slate-300 dark:text-zinc-600">→</span>
                        <span className="text-blue-500">{upPool.nextPool}</span>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 sm:gap-4">
            <NotificationBadge showDot={hasNewAnnouncement}>
              <button
                onClick={() => {
                  setActiveTab('home');
                  // 点击首页后，如果有新公告，标记为已查看
                  if (hasNewAnnouncement) {
                    markAsViewed(STORAGE_KEYS.ANNOUNCEMENT_LAST_VIEWED);
                    setHasNewAnnouncement(false);
                  }
                }}
                className={`text-sm font-medium px-3 py-1.5 rounded-none transition-colors ${activeTab === 'home' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-zinc-500 hover:text-slate-800 dark:text-zinc-100'}`}
              >
                首页
              </button>
            </NotificationBadge>
            <button
              onClick={() => setActiveTab('summary')}
              className={`text-sm font-medium px-3 py-1.5 rounded-none transition-colors ${activeTab === 'summary' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' : 'text-slate-500 dark:text-zinc-500 hover:text-slate-800 dark:text-zinc-100'}`}
            >
              统计
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`text-sm font-medium px-3 py-1.5 rounded-none transition-colors ${activeTab === 'dashboard' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' : 'text-slate-500 dark:text-zinc-500 hover:text-slate-800 dark:text-zinc-100'}`}
            >
              卡池详情
            </button>

            {/* 超管管理页面 */}
            {isSuperAdmin && (
              <NotificationBadge count={pendingApplicationsCount}>
                <button
                  onClick={() => {
                    setActiveTab('admin');
                    // 点击管理面板后标记为已查看（申请数量会在处理后自动减少）
                    markAsViewed(STORAGE_KEYS.ADMIN_LAST_VIEWED);
                  }}
                  className={`text-sm font-medium px-3 py-1.5 rounded-none transition-colors ${activeTab === 'admin' ? 'bg-red-50 text-red-700' : 'text-slate-500 dark:text-zinc-500 hover:text-slate-800 dark:text-zinc-100'}`}
                >
                  管理
                </button>
              </NotificationBadge>
            )}

            {/* 工单、设置和关于按钮 */}
            {user && (
              <NotificationBadge count={unreadTicketsCount}>
                <button
                  onClick={() => {
                    setActiveTab('tickets');
                    // 点击工单面板后标记为已查看
                    markAsViewed(STORAGE_KEYS.TICKETS_LAST_VIEWED);
                    setUnreadTicketsCount(0);
                  }}
                  className={`text-sm font-medium px-2 py-1.5 rounded-none transition-colors ${activeTab === 'tickets' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:text-zinc-400'}`}
                  title="工单"
                >
                  <MessageSquare size={18} />
                </button>
              </NotificationBadge>
            )}
            <button
              onClick={() => setActiveTab('settings')}
              className={`text-sm font-medium px-2 py-1.5 rounded-none transition-colors ${activeTab === 'settings' ? 'bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100' : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:text-zinc-400'}`}
              title="设置"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`text-sm font-medium px-2 py-1.5 rounded-none transition-colors ${activeTab === 'about' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:text-zinc-400'}`}
              title="关于"
            >
              <Info size={18} />
            </button>

            {/* 登录/用户区域 */}
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-zinc-200 dark:border-zinc-800">
              {isSupabaseConfigured() ? (
                user ? (
                  <div className="flex items-center gap-2">
                    {/* 角色标签 */}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold hidden sm:inline ${
                      userRole === 'super_admin' ? 'bg-red-100 text-red-600' :
                      userRole === 'admin' ? 'bg-green-100 text-green-600' :
                      'bg-slate-100 text-slate-500 dark:text-zinc-500'
                    }`}>
                      {userRole === 'super_admin' ? '超管' :
                       userRole === 'admin' ? '管理' : '用户'}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-zinc-500 hidden sm:inline">
                      {user.user_metadata?.username || user.email?.split("@")[0]}
                    </span>
                    {/* 申请按钮 - 仅普通用户且未申请时显示 */}
                    {userRole === 'user' && applicationStatus !== 'pending' && (
                      <button
                        onClick={() => setShowApplyModal(true)}
                        className="flex items-center gap-1 text-xs bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded transition-colors"
                        title="申请成为管理员"
                      >
                        <UserPlus size={14} />
                        <span className="hidden sm:inline">申请</span>
                      </button>
                    )}
                    {/* 申请待审核状态 */}
                    {applicationStatus === 'pending' && (
                      <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                        审核中
                      </span>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-1 text-sm text-slate-500 dark:text-zinc-500 hover:text-red-600 px-2 py-1 rounded transition-colors"
                      title="退出登录"
                    >
                      <LogOut size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={openAuthModal}
                    className="flex items-center gap-1 text-sm bg-endfield-yellow text-black hover:bg-yellow-400 font-bold uppercase tracking-wider px-3 py-1.5 rounded-none transition-colors"
                  >
                    <LogIn size={16} />
                    <span className="hidden sm:inline">登录</span>
                  </button>
                )
              ) : (
                <span className="text-xs text-slate-400 dark:text-zinc-500 flex items-center gap-1" title="未配置 Supabase">
                  <CloudOff size={14} /> 本地模式
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* 无数据提示（方案A：引导游客和新用户） */}
        {pools.length === 0 && (
          <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-none p-6 text-center">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <AlertCircle size={32} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2 text-lg">暂无卡池数据</h3>
            <p className="text-sm text-blue-700 dark:text-blue-400/80 mb-4">
              {user ? (
                canEdit
                  ? '作为管理员，您可以创建新卡池并开始录入数据。点击顶部导航栏的卡池切换器即可创建。'
                  : '当前系统暂无数据。如需录入数据，请申请成为管理员后创建卡池。'
              ) : (
                '当前系统暂无数据。登录后可申请成为管理员并开始录入抽卡记录。'
              )}
            </p>
            {!user ? (
              <button
                onClick={() => setShowAuthModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-none text-sm transition-colors"
              >
                登录/注册
              </button>
            ) : !canEdit && (
              <button
                onClick={() => setShowApplyModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-none text-sm transition-colors"
              >
                申请成为管理员
              </button>
            )}
          </div>
        )}

        {activeTab === 'home' ? (
          <HomePage user={user} canEdit={canEdit} announcements={announcements} />
        ) : activeTab === 'summary' ? (
          <SummaryView history={history} pools={pools} globalStats={globalStats} globalStatsLoading={globalStatsLoading} user={user} />
        ) : activeTab === 'admin' && isSuperAdmin ? (
          <AdminPanel showToast={showToast} />
        ) : activeTab === 'settings' ? (
          <SettingsPanel
            user={user}
            userRole={userRole}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
            pools={pools}
            history={history}
            onDeleteAllData={deleteAllUserData}
            onManualSync={handleManualSync}
            syncing={syncing}
          />
        ) : activeTab === 'about' ? (
          <AboutPanel />
        ) : activeTab === 'tickets' ? (
          <TicketPanel user={user} userRole={userRole} showToast={showToast} />
        ) : (
          <>
            {/* 数据录入区域 - 仅管理员可见且卡池未锁定 */}
            {canEditCurrentPool && (
              <InputSection
                currentPool={currentPool}
                poolStatsTotal={stats.total}
                onAddSingle={addSinglePull}
                onSubmitBatch={submitBatch}
                onDeletePool={openDeleteConfirmModal}
              />
            )}

            {/* 非管理员提示 */}
            {!canEdit && (
              <div className="mb-8 bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-none p-6 text-center">
                <Shield size={40} className="mx-auto text-slate-300 mb-3" />
                <h3 className="font-bold text-slate-600 dark:text-zinc-400 mb-2">数据录入仅限管理员</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-500 mb-4">
                  {user ? (
                    applicationStatus === 'pending'
                      ? '您的管理员申请正在审核中，请耐心等待。'
                      : '如需录入数据，请点击右上角申请成为管理员。'
                  ) : (
                    '请先登录，然后申请成为管理员。'
                  )}
                </p>
                {!user && (
                  <button
                    onClick={openAuthModal}
                    className="bg-endfield-yellow text-black hover:bg-yellow-400 font-bold uppercase tracking-wider px-4 py-2 rounded-none text-sm transition-colors"
                  >
                    登录
                  </button>
                )}
              </div>
            )}

            {/* 卡池锁定提示 - 管理员但卡池被锁定 */}
            {canEdit && !canEditCurrentPool && (
              <div className="mb-8 bg-amber-50 border border-amber-200 rounded-none p-6 text-center">
                <Lock size={40} className="mx-auto text-amber-400 mb-3" />
                <h3 className="font-bold text-amber-700 mb-2">此卡池已被锁定</h3>
                <p className="text-sm text-amber-600">
                  卡池「{currentPool?.name}」已被超级管理员锁定，暂时无法编辑。
                  <br/>如需修改，请联系超级管理员解锁。
                </p>
              </div>
            )}

            {activeTab === 'dashboard' && (
              <div className="animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 左列：保底机制分析 */}
            <div className="md:col-span-1 space-y-6">
              <DashboardView currentPool={currentPool} stats={stats} effectivePity={effectivePity} />
              
              {/* 平均出货消耗 */}
              <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
                <h3 className="text-slate-700 dark:text-zinc-300 font-bold mb-4">平均出货消耗</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-none border border-indigo-100 dark:border-yellow-800/50">
                    <span className="text-yellow-700 dark:text-yellow-300 font-medium">综合6星</span>
                    <div className="text-right">
                       <span className="text-xl font-bold text-indigo-800 dark:text-yellow-300">{stats.avgPullCost[6]}</span>
                       <span className="text-xs text-yellow-600 dark:text-endfield-yellow ml-1">抽/只</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-none border border-amber-100 dark:border-amber-800/50">
                    <span className="text-amber-700 dark:text-amber-300 font-medium">5星</span>
                    <div className="text-right">
                       <span className="text-xl font-bold text-amber-800 dark:text-amber-300">{stats.avgPullCost[5]}</span>
                       <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">抽/只</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 中右列：图表与详细数据 */}
            <div className="md:col-span-2 space-y-6">
              
              {/* 总抽数概览 */}
              <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 flex items-center justify-between">
                <div>
                  <h3 className="text-slate-500 dark:text-zinc-500 font-bold text-sm uppercase tracking-wider">当前卡池总投入</h3>
                  <div className="text-4xl font-black text-slate-800 dark:text-zinc-100 mt-1 flex items-baseline gap-2">
                    {stats.total}
                    <span className="text-lg font-medium text-slate-400 dark:text-zinc-500">抽</span>
                  </div>
                </div>
                <div className="h-12 w-12 bg-yellow-50 dark:bg-yellow-900/20 rounded-sm flex items-center justify-center text-indigo-500">
                  <Layers size={24} />
                </div>
              </div>

              {/* 核心数据概览 */}
              <div className={`grid grid-cols-2 ${currentPool.type !== 'standard' ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
                 {currentPool.type !== 'standard' && (
                   <StatBox 
                     title="限定6星" 
                     value={stats.counts[6]} 
                     subValue={(() => {
                        let bonusCount = 0;
                        if (currentPool.type === 'limited') {
                           bonusCount = Math.floor(stats.total/240);
                        } else if (currentPool.type === 'weapon') {
                           if (stats.total >= 180) {
                             bonusCount++;
                             const extraPulls = stats.total - 180;
                             const extraCycles = Math.floor(extraPulls / 80);
                             bonusCount += Math.floor(extraCycles / 2);
                           }
                        }
                        return bonusCount > 0 ? `含赠送 ${bonusCount}` : `占6星 ${(stats.winRate)}%`;
                     })()}
                     colorClass="rainbow-bg"
                     icon={Star}
                     isAnimated={true}
                   />
                 )}
                 <StatBox 
                   title="常驻6星" 
                   value={stats.counts['6_std']} 
                   subValue={
                     currentPool.type !== 'standard' 
                       ? "歪了" 
                       : (currentPool.type === 'standard' && stats.total >= 300 ? "含赠送 1" : "总数")
                   } 
                   colorClass="bg-red-500" 
                   icon={Star} 
                 />
                 <StatBox title="5星总数" value={stats.counts[5]} subValue={`占比 ${(stats.total > 0 ? stats.counts[5]/stats.total*100 : 0).toFixed(2)}%`} colorClass="bg-amber-400" icon={Star} />
                 <StatBox title="4星总数" value={stats.counts[4]} subValue={`占比 ${(stats.total > 0 ? stats.counts[4]/stats.total*100 : 0).toFixed(2)}%`} colorClass="bg-purple-500" icon={Star} />
              </div>

              {/* 饼图 */}
              <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 min-h-[400px] flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-slate-700 dark:text-zinc-300 font-bold">概率分布概览</h3>
                  <span className="text-xs text-slate-400 dark:text-zinc-500 bg-slate-50 dark:bg-zinc-950 px-2 py-1 rounded">仅显示当前卡池</span>
                </div>
                <div className="flex-1 w-full h-full relative">
                  {stats.total === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                      暂无数据，请在上方录入
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie
                          data={stats.chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={120}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {stats.chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value, name) => [
                            `${value}个 (${(value/stats.total*100).toFixed(1)}%)`,
                            name
                          ]}
                          contentStyle={{
                            backgroundColor: isDark ? '#18181b' : '#ffffff',
                            borderRadius: '0px',
                            border: isDark ? '1px solid #3f3f46' : '1px solid #e4e4e7',
                            boxShadow: isDark ? '0 4px 6px -1px rgb(0 0 0 / 0.3)' : '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}
                          itemStyle={{ color: isDark ? '#e4e4e7' : '#27272a' }}
                          labelStyle={{ color: isDark ? '#a1a1aa' : '#71717a' }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          wrapperStyle={{
                            color: isDark ? '#a1a1aa' : '#71717a',
                            fontSize: '12px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 详细日志 - 默认折叠 */}
          <div className="mt-6">
            <details className="group">
              <summary className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                <span className="font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                  <History size={18} /> 详细日志
                </span>
                <ChevronDown size={20} className="text-slate-400 dark:text-zinc-500 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="mt-2">
                <RecordsView
                  filteredGroupedHistory={filteredGroupedHistory}
                  currentPool={currentPool}
                  canEditCurrentPool={canEditCurrentPool}
                  onEdit={setEditItemState}
                  onDeleteGroup={handleDeleteGroup}
                  onImportFile={handleImportFile}
                  onExportJSON={handleExportJSON}
                  onExportCSV={handleExportCSV}
                />
              </div>
            </details>
          </div>

          {/* 编辑弹窗 */}
          {editItemState && (
            <EditItemModal
              item={editItemState}
              poolType={currentPool.type}
              onClose={() => setEditItemState(null)}
              onUpdate={handleUpdateItem}
              onDelete={handleDeleteItem}
            />
          )}
        </div>
        )}
        </>
      )}
      </main>

      {/* 全局页脚 */}
      <Footer />

      {/* --- 全局弹窗 --- */}
      {(modalState.type === 'createPool' || modalState.type === 'editPool') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex justify-between items-center">
              <h3 className="font-bold text-slate-700 dark:text-zinc-300">{modalState.type === 'createPool' ? '创建新卡池' : '编辑卡池'}</h3>
              <button onClick={closeModalAndClear} className="text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:text-zinc-400 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {modalState.type === 'createPool' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase mb-2">快速选择卡池</label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {PRESET_POOLS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          const typeStr = preset.type === 'limited' ? '限定' : (preset.type === 'weapon' ? '武器' : '常驻');
                          const name = `${typeStr}${preset.charName ? '-' + preset.charName : ''}${drawerName ? '-' + drawerName : ''}`;
                          setNewPoolTypeInput(preset.type);
                          setSelectedCharName(preset.charName);
                          setNewPoolNameInput(name);
                        }}
                        className="text-left text-xs p-2 rounded-none border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 hover:border-yellow-300 dark:hover:border-yellow-700 text-slate-600 dark:text-zinc-300 hover:text-yellow-700 dark:hover:text-yellow-300 transition-colors truncate"
                        title={preset.label}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 卡池添加人 - 仅编辑模式显示，只读 */}
              {modalState.type === 'editPool' && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-2">
                    卡池添加人
                  </label>
                  <div className="flex items-center gap-2 px-4 py-2 border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-none">
                    <User size={16} />
                    <span>
                      {/* 优先显示 creator_username，否则显示当前登录用户（本地数据） */}
                      {modalState.data?.creator_username || user?.user_metadata?.username || user?.email?.split('@')[0] || '未知用户'}
                    </span>
                    {modalState.data?.created_at && (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 ml-auto">
                        创建于 {new Date(modalState.data.created_at).toLocaleDateString('zh-CN')}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-2">抽卡人</label>
                {/* 已知抽卡人快捷选择 */}
                {knownDrawers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {knownDrawers.map(drawer => (
                      <button
                        key={drawer}
                        onClick={() => {
                          setDrawerName(drawer);
                          if (modalState.type === 'createPool') {
                            const typeStr = newPoolTypeInput === 'limited' ? '限定' : (newPoolTypeInput === 'weapon' ? '武器' : '常驻');
                            const name = `${typeStr}${selectedCharName ? '-' + selectedCharName : ''}${drawer ? '-' + drawer : ''}`;
                            setNewPoolNameInput(name);
                          }
                        }}
                        className={`text-xs px-2 py-1 rounded-none border transition-colors ${
                          drawerName === drawer
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 font-bold'
                            : 'bg-slate-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 hover:border-yellow-300 dark:hover:border-yellow-700'
                        }`}
                      >
                        <User size={10} className="inline mr-1" />
                        {drawer}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  value={drawerName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDrawerName(val);
                    if (modalState.type === 'createPool') {
                       const typeStr = newPoolTypeInput === 'limited' ? '限定' : (newPoolTypeInput === 'weapon' ? '武器' : '常驻');
                       const name = `${typeStr}${selectedCharName ? '-' + selectedCharName : ''}${val ? '-' + val : ''}`;
                       setNewPoolNameInput(name);
                    }
                  }}
                  placeholder={knownDrawers.length > 0 ? "选择上方已有或输入新抽卡人" : "例如：Me, 朋友A"}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-2">卡池名称</label>
                <input
                  type="text"
                  value={newPoolNameInput}
                  onChange={(e) => setNewPoolNameInput(e.target.value)}
                  placeholder="例如：限定-莱万汀-Me"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && (modalState.type === 'createPool' ? confirmCreatePool() : confirmEditPool())}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-2">卡池类型</label>
                <div className="flex gap-3">
                  {['limited', 'standard', 'weapon'].map(type => (
                    <label key={type} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-none border cursor-pointer transition-all ${newPoolTypeInput === type ? (type === 'weapon' ? 'bg-slate-800 border-slate-600 text-white' : type === 'limited' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-yellow-50 dark:bg-yellow-900/20 border-indigo-500 text-yellow-700 dark:text-yellow-300') + ' font-bold ring-1' : 'border-zinc-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-500 hover:bg-slate-50 dark:bg-zinc-950'}`}>
                      <input 
                        type="radio" 
                        name="poolType" 
                        value={type}
                        checked={newPoolTypeInput === type}
                        onChange={() => {
                          setNewPoolTypeInput(type);
                          if (modalState.type === 'createPool') {
                             const typeStr = type === 'limited' ? '限定' : (type === 'weapon' ? '武器' : '常驻');
                             const name = `${typeStr}${selectedCharName ? '-' + selectedCharName : ''}${drawerName ? '-' + drawerName : ''}`;
                             setNewPoolNameInput(name);
                          }
                        }}
                        className="hidden"
                      />
                      {type === 'limited' && <Star size={16} />}
                      {type === 'standard' && <Layers size={16} />}
                      {type === 'weapon' && <Search size={16} />}
                      {type === 'limited' ? '限定池' : (type === 'weapon' ? '武器池' : '常驻池')}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-2">
                  {newPoolTypeInput === 'limited' && '包含限定与歪，统计大小保底、硬保底(120)及赠送(240)。'}
                  {newPoolTypeInput === 'standard' && '仅统计常驻6星，不区分限定/歪，无大小保底统计。'}
                  {newPoolTypeInput === 'weapon' && (isLimitedWeaponPool
                    ? '6星40抽保底，首轮80抽必出限定。赠送：100(常)->180(限)->+80交替。'
                    : '6星40抽保底，无额外赠送内容。'
                  )}
                </p>

                {/* 武器池限定/常驻开关 */}
                {newPoolTypeInput === 'weapon' && (
                  <div className="mt-3 p-3 bg-slate-50 dark:bg-zinc-800 rounded-none border border-zinc-200 dark:border-zinc-700">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">限定武器池</span>
                        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                          限定武器池有额外获取内容（武库箱、限定武器赠送）
                        </p>
                      </div>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={isLimitedWeaponPool}
                          onChange={(e) => setIsLimitedWeaponPool(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-11 h-6 rounded-full transition-colors ${isLimitedWeaponPool ? 'bg-orange-500' : 'bg-slate-300 dark:bg-zinc-600'}`}>
                          <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isLimitedWeaponPool ? 'translate-x-5' : ''}`}></div>
                        </div>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex gap-3 justify-end">
              <button 
                onClick={closeModalAndClear}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:text-zinc-100 hover:bg-slate-200 rounded-none transition-colors"
              >
                取消
              </button>
              <button 
                onClick={modalState.type === 'createPool' ? confirmCreatePool : confirmEditPool}
                disabled={!newPoolNameInput.trim()}
                className="px-4 py-2 text-sm font-bold text-white bg-endfield-yellow text-black hover:bg-yellow-400 font-bold uppercase tracking-wider hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-none shadow-sm transition-all"
              >
                {modalState.type === 'createPool' ? '创建' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除卡池确认弹窗 */}
      {modalState.type === 'deletePool' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
             <div className="p-6 text-center">
               <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-sm flex items-center justify-center mx-auto mb-4">
                 <Trash2 size={24} />
               </div>
               <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-2">确定删除卡池？</h3>
               <p className="text-sm text-slate-500 dark:text-zinc-500">
                 您正在删除卡池 <span className="font-bold text-slate-700 dark:text-zinc-300">「{modalState.data?.name}」</span>
                 <br/>及其所有 <span className="text-red-500 font-bold">{history.filter(h => h.poolId === modalState.data?.id).length}</span> 条抽卡记录。
                 <br/>此操作<span className="text-red-500 font-bold">无法撤销</span>。
               </p>
             </div>
             <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex gap-3 justify-center">
              <button
                onClick={closeModalAndClear}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-none transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmDeletePool}
                className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-none shadow-sm transition-all"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 清空卡池数据确认弹窗 */}
      {modalState.type === 'deleteConfirm' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
             <div className="p-6 text-center">
               <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-sm flex items-center justify-center mx-auto mb-4">
                 <AlertCircle size={24} />
               </div>
               <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-2">确定清空数据？</h3>
               <p className="text-sm text-slate-500 dark:text-zinc-500">
                 您正在清空 <span className="font-bold text-slate-700 dark:text-zinc-300">{modalState.data?.poolName}</span> 的所有记录。
                 <br/>此操作<span className="text-red-500 font-bold">无法撤销</span>。
               </p>
             </div>
             <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex gap-3 justify-center">
              <button
                onClick={closeModalAndClear}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-none transition-colors"
              >
                再想想
              </button>
              <button
                onClick={confirmDeleteData}
                className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-none shadow-sm transition-all"
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除单条记录确认 */}
      {modalState.type === 'deleteItem' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" style={{zIndex: 60}}> 
          {/* zIndex 60 to sit above EditItemModal (if open) */}
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
             <div className="p-6 text-center">
               <div className="w-12 h-12 bg-red-100 text-red-500 rounded-sm flex items-center justify-center mx-auto mb-4">
                 <Trash2 size={24} />
               </div>
               <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-2">删除这条记录？</h3>
               <p className="text-sm text-slate-500 dark:text-zinc-500">
                 此操作将从历史记录中移除该条目。
               </p>
             </div>
             <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex gap-3 justify-center">
              <button 
                onClick={() => setModalState({ type: null, data: null })}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:text-zinc-100 hover:bg-slate-200 rounded-none transition-colors"
              >
                取消
              </button>
              <button 
                onClick={confirmRealDeleteItem}
                className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-none shadow-sm transition-all"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除整组确认 */}
      {modalState.type === 'deleteGroup' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
             <div className="p-6 text-center">
               <div className="w-12 h-12 bg-red-100 text-red-500 rounded-sm flex items-center justify-center mx-auto mb-4">
                 <Trash2 size={24} />
               </div>
               <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-2">删除这 {modalState.data?.length} 条记录？</h3>
               <p className="text-sm text-slate-500 dark:text-zinc-500">
                 您正在删除一组记录（例如一次十连）。
               </p>
             </div>
             <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex gap-3 justify-center">
              <button 
                onClick={closeModalAndClear}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:text-zinc-100 hover:bg-slate-200 rounded-none transition-colors"
              >
                取消
              </button>
              <button 
                onClick={confirmRealDeleteGroup}
                className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-none shadow-sm transition-all"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 登录弹窗 */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={closeAuthModal}
        onAuthSuccess={(user) => setUser(user)}
      />

      {/* 数据迁移弹窗 - 仅管理员可见 */}
      {showMigrateModal && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-sm flex items-center justify-center mx-auto mb-4">
                <Cloud size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-2">同步本地数据到云端？</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-500">
                检测到您有 <span className="font-bold text-slate-700 dark:text-zinc-300">{history.length}</span> 条本地记录。
                <br/>是否将这些数据同步到云端？
              </p>
              {syncing && (
                <div className="mt-4 flex items-center justify-center gap-2 text-yellow-600 dark:text-endfield-yellow">
                  <RefreshCw size={16} className="animate-spin" />
                  <span className="text-sm">正在同步...</span>
                </div>
              )}
              {syncError && (
                <div className="mt-4 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-none">
                  同步失败: {syncError}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex gap-3 justify-center">
              <button
                onClick={() => setShowMigrateModal(false)}
                disabled={syncing}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-none transition-colors disabled:opacity-50"
              >
                暂不同步
              </button>
              <button
                onClick={async () => {
                  const success = await migrateLocalToCloud();
                  if (success) {
                    setShowMigrateModal(false);
                  }
                }}
                disabled={syncing}
                className="px-4 py-2 text-sm font-bold bg-endfield-yellow text-black hover:bg-yellow-400 uppercase tracking-wider rounded-none shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {syncing ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    同步中...
                  </>
                ) : (
                  <>
                    <Cloud size={16} />
                    同步到云端
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 申请管理员弹窗 */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-amber-100 text-amber-500 rounded-sm flex items-center justify-center mx-auto mb-4">
                <UserPlus size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-2">申请成为管理员</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-500 mb-4">
                成为管理员后，您可以为本站录入抽卡数据。
              </p>
              <textarea
                id="apply-reason"
                placeholder="请简单说明申请理由（如：我想帮忙录入数据）"
                className="w-full p-3 border border-zinc-200 dark:border-zinc-800 rounded-none text-sm resize-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                rows={3}
              />
            </div>
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex gap-3 justify-center">
              <button
                onClick={() => setShowApplyModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:text-zinc-100 hover:bg-slate-200 rounded-none transition-colors"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  const reason = document.getElementById('apply-reason').value.trim();
                  if (!reason) {
                    showToast('请填写申请理由', 'warning');
                    return;
                  }
                  const success = await handleApplyAdmin(reason);
                  if (success) {
                    showToast('申请已提交，请等待审核', 'success');
                  } else {
                    showToast('提交失败，请稍后重试', 'error');
                  }
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-none shadow-sm transition-all flex items-center gap-2"
              >
                <UserPlus size={16} />
                提交申请
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 导入确认弹窗 */}
      {pendingImport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-blue-100 text-blue-500 rounded-sm flex items-center justify-center mx-auto mb-4">
                <Upload size={28} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-2">确认导入数据</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-500">
                包含 <span className="font-bold text-slate-700 dark:text-zinc-300">{pendingImport.data.pools.length}</span> 个卡池和 <span className="font-bold text-slate-700 dark:text-zinc-300">{pendingImport.data.history.length}</span> 条记录
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-2">相同ID的记录会被跳过</p>
              {pendingImport.willSyncToCloud ? (
                <p className="text-xs text-green-600 mt-2 flex items-center justify-center gap-1">
                  <Cloud size={14} /> 数据将自动同步到云端
                </p>
              ) : (
                <p className="text-xs text-amber-600 mt-2 flex items-center justify-center gap-1">
                  <CloudOff size={14} /> 未登录，仅保存到本地
                </p>
              )}
            </div>
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex gap-3 justify-center">
              <button
                onClick={() => setPendingImport(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:text-zinc-100 hover:bg-slate-200 rounded-none transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmImport}
                disabled={syncing}
                className="px-4 py-2 text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 rounded-none shadow-sm transition-all flex items-center gap-2"
              >
                {syncing ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {syncing ? '导入中...' : '确认导入'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 通用确认弹窗 */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        type={confirmState.type}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      {/* Toast 通知 */}
      <Toast toasts={toasts} onRemove={removeToast} />

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-up {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
        .animate-scale-up {
          animation: scale-up 0.2s ease-out forwards;
        }
        
        @keyframes shine {
          0% { background-position: -100% 0; }
          100% { background-position: 200% 0; }
        }
        .shine-effect {
          background-image: linear-gradient(
            120deg, 
            rgba(255,255,255,0) 30%, 
            rgba(255, 215, 0, 0.5) 40%, 
            rgba(255, 0, 128, 0.5) 50%, 
            rgba(0, 255, 255, 0.5) 60%, 
            rgba(255,255,255,0) 70%
          );
          background-size: 200% 100%;
          animation: shine 3s infinite linear;
        }
        
        .glow-border {
           box-shadow: 0 0 8px rgba(255, 165, 0, 0.6);
        }

        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}