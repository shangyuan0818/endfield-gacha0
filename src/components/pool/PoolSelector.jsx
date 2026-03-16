import React, { useEffect, useMemo, useState } from 'react';
import { Upload, User, Search, X, ChevronDown } from 'lucide-react';
import { usePoolStore, useAuthStore, useHistoryStore } from '../../stores';
import ImportManager from '../../features/import/ImportManager';
import PoolGroupCardRail from './PoolGroupCardRail';
import { buildPoolSelectorGroups, getPoolGroupId } from '../../utils/poolSelectorDisplay';
import { getPreferredPool } from '../../utils/poolSelectionUtils';
import { isPoolGroupId } from '../../stores/usePoolStore';

/**
 * 卡池选择器组件 V3 (Technical Style)
 * 卡池管理功能已移至管理页面，仅超管可操作
 */
const PoolSelector = () => {
  // 从 stores 获取状态
  const pools = usePoolStore(state => state.pools);
  const currentPoolId = usePoolStore(state => state.currentPoolId);
  const switchPool = usePoolStore(state => state.switchPool);
  const currentGameUid = usePoolStore(state => state.currentGameUid);
  const switchGameAccount = usePoolStore(state => state.switchGameAccount);
  const history = useHistoryStore(state => state.history);
  const getGameAccountsFromHistory = useHistoryStore(state => state.getGameAccountsFromHistory);

  const user = useAuthStore(state => state.user);

  // UI状态
  const [showImportManager, setShowImportManager] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [hideZeroPullPools, setHideZeroPullPools] = useState(true);

  // 获取所有游戏账号（从历史记录）
  const gameAccounts = useMemo(() => {
    return getGameAccountsFromHistory();
  }, [history, getGameAccountsFromHistory]); // 依赖history而不是pools

  // 根据当前选中账号过滤历史记录
  const filteredHistory = useMemo(() => {
    if (!currentGameUid) {
      return history; // 全部账号
    }
    return history.filter(h => h.gameUid === currentGameUid || h.game_uid === currentGameUid);
  }, [history, currentGameUid]);

  // 直接使用所有卡池（不再按账号筛选）
  const filteredPools = pools;

  // 计算每个卡池的抽数（根据当前账号过滤）
  const poolPullCounts = useMemo(() => {
    const counts = {};
    filteredHistory.forEach(h => {
      counts[h.poolId] = (counts[h.poolId] || 0) + 1;
    });
    return counts;
  }, [filteredHistory]);

  const zeroPullPoolCount = useMemo(() => (
    filteredPools.filter((pool) => (poolPullCounts[pool.id] || 0) === 0).length
  ), [filteredPools, poolPullCounts]);

  const selectorPools = useMemo(() => (
    filteredPools.filter((pool) => (
      !hideZeroPullPools ||
      (poolPullCounts[pool.id] || 0) > 0 ||
      pool.id === currentPoolId
    ))
  ), [currentPoolId, filteredPools, hideZeroPullPools, poolPullCounts]);

  // 按类型分组并排序的卡池
  const sortedPoolsWithGroups = useMemo(() => {
    return buildPoolSelectorGroups({
      pools: selectorPools,
      poolPullCounts,
      searchQuery
    });
  }, [poolPullCounts, searchQuery, selectorPools]);

  const totalPools = pools.length;
  const visiblePools = selectorPools.length;
  const totalPulls = Object.values(poolPullCounts).reduce((a, b) => a + b, 0);
  const allOverviewId = getPoolGroupId('all');
  const showOverviewOptions = Boolean(currentGameUid);

  const switchToPoolGroup = usePoolStore(state => state.switchToPoolGroup);

  useEffect(() => {
    if (showOverviewOptions || !isPoolGroupId(currentPoolId)) {
      return;
    }

    const fallbackPool = getPreferredPool(filteredPools, {
      preferredPoolId: null,
      includeDefaultPool: true
    });

    if (fallbackPool?.id) {
      switchPool(fallbackPool.id);
    }
  }, [currentPoolId, filteredPools, showOverviewOptions, switchPool]);

  return (
    <div className="space-y-4">
      {/* 顶部工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* 导入按钮 & 账号切换 */}
        <div className="flex items-center gap-3">
          {user ? (
            <button
              onClick={() => setShowImportManager(true)}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 dark:bg-zinc-100 hover:bg-zinc-700 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold uppercase tracking-wider transition-all"
            >
              <Upload size={14} />
              导入数据
            </button>
          ) : (
            <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
              [ 请登录以导入数据 ]
            </div>
          )}

          {/* 账号切换器 - 仅在有多个账号时显示 */}
          {gameAccounts.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-xs font-mono transition-colors"
              >
                <User size={14} className="text-slate-500 dark:text-zinc-400" />
                <span className="text-slate-700 dark:text-zinc-300">
                  {gameAccounts.find(a => a.gameUid === currentGameUid)?.nickName || '全部账号'}
                </span>
                {gameAccounts.find(a => a.gameUid === currentGameUid)?.serverTag && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-sm bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300">
                    {gameAccounts.find(a => a.gameUid === currentGameUid)?.serverTag}
                  </span>
                )}
                <ChevronDown size={12} className={`text-slate-400 transition-transform ${showAccountDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showAccountDropdown && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-lg z-20">
                  <button
                    onClick={() => {
                      switchGameAccount(null);
                      setShowAccountDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs font-mono hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors ${
                      !currentGameUid ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' : 'text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    全部账号
                  </button>
                  {gameAccounts.map(account => (
                    <button
                      key={account.gameUid}
                      onClick={() => {
                        switchGameAccount(account.gameUid);
                        setShowAccountDropdown(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs font-mono hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors ${
                        currentGameUid === account.gameUid ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' : 'text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="font-bold">{account.nickName}</div>
                        {account.serverTag && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-sm bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300">
                            {account.serverTag}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400">UID: {account.gameUid}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 搜索与统计 */}
        <div className="flex items-center gap-4">
          {/* 搜索 */}
          <div className="flex items-center gap-3">
            {zeroPullPoolCount > 0 && (
              <button
                type="button"
                onClick={() => setHideZeroPullPools((value) => !value)}
                className={`flex items-center gap-2 px-2.5 py-1.5 border text-[11px] font-mono transition-colors ${
                  hideZeroPullPools
                    ? 'border-emerald-500/50 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border-zinc-200 bg-white text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
                title={hideZeroPullPools ? '当前会隐藏零抽数卡池' : '当前会显示零抽数卡池'}
              >
                <span className={`h-2 w-2 rounded-full ${hideZeroPullPools ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-500'}`} />
                <span>{hideZeroPullPools ? '隐藏零抽卡池' : '显示零抽卡池'}</span>
              </button>
            )}

            {totalPools > 5 && (
              <div className="relative group">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 group-focus-within:text-yellow-500 transition-colors" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="SEARCH POOLS..."
                  className="w-40 pl-8 pr-8 py-1.5 text-xs bg-transparent border-b border-zinc-200 dark:border-zinc-700 focus:border-yellow-500 outline-none text-slate-700 dark:text-zinc-300 font-mono placeholder:text-slate-300 dark:placeholder:text-zinc-700 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-zinc-500"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 统计 */}
          <div className="text-xs font-mono text-slate-500 dark:text-zinc-400">
            <span className="text-slate-700 dark:text-zinc-300 font-bold">{visiblePools}</span>
            {visiblePools !== totalPools && (
              <span className="text-slate-400 dark:text-zinc-500">/{totalPools}</span>
            )} POOLS /
            <span className="text-slate-700 dark:text-zinc-300 font-bold ml-1">{totalPulls}</span> PULLS
          </div>
        </div>
      </div>

      {/* 卡池列表 */}
      {sortedPoolsWithGroups.length > 0 ? (
        <PoolGroupCardRail
          groups={sortedPoolsWithGroups}
          currentSelectionId={currentPoolId}
          onSelectGroup={showOverviewOptions ? switchToPoolGroup : undefined}
          onSelectPool={switchPool}
          showGroupOverviewCards={showOverviewOptions}
          leadingOverview={showOverviewOptions ? {
            title: '全部卡池总览',
            totalPools: visiblePools,
            totalPulls,
            isSelected: currentPoolId === allOverviewId,
            onClick: () => switchToPoolGroup('all')
          } : null}
        />
      ) : (
        <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="text-slate-400 dark:text-zinc-500 text-sm font-mono">
            {searchQuery ? 'NO MATCHES FOUND' : (user ? 'NO DATA • IMPORT TO START' : 'NO DATA')}
          </div>
        </div>
      )}

      {/* 导入管理器 */}
      {showImportManager && (
        <ImportManager
          isOpen={showImportManager}
          onClose={() => {
            console.log('[PoolSelector] 关闭导入管理器');
            setShowImportManager(false);
          }}
          onImportComplete={(result) => {
            // ⚠️ 什么都不做，让 ImportManager 自己控制显示
            // 避免父组件状态更新导致 ImportManager 重新渲染
            console.log('[PoolSelector] 导入完成（不做任何操作）:', result);
          }}
        />
      )}
    </div>
  );
};

export default PoolSelector;
