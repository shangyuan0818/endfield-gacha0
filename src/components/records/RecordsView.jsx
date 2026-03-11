import React, { useMemo, useRef, useState } from 'react';
import { CalendarRange, Download, FileJson, Filter, History, Upload } from 'lucide-react';
import { useHistoryStore, useAuthStore, usePoolStore } from '../../stores';
import { useCurrentPoolData, useCurrentPoolGroupedHistory } from '../../hooks';
import BatchCard from '../BatchCard';
import { isPoolGroupId } from '../../stores/usePoolStore';

/**
 * 记录列表组件
 * 显示历史抽卡记录，支持筛选、导入、导出、分页
 */
const RecordsView = ({
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
  const getGameAccountsFromHistory = useHistoryStore(state => state.getGameAccountsFromHistory);

  const userRole = useAuthStore(state => state.userRole);
  const canEdit = userRole === 'admin' || userRole === 'super_admin';
  const pools = usePoolStore(state => state.pools);
  const currentPoolId = usePoolStore(state => state.currentPoolId);
  const currentGameUid = usePoolStore(state => state.currentGameUid);

  const {
    currentPool,
    normalizedCurrentPoolHistory
  } = useCurrentPoolData();

  const canEditCurrentPool = canEdit && !(currentPool?.locked && userRole !== 'super_admin');

  const {
    filteredGroupedHistory
  } = useCurrentPoolGroupedHistory(normalizedCurrentPoolHistory);

  const buildDefaultExportOptions = () => ({
    poolFilter: 'current',
    poolId: !isPoolGroupId(currentPoolId) && currentPoolId ? currentPoolId : '',
    accountFilter: currentGameUid ? 'current' : 'all',
    gameUid: currentGameUid || '',
    dateFrom: '',
    dateTo: ''
  });

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportOptions, setExportOptions] = useState(buildDefaultExportOptions);

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
      setShowExportMenu(false);
    }
  };

  // 当前卡池名称
  const currentPoolName = currentPool?.name || '未知卡池';
  const poolOptions = useMemo(
    () => [...(Array.isArray(pools) ? pools : [])].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-CN')),
    [pools]
  );
  const gameAccounts = getGameAccountsFromHistory();

  const updateExportOption = (key, value) => {
    setExportOptions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const buildExportOptions = () => ({
    poolFilter: exportOptions.poolFilter,
    poolId: exportOptions.poolFilter === 'specific' ? exportOptions.poolId || null : null,
    accountFilter: exportOptions.accountFilter,
    gameUid: exportOptions.accountFilter === 'specific' ? exportOptions.gameUid || null : null,
    dateFrom: exportOptions.dateFrom,
    dateTo: exportOptions.dateTo
  });

  const canExportWithSpecificPool = exportOptions.poolFilter !== 'specific' || Boolean(exportOptions.poolId);
  const canExportWithSpecificAccount = exportOptions.accountFilter !== 'specific' || Boolean(exportOptions.gameUid);
  const canExport = canExportWithSpecificPool && canExportWithSpecificAccount;

  const handleToggleExportMenu = () => {
    setShowExportMenu(prev => {
      const next = !prev;
      if (next) {
        setExportOptions(buildDefaultExportOptions());
      }
      return next;
    });
  };

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
                  ? 'rainbow-bg text-white shadow-sm'
                  : 'text-slate-500 dark:text-zinc-400 hover:rainbow-text'
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
              onClick={handleToggleExportMenu}
              className="text-xs bg-slate-800 text-white hover:bg-slate-700 px-3 py-1.5 rounded-none flex items-center gap-2 transition-colors shadow-sm"
            >
              <Download size={14} />
              导出...
            </button>

            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={closeExportMenu}></div>
                <div className="absolute top-full right-0 mt-2 w-[360px] bg-white dark:bg-zinc-900 rounded-none shadow-xl border border-zinc-100 dark:border-zinc-800 z-20 animate-fade-in overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-2">
                          <Filter size={14} />
                          导出配置
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500 dark:text-zinc-500">
                          支持按时间、卡池和账号筛选，JSON 会附带结构化摘要与 schema 版本。
                        </div>
                      </div>
                      <button
                        onClick={() => setExportOptions(buildDefaultExportOptions())}
                        className="text-[11px] text-slate-500 dark:text-zinc-400 hover:text-yellow-600 dark:hover:text-endfield-yellow"
                      >
                        重置
                      </button>
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">
                        卡池范围
                      </label>
                      <select
                        value={exportOptions.poolFilter}
                        onChange={(event) => updateExportOption('poolFilter', event.target.value)}
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-slate-700 dark:text-zinc-200 rounded-none"
                      >
                        <option value="current">当前卡池</option>
                        <option value="all">全部卡池</option>
                        <option value="specific">指定卡池</option>
                      </select>
                      {exportOptions.poolFilter === 'specific' && (
                        <select
                          value={exportOptions.poolId}
                          onChange={(event) => updateExportOption('poolId', event.target.value)}
                          className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-slate-700 dark:text-zinc-200 rounded-none"
                        >
                          <option value="">请选择卡池</option>
                          {poolOptions.map(pool => (
                            <option key={pool.id} value={pool.id}>
                              {pool.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">
                        账号范围
                      </label>
                      <select
                        value={exportOptions.accountFilter}
                        onChange={(event) => updateExportOption('accountFilter', event.target.value)}
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-slate-700 dark:text-zinc-200 rounded-none"
                      >
                        <option value="all">全部账号</option>
                        {currentGameUid && <option value="current">当前账号</option>}
                        <option value="specific">指定账号</option>
                      </select>
                      {exportOptions.accountFilter === 'specific' && (
                        <select
                          value={exportOptions.gameUid}
                          onChange={(event) => updateExportOption('gameUid', event.target.value)}
                          className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-slate-700 dark:text-zinc-200 rounded-none"
                        >
                          <option value="">请选择账号</option>
                          {gameAccounts.map(account => (
                            <option key={account.gameUid} value={account.gameUid}>
                              {account.nickName} · {account.gameUid}{account.serverTag ? ` · ${account.serverTag}` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                        <CalendarRange size={12} />
                        时间范围
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={exportOptions.dateFrom}
                          onChange={(event) => updateExportOption('dateFrom', event.target.value)}
                          className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-slate-700 dark:text-zinc-200 rounded-none"
                        />
                        <input
                          type="date"
                          value={exportOptions.dateTo}
                          onChange={(event) => updateExportOption('dateTo', event.target.value)}
                          className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-slate-700 dark:text-zinc-200 rounded-none"
                        />
                      </div>
                    </div>

                    <div className="rounded-none border border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-3 py-2 text-[11px] text-slate-500 dark:text-zinc-500 space-y-1">
                      <div>当前卡池：{currentPoolName}</div>
                      <div>当前账号：{currentGameUid || '全部账号'}</div>
                      <div>CSV 采用 UTF-8 BOM 与平铺字段，便于 Excel 直接打开。</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-px border-t border-zinc-100 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800">
                    <button
                      onClick={() => {
                        onExportJSON(buildExportOptions());
                        closeExportMenu();
                      }}
                      disabled={!canExport}
                      className="bg-white dark:bg-zinc-900 px-4 py-3 text-sm font-medium text-slate-600 dark:text-zinc-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 hover:text-yellow-600 dark:hover:text-endfield-yellow disabled:text-slate-300 disabled:hover:bg-white disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <FileJson size={14} />
                      导出 JSON
                    </button>
                    <button
                      onClick={() => {
                        onExportCSV(buildExportOptions());
                        closeExportMenu();
                      }}
                      disabled={!canExport}
                      className="bg-white dark:bg-zinc-900 px-4 py-3 text-sm font-medium text-slate-600 dark:text-zinc-300 hover:bg-green-50 dark:hover:bg-green-950/30 hover:text-green-600 dark:hover:text-green-400 disabled:text-slate-300 disabled:hover:bg-white disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Download size={14} />
                      导出 CSV
                    </button>
                  </div>
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
                poolType={currentPool?.type}
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
