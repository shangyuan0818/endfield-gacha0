import React from 'react';
import { Layers, ChevronDown, Search, X, User, Lock, Unlock, Settings, Trash2, Plus } from 'lucide-react';
import { usePoolStore, useAuthStore } from '../../stores';
import { extractCharNameFromPoolName } from '../../utils';

/**
 * 卡池选择器组件
 * 使用 Zustand stores 管理状态
 */
const PoolSelector = ({
  onOpenCreatePoolModal,
  onOpenEditPoolModal,
  onOpenDeletePoolModal,
  onTogglePoolLock
}) => {
  // 从 stores 获取状态
  const pools = usePoolStore(state => state.pools);
  const currentPoolId = usePoolStore(state => state.currentPoolId);
  const poolSearchQuery = usePoolStore(state => state.poolSearchQuery);
  const collapsedDrawers = usePoolStore(state => state.collapsedDrawers);
  const groupedPools = usePoolStore(state => state.getGroupedPools());

  const switchPool = usePoolStore(state => state.switchPool);
  const setPoolSearchQuery = usePoolStore(state => state.setPoolSearchQuery);
  const toggleDrawer = usePoolStore(state => state.toggleDrawer);

  const userRole = useAuthStore(state => state.userRole);
  const canEdit = userRole === 'admin' || userRole === 'super_admin';
  const isSuperAdmin = userRole === 'super_admin';

  // UI状态（使用 React.useState，因为这些是纯UI状态）
  const [showPoolMenu, setShowPoolMenu] = React.useState(false);

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
  const currentPoolName = pools.find(p => p.id === currentPoolId)?.name || '未知卡池';

  return (
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
        <ChevronDown size={14} className={`transition-transform ${showPoolMenu ? 'rotate-180' : ''}`}/>
      </button>

      {/* 卡池选择菜单 */}
      {showPoolMenu && (
        <>
          {/* 背景遮罩 */}
          <div className="fixed inset-0 z-10" onClick={closeMenu}></div>

          {/* 菜单内容 */}
          <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-zinc-900 rounded-none shadow-xl border border-zinc-100 dark:border-zinc-800 z-20 animate-fade-in overflow-hidden">
            {/* 搜索框 */}
            <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
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
            </div>

            {/* 卡池列表 - 按抽卡人分组 */}
            <div className="max-h-80 overflow-y-auto">
              {groupedPools.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-400 dark:text-zinc-500">
                  未找到匹配的卡池
                </div>
              ) : (
                groupedPools.map((group) => {
                  const drawerKey = group.drawer || '未分类';
                  const isCollapsed = collapsedDrawers.has(drawerKey);

                  return (
                    <div key={drawerKey}>
                      {/* 抽卡人分组标题 - 可点击折叠 */}
                      <button
                        onClick={() => toggleDrawer(drawerKey)}
                        className="w-full px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider bg-slate-50 dark:bg-zinc-800/50 sticky top-0 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-zinc-700/50 transition-colors"
                      >
                        <ChevronDown
                          size={12}
                          className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                        />
                        <User size={12} />
                        {group.drawer || '未分类'}
                        <span className="text-slate-300 dark:text-zinc-600">({group.pools.length})</span>
                      </button>

                      {/* 该抽卡人的卡池列表 - 可折叠 */}
                      {!isCollapsed && group.pools.map(pool => {
                        const charName = extractCharNameFromPoolName(pool.name);
                        const poolTypeLabel = pool.type === 'limited' ? '限定' : pool.type === 'weapon' ? '武器' : '常驻';
                        const poolTypeColor = pool.type === 'limited' ? 'text-orange-500' : pool.type === 'weapon' ? 'text-slate-500 dark:text-zinc-400' : 'text-yellow-600 dark:text-endfield-yellow';

                        return (
                          <div
                            key={pool.id}
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 group/item ${currentPoolId === pool.id ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}
                          >
                            <button
                              onClick={() => handleSelectPool(pool.id)}
                              className={`flex-1 text-left flex items-center gap-2 min-w-0 ${currentPoolId === pool.id ? 'text-yellow-600 dark:text-endfield-yellow font-bold' : 'text-slate-600 dark:text-zinc-400'}`}
                              title={pool.name}
                            >
                              {pool.locked && <Lock size={12} className="text-amber-500 shrink-0" />}
                              <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 font-bold ${poolTypeColor} bg-opacity-10 ${pool.type === 'limited' ? 'bg-orange-100 dark:bg-orange-900/30' : pool.type === 'weapon' ? 'bg-slate-100 dark:bg-zinc-700' : 'bg-yellow-100 dark:bg-yellow-900/30'}`}>
                                {poolTypeLabel}
                              </span>
                              <span className="truncate">
                                {charName || (group.drawer ? pool.name.replace(`-${group.drawer}`, '') : pool.name)}
                              </span>
                            </button>

                            <div className="flex items-center gap-0.5 shrink-0">
                              {currentPoolId === pool.id && <div className="w-1.5 h-1.5 rounded-sm bg-endfield-yellow shrink-0 mr-1"></div>}
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
                                    onOpenEditPoolModal(e, pool);
                                  }}
                                  className="p-1 text-slate-300 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded opacity-0 group-hover/item:opacity-100 transition-all"
                                  title="编辑卡池"
                                >
                                  <Settings size={12} />
                                </button>
                              )}
                              {/* 删除卡池按钮 */}
                              {canEdit && (!pool.locked || isSuperAdmin) && pools.length > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenDeletePoolModal(pool);
                                  }}
                                  className="p-1 text-slate-300 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded opacity-0 group-hover/item:opacity-100 transition-all"
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
                  );
                })
              )}
            </div>

            {/* 新建卡池 - 仅管理员可见 */}
            {canEdit && (
              <div className="border-t border-zinc-100 dark:border-zinc-800">
                <button
                  onClick={() => {
                    closeMenu();
                    onOpenCreatePoolModal();
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm text-yellow-600 dark:text-endfield-yellow hover:bg-yellow-50 dark:hover:bg-yellow-900/20 flex items-center gap-2 font-medium"
                >
                  <Plus size={16} />
                  新建卡池...
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PoolSelector;
