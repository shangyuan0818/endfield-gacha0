/**
 * 角色管理 Hook
 * 封装角色/武器管理的所有状态和业务逻辑
 *
 * @version 1.0.0
 * @date 2026-02-04
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import * as characterService from '../../services/admin/characterService';

/**
 * 角色表单初始状态
 */
export const INITIAL_CHARACTER_FORM = {
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
};

/**
 * 批量编辑表单初始状态
 */
export const INITIAL_BATCH_EDIT_FORM = {
  is_limited: null,
  pools: {
    limited: null,
    standard: null,
    weapon: null
  }
};

/**
 * 角色管理 Hook
 * @param {Object} options - 选项
 * @param {Function} options.showToast - Toast 提示函数
 * @returns {Object} 角色管理状态和方法
 */
export function useCharacters({ showToast }) {
  // 数据状态
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // 同步状态
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');

  // Tab 切换状态
  const [activeTab, setActiveTabState] = useState('character');

  // 批量选择状态
  const [selectedIds, setSelectedIds] = useState(new Set());

  // 搜索和筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [limitedFilter, setLimitedFilter] = useState('all');

  // 排序状态
  const [sortField, setSortField] = useState('rarity');
  const [sortDirection, setSortDirection] = useState('desc');

  // 编辑对话框状态
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState(null);
  const [characterForm, setCharacterForm] = useState(INITIAL_CHARACTER_FORM);
  const [aliasInput, setAliasInput] = useState('');

  // 批量编辑对话框状态
  const [showBatchEditDialog, setShowBatchEditDialog] = useState(false);
  const [batchEditForm, setBatchEditForm] = useState(INITIAL_BATCH_EDIT_FORM);

  // 加载角色列表
  const loadCharacters = useCallback(async () => {
    setLoading(true);
    const { data, error } = await characterService.loadCharacters();
    if (error) {
      showToast('加载角色失败: ' + error.message, 'error');
    } else {
      setCharacters(data);
    }
    setLoading(false);
  }, [showToast]);

  // 初始化加载
  useEffect(() => {
    queueMicrotask(() => {
      loadCharacters();
    });
  }, [loadCharacters]);

  const setActiveTab = useCallback((nextTab) => {
    setActiveTabState(nextTab);
    setSelectedIds(new Set());
  }, []);

  // 过滤和排序后的角色列表
  const filteredCharacters = useMemo(() => {
    let result = characters.filter(char => {
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

  // 排序处理
  const handleSort = useCallback((field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'name' || field === 'id' ? 'asc' : 'desc');
    }
  }, [sortField]);

  // 批量选择函数
  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = filteredCharacters.map(c => c.id);
    setSelectedIds(new Set(allIds));
  }, [filteredCharacters]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isAllSelected = filteredCharacters.length > 0 &&
    filteredCharacters.every(c => selectedIds.has(c.id));

  // 重置表单
  const resetForm = useCallback(() => {
    setCharacterForm(INITIAL_CHARACTER_FORM);
    setAliasInput('');
    setEditingCharacter(null);
    setShowEditDialog(false);
  }, []);

  // 开始编辑
  const startEdit = useCallback((character) => {
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
  }, []);

  // 添加别名
  const addAlias = useCallback(() => {
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
  }, [aliasInput, characterForm.aliases, showToast]);

  // 删除别名
  const removeAlias = useCallback((index) => {
    setCharacterForm(prev => ({
      ...prev,
      aliases: prev.aliases.filter((_, i) => i !== index)
    }));
  }, []);

  // 保存角色
  const saveCharacter = useCallback(async () => {
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

    const { success, error } = await characterService.saveCharacter(characterData, editingCharacter);

    if (success) {
      showToast(editingCharacter ? '角色已更新' : '角色已创建', 'success');
      await loadCharacters();
      resetForm();
    } else {
      showToast('保存失败: ' + error.message, 'error');
    }

    setActionLoading(null);
  }, [characterForm, editingCharacter, showToast, loadCharacters, resetForm]);

  // 删除角色
  const deleteCharacter = useCallback(async (character) => {
    if (!window.confirm(`确定要删除角色「${character.name}」吗？此操作无法撤销。`)) {
      return;
    }

    setActionLoading(character.id);

    const { success, error } = await characterService.deleteCharacter(character.id);

    if (success) {
      showToast('角色已删除', 'success');
      await loadCharacters();
    } else {
      showToast('删除失败: ' + error.message, 'error');
    }

    setActionLoading(null);
  }, [showToast, loadCharacters]);

  // 批量删除
  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const confirmMsg = `确定要删除选中的 ${selectedIds.size} 个${activeTab === 'character' ? '角色' : '武器'}吗？此操作不可恢复！`;
    if (!window.confirm(confirmMsg)) return;

    setActionLoading('batch-delete');

    const { success, error } = await characterService.batchDeleteCharacters(Array.from(selectedIds));

    if (success) {
      showToast(`成功删除 ${selectedIds.size} 个项目`, 'success');
      setSelectedIds(new Set());
      await loadCharacters();
    } else {
      showToast('批量删除失败: ' + error.message, 'error');
    }

    setActionLoading(null);
  }, [selectedIds, activeTab, showToast, loadCharacters]);

  // 打开批量编辑对话框
  const openBatchEditDialog = useCallback(() => {
    if (selectedIds.size === 0) {
      showToast('请先选择要编辑的项目', 'warning');
      return;
    }
    setBatchEditForm(INITIAL_BATCH_EDIT_FORM);
    setShowBatchEditDialog(true);
  }, [selectedIds.size, showToast]);

  // 关闭批量编辑对话框
  const closeBatchEditDialog = useCallback(() => {
    setShowBatchEditDialog(false);
    setBatchEditForm(INITIAL_BATCH_EDIT_FORM);
  }, []);

  // 执行批量编辑
  const executeBatchEdit = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setActionLoading('batch-edit');

    const { success, updateCount, error } = await characterService.batchUpdateCharacters(
      Array.from(selectedIds),
      batchEditForm
    );

    if (success) {
      showToast(`成功更新 ${updateCount} 个项目`, 'success');
      setSelectedIds(new Set());
      await loadCharacters();
      closeBatchEditDialog();
    } else {
      showToast('批量编辑失败: ' + error.message, 'error');
    }

    setActionLoading(null);
  }, [selectedIds, batchEditForm, showToast, loadCharacters, closeBatchEditDialog]);

  // 从 API 同步
  const handleSyncFromAPI = useCallback(async () => {
    setIsSyncing(true);
    setSyncProgress('正在获取数据...');

    const result = await characterService.syncFromAPI({
      onProgress: setSyncProgress,
      existingIds: characters.map(c => c.id)
    });

    if (result.success) {
      await loadCharacters();

      let message = `同步完成！新增 ${result.newCount} 个`;
      if (result.skippedCount > 0) {
        message += `，跳过 ${result.skippedCount} 个已存在的项目`;
      }
      if (result.avatarCount > 0) {
        message += `，头像已上传 ${result.avatarCount} 个`;
      }
      if (result.errorCount > 0) {
        message += `，失败 ${result.errorCount} 个`;
      }
      showToast(message, result.errorCount > 0 ? 'warning' : 'success');
    } else {
      showToast('同步失败: ' + result.error.message, 'error');
    }

    setIsSyncing(false);
    setSyncProgress('');
  }, [characters, loadCharacters, showToast]);

  return {
    // 数据状态
    characters,
    loading,
    actionLoading,
    filteredCharacters,

    // 同步状态
    isSyncing,
    syncProgress,

    // Tab
    activeTab,
    setActiveTab,

    // 批量选择
    selectedIds,
    toggleSelect,
    selectAll,
    deselectAll,
    isAllSelected,

    // 搜索筛选
    searchQuery,
    setSearchQuery,
    rarityFilter,
    setRarityFilter,
    limitedFilter,
    setLimitedFilter,

    // 排序
    sortField,
    sortDirection,
    handleSort,

    // 编辑对话框
    showEditDialog,
    setShowEditDialog,
    editingCharacter,
    characterForm,
    setCharacterForm,
    aliasInput,
    setAliasInput,
    resetForm,
    startEdit,
    addAlias,
    removeAlias,
    saveCharacter,
    deleteCharacter,

    // 批量编辑
    showBatchEditDialog,
    batchEditForm,
    setBatchEditForm,
    openBatchEditDialog,
    closeBatchEditDialog,
    executeBatchEdit,
    handleBatchDelete,

    // 同步操作
    handleSyncFromAPI,
    loadCharacters
  };
}
