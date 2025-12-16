import React, { useRef } from 'react';
import { History, Upload, Download, FileJson } from 'lucide-react';
import { useHistoryStore, usePoolStore, useAuthStore, useUIStore } from '../../stores';
import { BatchCard } from '../';

/**
 * 记录列表组件
 * 显示历史抽卡记录，支持筛选、导入、导出、分页
 */
const RecordsView = ({
  filteredGroupedHistory,
  currentPool,
  canEditCurrentPool,
  onEdit,
  onDeleteGroup,
  onImportFile,
  onExportJSON,
  onExportCSV
}) => {
  // 从 stores 获取状态
  const historyFilter = useHistoryStore(state => state.historyFilter);
  const visibleHistoryCount = useHistoryStore(state => state.visibleHistoryCount);
  const setHistoryFilter = useHistoryStore(state => state.setHistoryFilter);
  const loadMoreHistory = useHistoryStore(state => state.loadMoreHistory);
  const setVisibleHistoryCount = useHistoryStore(state => state.setVisibleHistoryCount);

  const pools = usePoolStore(state => state.pools);
  const currentPoolId = usePoolStore(state => state.currentPoolId);

  const userRole = useAuthStore(state => state.userRole);
  const canEdit = userRole === 'admin' || userRole === 'super_admin';

  // UI 状态（导出菜单）从 store 获取
  const showExportMenu = useUIStore(state => state.showExportMenu);
  const toggleExportMenu = useUIStore(state => state.toggleExportMenu);
  const closeAllMenus = useUIStore(state => state.closeAllMenus);

  // 文件输入 ref
  const fileInputRef = useRef(null);

  // 切换筛选器
  const handleFilterChange = (filter) => {
    setHistoryFilter(filter);
    setVisibleHistoryCount(20); // 重置显示数量
  };

  // 关闭导出菜单
  const closeExportMenu = () => {
    if (showExportMenu) {
      toggleExportMenu();
    }
  };

  // 当前卡池名称
  const currentPoolName = pools.find(p => p.id === currentPoolId)?.name || '未知卡池';

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-fade-in relative">
      {/* 标题栏 */}
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-950 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <h3 className="font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
            <History size={18} /> 详细日志
          </h3>
          <span className="text-xs px-2 py-1 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-endfield-yellow rounded-none">
            {currentPoolName}
          </span>
        </div>

        <div className="flex gap-2">
          {/* 筛选按钮 */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 rounded-none p-0.5">
            <button
              onClick={() => handleFilterChange('all')}
              className={`text-xs px-2 py-1 rounded-none transition-colors ${
                historyFilter === 'all'
                  ? 'bg-white dark:bg-zinc-700 text-slate-800 dark:text-zinc-100 shadow-sm'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => handleFilterChange('6star')}
              className={`text-xs px-2 py-1 rounded-none transition-colors ${
                historyFilter === '6star'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-orange-500'
              }`}
            >
              6星
            </button>
            <button
              onClick={() => handleFilterChange('5star')}
              className={`text-xs px-2 py-1 rounded-none transition-colors ${
                historyFilter === '5star'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-amber-500'
              }`}
            >
              5星
            </button>
          </div>

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
                onChange={onImportFile}
                className="hidden"
                accept=".json"
              />
            </>
          )}

          {/* 导出菜单 */}
          <div className="relative">
            <button
              onClick={toggleExportMenu}
              className="text-xs bg-slate-800 text-white hover:bg-slate-700 px-3 py-1.5 rounded-none flex items-center gap-2 transition-colors shadow-sm"
            >
              <Download size={14} />
              导出...
            </button>

            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={closeExportMenu}></div>
                <div className="absolute top-full right-0 mt-2 w-40 bg-white dark:bg-zinc-900 rounded-none shadow-xl border border-zinc-100 dark:border-zinc-800 z-20 py-2 animate-fade-in overflow-hidden">
                  <div className="px-3 py-2 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider bg-slate-50 dark:bg-zinc-950">
                    JSON 备份
                  </div>
                  <button
                    onClick={() => {
                      onExportJSON('all');
                      closeExportMenu();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 hover:text-yellow-600 dark:hover:text-endfield-yellow flex items-center justify-between"
                  >
                    全部卡池 <FileJson size={14} />
                  </button>
                  <button
                    onClick={() => {
                      onExportJSON('current');
                      closeExportMenu();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 hover:text-yellow-600 dark:hover:text-endfield-yellow flex items-center justify-between"
                  >
                    当前卡池 <FileJson size={14} />
                  </button>

                  <div className="border-t border-zinc-100 dark:border-zinc-800 my-1"></div>

                  <div className="px-3 py-2 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider bg-slate-50 dark:bg-zinc-950">
                    CSV 表格
                  </div>
                  <button
                    onClick={() => {
                      onExportCSV('all');
                      closeExportMenu();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:bg-green-50 hover:text-green-600 flex items-center justify-between"
                  >
                    全部卡池 <FileJson size={14} />
                  </button>
                  <button
                    onClick={() => {
                      onExportCSV('current');
                      closeExportMenu();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:bg-green-50 hover:text-green-600 flex items-center justify-between"
                  >
                    当前卡池 <FileJson size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 记录列表 */}
      <div className="max-h-[800px] overflow-y-auto bg-slate-50 dark:bg-zinc-950/50">
        {filteredGroupedHistory.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-zinc-500">
            {historyFilter === 'all'
              ? '当前卡池暂无记录'
              : `当前卡池暂无${historyFilter === '6star' ? '6星' : '5星'}记录`}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredGroupedHistory.slice(0, visibleHistoryCount).map((group, idx) => (
              <BatchCard
                key={idx}
                group={group}
                onEdit={onEdit}
                onDeleteGroup={onDeleteGroup}
                poolType={currentPool.type}
                canEdit={canEditCurrentPool}
              />
            ))}

            {/* 加载更多按钮 */}
            {visibleHistoryCount < filteredGroupedHistory.length && (
              <div className="p-4 flex justify-center">
                <button
                  onClick={loadMoreHistory}
                  className="text-sm text-slate-500 dark:text-zinc-500 hover:text-yellow-600 dark:hover:text-endfield-yellow font-medium px-6 py-2 rounded-sm border border-zinc-200 dark:border-zinc-800 hover:border-yellow-200 dark:hover:border-yellow-800 bg-white dark:bg-zinc-900 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-all shadow-sm"
                >
                  加载更多 ({filteredGroupedHistory.length - visibleHistoryCount} 条剩余)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordsView;
