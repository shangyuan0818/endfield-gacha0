import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, Save, X, Calendar, Link as LinkIcon, Star, Layers, Swords, Database, RefreshCw, RotateCw, Users, AlertTriangle, UserPlus, CheckCircle, Lock, Unlock, ArrowUpDown, Filter, CheckSquare, Square } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { incrementRotationCount, characterCache, getPoolCharacters } from '../../utils/characterUtils';
import DateTimePicker from '../common/DateTimePicker';

/**
 * 卡池管理界面
 * 超级管理员专用，用于管理所有卡池的 CRUD 操作
 */
const PoolManagement = ({ showToast }) => {
  // 数据状态
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // 角色数据状态（用于显示轮换状态）
  const [characters, setCharacters] = useState([]);

  // 池子-角色关联数据（每个池子独立的角色列表）
  const [poolCharacters, setPoolCharacters] = useState({});  // { pool_id: [character_ids] }
  const [editingPoolCharacters, setEditingPoolCharacters] = useState([]);  // 当前编辑池子的角色列表

  // 搜索和筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortField, setSortField] = useState('created_at'); // 'created_at' | 'start_time' | 'end_time' | 'name'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'

  // 编辑对话框状态
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPool, setEditingPool] = useState(null);
  const [poolForm, setPoolForm] = useState({
    name: '',
    type: 'limited',
    up_character: '',
    banner_url: '',
    description: '',
    start_time: '',
    end_time: '',
    is_limited_weapon: true,
    locked: false
  });

  // 自动轮换检测状态
  const [pendingRotationPools, setPendingRotationPools] = useState([]);
  const [autoRotationProcessing, setAutoRotationProcessing] = useState(false);

  // 加载卡池列表
  useEffect(() => {
    loadPools();
    loadCharacters();
    loadAllPoolCharacters();
  }, []);

  // 检测需要自动轮换的卡池（已结束但未处理轮换的限定池）
  useEffect(() => {
    if (pools.length > 0 && characters.length > 0) {
      checkPendingRotations();
    }
  }, [pools, characters]);

  const loadPools = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pools')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPools(data || []);
    } catch (error) {
      showToast('加载卡池失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 加载角色列表（用于轮换管理和卡池角色编辑）
  const loadCharacters = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('id, name, rarity, type, is_limited, pool_config')
        .order('rarity', { ascending: false });

      if (error) throw error;
      setCharacters(data || []);
    } catch (error) {
      console.warn('加载角色数据失败:', error);
    }
  };

  // 加载所有池子的角色关联数据
  const loadAllPoolCharacters = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('pool_characters')
        .select('pool_id, character_id, is_up');

      if (error) throw error;

      // 按 pool_id 分组
      const grouped = {};
      (data || []).forEach(pc => {
        if (!grouped[pc.pool_id]) {
          grouped[pc.pool_id] = [];
        }
        grouped[pc.pool_id].push({ character_id: pc.character_id, is_up: pc.is_up });
      });
      setPoolCharacters(grouped);
    } catch (error) {
      console.warn('加载池子角色关联失败:', error);
    }
  };

  // 加载特定池子的角色列表（用于编辑）
  const loadPoolCharactersForEdit = async (poolId) => {
    if (!supabase || !poolId) return;
    try {
      const { data, error } = await supabase
        .from('pool_characters')
        .select('character_id, is_up')
        .eq('pool_id', poolId);

      if (error) throw error;
      setEditingPoolCharacters(data || []);
    } catch (error) {
      console.warn('加载池子角色失败:', error);
      setEditingPoolCharacters([]);
    }
  };

  // 添加角色到池子
  const addCharacterToPool = async (poolId, characterId, isUp = false) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('pool_characters')
        .insert({ pool_id: poolId, character_id: characterId, is_up: isUp });

      if (error) throw error;
      return true;
    } catch (error) {
      if (error.code === '23505') {
        // 重复插入，忽略
        return true;
      }
      throw error;
    }
  };

  // 从池子移除角色
  const removeCharacterFromPool = async (poolId, characterId) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('pool_characters')
        .delete()
        .eq('pool_id', poolId)
        .eq('character_id', characterId);

      if (error) throw error;
      return true;
    } catch (error) {
      throw error;
    }
  };

  // 检查是否有需要处理轮换的卡池（已结束但未处理）
  const checkPendingRotations = () => {
    const now = new Date();
    const pending = pools.filter(pool => {
      // 只检查限定池
      if (pool.type !== 'limited' && pool.type !== 'limited_character') return false;
      // 必须有结束时间
      if (!pool.end_time) return false;
      // 结束时间已过
      if (new Date(pool.end_time) >= now) return false;
      // 尚未处理轮换
      if (pool.rotation_processed) return false;
      return true;
    });

    // 按结束时间排序（先结束的先处理）
    pending.sort((a, b) => new Date(a.end_time) - new Date(b.end_time));
    setPendingRotationPools(pending);

    if (pending.length > 0) {
      console.log(`[PoolManagement] 发现 ${pending.length} 个已结束但未处理轮换的卡池:`,
        pending.map(p => `${p.name} (结束于 ${new Date(p.end_time).toLocaleString()})`));
    }
  };

  // 自动处理所有待轮换的卡池（无需确认，直接执行）
  const processAllPendingRotations = async () => {
    if (pendingRotationPools.length === 0) return;

    const limitedChars = getLimitedSixStarCharacters;
    if (limitedChars.length === 0) {
      showToast('没有找到限定池6星角色', 'error');
      return;
    }

    const totalRotations = pendingRotationPools.length;
    setAutoRotationProcessing(true);

    try {
      // 逐个处理每个待轮换的卡池
      for (const pool of pendingRotationPools) {
        console.log(`[PoolManagement] 处理卡池轮换: ${pool.name}`);

        // 为所有限定池6星角色增加轮换次数
        for (const char of limitedChars) {
          await incrementRotationCount(char.id);
        }

        // 标记该卡池轮换已处理
        await supabase
          .from('pools')
          .update({ rotation_processed: true })
          .eq('pool_id', pool.pool_id);
      }

      // 刷新数据
      await loadPools();
      await loadCharacters();
      await characterCache.refresh();

      showToast(`已处理 ${totalRotations} 个卡池的轮换，共 ${limitedChars.length} 个角色各增加 ${totalRotations} 次轮换`, 'success');
    } catch (error) {
      showToast('自动轮换处理失败: ' + error.message, 'error');
    } finally {
      setAutoRotationProcessing(false);
    }
  };

  // 获取限定池相关的6星角色（用于轮换）
  const getLimitedSixStarCharacters = useMemo(() => {
    return characters.filter(char =>
      char.rarity === 6 &&
      char.pool_config?.pools?.includes('limited')
    );
  }, [characters]);

  // 开启轮换 - 增加所有限定池6星角色的轮换次数（包括当前UP角色）
  // 注意：轮换从角色自己的UP池就开始计数，所以UP角色也要+1
  // 无需确认，直接执行
  const handleStartRotation = async (pool) => {
    if (!supabase) return;

    const limitedChars = getLimitedSixStarCharacters;
    if (limitedChars.length === 0) {
      showToast('没有找到限定池6星角色', 'error');
      return;
    }

    setActionLoading(`rotation_${pool.pool_id}`);

    try {
      // 逐个增加轮换次数（包括UP角色）
      for (const char of limitedChars) {
        await incrementRotationCount(char.id);
      }

      // 标记该卡池轮换已处理
      await supabase
        .from('pools')
        .update({ rotation_processed: true })
        .eq('pool_id', pool.pool_id);

      // 刷新数据
      await loadPools();
      await loadCharacters();
      await characterCache.refresh();

      showToast(`已为 ${limitedChars.length} 个角色增加轮换次数`, 'success');
    } catch (error) {
      showToast('轮换失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 获取指定卡池类型的角色列表
  const getCharactersForPool = (poolType, rarity = null) => {
    return characters.filter(char => {
      const pools = char.pool_config?.pools || [];
      if (!pools.includes(poolType)) return false;
      if (rarity !== null && char.rarity !== rarity) return false;
      return true;
    });
  };

  // 检查UP角色是否存在于数据库中
  const checkUpCharacterExists = (upCharacterName) => {
    if (!upCharacterName || !upCharacterName.trim()) return true;
    return characters.some(c => c.name === upCharacterName.trim());
  };

  // 过滤并排序后的卡池列表
  const filteredPools = useMemo(() => {
    let result = pools.filter(pool => {
      const matchesSearch = pool.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           pool.up_character?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || pool.type === typeFilter;
      return matchesSearch && matchesType;
    });
    
    // 排序
    result.sort((a, b) => {
      let aVal, bVal;
      switch (sortField) {
        case 'start_time':
          aVal = a.start_time ? new Date(a.start_time).getTime() : 0;
          bVal = b.start_time ? new Date(b.start_time).getTime() : 0;
          break;
        case 'end_time':
          aVal = a.end_time ? new Date(a.end_time).getTime() : 0;
          bVal = b.end_time ? new Date(b.end_time).getTime() : 0;
          break;
        case 'name':
          aVal = a.name || '';
          bVal = b.name || '';
          return sortOrder === 'asc' 
            ? aVal.localeCompare(bVal, 'zh-CN') 
            : bVal.localeCompare(aVal, 'zh-CN');
        default: // created_at
          aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
          bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
    
    return result;
  }, [pools, searchQuery, typeFilter, sortField, sortOrder]);

  // 重置表单
  const resetForm = () => {
    setPoolForm({
      name: '',
      type: 'limited',
      up_character: '',
      banner_url: '',
      description: '',
      start_time: '',
      end_time: '',
      is_limited_weapon: true,
      locked: false
    });
    setEditingPool(null);
    setEditingPoolCharacters([]);
    setShowEditDialog(false);
  };

  // 开始编辑
  const startEdit = async (pool) => {
    // 将UTC时间转换为本地时间字符串（用于datetime-local输入框）
    const formatDateTimeLocal = (utcDateString) => {
      if (!utcDateString) return '';
      const date = new Date(utcDateString);
      // 获取本地时间的年月日时分
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    // 加载该池子的角色列表
    await loadPoolCharactersForEdit(pool.pool_id);

    setPoolForm({
      name: pool.name || '',
      type: pool.type || 'limited',
      up_character: pool.up_character || '',
      banner_url: pool.banner_url || '',
      description: pool.description || '',
      start_time: formatDateTimeLocal(pool.start_time),
      end_time: formatDateTimeLocal(pool.end_time),
      is_limited_weapon: pool.is_limited_weapon !== false,
      locked: pool.locked || false
    });
    setEditingPool(pool);
    setShowEditDialog(true);
  };

  // 创建新的UP角色
  // 新逻辑：角色只出现在自己UP池+后续2个轮换池（共3个池）
  const createUpCharacter = async (characterName, poolType, poolStartTime) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('请先登录');

    // 生成角色ID
    const charId = `char_${characterName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;

    // 根据卡池类型确定角色类型
    const characterType = poolType === 'weapon' ? 'weapon' : 'character';

    // 计算当前已处理轮换的池子数量（用于设置初始轮换次数）
    // 这样新角色就不会出现在之前的池子中
    const processedPoolsCount = pools.filter(p => 
      (p.type === 'limited' || p.type === 'limited_character') && 
      p.rotation_processed === true
    ).length;

    // 新角色配置
    // introduced_at: 记录角色首次出现的时间，用于判断是否应该在某个池子中显示
    // limited_rotation_count: 设置为当前已处理的轮换数，这样在之前的池子中 count >= removes_after
    const newCharacter = {
      id: charId,
      name: characterName,
      rarity: 6, // UP角色通常是6星
      type: characterType,
      is_limited: poolType === 'limited' || poolType === 'weapon',
      aliases: [],
      avatar_url: null,
      pool_config: {
        pools: [poolType],
        limited_rotation_count: processedPoolsCount, // 从当前轮换数开始
        removes_after: processedPoolsCount + 3, // 在后面3个池子内有效
        is_active_in_limited: true,
        introduced_at: poolStartTime || new Date().toISOString() // 记录引入时间
      }
    };

    const { data, error } = await supabase
      .from('characters')
      .insert(newCharacter)
      .select()
      .single();

    if (error) throw error;

    console.log('[PoolManagement] 自动创建UP角色:', data, '当前轮换数:', processedPoolsCount);
    return data;
  };

  // 保存卡池
  const savePool = async () => {
    if (!supabase) return;

    // 验证必填字段
    if (!poolForm.name.trim()) {
      showToast('卡池名称不能为空', 'error');
      return;
    }

    setActionLoading('save');

    try {
      // 获取当前用户
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast('请先登录', 'error');
        return;
      }

      const upCharacterName = poolForm.up_character.trim();

      // 检查UP角色是否存在
      if (upCharacterName && (poolForm.type === 'limited' || poolForm.type === 'weapon')) {
        const upExists = checkUpCharacterExists(upCharacterName);

        if (!upExists) {
          // 计算当前已处理的轮换数，用于显示
          const processedCount = pools.filter(p => 
            (p.type === 'limited' || p.type === 'limited_character') && 
            p.rotation_processed === true
          ).length;

          // UP角色不存在，直接自动创建（无需确认）
          try {
            const poolStartTime = poolForm.start_time ? new Date(poolForm.start_time).toISOString() : new Date().toISOString();
            await createUpCharacter(upCharacterName, poolForm.type, poolStartTime);
            showToast(`已自动创建UP角色「${upCharacterName}」（轮换起始: ${processedCount}，3池后移出）`, 'success');
            // 刷新角色数据
            await loadCharacters();
            await characterCache.refresh();
          } catch (createError) {
            showToast('创建UP角色失败: ' + createError.message, 'error');
            setActionLoading(null);
            return;
          }
        }
      }

      const poolData = {
        name: poolForm.name.trim(),
        type: poolForm.type,
        up_character: upCharacterName || null,
        banner_url: poolForm.banner_url.trim() || null,
        description: poolForm.description.trim() || null,
        start_time: poolForm.start_time ? new Date(poolForm.start_time).toISOString() : null,
        end_time: poolForm.end_time ? new Date(poolForm.end_time).toISOString() : null,
        is_limited_weapon: poolForm.type === 'weapon' ? poolForm.is_limited_weapon : null,
        locked: poolForm.locked
      };

      if (editingPool) {
        // 更新现有卡池
        const { error } = await supabase
          .from('pools')
          .update(poolData)
          .eq('pool_id', editingPool.pool_id);

        if (error) throw error;
        showToast('卡池已更新', 'success');
      } else {
        // 创建新卡池 - 需要添加 user_id 和生成 pool_id
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const pool_id = `pool_${user.id.substring(0, 8)}_${poolForm.type}_${timestamp}_${randomStr}`;

        const newPoolData = {
          ...poolData,
          user_id: user.id,
          pool_id: pool_id,
          locked: false // 默认不锁定
        };

        const { error } = await supabase
          .from('pools')
          .insert(newPoolData);

        if (error) throw error;

        // 新增卡池时自动添加所有对应类型的角色
        const poolType = poolData.type === 'limited_character' ? 'limited' : poolData.type;
        const charsToAdd = characters.filter(c => 
          c.type === (poolType === 'weapon' ? 'weapon' : 'character')
        );
        
        for (const char of charsToAdd) {
          const isUp = char.name === upCharacterName;
          await addCharacterToPool(pool_id, char.id, isUp);
        }

        showToast(`卡池已创建，已自动添加 ${charsToAdd.length} 个角色`, 'success');
      }

      await loadPools();
      await loadAllPoolCharacters();
      resetForm();
    } catch (error) {
      showToast('保存失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 删除卡池
  const deletePool = async (pool) => {
    if (!supabase) return;

    if (!window.confirm(`确定要删除卡池「${pool.name}」吗？此操作将删除该卡池的所有相关数据，且无法撤销。`)) {
      return;
    }

    setActionLoading(pool.pool_id);

    try {
      const { error } = await supabase
        .from('pools')
        .delete()
        .eq('pool_id', pool.pool_id);

      if (error) throw error;

      showToast('卡池已删除', 'success');
      await loadPools();
    } catch (error) {
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 获取类型图标
  const getTypeIcon = (type) => {
    switch (type) {
      case 'limited':
      case 'limited_character':
        return <Star size={14} className="text-orange-500" />;
      case 'weapon':
      case 'limited_weapon':
        return <Swords size={14} className="text-slate-500 dark:text-zinc-400" />;
      default:
        return <Layers size={14} className="text-yellow-600 dark:text-endfield-yellow" />;
    }
  };

  // 获取类型标签
  const getTypeLabel = (type) => {
    switch (type) {
      case 'limited':
      case 'limited_character':
        return '限定角色';
      case 'weapon':
      case 'limited_weapon':
        return '限定武器';
      default:
        return '常驻';
    }
  };

  // 获取类型颜色
  const getTypeColor = (type) => {
    switch (type) {
      case 'limited':
      case 'limited_character':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400';
      case 'weapon':
      case 'limited_weapon':
        return 'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400';
      default:
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-endfield-yellow';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索卡池名称或UP角色..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>
        
        {/* 类型筛选 */}
        <div className="flex items-center gap-1">
          <Filter size={14} className="text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
          >
            <option value="all">全部类型</option>
            <option value="limited">限定角色</option>
            <option value="weapon">限定武器</option>
            <option value="standard">常驻</option>
          </select>
        </div>
        
        {/* 排序 */}
        <div className="flex items-center gap-1">
          <ArrowUpDown size={14} className="text-slate-400" />
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
            className="px-2 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
          >
            <option value="created_at">创建时间</option>
            <option value="start_time">开始时间</option>
            <option value="end_time">结束时间</option>
            <option value="name">名称</option>
          </select>
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className={`px-2 py-2 text-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800`}
            title={sortOrder === 'asc' ? '升序' : '降序'}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
        
        <button
          onClick={() => setShowEditDialog(true)}
          className="flex items-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-none transition-colors"
        >
          <Plus size={16} />
          新增卡池
        </button>
      </div>

      {/* 自动轮换提示横幅 */}
      {pendingRotationPools.length > 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-amber-700 dark:text-amber-400 mb-1">
                🔄 检测到 {pendingRotationPools.length} 个已结束的卡池需要处理轮换
              </h4>
              <p className="text-sm text-amber-600 dark:text-amber-500 mb-2">
                以下卡池已结束但尚未处理角色轮换计数：
              </p>
              <ul className="text-sm text-amber-600 dark:text-amber-500 mb-3 space-y-1">
                {pendingRotationPools.slice(0, 3).map(pool => (
                  <li key={pool.pool_id} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    <span className="font-medium">{pool.name}</span>
                    <span className="text-xs opacity-70">
                      (结束于 {new Date(pool.end_time).toLocaleString('zh-CN')})
                    </span>
                  </li>
                ))}
                {pendingRotationPools.length > 3 && (
                  <li className="text-xs opacity-70">
                    ... 还有 {pendingRotationPools.length - 3} 个卡池
                  </li>
                )}
              </ul>
              <button
                onClick={processAllPendingRotations}
                disabled={autoRotationProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded transition-colors disabled:opacity-50"
              >
                <RefreshCw size={16} className={autoRotationProcessing ? 'animate-spin' : ''} />
                {autoRotationProcessing ? '处理中...' : `立即处理所有轮换 (+${pendingRotationPools.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 统计信息 */}
      <div className="text-xs text-slate-500 dark:text-zinc-500">
        显示 {filteredPools.length} / {pools.length} 个卡池
      </div>

      {/* 卡池列表 */}
      {filteredPools.length === 0 ? (
        <div className="p-12 text-center text-slate-400 dark:text-zinc-500">
          <Database size={48} className="mx-auto mb-4 opacity-50" />
          <p>{pools.length === 0 ? '暂无卡池' : '未找到匹配的卡池'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredPools.map(pool => (
            <div
              key={pool.pool_id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              {/* Banner 图片 */}
              {pool.banner_url && (
                <div className="relative w-full h-24 overflow-hidden">
                  <img
                    src={pool.banner_url}
                    alt={pool.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                </div>
              )}

              {/* 卡池信息 */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getTypeIcon(pool.type)}
                      <h4 className="font-bold text-slate-700 dark:text-zinc-300 truncate">
                        {pool.name}
                      </h4>
                      {pool.locked && (
                        <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded">
                          已锁定
                        </span>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${getTypeColor(pool.type)}`}>
                      {getTypeLabel(pool.type)}
                    </span>
                  </div>
                </div>

                {/* UP 角色 */}
                {pool.up_character && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-slate-600 dark:text-zinc-400">
                    <Star size={12} className="text-orange-500" />
                    UP: {pool.up_character}
                  </div>
                )}

                {/* 描述 */}
                {pool.description && (
                  <p className="text-xs text-slate-500 dark:text-zinc-500 mt-2 line-clamp-2">
                    {pool.description}
                  </p>
                )}

                {/* 时间范围 */}
                {(pool.start_time || pool.end_time) && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-400 dark:text-zinc-600">
                    <Calendar size={12} />
                    {pool.start_time && new Date(pool.start_time).toLocaleDateString()}
                    {pool.start_time && pool.end_time && ' - '}
                    {pool.end_time && new Date(pool.end_time).toLocaleDateString()}
                  </div>
                )}

                {/* 卡池角色一览（使用 pool_characters 关联表） */}
                <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-600 dark:text-zinc-400 flex items-center gap-1">
                      <Users size={12} />
                      卡池角色一览
                    </span>
                  </div>
                  {(() => {
                    // 获取该池子的角色ID列表
                    const poolCharIds = (poolCharacters[pool.pool_id] || []).map(pc => pc.character_id);
                    // 根据ID获取完整角色信息
                    const poolChars = characters.filter(c => poolCharIds.includes(c.id));
                    
                    // 6星角色排序：当期UP -> 其他限定6星 -> 常驻6星
                    const sixStars = poolChars.filter(c => c.rarity === 6).sort((a, b) => {
                      const aIsUp = a.name === pool.up_character;
                      const bIsUp = b.name === pool.up_character;
                      if (aIsUp && !bIsUp) return -1;
                      if (!aIsUp && bIsUp) return 1;
                      // 都不是UP，限定排在常驻前面
                      const aIsLimited = a.is_limited;
                      const bIsLimited = b.is_limited;
                      if (aIsLimited && !bIsLimited) return -1;
                      if (!aIsLimited && bIsLimited) return 1;
                      return a.name.localeCompare(b.name, 'zh-CN');
                    });
                    
                    const fiveStars = poolChars.filter(c => c.rarity === 5);
                    const fourStars = poolChars.filter(c => c.rarity === 4);

                    return (
                      <div className="space-y-1.5">
                        {/* 6星（排序：UP -> 限定 -> 常驻） */}
                        {sixStars.length > 0 && (
                          <div className="flex items-start gap-1">
                            <span className="text-xs text-orange-500 font-medium shrink-0 w-8">6★</span>
                            <div className="flex flex-wrap gap-1">
                              {sixStars.slice(0, 6).map(char => {
                                const isUp = char.name === pool.up_character;
                                const isLimited = char.is_limited;
                                return (
                                  <span
                                    key={char.id}
                                    className={`text-xs px-1.5 py-0.5 rounded ${
                                      isUp
                                        ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300 font-bold ring-1 ring-orange-400'
                                        : isLimited
                                          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                                          : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                                    }`}
                                    title={`${char.name}${isUp ? ' [当期UP]' : isLimited ? ' [限定]' : ' [常驻]'}`}
                                  >
                                    {isUp && '★'}{char.name.length > 4 ? char.name.slice(0, 4) + '...' : char.name}
                                  </span>
                                );
                              })}
                              {sixStars.length > 6 && (
                                <span className="text-xs text-slate-400">+{sixStars.length - 6}</span>
                              )}
                            </div>
                          </div>
                        )}
                        {/* 5星 */}
                        {fiveStars.length > 0 && (
                          <div className="flex items-start gap-1">
                            <span className="text-xs text-purple-500 font-medium shrink-0 w-8">5★</span>
                            <div className="flex flex-wrap gap-1">
                              {fiveStars.slice(0, 4).map(char => (
                                <span
                                  key={char.id}
                                  className="text-xs px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
                                >
                                  {char.name.length > 4 ? char.name.slice(0, 4) + '...' : char.name}
                                </span>
                              ))}
                              {fiveStars.length > 4 && (
                                <span className="text-xs text-slate-400">+{fiveStars.length - 4}</span>
                              )}
                            </div>
                          </div>
                        )}
                        {/* 4星 */}
                        {fourStars.length > 0 && (
                          <div className="flex items-start gap-1">
                            <span className="text-xs text-blue-500 font-medium shrink-0 w-8">4★</span>
                            <span className="text-xs text-slate-400 dark:text-zinc-500">
                              共 {fourStars.length} 个
                            </span>
                          </div>
                        )}
                        {/* 空状态 */}
                        {poolChars.length === 0 && (
                          <p className="text-xs text-slate-400 dark:text-zinc-500 italic">
                            暂无角色配置，点击编辑来添加
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* 轮换状态（仅限限定池） */}
                {(pool.type === 'limited' || pool.type === 'limited_character') && (
                  <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-600 dark:text-zinc-400 flex items-center gap-1">
                        <RotateCw size={12} />
                        6★ 轮换状态
                        <span className="text-slate-400 dark:text-zinc-500 font-normal">（从自己UP池开始计数）</span>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {getLimitedSixStarCharacters
                        .slice(0, 6)
                        .map(char => {
                          const rotationCount = char.pool_config?.limited_rotation_count || 0;
                          const removesAfter = char.pool_config?.removes_after;
                          const isRemoved = removesAfter !== null && removesAfter !== undefined && rotationCount >= removesAfter;
                          const isCurrentUp = char.name === pool.up_character;

                          return (
                            <span
                              key={char.id}
                              title={`${char.name}: ${rotationCount}/${removesAfter ?? '∞'} 次轮换${isRemoved ? ' (已移出)' : ''}${isCurrentUp ? ' [当前UP]' : ''}`}
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                isRemoved
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 line-through'
                                  : isCurrentUp
                                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-bold'
                                    : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                              }`}
                            >
                              {isCurrentUp && '★'}{char.name.length > 4 ? char.name.slice(0, 4) + '...' : char.name}
                              <span className="opacity-70 ml-0.5">{rotationCount}/{removesAfter ?? '∞'}</span>
                            </span>
                          );
                        })}
                      {getLimitedSixStarCharacters.length > 6 && (
                        <span className="text-xs text-slate-400 dark:text-zinc-500">
                          +{getLimitedSixStarCharacters.length - 6}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 操作按钮 */}
                <div className={`flex items-center gap-2 ${(pool.type !== 'limited' && pool.type !== 'limited_character') ? 'mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800' : ''}`}>
                  {/* 轮换状态和按钮（仅限限定池） */}
                  {(pool.type === 'limited' || pool.type === 'limited_character') && (
                    <>
                      {pool.rotation_processed ? (
                        <span className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-none">
                          <CheckCircle size={12} />
                          轮换已处理
                        </span>
                      ) : pool.end_time && new Date(pool.end_time) < new Date() ? (
                        <button
                          onClick={() => handleStartRotation(pool)}
                          disabled={actionLoading === `rotation_${pool.pool_id}`}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-none transition-colors disabled:opacity-50 animate-pulse"
                          title="此卡池已结束，请处理轮换"
                        >
                          <AlertTriangle size={12} />
                          {actionLoading === `rotation_${pool.pool_id}` ? '处理中...' : '待处理轮换'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartRotation(pool)}
                          disabled={actionLoading === `rotation_${pool.pool_id}`}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-none transition-colors disabled:opacity-50"
                          title="手动开启轮换（卡池结束后会自动提示）"
                        >
                          <RefreshCw size={12} className={actionLoading === `rotation_${pool.pool_id}` ? 'animate-spin' : ''} />
                          {actionLoading === `rotation_${pool.pool_id}` ? '轮换中...' : '手动轮换'}
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => startEdit(pool)}
                    disabled={actionLoading === pool.pool_id}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-none transition-colors disabled:opacity-50"
                  >
                    <Edit2 size={12} />
                    编辑
                  </button>
                  <button
                    onClick={() => deletePool(pool)}
                    disabled={actionLoading === pool.pool_id || pool.locked}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-none transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                    {actionLoading === pool.pool_id ? '删除中...' : '删除'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑对话框 - 重写版 */}
      {showEditDialog && (
        <>
          {/* 背景遮罩 */}
          <div className="fixed inset-0 bg-black/50 z-40" onClick={resetForm}></div>

          {/* 对话框 - 更宽以容纳角色管理 */}
          <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-4xl md:max-h-[90vh] z-50">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 h-full md:h-auto max-h-full overflow-hidden flex flex-col">
              {/* 对话框标题 */}
              <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                <h3 className="text-lg font-bold text-slate-700 dark:text-zinc-300">
                  {editingPool ? '编辑卡池' : '新增卡池'}
                </h3>
                <button
                  onClick={resetForm}
                  className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                >
                  <X size={20} />
                </button>
              </div>

              {/* 表单内容 - 可滚动 */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 左栏：基本信息 */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-600 dark:text-zinc-400 text-sm border-b border-zinc-200 dark:border-zinc-700 pb-2">
                      基本信息
                    </h4>

                    {/* 卡池名称 */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                        卡池名称 *
                      </label>
                      <input
                        type="text"
                        value={poolForm.name}
                        onChange={(e) => setPoolForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="例如：终末序曲 - 莱万汀UP"
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                      />
                    </div>

                    {/* 卡池类型 */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                        卡池类型 *
                      </label>
                      <select
                        value={poolForm.type}
                        onChange={(e) => setPoolForm(prev => ({ ...prev, type: e.target.value }))}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                      >
                        <option value="limited">限定角色池</option>
                        <option value="weapon">限定武器池</option>
                        <option value="standard">常驻池</option>
                      </select>
                    </div>

                    {/* 武器池特殊选项 */}
                    {poolForm.type === 'weapon' && (
                      <div>
                        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300">
                          <input
                            type="checkbox"
                            checked={poolForm.is_limited_weapon}
                            onChange={(e) => setPoolForm(prev => ({ ...prev, is_limited_weapon: e.target.checked }))}
                            className="w-4 h-4"
                          />
                          是否为限定武器池（影响赠送规则）
                        </label>
                      </div>
                    )}

                    {/* UP 角色 */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                        UP 角色/武器名称
                      </label>
                      <input
                        type="text"
                        value={poolForm.up_character}
                        onChange={(e) => setPoolForm(prev => ({ ...prev, up_character: e.target.value }))}
                        placeholder="例如：莱万汀"
                        className={`w-full px-3 py-2 border rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 ${
                          poolForm.up_character.trim() && !checkUpCharacterExists(poolForm.up_character)
                            ? 'border-amber-400 dark:border-amber-600'
                            : 'border-zinc-300 dark:border-zinc-700'
                        }`}
                      />
                      {/* UP角色不存在警告 */}
                      {poolForm.up_character.trim() && !checkUpCharacterExists(poolForm.up_character) && (
                        <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs">
                          <div className="flex items-start gap-2">
                            <UserPlus size={14} className="text-amber-500 shrink-0 mt-0.5" />
                            <div className="text-amber-700 dark:text-amber-400">
                              <p className="font-medium">将自动创建新角色「{poolForm.up_character.trim()}」</p>
                              <p className="mt-0.5 opacity-80">6星 · {poolForm.type === 'weapon' ? '武器' : '角色'} · 3次轮换后移出</p>
                            </div>
                          </div>
                        </div>
                      )}
                      {poolForm.up_character.trim() && checkUpCharacterExists(poolForm.up_character) && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle size={12} />
                          角色已存在
                        </div>
                      )}
                    </div>

                    {/* 时间范围 */}
                    <div className="grid grid-cols-2 gap-3">
                      <DateTimePicker
                        label="开始时间"
                        value={poolForm.start_time}
                        onChange={(val) => setPoolForm(prev => ({ ...prev, start_time: val }))}
                        placeholder="选择开始时间"
                      />
                      <DateTimePicker
                        label="结束时间"
                        value={poolForm.end_time}
                        onChange={(val) => setPoolForm(prev => ({ ...prev, end_time: val }))}
                        placeholder="选择结束时间"
                        minDate={poolForm.start_time}
                      />
                    </div>
                    
                    {/* 锁定状态 */}
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={poolForm.locked}
                            onChange={(e) => setPoolForm(prev => ({ ...prev, locked: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-5 bg-zinc-300 dark:bg-zinc-600 rounded-full peer peer-checked:bg-amber-500 transition-colors"></div>
                          <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
                        </div>
                        <div className="flex items-center gap-2">
                          {poolForm.locked ? (
                            <Lock size={16} className="text-amber-500" />
                          ) : (
                            <Unlock size={16} className="text-slate-400" />
                          )}
                          <span className="text-sm text-slate-700 dark:text-zinc-300">
                            {poolForm.locked ? '卡池已锁定' : '卡池未锁定'}
                          </span>
                        </div>
                      </label>
                      <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500 ml-[52px]">
                        锁定后用户无法删除此卡池的抽卡记录
                      </p>
                    </div>

                    {/* Banner URL */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                        Banner 图片 URL
                      </label>
                      <input
                        type="text"
                        value={poolForm.banner_url}
                        onChange={(e) => setPoolForm(prev => ({ ...prev, banner_url: e.target.value }))}
                        placeholder="https://..."
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-sm"
                      />
                    </div>

                    {/* 描述 */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                        描述
                      </label>
                      <textarea
                        value={poolForm.description}
                        onChange={(e) => setPoolForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="卡池描述..."
                        rows={2}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 resize-none text-sm"
                      />
                    </div>
                  </div>

                  {/* 右栏：卡池角色管理 */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-600 dark:text-zinc-400 text-sm border-b border-zinc-200 dark:border-zinc-700 pb-2 flex items-center gap-2">
                      <Users size={14} />
                      卡池角色管理
                    </h4>

                    {/* 角色列表 - 按稀有度分组（使用独立的池子角色关联表） */}
                    {(() => {
                      const poolType = poolForm.type === 'limited_character' ? 'limited' : poolForm.type;
                      const allChars = characters.filter(c => c.type === (poolType === 'weapon' ? 'weapon' : 'character'));
                      const sixStars = allChars.filter(c => c.rarity === 6);
                      const fiveStars = allChars.filter(c => c.rarity === 5);
                      const fourStars = allChars.filter(c => c.rarity === 4);

                      // 判断角色是否在当前编辑的池子中（使用 pool_characters 表）
                      const isInPool = (char) => {
                        return editingPoolCharacters.some(pc => pc.character_id === char.id);
                      };

                      // 切换角色在当前池子中的状态（只影响当前池子）
                      const toggleCharacterInPool = async (char) => {
                        if (!editingPool?.pool_id) {
                          showToast('请先保存卡池后再管理角色', 'info');
                          return;
                        }

                        const inPool = isInPool(char);
                        const isUp = char.name === poolForm.up_character.trim();

                        try {
                          if (inPool) {
                            // 从当前池子移除
                            await removeCharacterFromPool(editingPool.pool_id, char.id);
                            setEditingPoolCharacters(prev => prev.filter(pc => pc.character_id !== char.id));
                          } else {
                            // 添加到当前池子
                            await addCharacterToPool(editingPool.pool_id, char.id, isUp);
                            setEditingPoolCharacters(prev => [...prev, { character_id: char.id, is_up: isUp }]);
                          }
                          // 刷新全局池子角色数据
                          await loadAllPoolCharacters();
                        } catch (error) {
                          showToast('更新失败: ' + error.message, 'error');
                        }
                      };

                      // 批量添加所有角色
                      const addAllCharacters = async (charList) => {
                        if (!editingPool?.pool_id) {
                          showToast('请先保存卡池后再管理角色', 'info');
                          return;
                        }
                        
                        const toAdd = charList.filter(c => !isInPool(c));
                        if (toAdd.length === 0) {
                          showToast('所有角色已在池中', 'info');
                          return;
                        }
                        
                        try {
                          for (const char of toAdd) {
                            const isUp = char.name === poolForm.up_character.trim();
                            await addCharacterToPool(editingPool.pool_id, char.id, isUp);
                          }
                          setEditingPoolCharacters(prev => [
                            ...prev,
                            ...toAdd.map(c => ({ character_id: c.id, is_up: c.name === poolForm.up_character.trim() }))
                          ]);
                          await loadAllPoolCharacters();
                          showToast(`已添加 ${toAdd.length} 个角色`, 'success');
                        } catch (error) {
                          showToast('批量添加失败: ' + error.message, 'error');
                        }
                      };

                      // 批量移除所有角色
                      const removeAllCharacters = async (charList) => {
                        if (!editingPool?.pool_id) return;
                        
                        const toRemove = charList.filter(c => isInPool(c));
                        if (toRemove.length === 0) {
                          showToast('没有角色需要移除', 'info');
                          return;
                        }
                        
                        try {
                          for (const char of toRemove) {
                            await removeCharacterFromPool(editingPool.pool_id, char.id);
                          }
                          const removeIds = toRemove.map(c => c.id);
                          setEditingPoolCharacters(prev => prev.filter(pc => !removeIds.includes(pc.character_id)));
                          await loadAllPoolCharacters();
                          showToast(`已移除 ${toRemove.length} 个角色`, 'success');
                        } catch (error) {
                          showToast('批量移除失败: ' + error.message, 'error');
                        }
                      };

                      // 渲染角色标签（紧凑样式）
                      const renderCharTag = (char) => {
                        const inPool = isInPool(char);
                        const isUp = char.name === poolForm.up_character.trim();
                        const rotationCount = char.pool_config?.limited_rotation_count || 0;
                        const removesAfter = char.pool_config?.removes_after;
                        const isRemoved = poolType === 'limited' && removesAfter !== null && removesAfter !== undefined && rotationCount >= removesAfter;

                        return (
                          <button
                            key={char.id}
                            onClick={() => toggleCharacterInPool(char)}
                            disabled={!editingPool?.pool_id}
                            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-all ${
                              !editingPool?.pool_id
                                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                                : inPool
                                  ? isUp
                                    ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300 font-bold ring-2 ring-orange-400'
                                    : isRemoved
                                      ? 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 line-through'
                                      : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                            }`}
                            title={`${char.name}${inPool ? ' ✓ 在池中' : ' ✗ 不在池中'}${isUp ? ' [UP]' : ''}${isRemoved ? ' [已轮换移出]' : ''}`}
                          >
                            {inPool ? <CheckSquare size={12} /> : <Square size={12} />}
                            {isUp && '★'}
                            {char.name}
                          </button>
                        );
                      };

                      // 渲染分组
                      const renderGroup = (stars, color, colorClass, label) => {
                        if (stars.length === 0) return null;
                        const inPoolCount = stars.filter(isInPool).length;
                        const allSelected = inPoolCount === stars.length;
                        
                        return (
                          <div className="p-3 bg-zinc-50/50 dark:bg-zinc-800/30 rounded border border-zinc-200 dark:border-zinc-700">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Star size={14} className={colorClass} />
                                <span className={`text-xs font-medium ${colorClass}`}>{label}</span>
                                <span className="text-xs text-slate-400 dark:text-zinc-500">
                                  {inPoolCount}/{stars.length}
                                </span>
                              </div>
                              {editingPool?.pool_id && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => addAllCharacters(stars)}
                                    disabled={allSelected}
                                    className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    全选
                                  </button>
                                  <button
                                    onClick={() => removeAllCharacters(stars)}
                                    disabled={inPoolCount === 0}
                                    className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    清空
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {stars.map(renderCharTag)}
                            </div>
                          </div>
                        );
                      };

                      return (
                        <div className="space-y-3">
                          {/* 新建池子提示 */}
                          {!editingPool?.pool_id && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-400">
                              <p className="font-medium">💡 提示：请先保存卡池，然后再管理池中角色</p>
                              <p className="mt-1 opacity-80">保存后将自动选择所有可用角色</p>
                            </div>
                          )}

                          {/* 快捷操作 */}
                          {editingPool?.pool_id && allChars.length > 0 && (
                            <div className="flex items-center gap-2 p-2 bg-zinc-100 dark:bg-zinc-800 rounded">
                              <span className="text-xs text-slate-500 dark:text-zinc-400">快捷操作：</span>
                              <button
                                onClick={() => addAllCharacters(allChars)}
                                className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                              >
                                全部选中
                              </button>
                              <button
                                onClick={() => removeAllCharacters(allChars)}
                                className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                              >
                                全部清空
                              </button>
                              <span className="text-xs text-slate-400 dark:text-zinc-500 ml-auto">
                                已选 {editingPoolCharacters.length}/{allChars.length}
                              </span>
                            </div>
                          )}

                          {/* 按稀有度分组 */}
                          {renderGroup(sixStars, 'orange', 'text-orange-500', '6星')}
                          {renderGroup(fiveStars, 'purple', 'text-purple-500', '5星')}
                          {renderGroup(fourStars, 'blue', 'text-blue-500', '4星')}

                          {allChars.length === 0 && (
                            <p className="text-sm text-slate-400 dark:text-zinc-500 italic text-center py-4">
                              暂无{poolType === 'weapon' ? '武器' : '角色'}数据，请先在角色管理中添加
                            </p>
                          )}

                          {/* 轮换说明（限定池） */}
                          {poolType === 'limited' && allChars.length > 0 && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-700 dark:text-amber-400">
                              <div className="flex items-start gap-2">
                                <RotateCw size={14} className="shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-medium">限定池轮换机制</p>
                                  <p className="mt-1 opacity-80">
                                    • 绿色 = 在池中 · 红色删除线 = 已轮换移出 · 灰色 = 不在池中
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* 对话框操作按钮 */}
              <div className="flex items-center gap-2 p-4 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
                <button
                  onClick={savePool}
                  disabled={actionLoading === 'save'}
                  className="flex items-center gap-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-none transition-colors disabled:opacity-50"
                >
                  <Save size={16} />
                  {actionLoading === 'save' ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-none"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PoolManagement;
