/**
 * 角色管理界面
 * 超级管理员专用，用于管理所有角色的 CRUD 操作
 *
 * @version 2.0.0 - 重构版本，使用 hooks 和子组件
 * @date 2026-02-04
 */

import React from 'react';
import { Search, Plus, Edit2, Trash2, RefreshCw, CloudUpload, User, Swords, Package } from 'lucide-react';
import { useCharacters } from '../../hooks/admin/useCharacters';
import { CharacterTable, CharacterEditDialog, BatchEditDialog } from './characters';

/**
 * 角色管理组件
 */
const CharacterManagement = ({ showToast }) => {
  const {
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
    handleSyncFromAPI
  } = useCharacters({ showToast });

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
            onClick={openBatchEditDialog}
            disabled={actionLoading}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
          >
            <Edit2 size={14} />
            批量编辑
          </button>
          <button
            onClick={handleBatchDelete}
            disabled={actionLoading}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
          >
            <Trash2 size={14} />
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
        <CharacterTable
          characters={filteredCharacters}
          selectedIds={selectedIds}
          isAllSelected={isAllSelected}
          actionLoading={actionLoading}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          onToggleSelect={toggleSelect}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          onEdit={startEdit}
          onDelete={deleteCharacter}
        />
      )}

      {/* 编辑对话框 */}
      <CharacterEditDialog
        show={showEditDialog}
        editingCharacter={editingCharacter}
        characterForm={characterForm}
        setCharacterForm={setCharacterForm}
        aliasInput={aliasInput}
        setAliasInput={setAliasInput}
        actionLoading={actionLoading}
        onSave={saveCharacter}
        onClose={resetForm}
        onAddAlias={addAlias}
        onRemoveAlias={removeAlias}
      />

      {/* 批量编辑对话框 */}
      <BatchEditDialog
        show={showBatchEditDialog}
        selectedCount={selectedIds.size}
        batchEditForm={batchEditForm}
        setBatchEditForm={setBatchEditForm}
        actionLoading={actionLoading}
        onExecute={executeBatchEdit}
        onClose={closeBatchEditDialog}
      />
    </div>
  );
};

export default CharacterManagement;
