/**
 * 卡池管理 Hook
 * 集中管理状态和业务逻辑
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import * as poolService from '../../services/admin/poolService';
import { characterCache } from '../../utils/characterUtils';

// 表单初始状态
export const INITIAL_POOL_FORM = {
  name: '',
  type: 'limited',
  up_character: '',
  banner_url: '',
  description: '',
  start_time: '',
  end_time: '',
  is_limited_weapon: true,
  locked: false
};

/**
 * 卡池管理主 Hook
 */
export const usePools = (showToast) => {
  // 数据状态
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // 角色数据状态
  const [characters, setCharacters] = useState([]);

  // 池子-角色关联数据
  const [poolCharacters, setPoolCharacters] = useState({});
  const [editingPoolCharacters, setEditingPoolCharacters] = useState([]);

  // 搜索和筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // 编辑对话框状态
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPool, setEditingPool] = useState(null);
  const [poolForm, setPoolForm] = useState(INITIAL_POOL_FORM);

  // 自动轮换检测状态
  const [pendingRotationPools, setPendingRotationPools] = useState([]);
  const [autoRotationProcessing, setAutoRotationProcessing] = useState(false);

  // 加载数据
  const loadPoolsData = useCallback(async () => {
    setLoading(true);
    const result = await poolService.loadPools();
    if (result.success) {
      setPools(result.data);
    } else {
      showToast('加载卡池失败: ' + result.error, 'error');
    }
    setLoading(false);
  }, [showToast]);

  const loadCharactersData = useCallback(async () => {
    const result = await poolService.loadCharacters();
    if (result.success) {
      setCharacters(result.data);
    }
  }, []);

  const loadAllPoolCharactersData = useCallback(async () => {
    const result = await poolService.loadAllPoolCharacters();
    if (result.success) {
      setPoolCharacters(result.data);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadPoolsData();
    loadCharactersData();
    loadAllPoolCharactersData();
  }, [loadPoolsData, loadCharactersData, loadAllPoolCharactersData]);

  // 检测需要自动轮换的卡池
  useEffect(() => {
    if (pools.length > 0 && characters.length > 0) {
      const now = new Date();
      const pending = pools.filter(pool => {
        if (pool.type !== 'limited' && pool.type !== 'limited_character') return false;
        if (!pool.end_time) return false;
        if (new Date(pool.end_time) >= now) return false;
        if (pool.rotation_processed) return false;
        return true;
      });

      pending.sort((a, b) => new Date(a.end_time) - new Date(b.end_time));
      setPendingRotationPools(pending);
    }
  }, [pools, characters]);

  // 获取限定池相关的6星角色
  const limitedSixStarCharacters = useMemo(() => {
    return characters.filter(char =>
      char.rarity === 6 &&
      char.pool_config?.pools?.includes('limited')
    );
  }, [characters]);

  // 过滤并排序后的卡池列表
  const filteredPools = useMemo(() => {
    let result = pools.filter(pool => {
      const matchesSearch = pool.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           pool.up_character?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || pool.type === typeFilter;
      return matchesSearch && matchesType;
    });

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
        default:
          aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
          bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [pools, searchQuery, typeFilter, sortField, sortOrder]);

  // 检查UP角色是否存在
  const checkUpCharacterExists = useCallback((upCharacterName) => {
    if (!upCharacterName || !upCharacterName.trim()) return true;
    return characters.some(c => c.name === upCharacterName.trim());
  }, [characters]);

  // 重置表单
  const resetForm = useCallback(() => {
    setPoolForm(INITIAL_POOL_FORM);
    setEditingPool(null);
    setEditingPoolCharacters([]);
    setShowEditDialog(false);
  }, []);

  // 开始编辑
  const startEdit = useCallback(async (pool) => {
    const formatDateTimeLocal = (utcDateString) => {
      if (!utcDateString) return '';
      const date = new Date(utcDateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const result = await poolService.loadPoolCharactersForEdit(pool.pool_id);
    setEditingPoolCharacters(result.data);

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
  }, []);

  // 保存卡池
  const handleSavePool = useCallback(async () => {
    if (!poolForm.name.trim()) {
      showToast('卡池名称不能为空', 'error');
      return;
    }

    setActionLoading('save');

    try {
      const upCharacterName = poolForm.up_character.trim();

      // 检查UP角色是否存在
      if (upCharacterName && (poolForm.type === 'limited' || poolForm.type === 'weapon')) {
        const upExists = checkUpCharacterExists(upCharacterName);

        if (!upExists) {
          const processedCount = pools.filter(p =>
            (p.type === 'limited' || p.type === 'limited_character') &&
            p.rotation_processed === true
          ).length;

          try {
            const poolStartTime = poolForm.start_time ? new Date(poolForm.start_time).toISOString() : new Date().toISOString();
            await poolService.createUpCharacter(upCharacterName, poolForm.type, poolStartTime, processedCount);
            showToast(`已自动创建UP角色「${upCharacterName}」（轮换起始: ${processedCount}，3池后移出）`, 'success');
            await loadCharactersData();
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

      const result = await poolService.savePool(
        poolData,
        editingPool,
        characters,
        poolService.addCharacterToPool
      );

      if (result.success) {
        if (result.isNew) {
          showToast(`卡池已创建，已自动添加 ${result.addedCount} 个角色`, 'success');
        } else {
          showToast('卡池已更新', 'success');
        }
        await loadPoolsData();
        await loadAllPoolCharactersData();
        resetForm();
      } else {
        showToast('保存失败: ' + result.error, 'error');
      }
    } finally {
      setActionLoading(null);
    }
  }, [poolForm, editingPool, characters, pools, checkUpCharacterExists, showToast, loadPoolsData, loadCharactersData, loadAllPoolCharactersData, resetForm]);

  // 删除卡池
  const handleDeletePool = useCallback(async (pool) => {
    if (!window.confirm(`确定要删除卡池「${pool.name}」吗？此操作将删除该卡池的所有相关数据，且无法撤销。`)) {
      return;
    }

    setActionLoading(pool.pool_id);

    const result = await poolService.deletePool(pool.pool_id);
    if (result.success) {
      showToast('卡池已删除', 'success');
      await loadPoolsData();
    } else {
      showToast('删除失败: ' + result.error, 'error');
    }

    setActionLoading(null);
  }, [showToast, loadPoolsData]);

  // 处理轮换
  const handleStartRotation = useCallback(async (pool) => {
    if (limitedSixStarCharacters.length === 0) {
      showToast('没有找到限定池6星角色', 'error');
      return;
    }

    setActionLoading(`rotation_${pool.pool_id}`);

    const result = await poolService.processRotation(pool, limitedSixStarCharacters);
    if (result.success) {
      await loadPoolsData();
      await loadCharactersData();
      showToast(`已为 ${result.count} 个角色增加轮换次数`, 'success');
    } else {
      showToast('轮换失败: ' + result.error, 'error');
    }

    setActionLoading(null);
  }, [limitedSixStarCharacters, showToast, loadPoolsData, loadCharactersData]);

  // 处理所有待轮换卡池
  const handleProcessAllPendingRotations = useCallback(async () => {
    if (pendingRotationPools.length === 0) return;

    if (limitedSixStarCharacters.length === 0) {
      showToast('没有找到限定池6星角色', 'error');
      return;
    }

    setAutoRotationProcessing(true);

    const result = await poolService.processAllPendingRotations(pendingRotationPools, limitedSixStarCharacters);
    if (result.success) {
      await loadPoolsData();
      await loadCharactersData();
      showToast(`已处理 ${result.poolCount} 个卡池的轮换，共 ${result.charCount} 个角色各增加 ${result.poolCount} 次轮换`, 'success');
    } else {
      showToast('自动轮换处理失败: ' + result.error, 'error');
    }

    setAutoRotationProcessing(false);
  }, [pendingRotationPools, limitedSixStarCharacters, showToast, loadPoolsData, loadCharactersData]);

  // 重新计算限定/常驻
  const handleRecalculateIsStandard = useCallback(async () => {
    setActionLoading('recalculate');

    const result = await poolService.recalculateIsStandard(pools);
    if (result.success) {
      if (result.changedCount === 0) {
        showToast(result.message || '所有记录已是最新状态，无需更新', 'info');
      } else {
        showToast(`已更新 ${result.changedCount} 条记录的限定/常驻状态。刷新页面后生效。`, 'success');
      }
    } else {
      showToast('重新计算失败: ' + result.error, 'error');
    }

    setActionLoading(null);
  }, [pools, showToast]);

  // 角色池子管理操作
  const toggleCharacterInPool = useCallback(async (char, isInPool) => {
    if (!editingPool?.pool_id) {
      showToast('请先保存卡池后再管理角色', 'info');
      return;
    }

    const isUp = char.name === poolForm.up_character.trim();

    try {
      if (isInPool) {
        await poolService.removeCharacterFromPool(editingPool.pool_id, char.id);
        setEditingPoolCharacters(prev => prev.filter(pc => pc.character_id !== char.id));
      } else {
        await poolService.addCharacterToPool(editingPool.pool_id, char.id, isUp);
        setEditingPoolCharacters(prev => [...prev, { character_id: char.id, is_up: isUp }]);
      }
      await loadAllPoolCharactersData();
    } catch (error) {
      showToast('更新失败: ' + error.message, 'error');
    }
  }, [editingPool, poolForm.up_character, showToast, loadAllPoolCharactersData]);

  const addAllCharactersToPool = useCallback(async (charList) => {
    if (!editingPool?.pool_id) {
      showToast('请先保存卡池后再管理角色', 'info');
      return;
    }

    const currentIds = editingPoolCharacters.map(pc => pc.character_id);
    const toAdd = charList.filter(c => !currentIds.includes(c.id));

    if (toAdd.length === 0) {
      showToast('所有角色已在池中', 'info');
      return;
    }

    try {
      for (const char of toAdd) {
        const isUp = char.name === poolForm.up_character.trim();
        await poolService.addCharacterToPool(editingPool.pool_id, char.id, isUp);
      }
      setEditingPoolCharacters(prev => [
        ...prev,
        ...toAdd.map(c => ({ character_id: c.id, is_up: c.name === poolForm.up_character.trim() }))
      ]);
      await loadAllPoolCharactersData();
      showToast(`已添加 ${toAdd.length} 个角色`, 'success');
    } catch (error) {
      showToast('批量添加失败: ' + error.message, 'error');
    }
  }, [editingPool, editingPoolCharacters, poolForm.up_character, showToast, loadAllPoolCharactersData]);

  const removeAllCharactersFromPool = useCallback(async (charList) => {
    if (!editingPool?.pool_id) return;

    const currentIds = editingPoolCharacters.map(pc => pc.character_id);
    const toRemove = charList.filter(c => currentIds.includes(c.id));

    if (toRemove.length === 0) {
      showToast('没有角色需要移除', 'info');
      return;
    }

    try {
      for (const char of toRemove) {
        await poolService.removeCharacterFromPool(editingPool.pool_id, char.id);
      }
      const removeIds = toRemove.map(c => c.id);
      setEditingPoolCharacters(prev => prev.filter(pc => !removeIds.includes(pc.character_id)));
      await loadAllPoolCharactersData();
      showToast(`已移除 ${toRemove.length} 个角色`, 'success');
    } catch (error) {
      showToast('批量移除失败: ' + error.message, 'error');
    }
  }, [editingPool, editingPoolCharacters, showToast, loadAllPoolCharactersData]);

  return {
    // 数据
    pools,
    characters,
    poolCharacters,
    filteredPools,
    limitedSixStarCharacters,
    pendingRotationPools,

    // 状态
    loading,
    actionLoading,
    autoRotationProcessing,

    // 搜索筛选排序
    searchQuery,
    setSearchQuery,
    typeFilter,
    setTypeFilter,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,

    // 编辑对话框
    showEditDialog,
    setShowEditDialog,
    editingPool,
    poolForm,
    setPoolForm,
    editingPoolCharacters,

    // 操作
    checkUpCharacterExists,
    resetForm,
    startEdit,
    handleSavePool,
    handleDeletePool,
    handleStartRotation,
    handleProcessAllPendingRotations,
    handleRecalculateIsStandard,

    // 角色池子管理
    toggleCharacterInPool,
    addAllCharactersToPool,
    removeAllCharactersFromPool
  };
};

export default usePools;
