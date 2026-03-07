import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ChevronDown, Star, Layers, Swords, User, Lock, Check, Upload, Search, X
} from 'lucide-react';
import { usePoolStore, useHistoryStore, useAuthStore } from '../../stores';
import { isPoolGroupId, POOL_GROUP_PREFIX, GROUP_TYPE_LABELS } from '../../stores/usePoolStore';
import ImportManager from '../../features/import/ImportManager';
import { getPreferredPool } from '../../utils/poolSelectionUtils';

/**
 * 移动端卡池选择器 - 完整版
 * 包含：卡池选择、账号切换、导入功能
 * 参考桌面端 PoolSelector.jsx 实现
 */
function MobilePoolSelector() {
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

  // 当前选中的卡池（或池组）
  const selectedPool = useMemo(() => {
    if (!pools || pools.length === 0) return null;
    if (isPoolGroupId(currentPoolId)) {
      const groupType = currentPoolId.slice(POOL_GROUP_PREFIX.length);
      return { id: currentPoolId, name: `全部${GROUP_TYPE_LABELS[groupType] || ''}池`, isGroupMode: true, type: groupType };
    }
    return getPreferredPool(pools, {
      preferredPoolId: currentPoolId,
      includeDefaultPool: true
    });
  }, [pools, currentPoolId]);

  // 当前选中的账号
  const currentAccount = useMemo(() => {
    if (!currentGameUid) return null;
    return gameAccounts.find(a => a.gameUid === currentGameUid);
  }, [gameAccounts, currentGameUid]);

  // 按类型分组并排序的卡池
  const sortedPoolsWithGroups = useMemo(() => {
    const searchFiltered = searchQuery.trim()
      ? pools.filter(pool => pool.name?.toLowerCase().includes(searchQuery.toLowerCase()))
      : pools;

    const groups = {
      limited: { label: '限定角色', pools: [] },
      standard: { label: '常驻', pools: [] },
      weapon_limited: { label: '限定武器', pools: [] },
      weapon_standard: { label: '常驻武器', pools: [] },
      beginner: { label: '新手', pools: [] }
    };

    searchFiltered.forEach(pool => {
      let type = pool.type || 'standard';
      if (type === 'limited_character') type = 'limited';
      if (type === 'limited_weapon' || type === 'weapon') {
        if (pool.isLimitedWeapon === false) {
          groups.weapon_standard.pools.push(pool);
        } else {
          groups.weapon_limited.pools.push(pool);
        }
        return;
      }

      if (type === 'limited') groups.limited.pools.push(pool);
      else if (type === 'beginner') groups.beginner.pools.push(pool);
      else groups.standard.pools.push(pool);
    });

    const order = ['limited', 'standard', 'weapon_limited', 'weapon_standard', 'beginner'];
    return order
      .map(type => ({ type, label: groups[type].label, pools: groups[type].pools }))
      .filter(group => group.pools.length > 0);
  }, [pools, searchQuery]);

  // 统计
  const totalPools = pools?.length || 0;
  const totalPulls = Object.values(poolPullCounts).reduce((a, b) => a + b, 0);

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
            导入
          </button>
        ) : (
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
            [ 请登录以导入 ]
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
                  {currentAccount?.nickName || '全部账号'}
                </span>
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
                  全部账号
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
                    <div className={`text-xs font-bold ${
                      currentGameUid === account.gameUid ? 'text-endfield-yellow' : 'text-zinc-700 dark:text-zinc-300'
                    }`}>
                      {account.nickName}
                    </div>
                    <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                      UID: {account.gameUid} · {account.recordCount} 条记录
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 统计信息 */}
        <div className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
          <span className="text-zinc-700 dark:text-zinc-300 font-bold">{totalPools}</span> 池 /
          <span className="text-zinc-700 dark:text-zinc-300 font-bold ml-1">{totalPulls}</span> 抽
        </div>
      </div>

      {/* 卡池选择器 */}
      {(!pools || pools.length === 0) ? (
        <div className="text-sm text-zinc-500 font-mono text-center py-4 border border-dashed border-zinc-200 dark:border-zinc-800">
          {user ? '暂无卡池数据，请导入' : '暂无卡池数据'}
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
                {selectedPool?.name || '选择卡池'}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                {selectedPool?.up_character && (
                  <>
                    <span>UP: {selectedPool.up_character}</span>
                    <span className="text-zinc-300 dark:text-zinc-700">|</span>
                  </>
                )}
                <span>{pullCount} 抽</span>
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
              {totalPools > 5 && (
                <div className="sticky top-0 p-2 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索卡池..."
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
                </div>
              )}

              {/* 卡池列表 */}
              <div className="max-h-64 overflow-y-auto">
                {sortedPoolsWithGroups.length > 0 ? (
                  sortedPoolsWithGroups.map((group) => (
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
                      {group.pools.length > 1 && (() => {
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
                                全部{group.label}池
                              </div>
                              <div className="text-[10px] text-zinc-400 font-mono">
                                {group.pools.length} 池 · {totalGroupPulls} 抽
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
                                <span>{count} 抽</span>
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
                  ))
                ) : (
                  <div className="py-8 text-center text-sm text-zinc-400 font-mono">
                    {searchQuery ? '未找到匹配的卡池' : '暂无卡池'}
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
            console.log('[MobilePoolSelector] 关闭导入管理器');
            setShowImportManager(false);
          }}
          onImportComplete={(result) => {
            console.log('[MobilePoolSelector] 导入完成:', result);
          }}
        />
      )}
    </div>
  );
}

export default MobilePoolSelector;
