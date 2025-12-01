import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Plus, Trash2, Settings, History, Save, RotateCcw, BarChart3, Star, Calculator, Search, Download, Layers, FolderPlus, ChevronDown, X, AlertCircle, Upload, FileJson, CheckCircle2, LogIn, LogOut, User, Cloud, CloudOff, RefreshCw, UserPlus, Bell, FileText, Shield, Info, Moon, Sun, Monitor, Lock, Unlock, ExternalLink, Heart, Code, Sparkles, AlertTriangle, MessageSquare } from 'lucide-react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import AuthModal from './AuthModal';
import { TicketPanel, AboutPanel, SummaryView, AdminPanel, SettingsPanel, InputSection, BatchCard } from './components';
import { Toast, ConfirmDialog } from './components/ui';
import { useToast, useConfirm } from './hooks';
import { RARITY_CONFIG, DEFAULT_DISPLAY_PITY, DEFAULT_POOL_ID, PRESET_POOLS, POOL_TYPE_KEYWORDS } from './constants';
import { validatePullData, validatePoolData, extractDrawerFromPoolName, extractCharNameFromPoolName, extractTypeFromPoolName } from './utils';


export default function GachaAnalyzer({ themeMode, setThemeMode }) {
  // --- State ---

  // 0.1 用户认证状态
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'user' | 'admin' | 'super_admin'
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  // 0.2 全局统计数据 (P2: 汇总页全局数据)
  const [globalStats, setGlobalStats] = useState(null);
  const [globalStatsLoading, setGlobalStatsLoading] = useState(false);

  // 0.1 申请和公告状态
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState(null); // 'pending' | 'approved' | 'rejected' | null
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncement, setShowAnnouncement] = useState(true);

  // 0.2 通用弹窗
  const { toasts, showToast, removeToast } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();

  // 权限判断
  const canEdit = userRole === 'admin' || userRole === 'super_admin';
  const isSuperAdmin = userRole === 'super_admin';

  // 1. 卡池列表
  const [pools, setPools] = useState(() => {
    try {
      const saved = localStorage.getItem('gacha_pools');
      let parsed = saved ? JSON.parse(saved) : [{ id: DEFAULT_POOL_ID, name: '常驻/默认池', type: 'standard', locked: false }];
      // 迁移数据：如果没有 type 或 locked 字段
      return parsed.map(p => ({
        ...p,
        type: p.type || (p.name.includes('常驻') || p.id === DEFAULT_POOL_ID ? 'standard' : 'limited'),
        locked: p.locked || false
      }));
    } catch (e) {
      return [{ id: DEFAULT_POOL_ID, name: '常驻/默认池', type: 'standard', locked: false }];
    }
  });

  // 2. 当前选中卡池ID
  const [currentPoolId, setCurrentPoolId] = useState(() => {
    return localStorage.getItem('gacha_current_pool_id') || DEFAULT_POOL_ID;
  });
  
  const currentPool = useMemo(() => pools.find(p => p.id === currentPoolId) || pools[0], [pools, currentPoolId]);

  // 当前卡池是否可编辑（锁定的卡池只有超管能改）
  const canEditCurrentPool = useMemo(() => {
    if (!canEdit) return false;
    if (currentPool?.locked && !isSuperAdmin) return false;
    return true;
  }, [canEdit, currentPool?.locked, isSuperAdmin]);

  // 卡池搜索状态（必须在 groupedPools 之前声明）
  const [poolSearchQuery, setPoolSearchQuery] = useState('');
  // 折叠的抽卡人分组（存储已折叠的抽卡人名称）
  const [collapsedDrawers, setCollapsedDrawers] = useState(new Set());

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

  // 3. 历史记录 (增加 isStandard 字段标识常驻)
  const [history, setHistory] = useState(() => {
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
  });

  // 当前卡池的历史记录（方案A：完全开放模式，显示该卡池的所有数据）
  const currentPoolHistory = useMemo(() => {
    if (!currentPool) return [];
    // 只按 poolId 过滤，不区分 user_id
    // 这样所有用户都能看到该卡池的全部录入数据（适合协作场景）
    return history.filter(h => h.poolId === currentPoolId);
  }, [history, currentPoolId, currentPool]);

  const [manualPityLimit, setManualPityLimit] = useState(DEFAULT_DISPLAY_PITY);
  
  // 列表分页状态
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(20);

  const [activeTab, setActiveTab] = useState('summary');
  const [showPoolMenu, setShowPoolMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // 弹窗状态
  const [modalState, setModalState] = useState({ type: null, data: null });
  const [newPoolNameInput, setNewPoolNameInput] = useState('');
  const [newPoolTypeInput, setNewPoolTypeInput] = useState('limited'); // 'limited' | 'standard'
  const [drawerName, setDrawerName] = useState('');
  const [selectedCharName, setSelectedCharName] = useState('');
  const [editItemState, setEditItemState] = useState(null); // { id, rarity, isStandard } or null

  // 文件上传 Ref
  const fileInputRef = useRef(null);

  // --- Effects ---

  // 加载全局统计数据 (P2: 汇总页统计全局数据)
  // 使用 RPC 函数绕过 RLS 获取全服统计
  const fetchGlobalStats = useCallback(async () => {
    if (!supabase) return;

    setGlobalStatsLoading(true);
    try {
      // 调用数据库 RPC 函数获取全服统计（绕过 RLS）
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_global_stats');

      if (rpcError) {
        console.error('RPC 调用失败:', rpcError);
        // 如果 RPC 失败，回退到旧方法（可能因为函数还没部署）
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
          avgPity: rpcData.avgPity || null
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
          distribution: [...limitedStats.distribution, ...standardStats.distribution],
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
      console.error('获取全局统计失败:', error);
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
      console.error('加载云端数据失败:', error);
      setSyncError(error.message);
      return null;
    } finally {
      setSyncing(false);
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

        // 获取全局统计（使用 RPC 函数，无需等待认证同步）
        await fetchGlobalStats();

        // 方案A：加载云端数据（包括游客）
        const cloudData = await loadCloudData();
        if (cloudData && cloudData.pools.length > 0) {
          setPools(cloudData.pools);
          setCurrentPoolId(cloudData.pools[0].id);
          if (cloudData.history.length > 0) {
            setHistory(cloudData.history);
          }
        }
      } catch (error) {
        console.error('初始化失败:', error);
      }
    };

    initializeApp();

    // 监听登录状态变化
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        // 用户状态变化时刷新全局统计（RPC 函数不受 RLS 限制）
        fetchGlobalStats();
      });

      return () => subscription.unsubscribe();
    }
  }, [fetchGlobalStats, loadCloudData]);

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
          if (insertError) console.error('创建 profile 失败:', insertError);
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
        console.error('获取用户角色失败:', error);
        setUserRole('user');
      }
    };

    fetchUserRole();
  }, [user]);

  // 加载公告 - 从本地JSON文件加载
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const response = await fetch('/announcements.json');
        if (!response.ok) throw new Error('Failed to fetch announcements');
        const data = await response.json();
        // 过滤激活的公告并按优先级排序
        const activeAnnouncements = data
          .filter(a => a.is_active)
          .sort((a, b) => b.priority - a.priority);
        setAnnouncements(activeAnnouncements);
      } catch (error) {
        console.error('加载公告失败:', error);
        setAnnouncements([]);
      }
    };

    fetchAnnouncements();
  }, []);

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
      console.error('提交申请失败:', error);
      return false;
    }
  };

  // --- 云同步函数 ---

  // 迁移弹窗状态
  const [showMigrateModal, setShowMigrateModal] = useState(false);

  // 保存卡池到云端
  const savePoolToCloud = useCallback(async (pool, showNotification = false) => {
    if (!supabase || !user) {
      console.warn('savePoolToCloud: supabase 或 user 不存在');
      return false;
    }

    try {
      const { error } = await supabase
        .from('pools')
        .upsert({
          user_id: user.id,
          pool_id: pool.id,
          name: pool.name,
          type: pool.type,
          locked: pool.locked || false,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,pool_id' });

      if (error) throw error;

      if (showNotification) {
        console.log('卡池同步成功:', pool.name);
      }
      return true;
    } catch (error) {
      console.error('保存卡池到云端失败:', error);
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
      console.error('保存历史记录到云端失败:', error);
      setSyncError(error.message);
    }
  }, [user]);

  // 从云端删除历史记录
  const deleteHistoryFromCloud = useCallback(async (recordIds) => {
    if (!supabase || !user) return;

    try {
      const { error } = await supabase
        .from('history')
        .delete()
        .eq('user_id', user.id)
        .in('record_id', recordIds);

      if (error) throw error;
    } catch (error) {
      console.error('从云端删除记录失败:', error);
      setSyncError(error.message);
    }
  }, [user]);

  // 从云端删除指定卡池的所有历史记录
  const deletePoolHistoryFromCloud = useCallback(async (poolId) => {
    if (!supabase || !user) return;

    try {
      const { error } = await supabase
        .from('history')
        .delete()
        .eq('user_id', user.id)
        .eq('pool_id', poolId);

      if (error) throw error;
    } catch (error) {
      console.error('从云端删除卡池记录失败:', error);
      setSyncError(error.message);
    }
  }, [user]);

  // 从云端删除卡池本身
  const deletePoolFromCloud = useCallback(async (poolId) => {
    if (!supabase || !user) return;

    try {
      const { error } = await supabase
        .from('pools')
        .delete()
        .eq('user_id', user.id)
        .eq('pool_id', poolId);

      if (error) throw error;
    } catch (error) {
      console.error('从云端删除卡池失败:', error);
      setSyncError(error.message);
    }
  }, [user]);

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
      console.error('迁移数据到云端失败:', error);
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
          setCurrentPoolId(cloudData.pools[0].id);
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
      }
    };
  }, [currentPoolHistory, manualPityLimit]);

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
      locked: false
    };

    // P1: 前端数据校验
    const validation = validatePoolData(newPool);
    if (!validation.isValid) {
      console.error('卡池数据校验失败:', validation.errors);
      showToast(`卡池创建失败: ${validation.errors.join(', ')}`, 'error');
      return;
    }

    setPools(prev => [...prev, newPool]);
    setCurrentPoolId(newId);
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
       creator_username: modalState.data.creator_username || null  // 保留创建人用户名
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
        setCurrentPoolId(remainingPools[0].id);
      }
    }

    setModalState({ type: null, data: null });

    // 同步到云端
    if (user) {
      await deletePoolHistoryFromCloud(poolId);
      await deletePoolFromCloud(poolId);
    }

    showToast(`卡池「${poolName}」已删除`, 'success');
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
      setCurrentPoolId(null);

      showToast('所有数据已删除', 'success');
    } catch (error) {
      console.error('删除所有数据失败:', error);
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
      console.error('手动同步失败:', error);
      showToast('同步失败: ' + error.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const closeModal = () => {
    setModalState({ type: null, data: null });
    setEditItemState(null);
  };

  // 添加单抽 (支持 isStandard)
  const addSinglePull = (rarity, isStandard = false) => {
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
      console.error('数据校验失败:', validation.errors);
      showToast(`数据校验失败: ${validation.errors.join(', ')}`, 'error');
      return;
    }

    setHistory(prev => [...prev, newPull]);

    // 同步到云端
    if (user) {
      saveHistoryToCloud([newPull]);
    }
  };

  // 提交十连
  const submitBatch = (inputData) => {
    const nowStr = new Date().toISOString(); // 确保同一批次时间戳完全一致
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
        console.error('批量数据校验失败:', validation.errors);
        showToast(`数据校验失败: ${validation.errors.join(', ')}`, 'error');
        return;
      }
    }

    setHistory(prev => [...prev, ...newPulls]);

    // 同步到云端
    if (user) {
      saveHistoryToCloud(newPulls);
    }
  };

  // 编辑记录
  const handleUpdateItem = (id, newConfig) => {
    let updatedItem = null;
    setHistory(prev => prev.map(item => {
      if (item.id === id) {
        updatedItem = { ...item, ...newConfig };
        return updatedItem;
      }
      return item;
    }));
    setEditItemState(null);

    // 同步到云端
    if (user && updatedItem) {
      saveHistoryToCloud([updatedItem]);
    }
  };

  // 删除单条记录 (触发弹窗)
  const handleDeleteItem = (id) => {
    setModalState({ type: 'deleteItem', data: id });
  };

  const confirmRealDeleteItem = async () => {
    const idToDelete = modalState.data;
    setHistory(prev => prev.filter(item => item.id !== idToDelete));
    setEditItemState(null);
    setModalState({ type: null, data: null });

    // 同步到云端
    if (user) {
      await deleteHistoryFromCloud([idToDelete]);
    }
  };

  // 删除整组记录 (触发弹窗)
  const handleDeleteGroup = (items) => {
    setModalState({ type: 'deleteGroup', data: items });
  };

  const confirmRealDeleteGroup = async () => {
    const itemsToDelete = modalState.data;
    const idsToDelete = new Set(itemsToDelete.map(i => i.id));
    setHistory(prev => prev.filter(item => !idsToDelete.has(item.id)));
    setModalState({ type: null, data: null });

    // 同步到云端
    if (user) {
      await deleteHistoryFromCloud(Array.from(idsToDelete));
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

  const handleImportFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);

        // 简单验证
        if (!importedData.pools || !importedData.history) {
          showToast("文件格式不正确，缺少关键数据字段。", 'error');
          return;
        }

        const willSyncToCloud = !!(user && supabase);

        // 存储待导入数据，显示确认弹窗
        setPendingImport({ data: importedData, willSyncToCloud });

      } catch (error) {
        console.error(error);
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
        console.error('同步到云端失败:', syncError);
        showToast(`新增了 ${addedHistory.length} 条记录，但云端同步失败: ${syncError.message}`, 'warning', '部分成功');
      } finally {
        setSyncing(false);
      }
    } else {
      showToast(`导入完成！新增了 ${addedHistory.length} 条记录。`, 'success', '导入成功');
    }
  };

  // --- 组件 ---
  
  const EditItemModal = React.memo(({ item, onClose, onUpdate, onDelete }) => {
     if (!item) return null;
     const isLimitedOrWeapon = currentPool.type === 'limited' || currentPool.type === 'weapon';
     
     return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex justify-between items-center">
              <h3 className="font-bold text-slate-700 dark:text-zinc-300">编辑记录</h3>
              <button onClick={onClose} className="text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:text-zinc-400 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
               <div>
                 <label className="block text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase mb-2">修改为</label>
                 <div className="grid grid-cols-2 gap-2">
                   <button
                     onClick={() => onUpdate(item.id, { rarity: 4, isStandard: false })}
                     className={`py-3 rounded-none border text-sm font-bold transition-colors ${item.rarity === 4 
                       ? 'bg-purple-50 border-purple-500 text-purple-700' 
                       : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:bg-zinc-950'}`}
                   >
                     4星
                   </button>
                   <button
                     onClick={() => onUpdate(item.id, { rarity: 5, isStandard: false })}
                     className={`py-3 rounded-none border text-sm font-bold transition-colors ${item.rarity === 5 
                       ? 'bg-amber-50 border-amber-500 text-amber-700' 
                       : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:bg-zinc-950'}`}
                   >
                     5星
                   </button>

                   {isLimitedOrWeapon ? (
                     <>
                       <button
                         onClick={() => onUpdate(item.id, { rarity: 6, isStandard: false })}
                         className={`py-3 rounded-none border text-sm font-bold transition-colors ${item.rarity === 6 && !item.isStandard
                           ? 'bg-orange-50 border-orange-500 text-orange-700' 
                           : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:bg-zinc-950'}`}
                       >
                         6星 (限定UP)
                       </button>
                       <button
                         onClick={() => onUpdate(item.id, { rarity: 6, isStandard: true })}
                         className={`py-3 rounded-none border text-sm font-bold transition-colors ${item.rarity === 6 && item.isStandard
                           ? 'bg-red-50 border-red-500 text-red-700' 
                           : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:bg-zinc-950'}`}
                       >
                         6星 (常驻歪)
                       </button>
                     </>
                   ) : (
                     <button
                       onClick={() => onUpdate(item.id, { rarity: 6, isStandard: true })}
                       className={`col-span-2 py-3 rounded-none border text-sm font-bold transition-colors ${item.rarity === 6
                         ? 'bg-red-50 border-red-500 text-red-700' 
                         : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:bg-zinc-950'}`}
                     >
                       6星 (常驻)
                     </button>
                   )}
                 </div>
               </div>

               {item.rarity === 6 && (
                 <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                   <label className="block text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase mb-2">特殊标记</label>
                   <div className="flex gap-2">
                     <button
                       onClick={() => onUpdate(item.id, { specialType: null })}
                       className={`flex-1 py-2 rounded-none border text-xs font-bold transition-colors ${!item.specialType
                         ? 'bg-slate-800 text-white border-slate-800' 
                         : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 hover:bg-slate-50 dark:bg-zinc-950'}`}
                     >
                       正常获取
                     </button>
                     <button
                       onClick={() => onUpdate(item.id, { specialType: 'guaranteed' })}
                       className={`flex-1 py-2 rounded-none border text-xs font-bold transition-colors ${item.specialType === 'guaranteed'
                         ? 'bg-green-500 text-white border-green-500' 
                         : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-green-600 hover:bg-green-50'}`}
                     >
                       120抽保底
                     </button>
                     <button
                       onClick={() => onUpdate(item.id, { specialType: 'gift' })}
                       className={`flex-1 py-2 rounded-none border text-xs font-bold transition-colors ${item.specialType === 'gift'
                         ? 'bg-purple-500 text-white border-purple-500' 
                         : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-purple-600 hover:bg-purple-50'}`}
                     >
                       额外赠送
                     </button>
                   </div>
                   {item.specialType === 'gift' && (
                     <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
                       * “额外赠送”不占用抽数，不重置当前垫刀，不计入平均出货花费。
                     </p>
                   )}
                 </div>
               )}
            </div>
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex justify-between">
               <button 
                 onClick={() => onDelete(item.id)}
                 className="text-red-500 hover:text-red-700 text-sm font-medium px-3 py-2 rounded hover:bg-red-50 transition-colors flex items-center gap-1"
               >
                 <Trash2 size={16}/> 删除
               </button>
               <button 
                 onClick={onClose}
                 className="bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold px-6 py-2 rounded-none transition-colors shadow-sm"
               >
                 完成
               </button>
            </div>
          </div>
        </div>
     );
  });

  // ... (inside GachaAnalyzer render)
  const PityAnalysisCard = () => {
    const isLimited = currentPool.type === 'limited';
    const isWeapon = currentPool.type === 'weapon';
    
    // 武器池参数
    const maxPity = isWeapon ? 40 : 80;
    const poolColor = isWeapon ? 'bg-slate-700' : (isLimited ? 'bg-orange-500' : 'bg-endfield-yellow');
    const textColor = isWeapon ? 'text-slate-700 dark:text-zinc-300' : (isLimited ? 'text-orange-500' : 'text-yellow-600 dark:text-endfield-yellow');
    const progressColor = isWeapon ? 'bg-slate-600' : (stats.currentPity >= 60 ? 'bg-red-500' : 'bg-endfield-yellow');

    // 计算武器池下一档赠送
    let nextWeaponGift = 0;
    let nextWeaponGiftType = ''; // 'standard' or 'limited'
    if (isWeapon) {
      if (stats.total < 100) {
        nextWeaponGift = 100;
        nextWeaponGiftType = 'standard';
      } else if (stats.total < 180) {
        nextWeaponGift = 180;
        nextWeaponGiftType = 'limited';
      } else {
        // 180以后，每80抽一档：260(std), 340(ltd), 420(std)...
        const base = 180;
        const cycle = Math.floor((stats.total - base) / 80) + 1;
        nextWeaponGift = base + cycle * 80;
      }
    }

    // 检查是否已达成硬保底 (首轮限定)
    const sortedHistory = [...currentPoolHistory].sort((a, b) => a.id - b.id);
    
    // 限定池 120 抽逻辑
    const firstLimitedIn120 = isLimited ? sortedHistory.slice(0, 120).find(i => i.rarity === 6 && !i.isStandard) : null;
    const firstLimitedIndex120 = firstLimitedIn120 ? sortedHistory.indexOf(firstLimitedIn120) + 1 : 0;
    const hasLimitedInFirst120 = firstLimitedIndex120 > 0;

    // 武器池 80 抽逻辑
    const firstLimitedIn80 = isWeapon ? sortedHistory.slice(0, 80).find(i => i.rarity === 6 && !i.isStandard) : null;
    const firstLimitedIndex80 = firstLimitedIn80 ? sortedHistory.indexOf(firstLimitedIn80) + 1 : 0;
    const hasLimitedInFirst80 = firstLimitedIndex80 > 0;
    
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 relative overflow-hidden transition-all hover:shadow-md">
        <div className={`absolute top-0 left-0 w-2 h-full ${isLimited ? 'bg-orange-500' : isWeapon ? 'bg-slate-700' : 'bg-yellow-50 dark:bg-yellow-900/200'}`}></div>
        
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-slate-700 dark:text-zinc-300 text-lg font-bold flex items-center gap-2">
              <Calculator size={20} className={textColor}/>
              {isWeapon ? '武器池分析' : isLimited ? '限定池分析' : '常驻池分析'}
            </h3>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
              当前: <span className={`font-medium ${isLimited ? 'text-orange-600' : isWeapon ? 'text-slate-700 dark:text-zinc-300' : 'text-yellow-600 dark:text-endfield-yellow'}`}>{currentPool.name}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-50 dark:bg-zinc-950 rounded-none p-4 border border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
             <div className="text-xs text-slate-500 dark:text-zinc-500 mb-1 relative z-10">距离6星保底 ({maxPity})</div>
             <div className="text-3xl font-bold text-slate-800 dark:text-zinc-100 relative z-10">
               {Math.max(maxPity - stats.currentPity, 0)} <span className="text-sm font-normal text-slate-400 dark:text-zinc-500">抽</span>
             </div>
             <div className="absolute bottom-0 left-0 h-1 bg-slate-200 w-full">
               <div 
                 className={`h-full transition-all duration-500 ${progressColor}`} 
                 style={{ width: `${Math.min((stats.currentPity / maxPity) * 100, 100)}%` }}
               ></div>
             </div>
             <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 relative z-10">当前垫刀: {stats.currentPity}</div>
          </div>

          <div className="bg-slate-50 dark:bg-zinc-950 rounded-none p-4 border border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
             <div className="text-xs text-slate-500 dark:text-zinc-500 mb-1 relative z-10">距离5星保底 (10)</div>
             <div className="text-3xl font-bold text-slate-800 dark:text-zinc-100 relative z-10">
               {Math.max(10 - stats.currentPity5, 0)} <span className="text-sm font-normal text-slate-400 dark:text-zinc-500">抽</span>
             </div>
             <div className="absolute bottom-0 left-0 h-1 bg-slate-200 w-full">
               <div 
                 className="h-full bg-amber-500 transition-all duration-500" 
                 style={{ width: `${Math.min((stats.currentPity5 / 10) * 100, 100)}%` }}
               ></div>
             </div>
             <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 relative z-10">当前垫刀: {stats.currentPity5}</div>
          </div>
        </div>

        {isLimited && (
          <div className="mb-6 space-y-4">
            {/* 120 Spark - One Time Only */}
            <div>
               <div className="flex justify-between text-xs mb-1">
                 <span className="font-bold text-slate-600 dark:text-zinc-400 flex items-center">
                    必出限定 (120抽)
                    {hasLimitedInFirst120 && <span className="ml-2 text-green-600 font-bold bg-green-50 px-1.5 rounded text-[10px] border border-green-100">已达成</span>}
                 </span>
                                  <span className="text-slate-400 dark:text-zinc-500">
                                     {hasLimitedInFirst120 ? firstLimitedIndex120 : Math.min(stats.total, 120)} / 120
                                  </span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
                                  <div 
                                     className={`h-full transition-all duration-500 ${hasLimitedInFirst120 ? 'bg-green-500' : 'bg-gradient-to-r from-orange-300 to-orange-500'}`}
                                     style={{ width: `${hasLimitedInFirst120 ? 100 : Math.min((stats.total / 120) * 100, 100)}%` }}
                                  ></div>               </div>
            </div>

            {/* 240 Bonus - Recurring */}
            <div>
               <div className="flex justify-between text-xs mb-1">
                 <span className="font-bold text-slate-600 dark:text-zinc-400 flex items-center">
                    赠送角色 (每240抽)
                    {Math.floor(stats.total / 240) > 0 && (
                        <span className="ml-2 flex items-center gap-1 text-purple-600 font-bold bg-purple-50 px-1.5 rounded text-[10px] border border-purple-100">
                           已获 x {Math.floor(stats.total / 240)}
                        </span>
                    )}
                 </span>
                 <span className="text-slate-400 dark:text-zinc-500">{stats.total % 240} / 240</span>
               </div>
               <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
                 <div 
                   className="h-full bg-gradient-to-r from-purple-300 to-purple-500 transition-all duration-500" 
                   style={{ width: `${((stats.total % 240) / 240) * 100}%` }}
                 ></div>
               </div>
            </div>
          </div>
        )}

        {isWeapon && (
          <div className="mb-6 space-y-4">
             {/* 80 Spark - One Time Only */}
             <div>
               <div className="flex justify-between text-xs mb-1">
                 <span className="font-bold text-slate-600 dark:text-zinc-400 flex items-center">
                    首轮限定必出 (80抽)
                    {hasLimitedInFirst80 && <span className="ml-2 text-green-600 font-bold bg-green-50 px-1.5 rounded text-[10px] border border-green-100">已达成</span>}
                 </span>
                 <span className="text-slate-400 dark:text-zinc-500">
                    {hasLimitedInFirst80 ? firstLimitedIndex80 : Math.min(stats.total, 80)} / 80
                 </span>
               </div>
               <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
                 <div 
                    className={`h-full transition-all duration-500 ${hasLimitedInFirst80 ? 'bg-green-500' : 'bg-gradient-to-r from-slate-400 to-slate-600'}`} 
                    style={{ width: `${hasLimitedInFirst80 ? 100 : Math.min((stats.total / 80) * 100, 100)}%` }}
                 ></div>
               </div>
             </div>

             {/* Weapon Gifts - Dynamic */}
             <div>
               <div className="flex justify-between text-xs mb-1">
                 <span className="font-bold text-slate-600 dark:text-zinc-400 flex items-center gap-2">
                    下一档赠送
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${nextWeaponGiftType === 'limited' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'}`}>
                      {nextWeaponGiftType === 'limited' ? '限定' : '常驻'}武器
                    </span>
                 </span>
                 <span className="text-slate-400 dark:text-zinc-500">{stats.total} / {nextWeaponGift}</span>
               </div>
               <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
                 <div 
                   className={`h-full transition-all duration-500 ${nextWeaponGiftType === 'limited' ? 'bg-orange-400' : 'bg-red-400'}`} 
                   style={{ width: `${Math.min((stats.total / nextWeaponGift) * 100, 100)}%` }}
                 ></div>
               </div>
               <div className="mt-1 text-[10px] text-slate-400 dark:text-zinc-500 flex gap-2">
                  <span>已领:</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-red-400 rounded-sm"></span>{Math.floor(stats.counts['6_std'] - stats.pityStats.history.filter(h=>h.isStandard).length)} 常</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-orange-400 rounded-sm"></span>{Math.floor(stats.counts[6] - stats.pityStats.history.filter(h=>!h.isStandard).length)} 限</span>
               </div>
             </div>
          </div>
        )}

        {!isLimited && !isWeapon && (
          // 常驻池
          <div className="mb-6">
             <div>
               <div className="flex justify-between text-xs mb-1">
                 <span className="font-bold text-slate-600 dark:text-zinc-400 flex items-center">
                    首次赠送自选 (300抽)
                    {stats.total >= 300 && <span className="ml-2 text-green-600 font-bold bg-green-50 px-1.5 rounded text-[10px] border border-green-100">已达成</span>}
                 </span>
                 <span className="text-slate-400 dark:text-zinc-500">
                    {Math.min(stats.total, 300)} / 300
                 </span>
               </div>
               <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
                 <div 
                    className={`h-full transition-all duration-500 ${stats.total >= 300 ? 'bg-green-500' : 'bg-gradient-to-r from-red-300 to-red-500'}`} 
                    style={{ width: `${Math.min((stats.total / 300) * 100, 100)}%` }}
                 ></div>
               </div>
             </div>
          </div>
        )}

        {stats.pityStats.history.length === 0 ? (
          <div className="bg-slate-50 dark:bg-zinc-950 rounded-none p-6 text-center text-slate-400 dark:text-zinc-500 text-sm border border-dashed border-zinc-200 dark:border-zinc-800">
            <div className="mb-2">⚠️ 数据不足</div>
            暂无6星记录，无法分析本卡池的概率模型。<br/>请继续录入数据。
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-none border border-orange-100 dark:border-orange-800/50 text-center">
                <div className="text-xs text-orange-600 dark:text-orange-400 mb-1">最非记录</div>
                <div className="text-lg font-bold text-orange-700 dark:text-orange-300">{stats.pityStats.max} 抽</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-none border border-green-100 dark:border-green-800/50 text-center">
                <div className="text-xs text-green-600 dark:text-green-400 mb-1">最欧记录</div>
                <div className="text-lg font-bold text-green-700 dark:text-green-300">{stats.pityStats.min} 抽</div>
              </div>
              {isLimited ? (
                 <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-none border border-blue-100 dark:border-blue-800/50 text-center">
                   <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">不歪率</div>
                   <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{stats.winRate}%</div>
                 </div>
              ) : (
                 <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-none border border-zinc-200 dark:border-zinc-800 text-center">
                   <div className="text-xs text-slate-500 dark:text-zinc-500 mb-1">总6星数</div>
                   <div className="text-lg font-bold text-slate-700 dark:text-zinc-300">{stats.totalSixStar}</div>
                 </div>
              )}
            </div>

            <div className="h-40 w-full mt-4">
              <p className="text-xs text-slate-500 dark:text-zinc-500 mb-2 font-medium">6星分布趋势</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.pityStats.distribution} stackOffset="sign">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="range" tick={{fontSize: 10}} interval={0} />
                  <YAxis allowDecimals={false} tick={{fontSize: 10}} />
                  <RechartsTooltip 
                     cursor={{fill: 'rgba(255,255,255,0.1)'}}
                     contentStyle={{ borderRadius: '0px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  {/* 堆叠柱状图：限定在下，常驻在上 */}
                  <Bar dataKey="limited" stackId="a" fill={RARITY_CONFIG[6].color} name="限定UP" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="standard" stackId="a" fill={RARITY_CONFIG['6_std'].color} name="常驻歪" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    );
  };

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
      {/* 顶部导航 */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* 左侧：Logo + 卡池切换器 */}
          <div className="flex items-center gap-4">
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
            
            <div className="relative">
              <button 
                onClick={() => setShowPoolMenu(!showPoolMenu)}
                className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-none text-sm font-medium text-slate-700 dark:text-zinc-300 transition-colors"
              >
                <Layers size={16} />
                <span className="max-w-[100px] sm:max-w-[200px] truncate">
                  {pools.find(p => p.id === currentPoolId)?.name}
                </span>
                <ChevronDown size={14} className={`transition-transform ${showPoolMenu ? 'rotate-180' : ''}`}/>
              </button>

              {showPoolMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => { setShowPoolMenu(false); setPoolSearchQuery(''); }}></div>
                  <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-zinc-900 rounded-none shadow-xl border border-zinc-100 dark:border-zinc-800 z-20 animate-fade-in overflow-hidden">
                    {/* 搜索框 */}
                    <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
                      <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                        <input
                          type="text"
                          value={poolSearchQuery}
                          onChange={(e) => setPoolSearchQuery(e.target.value)}
                          placeholder="搜索卡池..."
                          className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-slate-700 dark:text-zinc-300 placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                          autoFocus
                        />
                        {poolSearchQuery && (
                          <button
                            onClick={() => setPoolSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-400"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 卡池列表 - 按抽卡人分组 */}
                    <div className="max-h-80 overflow-y-auto">
                      {groupedPools.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-400 dark:text-zinc-500">
                          未找到匹配的卡池
                        </div>
                      ) : (
                        groupedPools.map((group, groupIdx) => {
                          const drawerKey = group.drawer || '未分类';
                          const isCollapsed = collapsedDrawers.has(drawerKey);

                          return (
                          <div key={drawerKey}>
                            {/* 抽卡人分组标题 - 可点击折叠 */}
                            <button
                              onClick={() => {
                                setCollapsedDrawers(prev => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(drawerKey)) {
                                    newSet.delete(drawerKey);
                                  } else {
                                    newSet.add(drawerKey);
                                  }
                                  return newSet;
                                });
                              }}
                              className="w-full px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider bg-slate-50 dark:bg-zinc-800/50 sticky top-0 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-zinc-700/50 transition-colors"
                            >
                              <ChevronDown
                                size={12}
                                className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                              />
                              <User size={12} />
                              {group.drawer || '未分类'}
                              <span className="text-slate-300 dark:text-zinc-600">({group.pools.length})</span>
                            </button>

                            {/* 该抽卡人的卡池列表 - 可折叠 */}
                            {!isCollapsed && group.pools.map(pool => {
                              const charName = extractCharNameFromPoolName(pool.name);
                              const poolTypeLabel = pool.type === 'limited' ? '限定' : pool.type === 'weapon' ? '武器' : '常驻';
                              const poolTypeColor = pool.type === 'limited' ? 'text-orange-500' : pool.type === 'weapon' ? 'text-slate-500 dark:text-zinc-400' : 'text-yellow-600 dark:text-endfield-yellow';

                              return (
                                <div
                                  key={pool.id}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 group/item ${currentPoolId === pool.id ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}
                                >
                                  <button
                                    onClick={() => {
                                      setCurrentPoolId(pool.id);
                                      setShowPoolMenu(false);
                                      setPoolSearchQuery('');
                                    }}
                                    className={`flex-1 text-left flex items-center gap-2 min-w-0 ${currentPoolId === pool.id ? 'text-yellow-600 dark:text-endfield-yellow font-bold' : 'text-slate-600 dark:text-zinc-400'}`}
                                    title={pool.name}
                                  >
                                    {pool.locked && <Lock size={12} className="text-amber-500 shrink-0" />}
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 font-bold ${poolTypeColor} bg-opacity-10 ${pool.type === 'limited' ? 'bg-orange-100 dark:bg-orange-900/30' : pool.type === 'weapon' ? 'bg-slate-100 dark:bg-zinc-700' : 'bg-yellow-100 dark:bg-yellow-900/30'}`}>
                                      {poolTypeLabel}
                                    </span>
                                    <span className="truncate">
                                      {charName || (group.drawer ? pool.name.replace(`-${group.drawer}`, '') : pool.name)}
                                    </span>
                                  </button>

                                  <div className="flex items-center gap-0.5 shrink-0">
                                    {currentPoolId === pool.id && <div className="w-1.5 h-1.5 rounded-sm bg-endfield-yellow shrink-0 mr-1"></div>}
                                    {/* 锁定/解锁按钮 - 仅超管可见 */}
                                    {isSuperAdmin && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          togglePoolLock(pool.id);
                                        }}
                                        className={`p-1 rounded opacity-0 group-hover/item:opacity-100 transition-all ${pool.locked ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30' : 'text-slate-300 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}
                                        title={pool.locked ? "解锁卡池" : "锁定卡池"}
                                      >
                                        {pool.locked ? <Unlock size={12} /> : <Lock size={12} />}
                                      </button>
                                    )}
                                    {/* 编辑卡池按钮 */}
                                    {canEdit && (!pool.locked || isSuperAdmin) && (
                                      <button
                                        onClick={(e) => openEditPoolModal(e, pool)}
                                        className="p-1 text-slate-300 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded opacity-0 group-hover/item:opacity-100 transition-all"
                                        title="编辑卡池"
                                      >
                                        <Settings size={12} />
                                      </button>
                                    )}
                                    {/* 删除卡池按钮 */}
                                    {canEdit && (!pool.locked || isSuperAdmin) && pools.length > 1 && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openDeletePoolModal(pool);
                                        }}
                                        className="p-1 text-slate-300 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded opacity-0 group-hover/item:opacity-100 transition-all"
                                        title="删除卡池"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          );
                        })
                      )}
                    </div>

                    {/* 新建卡池 - 仅管理员可见 */}
                    {canEdit && (
                      <div className="border-t border-zinc-100 dark:border-zinc-800">
                        <button
                          onClick={openCreatePoolModal}
                          className="w-full text-left px-3 py-2.5 text-sm text-yellow-600 dark:text-endfield-yellow hover:bg-yellow-50 dark:hover:bg-yellow-900/20 flex items-center gap-2 font-medium"
                        >
                          <Plus size={16} />
                          新建卡池...
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2 sm:gap-4">
            <button 
              onClick={() => setActiveTab('summary')}
              className={`text-sm font-medium px-3 py-1.5 rounded-none transition-colors ${activeTab === 'summary' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' : 'text-slate-500 dark:text-zinc-500 hover:text-slate-800 dark:text-zinc-100'}`}
            >
              汇总
            </button>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`text-sm font-medium px-3 py-1.5 rounded-none transition-colors ${activeTab === 'dashboard' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' : 'text-slate-500 dark:text-zinc-500 hover:text-slate-800 dark:text-zinc-100'}`}
            >
              看板
            </button>
            <button
              onClick={() => {
                setActiveTab('history');
                setVisibleHistoryCount(20); // 切换回记录页时重置分页，防止卡顿
              }}
              className={`text-sm font-medium px-3 py-1.5 rounded-none transition-colors ${activeTab === 'history' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' : 'text-slate-500 dark:text-zinc-500 hover:text-slate-800 dark:text-zinc-100'}`}
            >
              记录
            </button>

            {/* 超管管理页面 */}
            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`text-sm font-medium px-3 py-1.5 rounded-none transition-colors ${activeTab === 'admin' ? 'bg-red-50 text-red-700' : 'text-slate-500 dark:text-zinc-500 hover:text-slate-800 dark:text-zinc-100'}`}
              >
                管理
              </button>
            )}

            {/* 工单、设置和关于按钮 */}
            {user && (
              <button
                onClick={() => setActiveTab('tickets')}
                className={`text-sm font-medium px-2 py-1.5 rounded-none transition-colors ${activeTab === 'tickets' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:text-zinc-400'}`}
                title="工单"
              >
                <MessageSquare size={18} />
              </button>
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

            {/* 公告按钮 - 公告关闭时显示 */}
            {!showAnnouncement && announcements.length > 0 && (
              <button
                onClick={() => setShowAnnouncement(true)}
                className="text-sm text-amber-600 hover:text-amber-700 px-2 py-1.5 rounded-none hover:bg-amber-50 transition-colors"
                title="查看公告"
              >
                <Bell size={18} />
              </button>
            )}

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
                      {user.email?.split("@")[0]}
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
                    onClick={() => setShowAuthModal(true)}
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

      <main className="max-w-6xl mx-auto px-4 py-8">

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

        {/* 公告区域 */}
        {showAnnouncement && announcements.length > 0 && (
          <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-none p-4 relative">
            <button
              onClick={() => setShowAnnouncement(false)}
              className="absolute top-2 right-2 text-amber-400 hover:text-amber-600 dark:text-amber-500 dark:hover:text-amber-400 transition-colors"
            >
              <X size={16} />
            </button>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-none text-amber-600 dark:text-amber-400">
                <Bell size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-amber-800 dark:text-amber-300 mb-1">{announcements[0].title}</h3>
                <p className="text-sm text-amber-700 dark:text-amber-400/80 whitespace-pre-wrap">{announcements[0].content}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'summary' ? (
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
                    onClick={() => setShowAuthModal(true)}
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

            {activeTab === 'dashboard' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
            {/* 左列：保底机制分析 */}
            <div className="md:col-span-1 space-y-6">
              <PityAnalysisCard />
              
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
                     colorClass="bg-orange-500" 
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
                          contentStyle={{ backgroundColor: '#09090b', border: '1px solid #333', color: '#fff', borderRadius: '0px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{color: '#a1a1aa', fontSize: '12px'}}/>
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-fade-in relative">
             <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-950 sticky top-0 z-10">
               <div className="flex items-center gap-4">
                  <h3 className="font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                    <History size={18} /> 详细日志
                  </h3>
                  <span className="text-xs px-2 py-1 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-endfield-yellow rounded-none">
                    {pools.find(p => p.id === currentPoolId)?.name}
                  </span>
               </div>
               
               <div className="flex gap-2">
                 {/* 导入按钮 - 仅管理员可见 */}
                 {canEdit && (
                   <>
                     <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 px-3 py-1.5 rounded-none flex items-center gap-2 transition-colors shadow-sm"
                     >
                       <Upload size={14} />
                       导入
                     </button>
                     <input
                       type="file"
                       ref={fileInputRef}
                       onChange={handleImportFile}
                       className="hidden"
                       accept=".json"
                     />
                   </>
                 )}

                 {/* 导出菜单 */}
                 <div className="relative">
                   <button 
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="text-xs bg-slate-800 text-white hover:bg-slate-700 px-3 py-1.5 rounded-none flex items-center gap-2 transition-colors shadow-sm"
                   >
                     <Download size={14} /> 
                     导出...
                   </button>
                   
                   {showExportMenu && (
                     <>
                       <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>
                       <div className="absolute top-full right-0 mt-2 w-40 bg-white dark:bg-zinc-900 rounded-none shadow-xl border border-zinc-100 dark:border-zinc-800 z-20 py-2 animate-fade-in overflow-hidden">
                         <div className="px-3 py-2 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider bg-slate-50 dark:bg-zinc-950">JSON 备份</div>
                         <button onClick={() => handleExportJSON('all')} className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:bg-yellow-50 dark:bg-yellow-900/20 hover:text-yellow-600 dark:text-endfield-yellow flex items-center justify-between">
                           全部卡池 <FileJson size={14}/>
                         </button>
                         <button onClick={() => handleExportJSON('current')} className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:bg-yellow-50 dark:bg-yellow-900/20 hover:text-yellow-600 dark:text-endfield-yellow flex items-center justify-between">
                           当前卡池 <FileJson size={14}/>
                         </button>
                         
                         <div className="border-t border-zinc-100 dark:border-zinc-800 my-1"></div>
                         
                         <div className="px-3 py-2 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider bg-slate-50 dark:bg-zinc-950">CSV 表格</div>
                         <button onClick={() => handleExportCSV('all')} className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:bg-green-50 hover:text-green-600 flex items-center justify-between">
                           全部卡池 <FileJson size={14}/>
                         </button>
                         <button onClick={() => handleExportCSV('current')} className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:bg-green-50 hover:text-green-600 flex items-center justify-between">
                           当前卡池 <FileJson size={14}/>
                         </button>
                       </div>
                     </>
                   )}
                 </div>
               </div>
             </div>
             
             <div className="max-h-[800px] overflow-y-auto bg-slate-50 dark:bg-zinc-950/50">
               {groupedHistory.length === 0 ? (
                 <div className="p-12 text-center text-slate-400 dark:text-zinc-500">当前卡池暂无记录</div>
               ) : (
                 <div className="divide-y divide-slate-100">
                   {groupedHistory.slice(0, visibleHistoryCount).map((group, idx) => (
                     <BatchCard
                       key={idx}
                       group={group}
                       onEdit={setEditItemState}
                       onDeleteGroup={handleDeleteGroup}
                       poolType={currentPool.type}
                       canEdit={canEditCurrentPool}
                     />
                   ))}
                   
                   {visibleHistoryCount < groupedHistory.length && (
                     <div className="p-4 flex justify-center">
                       <button 
                         onClick={() => setVisibleHistoryCount(prev => prev + 20)}
                         className="text-sm text-slate-500 dark:text-zinc-500 hover:text-yellow-600 dark:text-endfield-yellow font-medium px-6 py-2 rounded-sm border border-zinc-200 dark:border-zinc-800 hover:border-yellow-200 dark:border-yellow-800 bg-white dark:bg-zinc-900 hover:bg-yellow-50 dark:bg-yellow-900/20 transition-all shadow-sm"
                       >
                         加载更多历史记录 ({groupedHistory.length - visibleHistoryCount} 条剩余)
                       </button>
                     </div>
                   )}
                 </div>
               )}
             </div>

             {/* 编辑弹窗 */}
             {editItemState && (
               <EditItemModal 
                 item={editItemState} 
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

      {/* --- 全局弹窗 --- */}
      {(modalState.type === 'createPool' || modalState.type === 'editPool') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex justify-between items-center">
              <h3 className="font-bold text-slate-700 dark:text-zinc-300">{modalState.type === 'createPool' ? '创建新卡池' : '编辑卡池'}</h3>
              <button onClick={closeModal} className="text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:text-zinc-400 transition-colors">
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
                  {newPoolTypeInput === 'weapon' && '6星40抽保底，首轮80抽必出限定。赠送：100(常)->180(限)->+80交替。'}
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex gap-3 justify-end">
              <button 
                onClick={closeModal}
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
                onClick={closeModal}
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
                onClick={closeModal}
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
                onClick={closeModal}
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
        onClose={() => setShowAuthModal(false)}
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