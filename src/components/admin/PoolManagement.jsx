import React, { useState } from 'react';
import { Search, Plus, Database, RotateCw, ArrowUpDown, Filter, CalendarDays, List } from 'lucide-react';
import { usePools } from '../../hooks/admin/usePools';
import { PoolCard, PoolEditDialog } from './pools';
import VirtualizedList from './VirtualizedList';
import HomeVersionTimelineManager from './HomeVersionTimelineManager.jsx';

/**
 * 卡池管理界面
 * 超级管理员专用，用于管理所有卡池的 CRUD 操作
 */
const PoolManagement = ({ showToast }) => {
  const [activeTab, setActiveTab] = useState('pools');
  const {
    // 数据
    pools,
    characters,
    poolCharacters,
    filteredPools,

    // 状态
    loading,
    actionLoading,

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
    editingPool,
    poolForm,
    setPoolForm,
    editingPoolCharacters,
    poolDraftDiff,

    // 操作
    checkUpCharacterExists,
    resetForm,
    startCreate,
    startEdit,
    handleSavePool,
    handleDeletePool,
    handleRecalculateIsStandard,

    // 角色池子管理
    toggleCharacterInPool,
    addAllCharactersToPool,
    removeAllCharactersFromPool
  } = usePools(showToast);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
        <button
          type="button"
          onClick={() => setActiveTab('pools')}
          className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-bold transition-colors ${
            activeTab === 'pools'
              ? 'bg-red-500 text-white'
              : 'text-slate-500 hover:bg-zinc-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <List size={14} />
          卡池列表
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('versions')}
          className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-bold transition-colors ${
            activeTab === 'versions'
              ? 'bg-blue-600 text-white'
              : 'text-slate-500 hover:bg-zinc-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <CalendarDays size={14} />
          版本管理
        </button>
      </div>

      {activeTab === 'versions' ? (
        <HomeVersionTimelineManager pools={pools} showToast={showToast} />
      ) : (
        <>
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
            <option value="extra">附加寻访</option>
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
            className="px-2 py-2 text-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
            title={sortOrder === 'asc' ? '升序' : '降序'}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        <button
          onClick={startCreate}
          className="flex items-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-none transition-colors"
        >
          <Plus size={16} />
          新增卡池
        </button>

        {/* 重新计算限定/常驻按钮 */}
        <button
          onClick={handleRecalculateIsStandard}
          disabled={actionLoading === 'recalculate'}
          className="flex items-center gap-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-none transition-colors disabled:opacity-50"
          title="根据各卡池的UP角色重新计算所有6星记录的限定/常驻状态"
        >
          <RotateCw size={16} className={actionLoading === 'recalculate' ? 'animate-spin' : ''} />
          {actionLoading === 'recalculate' ? '计算中...' : '重算限定/常驻'}
        </button>
      </div>

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
        <VirtualizedList
          items={filteredPools}
          getKey={(pool) => pool.pool_id}
          itemHeight={250}
          maxHeight={720}
          className="space-y-4 pr-1"
          renderItem={(pool) => (
            <div className="pb-4">
              <PoolCard
                pool={pool}
                poolCharacters={poolCharacters}
                characters={characters}
                actionLoading={actionLoading}
                onEdit={startEdit}
                onDelete={handleDeletePool}
              />
            </div>
          )}
        />
      )}

      {/* 编辑对话框 */}
      <PoolEditDialog
        show={showEditDialog}
        editingPool={editingPool}
        poolForm={poolForm}
        setPoolForm={setPoolForm}
        characters={characters}
        editingPoolCharacters={editingPoolCharacters}
        poolDraftDiff={poolDraftDiff}
        actionLoading={actionLoading}
        checkUpCharacterExists={checkUpCharacterExists}
        onSave={handleSavePool}
        onClose={resetForm}
        onToggleCharacter={toggleCharacterInPool}
        onAddAllCharacters={addAllCharactersToPool}
        onRemoveAllCharacters={removeAllCharactersFromPool}
      />
        </>
      )}
    </div>
  );
};

export default PoolManagement;
