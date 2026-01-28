import React, { useMemo, useState } from 'react';
import { Layers, Lock, Upload, Star, Swords, User, Search, X } from 'lucide-react';
import { usePoolStore, useAuthStore, useHistoryStore } from '../../stores';
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
  const history = useHistoryStore(state => state.history);

  const user = useAuthStore(state => state.user);

  // UI状态
  const [showImportManager, setShowImportManager] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 计算每个卡池的抽数
  const poolPullCounts = useMemo(() => {
    const counts = {};
    history.forEach(h => {
      counts[h.poolId] = (counts[h.poolId] || 0) + 1;
    });
    return counts;
  }, [history]);

  // 按类型分组并排序的卡池
  const sortedPoolsWithGroups = useMemo(() => {
    const filtered = searchQuery.trim()
      ? pools.filter(pool => pool.name?.toLowerCase().includes(searchQuery.toLowerCase()))
      : pools;

    const groups = {
      limited: { label: '限定角色', pools: [] },
      standard: { label: '常驻', pools: [] },
      weapon_limited: { label: '限定武器', pools: [] },
      weapon_standard: { label: '常驻武器', pools: [] },
      beginner: { label: '新手', pools: [] }
    };

    filtered.forEach(pool => {
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
  }, [pools, searchQuery]);

  const totalPools = pools.length;
  const totalPulls = Object.values(poolPullCounts).reduce((a, b) => a + b, 0);

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
          <div className="text-xs text-slate-400 dark:text-zinc-500 truncate mb-1 font-mono">
            UP: {pool.up_character}
          </div>
        )}

        {/* 抽数 */}
        <div className="text-xs text-slate-400 dark:text-zinc-500 font-mono">
          {pullCount} <span className="text-[10px]">抽</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 顶部工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* 导入按钮 */}
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
            <div className="text-xs text-slate-400 dark:text-zinc-500 font-mono">
              [ 请登录以导入数据 ]
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
          <div className="text-xs font-mono text-slate-400 dark:text-zinc-500">
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
                  <span className={`
                    writing-vertical text-[10px] font-bold tracking-widest uppercase opacity-40
                    ${group.type === 'limited' ? 'text-orange-500' :
                      group.type === 'standard' ? 'text-yellow-500' :
                      'text-slate-500'
                    }
                  `} style={{ writingMode: 'vertical-rl' }}>
                    {group.label}
                  </span>
                </div>
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
          onClose={() => setShowImportManager(false)}
        />
      )}
    </div>
  );
};

export default PoolSelector;