import React, { useMemo, useState } from 'react';
import { Layers, Lock, Upload, Star, Swords, User, Search, X, ChevronDown } from 'lucide-react';
import { usePoolStore, useAuthStore, useHistoryStore } from '../../stores';
import { isPoolGroupId, getPoolGroupType, POOL_GROUP_PREFIX, GROUP_TYPE_LABELS } from '../../stores/usePoolStore';
import ImportManager from '../../features/import/ImportManager';

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

  // 按类型分组并排序的卡池
  const sortedPoolsWithGroups = useMemo(() => {
    const searchFiltered = searchQuery.trim()
      ? filteredPools.filter(pool => pool.name?.toLowerCase().includes(searchQuery.toLowerCase()))
      : filteredPools;

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
    const result = [];

    order.forEach(type => {
      const group = groups[type];
      if (group.pools.length > 0) {
        result.push({ type, label: group.label, pools: group.pools });
      }
    });

    return result;
  }, [filteredPools, searchQuery]);

  const totalPools = pools.length;
  const totalPulls = Object.values(poolPullCounts).reduce((a, b) => a + b, 0);

  const switchToPoolGroup = usePoolStore(state => state.switchToPoolGroup);

  // 渲染池组聚合卡片（FEAT-018）
  const renderGroupCard = (group) => {
    const groupId = POOL_GROUP_PREFIX + group.type;
    const isSelected = currentPoolId === groupId;
    const totalGroupPulls = group.pools.reduce((sum, p) => sum + (poolPullCounts[p.id] || 0), 0);

    const typeConfig = {
      limited: { icon: Star, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/20' },
      standard: { icon: Layers, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/20' },
      beginner: { icon: User, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/20' },
      weapon_limited: { icon: Swords, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-zinc-800' },
      weapon_standard: { icon: Swords, color: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800' }
    };
    const config = typeConfig[group.type] || typeConfig.standard;
    const TypeIcon = config.icon;

    return (
      <div
        key={groupId}
        onClick={() => switchToPoolGroup(group.type)}
        className={`
          relative flex-shrink-0 w-44 p-3 cursor-pointer transition-all border-2 border-dashed
          group hover:border-zinc-400 dark:hover:border-zinc-500
          ${isSelected
            ? 'bg-zinc-50 dark:bg-zinc-900/50 border-yellow-500 dark:border-yellow-600 shadow-sm'
            : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700'
          }
        `}
      >
        <div className={`absolute top-2 left-2 p-1 ${config.bg}`}>
          <TypeIcon size={12} className={config.color} />
        </div>
        <div className={`text-sm font-bold truncate mb-1 mt-6 ${isSelected ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-600 dark:text-zinc-400'}`}>
          全部{group.label}池
        </div>
        <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
          {group.pools.length} 池 · {totalGroupPulls} <span className="text-[11px]">抽</span>
        </div>
      </div>
    );
  };

  const renderPoolCard = (pool) => {
    const pullCount = poolPullCounts[pool.id] || 0;
    const isSelected = currentPoolId === pool.id;

    let poolType = pool.type || 'standard';
    if (poolType === 'limited_character') poolType = 'limited';
    if (poolType === 'limited_weapon') poolType = 'weapon';

    const typeConfig = {
      limited: { icon: Star, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/20' },
      standard: { icon: Layers, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/20' },
      beginner: { icon: User, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/20' },
      weapon: { icon: Swords, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-zinc-800' }
    };
    const config = typeConfig[poolType] || typeConfig.standard;
    const TypeIcon = config.icon;

    return (
      <div
        key={pool.id}
        onClick={() => switchPool(pool.id)}
        className={`
          relative flex-shrink-0 w-44 p-3 cursor-pointer transition-all border
          group hover:border-zinc-400 dark:hover:border-zinc-500
          ${isSelected
            ? 'bg-zinc-50 dark:bg-zinc-900/50 border-yellow-500 dark:border-yellow-600 shadow-sm'
            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
          }
        `}
      >
        {/* 类型图标 */}
        <div className={`absolute top-2 left-2 p-1 ${config.bg}`}>
          <TypeIcon size={12} className={config.color} />
        </div>

        {/* 锁定标识 */}
        {pool.locked && (
          <div className="absolute top-2 right-2">
            <Lock size={12} className="text-amber-500" />
          </div>
        )}

        {/* 卡池名称 */}
        <div className={`text-sm font-bold truncate mb-1 mt-6 ${isSelected ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-600 dark:text-zinc-400'}`}>
          {pool.name}
        </div>

        {/* UP角色 */}
        {pool.up_character && (
          <div className="text-xs text-slate-500 dark:text-zinc-400 truncate mb-1 font-mono">
            UP: {pool.up_character}
          </div>
        )}

        {/* 抽数 */}
        <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
          {pullCount} <span className="text-[11px]">抽</span>
        </div>
      </div>
    );
  };

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
                      <div className="font-bold">{account.nickName}</div>
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

          {/* 统计 */}
          <div className="text-xs font-mono text-slate-500 dark:text-zinc-400">
            <span className="text-slate-700 dark:text-zinc-300 font-bold">{totalPools}</span> POOLS /
            <span className="text-slate-700 dark:text-zinc-300 font-bold ml-1">{totalPulls}</span> PULLS
          </div>
        </div>
      </div>

      {/* 卡池列表 */}
      {sortedPoolsWithGroups.length > 0 ? (
        <div className="relative border-t border-zinc-100 dark:border-zinc-800 pt-4">
          <div className="flex flex-nowrap items-end gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
            {sortedPoolsWithGroups.map((group, groupIndex) => (
              <div key={group.type} className="flex flex-nowrap items-end gap-2">
                {/* 分组竖排标签 */}
                <div className="flex-shrink-0 flex flex-col items-center justify-end h-full pb-3">
                  <div className={`
                    flex flex-col items-center gap-1.5
                  `} style={{ writingMode: 'vertical-rl' }}>
                    <span className={`
                      w-1 h-6 flex-shrink-0
                      ${group.type === 'limited' ? 'bg-orange-500' :
                        group.type === 'weapon_limited' ? 'bg-slate-500' :
                        group.type === 'standard' ? 'bg-yellow-500' :
                        group.type === 'weapon_standard' ? 'bg-zinc-400' :
                        'bg-green-500'
                      }
                    `} style={{ writingMode: 'horizontal-tb' }} />
                    <span className={`
                      text-xs font-bold tracking-widest uppercase
                      ${group.type === 'limited' ? 'text-orange-600 dark:text-orange-400' :
                        group.type === 'weapon_limited' ? 'text-slate-600 dark:text-slate-300' :
                        group.type === 'standard' ? 'text-yellow-600 dark:text-yellow-400' :
                        group.type === 'weapon_standard' ? 'text-zinc-500 dark:text-zinc-400' :
                        'text-green-600 dark:text-green-400'
                      }
                    `}>
                      {group.label}
                    </span>
                  </div>
                </div>
                {/* 池组聚合卡片（仅该分组 > 1 个池时显示） */}
                {group.pools.length > 1 && renderGroupCard(group)}
                {group.pools.map(pool => renderPoolCard(pool))}
                {/* 分隔符 */}
                {groupIndex < sortedPoolsWithGroups.length - 1 && (
                  <div className="flex-shrink-0 w-px h-12 bg-zinc-200 dark:bg-zinc-800 mx-2 self-center"></div>
                )}
              </div>
            ))}
          </div>
        </div>
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