import React from 'react';
import { Search, Plus, Database, RefreshCw, RotateCw, AlertTriangle, ArrowUpDown, Filter } from 'lucide-react';
import { usePools } from '../../hooks/admin/usePools';
import { PoolCard, PoolEditDialog } from './pools';

/**
 * 卡池管理界面
 * 超级管理员专用，用于管理所有卡池的 CRUD 操作
 */
const PoolManagement = ({ showToast }) => {
  const {
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
            className="px-2 py-2 text-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
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
                onClick={handleProcessAllPendingRotations}
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
            <PoolCard
              key={pool.pool_id}
              pool={pool}
              poolCharacters={poolCharacters}
              characters={characters}
              limitedSixStarCharacters={limitedSixStarCharacters}
              actionLoading={actionLoading}
              onEdit={startEdit}
              onDelete={handleDeletePool}
              onStartRotation={handleStartRotation}
            />
          ))}
        </div>
      )}

      {/* 编辑对话框 */}
      <PoolEditDialog
        show={showEditDialog}
        editingPool={editingPool}
        poolForm={poolForm}
        setPoolForm={setPoolForm}
        characters={characters}
        editingPoolCharacters={editingPoolCharacters}
        actionLoading={actionLoading}
        checkUpCharacterExists={checkUpCharacterExists}
        onSave={handleSavePool}
        onClose={resetForm}
        onToggleCharacter={toggleCharacterInPool}
        onAddAllCharacters={addAllCharactersToPool}
        onRemoveAllCharacters={removeAllCharactersFromPool}
      />
    </div>
  );
};

export default PoolManagement;
