import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, Star, Layers, Swords, User, Lock, Check, Upload, Search, X
} from 'lucide-react';
import { usePoolStore, useHistoryStore, useAuthStore } from '../../stores';
import { isPoolGroupId, POOL_GROUP_PREFIX } from '../../stores/usePoolStore';
import ImportManager from '../../features/import/ImportManager';
import {
  formatFreshnessAbsolute,
  formatFreshnessRelative,
  getFreshnessTone,
  getLatestHistoryTimestampMs
} from '../../utils/dataFreshness.js';
import { getPreferredPool } from '../../utils/poolSelectionUtils';
import { buildPoolSelectorGroups, getPoolTypeLabel } from '../../utils/poolSelectorDisplay';
import { getMobilePathForTab } from '../../constants/appRoutes';
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
      return 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400';
  }
}

/**
 * 移动端卡池选择器 - 完整版
 * 包含：卡池选择、账号切换、导入功能
 * 参考桌面端 PoolSelector.jsx 实现
 */
function MobilePoolSelector() {
  const { t, locale, formatNumber } = useI18n();
  const navigate = useNavigate();
  // Store 状态
  const pools = usePoolStore(state => state.pools);
  const currentPoolId = usePoolStore(state => state.currentPoolId);
  const switchPool = usePoolStore(state => state.switchPool);
  const currentGameUid = usePoolStore(state => state.currentGameUid);
  const switchGameAccount = usePoolStore(state => state.switchGameAccount);
  const history = useHistoryStore(state => state.history);
  const getGameAccountsFromHistory = useHistoryStore(state => state.getGameAccountsFromHistory);
  const user = useAuthStore(state => state.user);

  // UI 状态
  const [isPoolOpen, setIsPoolOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [showImportManager, setShowImportManager] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hideZeroPullPools, setHideZeroPullPools] = useState(true);

  const poolDropdownRef = useRef(null);
  const accountDropdownRef = useRef(null);

  // 获取所有游戏账号
  const gameAccounts = useMemo(() => {
    return getGameAccountsFromHistory();
  }, [history, getGameAccountsFromHistory]);

  // 根据当前账号过滤历史记录
  const filteredHistory = useMemo(() => {
    if (!currentGameUid) return history;
    return history.filter(h => h.gameUid === currentGameUid || h.game_uid === currentGameUid);
  }, [history, currentGameUid]);

  // 计算每个卡池的抽数
  const poolPullCounts = useMemo(() => {
    const counts = {};
    filteredHistory.forEach(h => {
      const poolId = h.poolId || h.pool_id;
      if (poolId) {
        counts[poolId] = (counts[poolId] || 0) + 1;
      }
    });
    return counts;
  }, [filteredHistory]);

  const zeroPullPoolCount = useMemo(() => (
    pools.filter((pool) => (poolPullCounts[pool.id] || 0) === 0).length
  ), [poolPullCounts, pools]);

  const selectorPools = useMemo(() => (
    pools.filter((pool) => (
      !hideZeroPullPools ||
      (poolPullCounts[pool.id] || 0) > 0 ||
      pool.id === currentPoolId
    ))
  ), [currentPoolId, hideZeroPullPools, poolPullCounts, pools]);

  // 当前选中的卡池（或池组）
  const selectedPool = useMemo(() => {
    if (!pools || pools.length === 0) return null;
    if (isPoolGroupId(currentPoolId)) {
      const groupType = currentPoolId.slice(POOL_GROUP_PREFIX.length);
      return {
        id: currentPoolId,
        name: groupType === 'all'
          ? t('pool.selector.allOverview')
          : t('pool.card.allGroupTitle', { label: getPoolTypeLabel(groupType, locale) }),
        isGroupMode: true,
        isAllPoolsOverview: groupType === 'all',
        type: groupType
      };
    }
    return getPreferredPool(selectorPools, {
      preferredPoolId: currentPoolId,
      includeDefaultPool: true
    });
  }, [currentPoolId, locale, pools, selectorPools, t]);

  // 当前选中的账号
  const currentAccount = useMemo(() => {
    if (currentGameUid) {
      return gameAccounts.find((account) => account.gameUid === currentGameUid) || null;
    }

    if (gameAccounts.length === 1) {
      return gameAccounts[0];
    }

    return null;
  }, [gameAccounts, currentGameUid]);

  // 按类型分组并排序的卡池
  const sortedPoolsWithGroups = useMemo(() => {
    return buildPoolSelectorGroups({
      pools: selectorPools,
      poolPullCounts,
      searchQuery,
      locale,
    });
  }, [locale, poolPullCounts, searchQuery, selectorPools]);

  // 统计
  const totalPools = pools?.length || 0;
  const visiblePools = selectorPools.length;
  const totalPulls = Object.values(poolPullCounts).reduce((a, b) => a + b, 0);
  const showOverviewOptions = Boolean(currentGameUid);
  const allOverviewId = `${POOL_GROUP_PREFIX}all`;

  const currentViewLatestRecordAt = useMemo(() => {
    const latestTimestamp = getLatestHistoryTimestampMs(filteredHistory);
    return latestTimestamp ? new Date(latestTimestamp).toISOString() : null;
  }, [filteredHistory]);

  const currentPoolLatestRecordAt = useMemo(() => {
    if (!currentPoolId || isPoolGroupId(currentPoolId)) {
      return currentViewLatestRecordAt;
    }

    const latestTimestamp = getLatestHistoryTimestampMs(
      filteredHistory.filter((record) => (record.poolId || record.pool_id) === currentPoolId)
    );

    return latestTimestamp ? new Date(latestTimestamp).toISOString() : null;
  }, [currentPoolId, currentViewLatestRecordAt, filteredHistory]);

  const currentPoolFreshnessLabel = selectedPool?.isGroupMode
    ? t('pool.selector.currentFilter')
    : t('pool.selector.currentBanner', { name: selectedPool?.name || t('common.unknown') });

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

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (poolDropdownRef.current && !poolDropdownRef.current.contains(e.target)) {
        setIsPoolOpen(false);
      }
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target)) {
        setIsAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (showOverviewOptions || !isPoolGroupId(currentPoolId)) {
      return;
    }

    const fallbackPool = getPreferredPool(pools, {
      preferredPoolId: null,
      includeDefaultPool: true
    });

    if (fallbackPool?.id) {
      switchPool(fallbackPool.id);
    }
  }, [currentPoolId, pools, showOverviewOptions, switchPool]);

  const handleSelectPool = (poolId) => {
    switchPool(poolId);
    setIsPoolOpen(false);
    setSearchQuery('');
  };

  const switchToPoolGroup = usePoolStore(state => state.switchToPoolGroup);

  const handleSelectGroup = (groupType) => {
    switchToPoolGroup(groupType);
    setIsPoolOpen(false);
    setSearchQuery('');
  };

  const handleSelectAccount = (gameUid) => {
    switchGameAccount(gameUid);
    setIsAccountOpen(false);
  };

  // 获取卡池类型配置
  const getPoolTypeConfig = (pool) => {
    let poolType = pool.type || 'standard';
    if (poolType === 'limited_character') poolType = 'limited';
    if (poolType === 'limited_weapon') poolType = 'weapon';

    const configs = {
      limited: { icon: Star, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/20' },
      standard: { icon: Layers, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/20' },
      weapon: { icon: Swords, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-zinc-800' },
      beginner: { icon: User, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/20' }
    };
    return configs[poolType] || configs.standard;
  };

  const config = selectedPool ? getPoolTypeConfig(selectedPool) : null;
  const TypeIcon = config?.icon || Layers;
  const pullCount = selectedPool ? (poolPullCounts[selectedPool.id] || 0) : 0;

  return (
    <div className="space-y-3">
      {/* 顶部工具栏：导入按钮 + 账号切换 */}
      <div className="flex items-center gap-2">
        {/* 导入按钮 */}
        {user ? (
          <button
            onClick={() => setShowImportManager(true)}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 dark:bg-zinc-100 hover:bg-zinc-700 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold uppercase tracking-wider transition-all touch-feedback"
          >
            <Upload size={14} />
            {t('pool.selector.import')}
          </button>
        ) : (
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
            {t('pool.selector.loginToImport')}
          </div>
        )}

        {/* 账号切换器 */}
        {gameAccounts.length > 1 && (
          <div className="relative flex-1" ref={accountDropdownRef}>
            <button
              onClick={() => setIsAccountOpen(!isAccountOpen)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-xs font-mono transition-colors touch-feedback"
            >
              <div className="flex items-center gap-2 min-w-0">
                <User size={14} className="text-zinc-500 dark:text-zinc-400 shrink-0" />
                <span className="text-zinc-700 dark:text-zinc-300 truncate">
                  {currentAccount?.nickName || t('pool.selector.allAccounts')}
                </span>
                {currentAccount?.serverTag && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-sm bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                    {currentAccount.serverTag}
                  </span>
                )}
              </div>
              <ChevronDown size={12} className={`text-zinc-400 transition-transform shrink-0 ${isAccountOpen ? 'rotate-180' : ''}`} />
            </button>

            {isAccountOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-lg z-50 max-h-60 overflow-y-auto animate-scale-up">
                {/* 全部账号 */}
                <button
                  onClick={() => handleSelectAccount(null)}
                  className={`w-full px-3 py-2.5 text-left text-xs font-mono transition-colors touch-feedback ${
                    !currentGameUid
                      ? 'bg-endfield-yellow/10 text-endfield-yellow font-bold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {t('pool.selector.allAccounts')}
                </button>

                {/* 账号列表 */}
                {gameAccounts.map(account => (
                  <button
                    key={account.gameUid}
                    onClick={() => handleSelectAccount(account.gameUid)}
                    className={`w-full px-3 py-2.5 text-left transition-colors touch-feedback ${
                      currentGameUid === account.gameUid
                        ? 'bg-endfield-yellow/10'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                    >
                    <div className="flex items-center gap-2">
                      <div className={`text-xs font-bold ${
                        currentGameUid === account.gameUid ? 'text-endfield-yellow' : 'text-zinc-700 dark:text-zinc-300'
                      }`}>
                        {account.nickName}
                      </div>
                      {account.serverTag && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-sm bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                          {account.serverTag}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                      {t('pool.selector.accountRecordCount', {
                        uid: account.gameUid,
                        count: formatNumber(account.recordCount || 0)
                      })}
                    </div>
                    <div className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
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

        {/* 统计信息 */}
        <div className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
          {summaryLabel}
        </div>
      </div>

      {(currentAccount || gameAccounts.length > 1 || currentPoolLatestRecordAt) && (
        <div className="grid gap-2">
          <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                  {t('pool.selector.accountStatus')}
                </div>
                <div className="mt-1 text-sm font-bold leading-tight text-zinc-800 dark:text-zinc-100 break-words">
                  {currentAccount ? `${currentAccount.nickName} · ${currentAccount.gameUid}` : t('pool.selector.multiAccountOverview')}
                </div>
              </div>
              <span className={`px-2 py-1 text-[10px] font-bold border whitespace-nowrap ${getFreshnessToneClasses(getFreshnessTone(currentAccount?.lastImportedAt))}`}>
                {currentAccount ? formatFreshnessRelative(currentAccount.lastImportedAt, t('common.importTimeUnknown'), locale) : t('pool.selector.switchAccountHint')}
              </span>
            </div>
            <div className="mt-2 text-[10px] leading-tight text-zinc-500 dark:text-zinc-400 font-mono break-words">
              {currentAccount
                ? t('pool.selector.meta.imported', {
                    value: formatFreshnessAbsolute(currentAccount.lastImportedAt, null, locale, { includeYear: false })
                  })
                : t('pool.selector.multiAccountDetail')}
            </div>
            {currentAccount?.latestRecordAt ? (
              <div className="mt-1 text-[10px] leading-tight text-zinc-400 dark:text-zinc-500 font-mono break-words">
                {t('pool.selector.meta.latestRecord', {
                  value: formatFreshnessAbsolute(currentAccount.latestRecordAt, null, locale, { includeYear: false })
                })}
              </div>
            ) : null}
          </div>

          <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                  {t('pool.selector.poolStatus')}
                </div>
                <div className="mt-1 text-sm font-bold leading-tight text-zinc-800 dark:text-zinc-100 break-words">
                  {currentPoolFreshnessLabel}
                </div>
              </div>
              <span className={`px-2 py-1 text-[10px] font-bold border whitespace-nowrap ${getFreshnessToneClasses(getFreshnessTone(currentPoolLatestRecordAt))}`}>
                {formatFreshnessRelative(currentPoolLatestRecordAt, t('pool.selector.noRecords'), locale)}
              </span>
            </div>
            <div className="mt-2 text-[10px] leading-tight text-zinc-500 dark:text-zinc-400 font-mono break-words">
              {t('pool.selector.meta.latestRecord', {
                value: formatFreshnessAbsolute(currentPoolLatestRecordAt, null, locale, { includeYear: false })
              })}
            </div>
            {!selectedPool?.isGroupMode && selectedPool?.id ? (
              <div className="mt-1 text-[10px] leading-tight text-zinc-400 dark:text-zinc-500 font-mono break-words">
                {t('pool.selector.currentPullsShort', { count: formatNumber(poolPullCounts[selectedPool.id] || 0) })}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* 卡池选择器 */}
      {(!pools || pools.length === 0) ? (
        <div className="text-sm text-zinc-500 font-mono text-center py-4 border border-dashed border-zinc-200 dark:border-zinc-800">
          {user ? t('pool.selector.noPoolDataImport') : t('pool.selector.noPoolData')}
        </div>
      ) : (
        <div className="relative" ref={poolDropdownRef}>
          {/* 当前选中卡池卡片 */}
          <button
            onClick={() => setIsPoolOpen(!isPoolOpen)}
            className={`w-full flex items-center gap-3 p-3 border transition-all touch-feedback ${
              isPoolOpen
                ? 'border-endfield-yellow bg-endfield-yellow/5'
                : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'
            }`}
          >
            {/* 类型图标 */}
            <div className={`p-2 ${config?.bg}`}>
              <TypeIcon size={18} className={config?.color} />
            </div>

            {/* 卡池信息 */}
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">
                {selectedPool?.name || t('pool.selector.selectPool')}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                {selectedPool?.up_character && (
                  <>
                    <span>UP: {selectedPool.up_character}</span>
                    <span className="text-zinc-300 dark:text-zinc-700">|</span>
                  </>
                )}
                <span>{t('pool.card.pulls', { count: formatNumber(pullCount) })}</span>
              </div>
            </div>

            {/* 展开图标 */}
            <ChevronDown
              size={18}
              className={`text-zinc-400 transition-transform ${isPoolOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* 下拉列表 */}
          {isPoolOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-lg z-50 max-h-80 overflow-hidden animate-scale-up">
              {/* 搜索框（卡池较多时显示） */}
              {(totalPools > 5 || zeroPullPoolCount > 0) && (
                <div className="sticky top-0 p-2 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    {zeroPullPoolCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setHideZeroPullPools((value) => !value)}
                        className={`flex items-center gap-1.5 px-2 py-2 border text-[10px] font-mono whitespace-nowrap transition-colors ${
                          hideZeroPullPools
                            ? 'border-emerald-500/50 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : 'border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'
                        }`}
                        title={hideZeroPullPools ? t('pool.selector.hideZeroTitle') : t('pool.selector.showZeroTitle')}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${hideZeroPullPools ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-500'}`} />
                        <span>{hideZeroPullPools ? t('pool.selector.hideZeroLabel') : t('pool.selector.showZeroLabel')}</span>
                      </button>
                    )}

                    {totalPools > 5 && (
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={t('pool.selector.searchPlaceholder')}
                          className="w-full pl-8 pr-8 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:border-endfield-yellow outline-none text-zinc-700 dark:text-zinc-300 font-mono"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 卡池列表 */}
              <div className="max-h-64 overflow-y-auto">
                {sortedPoolsWithGroups.length > 0 ? (
                  <>
                    {showOverviewOptions && (
                      <button
                        onClick={() => handleSelectGroup('all')}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors touch-feedback border-b border-dashed border-zinc-100 dark:border-zinc-800 ${
                          currentPoolId === allOverviewId
                            ? 'bg-endfield-yellow/10 border-l-2 border-l-endfield-yellow'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 border-l-2 border-l-transparent'
                        }`}
                      >
                        <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800">
                          <Layers size={14} className="text-zinc-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${
                            currentPoolId === allOverviewId ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300'
                          }`}>
                            {t('pool.selector.allOverview')}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono">
                            {t('pool.card.groupStats', { pools: formatNumber(visiblePools), pulls: formatNumber(totalPulls) })}
                          </div>
                        </div>
                        {currentPoolId === allOverviewId && <Check size={16} className="text-endfield-yellow flex-shrink-0" />}
                      </button>
                    )}

                    {sortedPoolsWithGroups.map((group) => (
                      <div key={group.type}>
                      {/* 分组标题 */}
                      <div className="sticky top-0 px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          group.type === 'limited' ? 'text-orange-500' :
                          group.type.includes('weapon') ? 'text-slate-500' :
                          group.type === 'standard' ? 'text-amber-500' :
                          'text-green-500'
                        }`}>
                          {group.label}
                        </span>
                      </div>

                      {/* 池组聚合按钮（仅该分组 > 1 个池时显示） */}
                      {showOverviewOptions && group.pools.length > 1 && (() => {
                        const groupId = POOL_GROUP_PREFIX + group.type;
                        const isGroupSelected = currentPoolId === groupId;
                        const totalGroupPulls = group.pools.reduce((sum, p) => sum + (poolPullCounts[p.id] || 0), 0);
                        return (
                          <button
                            onClick={() => handleSelectGroup(group.type)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors touch-feedback border-b border-dashed border-zinc-100 dark:border-zinc-800 ${
                              isGroupSelected
                                ? 'bg-endfield-yellow/10 border-l-2 border-l-endfield-yellow'
                                : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 border-l-2 border-l-transparent'
                            }`}
                          >
                            <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800">
                              <Layers size={14} className="text-zinc-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-medium ${isGroupSelected ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                {t('pool.card.allGroupTitle', { label: group.label })}
                              </div>
                              <div className="text-[10px] text-zinc-400 font-mono">
                                {t('pool.card.groupStats', { pools: formatNumber(group.pools.length), pulls: formatNumber(totalGroupPulls) })}
                              </div>
                            </div>
                            {isGroupSelected && <Check size={16} className="text-endfield-yellow flex-shrink-0" />}
                          </button>
                        );
                      })()}

                      {/* 卡池列表 */}
                      {group.pools.map((pool) => {
                        const isSelected = pool.id === currentPoolId;
                        const poolConfig = getPoolTypeConfig(pool);
                        const PoolIcon = poolConfig.icon;
                        const count = poolPullCounts[pool.id] || 0;

                        return (
                          <button
                            key={pool.id}
                            onClick={() => handleSelectPool(pool.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors touch-feedback ${
                              isSelected
                                ? 'bg-endfield-yellow/10 border-l-2 border-endfield-yellow'
                                : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 border-l-2 border-transparent'
                            }`}
                          >
                            {/* 类型图标 */}
                            <div className={`p-1.5 ${poolConfig.bg}`}>
                              <PoolIcon size={14} className={poolConfig.color} />
                            </div>

                            {/* 卡池信息 */}
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-medium truncate ${
                                isSelected ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300'
                              }`}>
                                {pool.name}
                                {pool.locked && <Lock size={10} className="inline ml-1 text-amber-500" />}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
                                {pool.up_character && <span>UP: {pool.up_character}</span>}
                                <span>{t('pool.card.pulls', { count: formatNumber(count) })}</span>
                              </div>
                            </div>

                            {/* 选中标识 */}
                            {isSelected && (
                              <Check size={16} className="text-endfield-yellow flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    ))}
                  </>
                ) : (
                  <div className="py-8 text-center text-sm text-zinc-400 font-mono">
                    {searchQuery ? t('pool.selector.noMatches') : t('pool.selector.noBanners')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 导入管理器弹窗 */}
      {showImportManager && (
        <ImportManager
          isOpen={showImportManager}
          onClose={() => {
            setShowImportManager(false);
          }}
          onImportComplete={() => {
            setShowImportManager(false);
            navigate(getMobilePathForTab('dashboard'));
          }}
        />
      )}
    </div>
  );
}

export default MobilePoolSelector;
