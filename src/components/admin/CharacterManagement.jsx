import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, Save, X, Link as LinkIcon, Star, User, Swords, Package, RefreshCw, Download, Check, Square, CheckSquare, ChevronUp, ChevronDown, ChevronsUpDown, Image, CloudUpload } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { syncAllCharacters, syncAllWeapons } from '../../utils/endfieldDataSync';
import { batchSyncAvatars, ensureBucketExists } from '../../utils/avatarStorage';
import { characterCache } from '../../utils/characterUtils';

/**
 * 角色管理界面
 * 超级管理员专用，用于管理所有角色的 CRUD 操作
 */
const CharacterManagement = ({ showToast }) => {
  // 数据状态
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');

  // Tab切换状态：角色/武器
  const [activeTab, setActiveTab] = useState('character');

  // 批量选择状态
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBatchMenu, setShowBatchMenu] = useState(false);

  // 搜索和筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [limitedFilter, setLimitedFilter] = useState('all');

  // 排序状态
  const [sortField, setSortField] = useState('rarity');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

  // 编辑对话框状态
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState(null);
  const [characterForm, setCharacterForm] = useState({
    id: '',
    name: '',
    rarity: 6,
    type: 'character',
    avatar_url: '',
    is_limited: false,
    aliases: [],
    // pool_config 配置
    pool_config: {
      pools: [],                    // 可用卡池列表：['limited', 'standard', 'weapon']
      limited_rotation_count: 0,    // 限定池轮换次数
      removes_after: null,          // 几次轮换后移出限定池（null表示永不移出）
      is_active_in_limited: true    // 是否仍在限定池中
    }
  });

  // 别名输入状态
  const [aliasInput, setAliasInput] = useState('');

  // 头像同步状态
  const [isUploadingAvatars, setIsUploadingAvatars] = useState(false);
  const [avatarUploadProgress, setAvatarUploadProgress] = useState('');

  // 加载角色列表
  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .order('rarity', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      setCharacters(data || []);
    } catch (error) {
      showToast('加载角色失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 从 EndfieldTools API 同步角色和武器数据（包含头像上传）
  const handleSyncFromAPI = async (uploadAvatars = false) => {
    if (!supabase) {
      showToast('数据库未连接', 'error');
      return;
    }

    // 如果需要上传头像，先检查 bucket
    if (uploadAvatars) {
      const bucketReady = await ensureBucketExists();
      if (!bucketReady) {
        showToast('请先在 Supabase 控制台创建名为 "avatars" 的公开存储桶，并配置上传策略', 'error');
        return;
      }
    }

    setIsSyncing(true);
    setSyncProgress('正在获取数据...');

    try {
      // 1. 获取角色数据
      setSyncProgress('正在获取角色数据...');
      const characterResult = await syncAllCharacters((current, total, msg) => {
        setSyncProgress(`角色: ${msg}`);
      });

      // 2. 获取武器数据
      setSyncProgress('正在获取武器数据...');
      const weaponResult = await syncAllWeapons((current, total, msg) => {
        setSyncProgress(`武器: ${msg}`);
      });

      // 3. 合并数据
      const allItems = [
        ...characterResult.characters.map(c => ({ ...c, type: 'character' })),
        ...weaponResult.weapons.map(w => ({ ...w, type: 'weapon' })),
      ];

      // 4. 如果需要上传头像，先上传到 Storage
      let avatarUrlMap = new Map(); // id -> new storage url
      if (uploadAvatars) {
        setSyncProgress(`正在上传头像 (0/${allItems.length})...`);

        const { success, failed, results } = await batchSyncAvatars(
          allItems,
          (current, total, name) => {
            setSyncProgress(`上传头像: ${current}/${total} - ${name}`);
          }
        );

        avatarUrlMap = results;
        console.log(`[Sync] 头像上传完成: 成功 ${success}, 失败 ${failed}`);
      }

      // 5. 更新数据库
      setSyncProgress(`正在更新数据库 (${allItems.length} 项)...`);

      let newCount = 0;
      let updateCount = 0;
      let errorCount = 0;

      // 获取现有数据进行对比
      const existingIds = new Set(characters.map(c => c.id));

      for (const item of allItems) {
        try {
          // 优先使用上传到 Storage 的 URL，否则使用原始 URL
          const finalAvatarUrl = avatarUrlMap.get(item.id) || item.avatar_url;

          const dbData = {
            id: item.id,
            name: item.name,
            rarity: item.rarity,
            type: item.type,
            avatar_url: finalAvatarUrl,
          };

          if (existingIds.has(item.id)) {
            // 更新现有记录
            const { error } = await supabase
              .from('characters')
              .update(dbData)
              .eq('id', item.id);
            if (error) throw error;
            updateCount++;
          } else {
            // 插入新记录 - 六星默认不设为限定，需要手动设置
            const { error } = await supabase
              .from('characters')
              .insert({
                ...dbData,
                aliases: [],
                is_limited: false,  // 默认不限定，需要手动设置
                pool_config: {
                  pools: item.rarity >= 5 ? ['standard'] : [],
                  limited_rotation_count: 0,
                  removes_after: null,
                  is_active_in_limited: false
                }
              });
            if (error) throw error;
            newCount++;
          }
        } catch (err) {
          console.error(`同步 ${item.name} 失败:`, err);
          errorCount++;
        }
      }

      // 6. 刷新列表和缓存
      await loadCharacters();
      // 刷新 characterCache 以便 BatchCard 能获取最新的 avatar_url
      await characterCache.refresh();

      // 7. 显示结果
      let message = `同步完成！新增 ${newCount} 个，更新 ${updateCount} 个`;
      if (uploadAvatars && avatarUrlMap.size > 0) {
        message += `，头像已上传 ${avatarUrlMap.size} 个`;
      }
      if (errorCount > 0) {
        message += `，失败 ${errorCount} 个`;
      }
      showToast(message, errorCount > 0 ? 'warning' : 'success');

    } catch (error) {
      console.error('同步失败:', error);
      showToast('同步失败: ' + error.message, 'error');
    } finally {
      setIsSyncing(false);
      setSyncProgress('');
    }
  };

  // 上传头像到 Supabase Storage
  const handleUploadAvatars = async () => {
    if (!supabase) {
      showToast('数据库未连接', 'error');
      return;
    }

    // 检查 bucket 是否存在
    const bucketReady = await ensureBucketExists();
    if (!bucketReady) {
      showToast('请先在 Supabase 控制台创建名为 "avatars" 的公开存储桶', 'error');
      return;
    }

    // 获取当前 Tab 对应的项目
    const itemsToUpload = characters.filter(c => c.type === activeTab);

    if (itemsToUpload.length === 0) {
      showToast('没有可上传的项目', 'warning');
      return;
    }

    if (!window.confirm(`确定要将 ${itemsToUpload.length} 个${activeTab === 'character' ? '角色' : '武器'}的头像上传到服务器吗？\n\n这将从 endfieldtools.dev 下载图片并保存到您的 Supabase Storage。`)) {
      return;
    }

    setIsUploadingAvatars(true);
    setAvatarUploadProgress('准备上传...');

    try {
      const { success, failed, results } = await batchSyncAvatars(
        itemsToUpload,
        (current, total, name) => {
          setAvatarUploadProgress(`上传中: ${current}/${total} - ${name}`);
        }
      );

      // 更新数据库中的 avatar_url
      if (results.size > 0) {
        setAvatarUploadProgress('正在更新数据库...');

        let updateSuccess = 0;
        for (const [id, newUrl] of results) {
          try {
            const { error } = await supabase
              .from('characters')
              .update({ avatar_url: newUrl })
              .eq('id', id);

            if (!error) updateSuccess++;
          } catch (err) {
            console.error(`更新 ${id} 的 avatar_url 失败:`, err);
          }
        }

        // 刷新列表
        await loadCharacters();

        showToast(
          `头像上传完成！成功 ${success} 个，失败 ${failed} 个，已更新 ${updateSuccess} 条记录`,
          failed > 0 ? 'warning' : 'success'
        );
      } else {
        showToast(`头像上传失败，请检查网络连接`, 'error');
      }

    } catch (error) {
      console.error('上传头像失败:', error);
      showToast('上传头像失败: ' + error.message, 'error');
    } finally {
      setIsUploadingAvatars(false);
      setAvatarUploadProgress('');
    }
  };

  // 过滤后的角色列表（按Tab分离角色和武器）
  const filteredCharacters = useMemo(() => {
    let result = characters.filter(char => {
      // 首先按Tab过滤类型
      const matchesTab = char.type === activeTab;
      const matchesSearch = char.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           char.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           char.aliases?.some(alias => alias.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesRarity = rarityFilter === 'all' || char.rarity === parseInt(rarityFilter);
      const matchesLimited = limitedFilter === 'all' ||
                            (limitedFilter === 'limited' && char.is_limited) ||
                            (limitedFilter === 'standard' && !char.is_limited);
      return matchesTab && matchesSearch && matchesRarity && matchesLimited;
    });

    // 排序
    result.sort((a, b) => {
      let aVal, bVal;

      switch (sortField) {
        case 'id':
          aVal = a.id || '';
          bVal = b.id || '';
          break;
        case 'name':
          aVal = a.name || '';
          bVal = b.name || '';
          break;
        case 'rarity':
          aVal = a.rarity || 0;
          bVal = b.rarity || 0;
          break;
        case 'is_limited':
          aVal = a.is_limited ? 1 : 0;
          bVal = b.is_limited ? 1 : 0;
          break;
        default:
          aVal = a.rarity || 0;
          bVal = b.rarity || 0;
      }

      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal, 'zh-CN');
        return sortDirection === 'asc' ? cmp : -cmp;
      } else {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });

    return result;
  }, [characters, activeTab, searchQuery, rarityFilter, limitedFilter, sortField, sortDirection]);

  // 排序处理函数
  const handleSort = (field) => {
    if (sortField === field) {
      // 同一列：切换排序方向
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // 新列：设置为降序（数字）或升序（文本）
      setSortField(field);
      setSortDirection(field === 'name' || field === 'id' ? 'asc' : 'desc');
    }
  };

  // 排序图标组件
  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return <ChevronsUpDown size={14} className="text-slate-300 dark:text-zinc-600" />;
    }
    return sortDirection === 'asc'
      ? <ChevronUp size={14} className="text-blue-500" />
      : <ChevronDown size={14} className="text-blue-500" />;
  };

  // 切换Tab时清空选择
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab]);

  // 批量选择函数
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    const allIds = filteredCharacters.map(c => c.id);
    setSelectedIds(new Set(allIds));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const isAllSelected = filteredCharacters.length > 0 &&
    filteredCharacters.every(c => selectedIds.has(c.id));

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmMsg = `确定要删除选中的 ${selectedIds.size} 个${activeTab === 'character' ? '角色' : '武器'}吗？此操作不可恢复！`;
    if (!window.confirm(confirmMsg)) return;

    setActionLoading('batch-delete');
    try {
      const { error } = await supabase
        .from('characters')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      showToast(`成功删除 ${selectedIds.size} 个项目`, 'success');
      setSelectedIds(new Set());
      await loadCharacters();
    } catch (error) {
      showToast('批量删除失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 批量设置限定状态
  const handleBatchSetLimited = async (isLimited) => {
    if (selectedIds.size === 0) return;

    setActionLoading('batch-limited');
    try {
      const { error } = await supabase
        .from('characters')
        .update({ is_limited: isLimited })
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      showToast(`成功将 ${selectedIds.size} 个项目设为${isLimited ? '限定' : '常驻'}`, 'success');
      setSelectedIds(new Set());
      await loadCharacters();
    } catch (error) {
      showToast('批量设置失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 批量设置卡池
  const handleBatchSetPool = async (poolType) => {
    if (selectedIds.size === 0) return;

    setActionLoading('batch-pool');
    try {
      // 获取当前选中的记录
      const { data: currentItems, error: fetchError } = await supabase
        .from('characters')
        .select('id, pool_config')
        .in('id', Array.from(selectedIds));

      if (fetchError) throw fetchError;

      // 更新每个记录的pool_config
      for (const item of currentItems) {
        const currentConfig = item.pool_config || { pools: [] };
        let newPools = currentConfig.pools || [];

        if (!newPools.includes(poolType)) {
          newPools = [...newPools, poolType];
        }

        const { error } = await supabase
          .from('characters')
          .update({
            pool_config: { ...currentConfig, pools: newPools }
          })
          .eq('id', item.id);

        if (error) throw error;
      }

      showToast(`成功为 ${selectedIds.size} 个项目添加卡池: ${poolType}`, 'success');
      setSelectedIds(new Set());
      await loadCharacters();
    } catch (error) {
      showToast('批量设置卡池失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 重置表单
  const resetForm = () => {
    setCharacterForm({
      id: '',
      name: '',
      rarity: 6,
      type: 'character',
      avatar_url: '',
      is_limited: false,
      aliases: [],
      pool_config: {
        pools: [],
        limited_rotation_count: 0,
        removes_after: null,
        is_active_in_limited: true
      }
    });
    setAliasInput('');
    setEditingCharacter(null);
    setShowEditDialog(false);
  };

  // 开始编辑
  const startEdit = (character) => {
    const existingPoolConfig = character.pool_config || {};
    setCharacterForm({
      id: character.id || '',
      name: character.name || '',
      rarity: character.rarity || 6,
      type: character.type || 'character',
      avatar_url: character.avatar_url || '',
      is_limited: character.is_limited || false,
      aliases: character.aliases || [],
      pool_config: {
        pools: existingPoolConfig.pools || [],
        limited_rotation_count: existingPoolConfig.limited_rotation_count || 0,
        removes_after: existingPoolConfig.removes_after ?? null,
        is_active_in_limited: existingPoolConfig.is_active_in_limited !== false
      }
    });
    setEditingCharacter(character);
    setShowEditDialog(true);
  };

  // 添加别名
  const addAlias = () => {
    const trimmedAlias = aliasInput.trim();
    if (!trimmedAlias) return;

    if (characterForm.aliases.includes(trimmedAlias)) {
      showToast('该别名已存在', 'error');
      return;
    }

    setCharacterForm(prev => ({
      ...prev,
      aliases: [...prev.aliases, trimmedAlias]
    }));
    setAliasInput('');
  };

  // 删除别名
  const removeAlias = (index) => {
    setCharacterForm(prev => ({
      ...prev,
      aliases: prev.aliases.filter((_, i) => i !== index)
    }));
  };

  // 保存角色
  const saveCharacter = async () => {
    if (!supabase) return;

    // 验证必填字段
    if (!characterForm.id.trim()) {
      showToast('角色ID不能为空', 'error');
      return;
    }
    if (!characterForm.name.trim()) {
      showToast('角色名称不能为空', 'error');
      return;
    }

    setActionLoading('save');

    try {
      // 构建 pool_config 对象
      const poolConfig = {
        pools: characterForm.pool_config.pools || [],
        limited_rotation_count: characterForm.pool_config.limited_rotation_count || 0,
        removes_after: characterForm.pool_config.removes_after,
        is_active_in_limited: characterForm.pool_config.is_active_in_limited
      };

      const characterData = {
        id: characterForm.id.trim(),
        name: characterForm.name.trim(),
        rarity: characterForm.rarity,
        type: characterForm.type,
        avatar_url: characterForm.avatar_url.trim() || null,
        is_limited: characterForm.is_limited,
        aliases: characterForm.aliases.length > 0 ? characterForm.aliases : null,
        pool_config: poolConfig
      };

      if (editingCharacter) {
        // 更新现有角色
        const { error } = await supabase
          .from('characters')
          .update(characterData)
          .eq('id', editingCharacter.id);

        if (error) throw error;
        showToast('角色已更新', 'success');
      } else {
        // 创建新角色
        const { error } = await supabase
          .from('characters')
          .insert(characterData);

        if (error) throw error;
        showToast('角色已创建', 'success');
      }

      await loadCharacters();
      resetForm();
    } catch (error) {
      showToast('保存失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 删除角色
  const deleteCharacter = async (character) => {
    if (!supabase) return;

    if (!window.confirm(`确定要删除角色「${character.name}」吗？此操作无法撤销。`)) {
      return;
    }

    setActionLoading(character.id);

    try {
      const { error } = await supabase
        .from('characters')
        .delete()
        .eq('id', character.id);

      if (error) throw error;

      showToast('角色已删除', 'success');
      await loadCharacters();
    } catch (error) {
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 获取稀有度颜色
  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 6:
        return 'text-orange-500 bg-orange-100 dark:bg-orange-900/30';
      case 5:
        return 'text-purple-500 bg-purple-100 dark:bg-purple-900/30';
      case 4:
        return 'text-blue-500 bg-blue-100 dark:bg-blue-900/30';
      case 3:
        return 'text-slate-500 bg-slate-100 dark:bg-zinc-700';
      default:
        return 'text-slate-400 bg-slate-100 dark:bg-zinc-700';
    }
  };

  // 获取类型图标
  const getTypeIcon = (type) => {
    return type === 'weapon' ? <Swords size={14} /> : <User size={14} />;
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
      {/* Tab切换：角色/武器 */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('character')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'character'
              ? 'border-red-500 text-red-600 dark:text-red-400'
              : 'border-transparent text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
          }`}
        >
          <User size={16} className="inline mr-2" />
          角色 ({characters.filter(c => c.type === 'character').length})
        </button>
        <button
          onClick={() => setActiveTab('weapon')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'weapon'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
          }`}
        >
          <Swords size={16} className="inline mr-2" />
          武器 ({characters.filter(c => c.type === 'weapon').length})
        </button>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`搜索${activeTab === 'character' ? '角色' : '武器'}名称、ID...`}
            className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>
        <select
          value={rarityFilter}
          onChange={(e) => setRarityFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
        >
          <option value="all">全部稀有度</option>
          <option value="6">6星</option>
          <option value="5">5星</option>
          <option value="4">4星</option>
          <option value="3">3星</option>
        </select>
        <select
          value={limitedFilter}
          onChange={(e) => setLimitedFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
        >
          <option value="all">全部类型</option>
          <option value="limited">限定</option>
          <option value="standard">常驻</option>
        </select>
        <button
          onClick={() => setShowEditDialog(true)}
          className="flex items-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-none transition-colors"
        >
          <Plus size={16} />
          新增{activeTab === 'character' ? '角色' : '武器'}
        </button>
        <button
          onClick={() => handleSyncFromAPI(false)}
          disabled={isSyncing}
          className="flex items-center gap-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white text-sm font-medium rounded-none transition-colors"
          title="从 EndfieldTools.dev 同步数据（使用原始图片链接）"
        >
          <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
          {isSyncing ? syncProgress || '同步中...' : '同步数据'}
        </button>
        <button
          onClick={() => handleSyncFromAPI(true)}
          disabled={isSyncing}
          className="flex items-center gap-1 px-3 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white text-sm font-medium rounded-none transition-colors"
          title="同步数据并将头像上传到您的服务器（推荐）"
        >
          <CloudUpload size={16} className={isSyncing ? 'animate-pulse' : ''} />
          {isSyncing ? syncProgress || '同步中...' : '同步+上传头像'}
        </button>
      </div>

      {/* 批量操作栏 */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
          <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
            已选择 {selectedIds.size} 项
          </span>
          <div className="flex-1" />
          <button
            onClick={() => handleBatchSetLimited(true)}
            disabled={actionLoading}
            className="px-3 py-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors"
          >
            设为限定
          </button>
          <button
            onClick={() => handleBatchSetLimited(false)}
            disabled={actionLoading}
            className="px-3 py-1.5 text-xs bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
          >
            设为常驻
          </button>
          <button
            onClick={() => handleBatchSetPool('standard')}
            disabled={actionLoading}
            className="px-3 py-1.5 text-xs bg-purple-500 hover:bg-purple-600 text-white rounded transition-colors"
          >
            添加常驻池
          </button>
          <button
            onClick={() => handleBatchSetPool('limited')}
            disabled={actionLoading}
            className="px-3 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded transition-colors"
          >
            添加限定池
          </button>
          <button
            onClick={handleBatchDelete}
            disabled={actionLoading}
            className="px-3 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
          >
            批量删除
          </button>
          <button
            onClick={deselectAll}
            className="px-3 py-1.5 text-xs bg-slate-500 hover:bg-slate-600 text-white rounded transition-colors"
          >
            取消选择
          </button>
        </div>
      )}

      {/* 统计信息 */}
      <div className="text-xs text-slate-500 dark:text-zinc-500">
        显示 {filteredCharacters.length} / {characters.filter(c => c.type === activeTab).length} 个{activeTab === 'character' ? '角色' : '武器'}
      </div>

      {/* 列表 */}
      {filteredCharacters.length === 0 ? (
        <div className="p-12 text-center text-slate-400 dark:text-zinc-500">
          <Package size={48} className="mx-auto mb-4 opacity-50" />
          <p>{characters.filter(c => c.type === activeTab).length === 0 ? `暂无${activeTab === 'character' ? '角色' : '武器'}` : '未找到匹配项'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-950 text-xs text-slate-500 dark:text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <button
                    onClick={isAllSelected ? deselectAll : selectAll}
                    className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                  >
                    {isAllSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">头像</th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('id')}
                    className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
                  >
                    ID <SortIcon field="id" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
                  >
                    名称 <SortIcon field="name" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('rarity')}
                    className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
                  >
                    稀有度 <SortIcon field="rarity" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('is_limited')}
                    className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
                  >
                    限定 <SortIcon field="is_limited" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">可用卡池</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredCharacters.map(char => (
                <tr key={char.id} className={`hover:bg-slate-50 dark:hover:bg-zinc-950 ${selectedIds.has(char.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                  {/* 选择框 */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleSelect(char.id)}
                      className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                    >
                      {selectedIds.has(char.id) ? <CheckSquare size={18} className="text-blue-500" /> : <Square size={18} />}
                    </button>
                  </td>
                  {/* 头像 */}
                  <td className="px-4 py-3">
                    {char.avatar_url ? (
                      <img
                        src={char.avatar_url}
                        alt={char.name}
                        className="w-10 h-10 rounded object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-slate-200 dark:bg-zinc-700 flex items-center justify-center">
                        {getTypeIcon(char.type)}
                      </div>
                    )}
                  </td>

                  {/* ID */}
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-zinc-500">
                    {char.id}
                  </td>

                  {/* 名称 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700 dark:text-zinc-200">{char.name}</span>
                      {char.aliases?.length > 0 && (
                        <span className="text-xs text-slate-400 dark:text-zinc-500">
                          ({char.aliases.join(', ')})
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 稀有度 */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium ${getRarityColor(char.rarity)}`}>
                      <Star size={12} />
                      {char.rarity}星
                    </span>
                  </td>

                  {/* 限定状态 */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${
                      char.is_limited
                        ? 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400'
                        : 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                      {char.is_limited ? '限定' : '常驻'}
                    </span>
                  </td>

                  {/* 可用卡池 */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {char.pool_config?.pools?.map(pool => (
                        <span
                          key={pool}
                          className={`px-1.5 py-0.5 text-xs rounded ${
                            pool === 'limited' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                            pool === 'standard' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                            pool === 'weapon' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                            'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400'
                          }`}
                        >
                          {pool === 'limited' ? '限定池' : pool === 'standard' ? '常驻池' : pool === 'weapon' ? '武器池' : pool}
                        </span>
                      ))}
                      {(!char.pool_config?.pools || char.pool_config.pools.length === 0) && (
                        <span className="text-xs text-slate-400 dark:text-zinc-600">-</span>
                      )}
                    </div>
                  </td>

                  {/* 操作 */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => startEdit(char)}
                        className="p-1.5 text-slate-400 hover:text-blue-500 dark:text-zinc-500 dark:hover:text-blue-400"
                        title="编辑"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(char)}
                        disabled={actionLoading === char.id}
                        className="p-1.5 text-slate-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400"
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 编辑对话框 */}
      {showEditDialog && (
        <>
          {/* 背景遮罩 */}
          <div className="fixed inset-0 bg-black/50 z-40" onClick={resetForm}></div>

          {/* 对话框 */}
          <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl z-50">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 max-h-full overflow-y-auto">
              {/* 对话框标题 */}
              <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="text-lg font-bold text-slate-700 dark:text-zinc-300">
                  {editingCharacter ? '编辑角色' : '新增角色'}
                </h3>
                <button
                  onClick={resetForm}
                  className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                >
                  <X size={20} />
                </button>
              </div>

              {/* 表单内容 */}
              <div className="p-4 space-y-4">
                {/* 角色ID */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    角色ID *
                  </label>
                  <input
                    type="text"
                    value={characterForm.id}
                    onChange={(e) => setCharacterForm(prev => ({ ...prev, id: e.target.value }))}
                    placeholder="例如：char_rococo"
                    disabled={!!editingCharacter}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 disabled:bg-slate-100 disabled:dark:bg-zinc-800"
                  />
                  {!editingCharacter && (
                    <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                      创建后无法修改，建议使用小写英文，格式：char_xxx 或 weapon_xxx
                    </p>
                  )}
                </div>

                {/* 角色名称 */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    角色名称 *
                  </label>
                  <input
                    type="text"
                    value={characterForm.name}
                    onChange={(e) => setCharacterForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="例如：莱万汀"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                  />
                </div>

                {/* 稀有度和类型 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      稀有度 *
                    </label>
                    <select
                      value={characterForm.rarity}
                      onChange={(e) => setCharacterForm(prev => ({ ...prev, rarity: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                    >
                      <option value={6}>6星</option>
                      <option value={5}>5星</option>
                      <option value={4}>4星</option>
                      <option value={3}>3星</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      类型 *
                    </label>
                    <select
                      value={characterForm.type}
                      onChange={(e) => setCharacterForm(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                    >
                      <option value="character">角色</option>
                      <option value="weapon">武器</option>
                    </select>
                  </div>
                </div>

                {/* 是否限定 */}
                <div>
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={characterForm.is_limited}
                      onChange={(e) => setCharacterForm(prev => ({ ...prev, is_limited: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    限定角色/武器
                  </label>
                </div>

                {/* 头像 URL */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-2">
                    <LinkIcon size={14} />
                    头像图片 URL
                  </label>
                  <input
                    type="text"
                    value={characterForm.avatar_url}
                    onChange={(e) => setCharacterForm(prev => ({ ...prev, avatar_url: e.target.value }))}
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                  />
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                    建议使用外部图床链接，推荐方形图片
                  </p>
                </div>

                {/* 别名管理 */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    别名
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={aliasInput}
                      onChange={(e) => setAliasInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addAlias()}
                      placeholder="输入别名后按回车添加"
                      className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                    />
                    <button
                      onClick={addAlias}
                      className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-none transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  {characterForm.aliases.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {characterForm.aliases.map((alias, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded text-sm"
                        >
                          <span>{alias}</span>
                          <button
                            onClick={() => removeAlias(index)}
                            className="hover:text-blue-800 dark:hover:text-blue-200"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                    别名用于识别角色的其他名称（如昵称、英文名等）
                  </p>
                </div>

                {/* 卡池配置 (pool_config) */}
                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-4">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                    <Package size={16} />
                    卡池配置
                  </h4>

                  {/* 可用卡池 */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                      可用卡池
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {['limited', 'standard', 'weapon'].map(poolType => (
                        <label key={poolType} className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                          <input
                            type="checkbox"
                            checked={characterForm.pool_config.pools.includes(poolType)}
                            onChange={(e) => {
                              setCharacterForm(prev => ({
                                ...prev,
                                pool_config: {
                                  ...prev.pool_config,
                                  pools: e.target.checked
                                    ? [...prev.pool_config.pools, poolType]
                                    : prev.pool_config.pools.filter(p => p !== poolType)
                                }
                              }));
                            }}
                            className="w-4 h-4"
                          />
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            poolType === 'limited' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                            poolType === 'standard' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                            'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400'
                          }`}>
                            {poolType === 'limited' ? '限定池' : poolType === 'standard' ? '常驻池' : '武器池'}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                      选择该角色/武器可以出现的卡池类型
                    </p>
                  </div>

                  {/* 限定池专属配置 - 仅当选择了限定池时显示 */}
                  {characterForm.pool_config.pools.includes('limited') && (
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/30 mb-4">
                      <h5 className="text-xs font-bold text-orange-700 dark:text-orange-400 mb-3 uppercase">
                        限定池轮换配置
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 轮换次数 */}
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                            当前轮换次数
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={characterForm.pool_config.limited_rotation_count}
                            onChange={(e) => setCharacterForm(prev => ({
                              ...prev,
                              pool_config: {
                                ...prev.pool_config,
                                limited_rotation_count: parseInt(e.target.value) || 0
                              }
                            }))}
                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-sm"
                          />
                        </div>

                        {/* 移出限制 */}
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                            几次轮换后移出
                          </label>
                          <input
                            type="number"
                            min="1"
                            placeholder="留空=永不移出"
                            value={characterForm.pool_config.removes_after ?? ''}
                            onChange={(e) => setCharacterForm(prev => ({
                              ...prev,
                              pool_config: {
                                ...prev.pool_config,
                                removes_after: e.target.value === '' ? null : parseInt(e.target.value) || null
                              }
                            }))}
                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-sm"
                          />
                        </div>

                        {/* 当前状态 */}
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                            限定池状态
                          </label>
                          <div className="flex items-center gap-2 h-[38px]">
                            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                              <input
                                type="checkbox"
                                checked={characterForm.pool_config.is_active_in_limited}
                                onChange={(e) => setCharacterForm(prev => ({
                                  ...prev,
                                  pool_config: {
                                    ...prev.pool_config,
                                    is_active_in_limited: e.target.checked
                                  }
                                }))}
                                className="w-4 h-4"
                              />
                              仍在限定池中
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* 状态提示 */}
                      {characterForm.pool_config.removes_after !== null && (
                        <div className={`mt-3 text-xs px-2 py-1 rounded ${
                          characterForm.pool_config.limited_rotation_count >= characterForm.pool_config.removes_after
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        }`}>
                          {characterForm.pool_config.limited_rotation_count >= characterForm.pool_config.removes_after
                            ? `⚠️ 已轮换 ${characterForm.pool_config.limited_rotation_count}/${characterForm.pool_config.removes_after} 次，已从限定池移出`
                            : `✓ 已轮换 ${characterForm.pool_config.limited_rotation_count}/${characterForm.pool_config.removes_after} 次，仍在限定池中`
                          }
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 对话框操作按钮 */}
              <div className="flex items-center gap-2 p-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={saveCharacter}
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

export default CharacterManagement;
