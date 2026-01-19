import React, { useMemo, useState } from 'react';
import { Layers, ChevronDown, Search, X, Lock, Unlock, Settings, Trash2, Upload, Star, Swords } from 'lucide-react';
import { usePoolStore, useAuthStore, useHistoryStore } from '../../stores';
import ImportManager from '../../features/import/ImportManager';

/**
 * 卡池选择器组件 v2.0
 * 按卡池类型分组显示，支持导入数据入口
 */
const PoolSelector = ({
  onOpenEditPoolModal,
  onOpenDeletePoolModal,
  onTogglePoolLock
}) => {
  // 从 stores 获取状态
  const pools = usePoolStore(state => state.pools);
  const currentPoolId = usePoolStore(state => state.currentPoolId);
  const poolSearchQuery = usePoolStore(state => state.poolSearchQuery);

  const switchPool = usePoolStore(state => state.switchPool);
  const setPoolSearchQuery = usePoolStore(state => state.setPoolSearchQuery);

  const history = useHistoryStore(state => state.history);

  const userRole = useAuthStore(state => state.userRole);
  const canEdit = userRole === 'admin' || userRole === 'super_admin';
  const isSuperAdmin = userRole === 'super_admin';

  // UI状态
  const [showPoolMenu, setShowPoolMenu] = useState(false);
  const [showImportManager, setShowImportManager] = useState(false);
  const [showSimulatedPools, setShowSimulatedPools] = useState(true);  // 是否显示模拟卡池

  // 计算每个卡池的抽数
  const poolPullCounts = useMemo(() => {
    const counts = {};
    history.forEach(h => {
      if (h.specialType !== 'gift') {  // 排除赠送
        counts[h.poolId] = (counts[h.poolId] || 0) + 1;
      }
    });
    return counts;
  }, [history]);

  // 检测哪些卡池包含模拟数据
  const poolsWithSimulatedData = useMemo(() => {
    const poolsSet = new Set();
    history.forEach(h => {
      if (h.isSimulated === true) {  // 包含模拟数据的记录
        poolsSet.add(h.poolId);
      }
    });
    return poolsSet;
  }, [history]);

  // 按类型分组的卡池列表（分为真实和模拟两部分）
  const groupedPools = useMemo(() => {
    // 先按搜索词过滤
    const filteredPools = poolSearchQuery.trim()
      ? pools.filter(pool =>
          pool.name.toLowerCase().includes(poolSearchQuery.toLowerCase())
        )
      : pools;

    // 分离真实卡池和模拟卡池
    const realPools = filteredPools.filter(pool => !poolsWithSimulatedData.has(pool.id));
    const simulatedPools = filteredPools.filter(pool => poolsWithSimulatedData.has(pool.id));

    // 按类型分组的辅助函数
    const groupPoolsByType = (poolsList) => {
      const groups = {
        limited: { label: '限定角色池', icon: 'star', pools: [] },
        weapon: { label: '限定武器池', icon: 'sword', pools: [] },
        standard: { label: '常驻池', icon: 'layers', pools: [] }
      };

      poolsList.forEach(pool => {
        let type = pool.type || 'standard';

        // 统一类型映射：将新格式映射到分组键
        if (type === 'limited_character' || type === 'limited') {
          type = 'limited';
        } else if (type === 'limited_weapon' || type === 'weapon') {
          type = 'weapon';
        } else {
          type = 'standard';
        }

        if (groups[type]) {
          groups[type].pools.push(pool);
        } else {
          groups.standard.pools.push(pool);
        }
      });

      // 转换为数组格式，按预定顺序
      return ['limited', 'weapon', 'standard']
        .map(type => ({
          type,
          ...groups[type],
          pools: groups[type].pools.sort((a, b) => {
            // 按抽数倒序
            const countA = poolPullCounts[a.id] || 0;
            const countB = poolPullCounts[b.id] || 0;
            return countB - countA;
          })
        }))
        .filter(group => group.pools.length > 0);  // 过滤空分组
    };

    return {
      real: groupPoolsByType(realPools),
      simulated: showSimulatedPools ? groupPoolsByType(simulatedPools) : []
    };
  }, [pools, poolSearchQuery, poolPullCounts, poolsWithSimulatedData, showSimulatedPools]);

  // 关闭菜单
  const closeMenu = () => {
    setShowPoolMenu(false);
    setPoolSearchQuery('');
  };

  // 切换卡池并关闭菜单
  const handleSelectPool = (poolId) => {
    switchPool(poolId);
    closeMenu();
  };

  // 当前显示的卡池名称
  const currentPool = pools.find(p => p.id === currentPoolId);
  const currentPoolName = currentPool?.name || '选择卡池';
  const currentPullCount = poolPullCounts[currentPoolId] || 0;

  // 获取分组图标
  const getGroupIcon = (type) => {
    switch (type) {
      case 'limited':
        return <Star size={12} className="text-orange-500" />;
      case 'weapon':
        return <Swords size={12} className="text-slate-500 dark:text-zinc-400" />;
      default:
        return <Layers size={12} className="text-yellow-600 dark:text-endfield-yellow" />;
    }
  };

  // 获取类型颜色
  const getTypeColor = (type) => {
    switch (type) {
      case 'limited':
        return 'text-orange-500 bg-orange-100 dark:bg-orange-900/30';
      case 'weapon':
        return 'text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-700';
      default:
        return 'text-yellow-600 dark:text-endfield-yellow bg-yellow-100 dark:bg-yellow-900/30';
    }
  };

  return (
    <>
      <div className="relative">
        {/* 卡池选择按钮 */}
        <button
          onClick={() => setShowPoolMenu(!showPoolMenu)}
          className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-none text-sm font-medium text-slate-700 dark:text-zinc-300 transition-colors"
        >
          <Layers size={16} />
          <span className="max-w-[100px] sm:max-w-[200px] truncate">
            {currentPoolName}
          </span>
          {currentPullCount > 0 && (
            <span className="text-xs text-slate-400 dark:text-zinc-500">
              ({currentPullCount}抽)
            </span>
          )}
          <ChevronDown size={14} className={`transition-transform ${showPoolMenu ? 'rotate-180' : ''}`}/>
        </button>

        {/* 卡池选择菜单 */}
        {showPoolMenu && (
          <>
            {/* 背景遮罩 */}
            <div className="fixed inset-0 z-10" onClick={closeMenu}></div>

            {/* 菜单内容 */}
            <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-zinc-900 rounded-none shadow-xl border border-zinc-100 dark:border-zinc-800 z-20 animate-fade-in overflow-hidden">
              {/* 搜索框 */}
              <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                  <input
                    type="text"
                    value={poolSearchQuery}
                    onChange={(e) => setPoolSearchQuery(e.target.value)}
                    placeholder="搜索卡池..."
                    className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-slate-700 dark:text-zinc-300 placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                    autoFocus
                  />
                  {poolSearchQuery && (
                    <button
                      onClick={() => setPoolSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-400"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* 显示/隐藏模拟数据开关 - 始终显示 */}
                <label className="flex items-center gap-2 px-2 py-1 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-zinc-800 rounded transition-colors">
                  <input
                    type="checkbox"
                    checked={showSimulatedPools}
                    onChange={(e) => setShowSimulatedPools(e.target.checked)}
                    className="w-3.5 h-3.5 text-blue-500 bg-slate-100 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded focus:ring-blue-500 focus:ring-1"
                  />
                  <span className="text-xs text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                    <span>显示模拟数据</span>
                    {poolsWithSimulatedData.size > 0 && (
                      <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-[10px] font-medium">
                        {poolsWithSimulatedData.size}
                      </span>
                    )}
                  </span>
                </label>
              </div>

              {/* 卡池列表 - 按类型分组，分为真实和模拟两部分 */}
              <div className="max-h-80 overflow-y-auto">
                {groupedPools.real.length === 0 && groupedPools.simulated.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-400 dark:text-zinc-500">
                    {pools.length === 0 ? '暂无卡池，请导入数据' : '未找到匹配的卡池'}
                  </div>
                ) : (
                  <>
                    {/* 真实卡池部分 */}
                    {groupedPools.real.length > 0 && (
                      <div>
                        {/* 真实卡池分隔标题 */}
                        {groupedPools.simulated.length > 0 && (
                          <div className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                            真实卡池
                          </div>
                        )}

                        {groupedPools.real.map((group) => (
                          <div key={`real-${group.type}`}>
                            {/* 类型分组标题 */}
                            <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider bg-slate-50 dark:bg-zinc-800/50 sticky top-0 flex items-center gap-2">
                              {getGroupIcon(group.type)}
                              {group.label}
                              <span className="text-slate-300 dark:text-zinc-600">({group.pools.length})</span>
                            </div>

                            {/* 该类型的卡池列表 */}
                            {group.pools.map(pool => {
                              const pullCount = poolPullCounts[pool.id] || 0;
                              const isSelected = currentPoolId === pool.id;

                              return (
                                <div
                                  key={pool.id}
                                  className={`w-full hover:bg-slate-50 dark:hover:bg-zinc-800 group/item ${isSelected ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}
                                >
                                  <button
                                    onClick={() => handleSelectPool(pool.id)}
                                    className="w-full text-left"
                                    title={pool.name}
                                  >
                                    {/* Banner 图片（如果存在）*/}
                                    {pool.banner_url && (
                                      <div className="relative w-full h-16 overflow-hidden">
                                        <img
                                          src={pool.banner_url}
                                          alt={pool.name}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            // 图片加载失败时隐藏
                                            e.target.style.display = 'none';
                                          }}
                                        />
                                        {/* 渐变遮罩，让文字更清晰 */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                                      </div>
                                    )}

                                    {/* 卡池信息区域 */}
                                    <div className="px-3 py-2 flex items-center justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        {/* 卡池名称和锁定图标 */}
                                        <div className={`flex items-center gap-2 text-sm ${isSelected ? 'text-yellow-600 dark:text-endfield-yellow font-bold' : 'text-slate-600 dark:text-zinc-400'}`}>
                                          {pool.locked && <Lock size={12} className="text-amber-500 shrink-0" />}
                                          <span className="truncate">{pool.name}</span>
                                        </div>

                                        {/* UP 角色信息（如果存在）*/}
                                        {pool.up_character && (
                                          <div className="flex items-center gap-1.5 mt-1">
                                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center shrink-0">
                                              <Star size={10} className="text-white" fill="white" />
                                            </div>
                                            <span className="text-xs text-slate-500 dark:text-zinc-500 truncate">
                                              UP: {pool.up_character}
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      {/* 右侧：抽数和选中标记 */}
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs text-slate-400 dark:text-zinc-500">
                                          {pullCount}抽
                                        </span>
                                        {isSelected && <div className="w-1.5 h-1.5 rounded-sm bg-endfield-yellow"></div>}
                                      </div>
                                    </div>
                                  </button>

                                  {/* 操作按钮区域（保持原有逻辑）*/}
                                  <div className="px-3 pb-2 flex items-center justify-end gap-0.5">
                                    {/* 锁定/解锁按钮 - 仅超管可见 */}
                                    {isSuperAdmin && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onTogglePoolLock(pool.id);
                                        }}
                                        className={`p-1 rounded opacity-0 group-hover/item:opacity-100 transition-all ${pool.locked ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30' : 'text-slate-300 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}
                                        title={pool.locked ? "解锁卡池" : "锁定卡池"}
                                      >
                                        {pool.locked ? <Unlock size={12} /> : <Lock size={12} />}
                                      </button>
                                    )}

                                    {/* 编辑卡池按钮 */}
                                    {canEdit && (!pool.locked || isSuperAdmin) && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onOpenEditPoolModal(pool.id);
                                          closeMenu();
                                        }}
                                        className="p-1 text-slate-300 hover:text-blue-600 dark:text-zinc-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded opacity-0 group-hover/item:opacity-100 transition-all"
                                        title="编辑卡池"
                                      >
                                        <Settings size={12} />
                                      </button>
                                    )}

                                    {/* 删除卡池按钮 */}
                                    {canEdit && (!pool.locked || isSuperAdmin) && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onOpenDeletePoolModal(pool.id);
                                          closeMenu();
                                        }}
                                        className="p-1 text-slate-300 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded opacity-0 group-hover/item:opacity-100 transition-all"
                                        title="删除卡池"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 模拟卡池部分 */}
                    {groupedPools.simulated.length > 0 && (
                      <div>
                        {/* 模拟卡池分隔标题 */}
                        <div className="px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800">
                          模拟卡池
                        </div>

                        {groupedPools.simulated.map((group) => (
                          <div key={`simulated-${group.type}`}>
                            {/* 类型分组标题 */}
                            <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider bg-slate-50 dark:bg-zinc-800/50 sticky top-0 flex items-center gap-2">
                              {getGroupIcon(group.type)}
                              {group.label}
                              <span className="text-slate-300 dark:text-zinc-600">({group.pools.length})</span>
                            </div>

                            {/* 该类型的卡池列表 */}
                            {group.pools.map(pool => {
                              const pullCount = poolPullCounts[pool.id] || 0;
                              const isSelected = currentPoolId === pool.id;

                              return (
                                <div
                                  key={pool.id}
                                  className={`w-full hover:bg-blue-50 dark:hover:bg-blue-900/20 group/item border-l-2 border-blue-400 dark:border-blue-600 ${isSelected ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}
                                >
                                  <button
                                    onClick={() => handleSelectPool(pool.id)}
                                    className="w-full text-left"
                                    title={pool.name}
                                  >
                                    {/* Banner 图片（如果存在）*/}
                                    {pool.banner_url && (
                                      <div className="relative w-full h-16 overflow-hidden">
                                        <img
                                          src={pool.banner_url}
                                          alt={pool.name}
                                          className="w-full h-full object-cover opacity-80"
                                          onError={(e) => {
                                            // 图片加载失败时隐藏
                                            e.target.style.display = 'none';
                                          }}
                                        />
                                        {/* 渐变遮罩，让文字更清晰 */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                                        {/* 模拟标识 */}
                                        <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded">
                                          模拟
                                        </div>
                                      </div>
                                    )}

                                    {/* 卡池信息区域 */}
                                    <div className="px-3 py-2 flex items-center justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        {/* 卡池名称和模拟标识 */}
                                        <div className={`flex items-center gap-2 text-sm ${isSelected ? 'text-yellow-600 dark:text-endfield-yellow font-bold' : 'text-slate-600 dark:text-zinc-400'}`}>
                                          {pool.locked && <Lock size={12} className="text-amber-500 shrink-0" />}
                                          <span className="truncate">{pool.name}</span>
                                          {!pool.banner_url && (
                                            <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-[10px] font-medium shrink-0">
                                              模拟
                                            </span>
                                          )}
                                        </div>

                                        {/* UP 角色信息（如果存在）*/}
                                        {pool.up_character && (
                                          <div className="flex items-center gap-1.5 mt-1">
                                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center shrink-0">
                                              <Star size={10} className="text-white" fill="white" />
                                            </div>
                                            <span className="text-xs text-slate-500 dark:text-zinc-500 truncate">
                                              UP: {pool.up_character}
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      {/* 右侧：抽数和选中标记 */}
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs text-slate-400 dark:text-zinc-500">
                                          {pullCount}抽
                                        </span>
                                        {isSelected && <div className="w-1.5 h-1.5 rounded-sm bg-endfield-yellow"></div>}
                                      </div>
                                    </div>
                                  </button>

                                  {/* 操作按钮区域（模拟卡池的操作相同）*/}
                                  <div className="px-3 pb-2 flex items-center justify-end gap-0.5">
                                    {/* 锁定/解锁按钮 - 仅超管可见 */}
                                    {isSuperAdmin && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onTogglePoolLock(pool.id);
                                        }}
                                        className={`p-1 rounded opacity-0 group-hover/item:opacity-100 transition-all ${pool.locked ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30' : 'text-slate-300 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}
                                        title={pool.locked ? "解锁卡池" : "锁定卡池"}
                                      >
                                        {pool.locked ? <Unlock size={12} /> : <Lock size={12} />}
                                      </button>
                                    )}

                                    {/* 编辑卡池按钮 */}
                                    {canEdit && (!pool.locked || isSuperAdmin) && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onOpenEditPoolModal(pool.id);
                                          closeMenu();
                                        }}
                                        className="p-1 text-slate-300 hover:text-blue-600 dark:text-zinc-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded opacity-0 group-hover/item:opacity-100 transition-all"
                                        title="编辑卡池"
                                      >
                                        <Settings size={12} />
                                      </button>
                                    )}

                                    {/* 删除卡池按钮 */}
                                    {canEdit && (!pool.locked || isSuperAdmin) && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onOpenDeletePoolModal(pool.id);
                                          closeMenu();
                                        }}
                                        className="p-1 text-slate-300 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded opacity-0 group-hover/item:opacity-100 transition-all"
                                        title="删除卡池"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 导入数据按钮 - 仅管理员可见 */}
              {canEdit && (
                <div className="border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    onClick={() => {
                      closeMenu();
                      setShowImportManager(true);
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 font-medium"
                  >
                    <Upload size={16} />
                    导入数据...
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 导入管理器弹窗 */}
      {showImportManager && (
        <ImportManager
          isOpen={showImportManager}
          onClose={() => setShowImportManager(false)}
        />
      )}
    </>
  );
};

export default PoolSelector;
