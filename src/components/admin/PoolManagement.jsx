import React, { useState } from 'react';
import { Search, Plus, Database, RotateCw, ArrowUpDown, Filter, CalendarDays, List } from 'lucide-react';
import { usePools } from '../../hooks/admin/usePools';
import { PoolCard, PoolEditDialog } from './pools';
import VirtualizedList from './VirtualizedList';
import HomeVersionTimelineManager from './HomeVersionTimelineManager.jsx';
import { PanelSection, PanelToolbarButton } from './panels/shared/PanelUi.jsx';

const INPUT_CLASS = 'border border-zinc-300 bg-white text-xs text-slate-700 outline-none transition-colors focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:focus:border-endfield-yellow';

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
      <div className="animate-fade-in-up flex flex-col items-center justify-center gap-3 border border-zinc-200 bg-white py-16 text-slate-400 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
        <RotateCw size={20} className="animate-spin" />
        <span className="text-xs uppercase tracking-widest">正在读取卡池数据</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="animate-fade-in-up flex border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setActiveTab('pools')}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
            activeTab === 'pools'
              ? 'bg-slate-900 text-white dark:bg-endfield-yellow dark:text-black'
              : 'text-slate-500 hover:bg-zinc-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
          }`}
        >
          <List size={14} />
          卡池列表
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('versions')}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
            activeTab === 'versions'
              ? 'bg-slate-900 text-white dark:bg-endfield-yellow dark:text-black'
              : 'text-slate-500 hover:bg-zinc-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
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
      <PanelSection
        title="卡池列表"
        icon={Database}
        delay={40}
        action={(
          <span className="text-[11px] text-slate-500 dark:text-zinc-500">
            显示 <span className="font-mono font-semibold text-slate-700 dark:text-zinc-300">{filteredPools.length}</span> / <span className="font-mono">{pools.length}</span> 个卡池
          </span>
        )}
      >
        {/* 工具栏 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索卡池名称或UP角色..."
              className={`w-full py-2 pl-8 pr-3 ${INPUT_CLASS}`}
            />
          </div>

          {/* 类型筛选 */}
          <div className="flex items-center gap-1">
            <Filter size={14} className="text-slate-400 dark:text-zinc-500" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={`px-2 py-2 ${INPUT_CLASS}`}
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
            <ArrowUpDown size={14} className="text-slate-400 dark:text-zinc-500" />
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              className={`px-2 py-2 ${INPUT_CLASS}`}
            >
              <option value="created_at">创建时间</option>
              <option value="start_time">开始时间</option>
              <option value="end_time">结束时间</option>
              <option value="name">名称</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="border border-zinc-300 bg-white px-2.5 py-2 font-mono text-xs text-slate-700 transition-all hover:border-amber-500 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-endfield-yellow dark:hover:bg-zinc-800"
              title={sortOrder === 'asc' ? '升序' : '降序'}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          <PanelToolbarButton onClick={startCreate} tone="primary">
            <Plus size={14} />
            新增卡池
          </PanelToolbarButton>

          {/* 重新计算限定/常驻按钮 */}
          <button
            onClick={handleRecalculateIsStandard}
            disabled={actionLoading === 'recalculate'}
            className="inline-flex items-center gap-2 border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            title="根据各卡池的UP角色重新计算所有6星记录的限定/常驻状态"
          >
            <RotateCw size={14} className={actionLoading === 'recalculate' ? 'animate-spin' : ''} />
            {actionLoading === 'recalculate' ? '计算中...' : '重算限定/常驻'}
          </button>
        </div>

        {/* 卡池列表 */}
        <div className="mt-3">
          {filteredPools.length === 0 ? (
            <div className="border border-dashed border-zinc-200 p-10 text-center text-slate-400 dark:border-zinc-800 dark:text-zinc-500">
              <Database size={40} className="mx-auto mb-3 opacity-50" />
              <p className="text-xs uppercase tracking-widest">{pools.length === 0 ? '暂无卡池' : '未找到匹配的卡池'}</p>
            </div>
          ) : (
            <VirtualizedList
              items={filteredPools}
              getKey={(pool) => pool.pool_id}
              itemHeight={250}
              maxHeight={720}
              className="space-y-3 pr-1"
              renderItem={(pool, index) => (
                <div
                  className="animate-fade-in-up-small pb-3"
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                >
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
        </div>
      </PanelSection>

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
