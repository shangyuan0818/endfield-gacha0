import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, User, Search, X, ChevronDown } from 'lucide-react';
import { usePoolStore, useAuthStore, useHistoryStore } from '../../stores';
import ImportManager from '../../features/import/ImportManager';
import PoolGroupCardRail from './PoolGroupCardRail';
import { buildPoolSelectorGroups, getPoolGroupId } from '../../utils/poolSelectorDisplay';
import { getPreferredPool } from '../../utils/poolSelectionUtils';
import {
  formatFreshnessAbsolute,
  formatFreshnessRelative,
  getFreshnessTone,
  getLatestHistoryTimestampMs
} from '../../utils/dataFreshness.js';
import { isPoolGroupId } from '../../stores/usePoolStore';
import { getDesktopPathForTab } from '../../constants/appRoutes';
import { useI18n } from '../../i18n/index.js';

function getFreshnessToneClasses(tone) {
  switch (tone) {
    case 'fresh':
      return 'border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'notice':
      return 'border-amber-500/40 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300';
    case 'stale':
      return 'border-red-500/40 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300';
    default:
      return 'border-zinc-200 bg-zinc-50 text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400';
  }
}

function CompactFreshnessCard({
  label,
  title,
  badgeText,
  metaText,
  detailText,
  tone,
  fallback = false
}) {
  return (
    <div className="min-w-0 border border-zinc-200 bg-white/80 px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
            {label}
          </div>
          <div className="text-sm font-bold leading-tight text-slate-800 dark:text-zinc-100 break-words">
            {title}
          </div>
          <div className="text-[11px] leading-tight font-mono text-slate-500 dark:text-zinc-400 break-words">
            {metaText}
          </div>
          {detailText && (
            <div className="text-[10px] leading-tight font-mono text-slate-400 dark:text-zinc-500 break-words">
              {detailText}
            </div>
          )}
        </div>
        <span className={`mt-0.5 shrink-0 px-2 py-1 text-[10px] font-bold border whitespace-nowrap ${getFreshnessToneClasses(tone)} ${fallback ? 'opacity-80' : ''}`}>
          {badgeText}
        </span>
      </div>
    </div>
  );
}

/**
 * 卡池选择器组件 V3 (Technical Style)
 * 卡池管理功能已移至管理页面，仅超管可操作
 */
const PoolSelector = () => {
  const { t, locale, formatNumber } = useI18n();
  const navigate = useNavigate();
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
      searchQuery,
      locale,
    });
  }, [locale, poolPullCounts, searchQuery, selectorPools]);

  const totalPools = pools.length;
  const visiblePools = selectorPools.length;
  const totalPulls = Object.values(poolPullCounts).reduce((a, b) => a + b, 0);
  const allOverviewId = getPoolGroupId('all');
  const showOverviewOptions = Boolean(currentGameUid);

  const switchToPoolGroup = usePoolStore(state => state.switchToPoolGroup);

  const currentAccount = useMemo(() => {
    if (currentGameUid) {
      return gameAccounts.find((account) => account.gameUid === currentGameUid) || null;
    }

    if (gameAccounts.length === 1) {
      return gameAccounts[0];
    }

    return null;
  }, [currentGameUid, gameAccounts]);

  const currentPool = useMemo(() => {
    if (!currentPoolId || isPoolGroupId(currentPoolId)) {
      return null;
    }

    return pools.find((pool) => pool.id === currentPoolId) || null;
  }, [currentPoolId, pools]);

  const currentViewLatestRecordAt = useMemo(() => {
    const latestTimestamp = getLatestHistoryTimestampMs(filteredHistory);
    return latestTimestamp ? new Date(latestTimestamp).toISOString() : null;
  }, [filteredHistory]);

  const currentPoolLatestRecordAt = useMemo(() => {
    if (!currentPoolId || isPoolGroupId(currentPoolId)) {
      return currentViewLatestRecordAt;
    }

    const latestTimestamp = getLatestHistoryTimestampMs(
      filteredHistory.filter((record) => record.poolId === currentPoolId || record.pool_id === currentPoolId)
    );

    return latestTimestamp ? new Date(latestTimestamp).toISOString() : null;
  }, [currentPoolId, currentViewLatestRecordAt, filteredHistory]);

  const currentPoolFreshnessLabel = currentPool
    ? t('pool.selector.currentBanner', { name: currentPool.name })
    : t('pool.selector.currentFilter');

  const totalPart = visiblePools !== totalPools ? `/${formatNumber(totalPools)}` : '';
  const summaryLabel = t('pool.selector.summary', {
    visible: formatNumber(visiblePools),
    totalPart,
    pulls: formatNumber(totalPulls)
  });

  useEffect(() => {
    if (gameAccounts.length === 1) {
      const onlyAccountUid = gameAccounts[0]?.gameUid || null;
      if (onlyAccountUid && currentGameUid !== onlyAccountUid) {
        switchGameAccount(onlyAccountUid);
      }
      return;
    }

    if (currentGameUid && !gameAccounts.some((account) => account.gameUid === currentGameUid)) {
      switchGameAccount(null);
    }
  }, [currentGameUid, gameAccounts, switchGameAccount]);

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
      <div className="flex flex-wrap items-center gap-4">
        {/* 导入按钮 & 账号切换 */}
        <div className="flex items-center gap-3">
          {user ? (
            <button
              id="guide-import-btn"
              onClick={() => setShowImportManager(true)}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 dark:bg-zinc-100 hover:bg-zinc-700 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold uppercase tracking-wider transition-all"
            >
              <Upload size={14} />
              {t('pool.selector.import')}
            </button>
          ) : (
            <div id="guide-import-btn" className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
              {t('pool.selector.loginToImport')}
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
                  {gameAccounts.find(a => a.gameUid === currentGameUid)?.nickName || t('pool.selector.allAccounts')}
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
                    {t('pool.selector.allAccounts')}
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
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                        {t('pool.selector.accountRecordCount', {
                          uid: account.gameUid,
                          count: formatNumber(account.recordCount || 0)
                        })}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400 dark:text-zinc-500">
                        {t('settings.lastImport', {
                          value: formatFreshnessRelative(account.lastImportedAt, t('common.timeUnknown'), locale)
                        })}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 搜索与统计 */}
        <div className="ml-auto flex items-center gap-4">
          {/* 数据新鲜度与搜索 */}
          <div className="flex items-center gap-3">
            {/* 账号与卡池数据状态 (紧凑版) */}
            <div className="hidden md:flex items-center gap-2 border-r border-zinc-200 dark:border-zinc-800 pr-3">
              {(currentAccount || gameAccounts.length > 1) && (
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 border text-[10px] font-mono transition-colors rounded ${getFreshnessToneClasses(getFreshnessTone(currentAccount?.lastImportedAt))}`}
                  title={currentAccount
                    ? `${currentAccount.nickName} · ${t('pool.selector.meta.imported', { value: formatFreshnessAbsolute(currentAccount.lastImportedAt, null, locale, { includeYear: false }) })}`
                    : t('pool.selector.switchAccountHint')}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${!currentAccount ? 'bg-zinc-400' : getFreshnessTone(currentAccount.lastImportedAt) === 'fresh' ? 'bg-emerald-500 animate-pulse' : getFreshnessTone(currentAccount.lastImportedAt) === 'notice' ? 'bg-amber-500' : 'bg-red-500'}`} />
                  <span className="hidden xl:inline font-bold tracking-widest uppercase">{t('pool.selector.accountStatus', 'ACCOUNT')}:</span>
                  <span>{currentAccount ? formatFreshnessRelative(currentAccount.lastImportedAt, t('common.importTimeUnknown'), locale) : t('pool.selector.switchAccountHint')}</span>
                </div>
              )}
              {currentPoolLatestRecordAt && (
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 border text-[10px] font-mono transition-colors rounded ${getFreshnessToneClasses(getFreshnessTone(currentPoolLatestRecordAt))}`}
                  title={`${currentPoolFreshnessLabel} · ${t('pool.selector.meta.latestRecord', { value: formatFreshnessAbsolute(currentPoolLatestRecordAt, null, locale, { includeYear: false }) })}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${getFreshnessTone(currentPoolLatestRecordAt) === 'fresh' ? 'bg-emerald-500 animate-pulse' : getFreshnessTone(currentPoolLatestRecordAt) === 'notice' ? 'bg-amber-500' : 'bg-red-500'}`} />
                  <span className="hidden xl:inline font-bold tracking-widest uppercase">{t('pool.selector.poolStatus', 'POOL')}:</span>
                  <span>{formatFreshnessRelative(currentPoolLatestRecordAt, t('pool.selector.noRecords'), locale)}</span>
                </div>
              )}
            </div>

            {zeroPullPoolCount > 0 && (
              <button
                type="button"
                onClick={() => setHideZeroPullPools((value) => !value)}
                className={`flex items-center gap-2 px-2.5 py-1.5 border text-[11px] font-mono transition-colors ${
                  hideZeroPullPools
                    ? 'border-emerald-500/50 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border-zinc-200 bg-white text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
                title={hideZeroPullPools ? t('pool.selector.hideZeroTitle') : t('pool.selector.showZeroTitle')}
              >
                <span className={`h-2 w-2 rounded-full ${hideZeroPullPools ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-500'}`} />
                <span>{hideZeroPullPools ? t('pool.selector.hideZeroLabel') : t('pool.selector.showZeroLabel')}</span>
              </button>
            )}

            {totalPools > 5 && (
              <div className="relative group">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 group-focus-within:text-yellow-500 transition-colors" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('pool.selector.searchPlaceholder')}
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
            {summaryLabel}
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
            title: t('pool.selector.allOverview'),
            totalPools: visiblePools,
            totalPulls,
            isSelected: currentPoolId === allOverviewId,
            onClick: () => switchToPoolGroup('all')
          } : null}
        />
      ) : (
        <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="text-slate-400 dark:text-zinc-500 text-sm font-mono">
            {searchQuery ? t('pool.selector.noMatches') : (user ? t('pool.selector.noPoolDataImport') : t('pool.selector.noPoolData'))}
          </div>
        </div>
      )}

      {/* 导入管理器 */}
      {showImportManager && (
        <ImportManager
          isOpen={showImportManager}
          onClose={() => {
            setShowImportManager(false);
          }}
          onImportComplete={() => {
            setShowImportManager(false);
            navigate(getDesktopPathForTab('dashboard'));
          }}
        />
      )}
    </div>
  );
};

export default PoolSelector;
