import { Check, ChevronDown, Download, Layers, RefreshCw, Share2, Star } from 'lucide-react';

function groupSimulatorPools(simulatorPools) {
  const groups = {
    limited: { label: '限定角色池', icon: <Star size={12} className="text-orange-500" />, pools: [] },
    weapon: { label: '限定武器池', icon: <Layers size={12} className="text-slate-500" />, pools: [] },
    standard: { label: '常驻池', icon: <Layers size={12} className="text-yellow-600" />, pools: [] }
  };

  simulatorPools.forEach((pool) => {
    let type = pool.type || 'standard';
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

  return ['limited', 'weapon', 'standard']
    .map((type) => ({ type, ...groups[type] }))
    .filter((group) => group.pools.length > 0);
}

const SimulatorToolbar = ({
  currentSimPool,
  currentSimPoolId,
  onExportData,
  onExportReport,
  onReset,
  onShare,
  onSwitchPool,
  onToggleMultipleFreeTen,
  onTogglePoolMenu,
  onToggleSkipAnimation,
  poolType,
  showPoolMenu,
  simulatorPools,
  multipleFreeTen,
  skipAnimation
}) => (
  <div className="flex flex-wrap items-center justify-between mb-6 px-2 gap-4">
    <div className="flex items-center gap-4">
      <div className="relative">
        <button
          onClick={onTogglePoolMenu}
          className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-none text-sm font-medium text-slate-700 dark:text-zinc-300 transition-colors"
        >
          <Layers size={16} />
          <span className="max-w-[150px] sm:max-w-[250px] truncate">
            {currentSimPool?.name || '选择模拟卡池'}
          </span>
          <ChevronDown size={14} className={`transition-transform ${showPoolMenu ? 'rotate-180' : ''}`} />
        </button>

        {showPoolMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={onTogglePoolMenu}></div>

            <div className="absolute left-0 top-full mt-2 w-80 bg-white dark:bg-zinc-900 rounded-none shadow-xl border border-zinc-100 dark:border-zinc-800 z-20 animate-fade-in overflow-hidden">
              <div className="max-h-80 overflow-y-auto">
                {simulatorPools.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-400 dark:text-zinc-500">
                    暂无卡池，请先在卡池详情中创建卡池
                  </div>
                ) : (
                  groupSimulatorPools(simulatorPools).map((group) => (
                    <div key={group.type}>
                      <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider bg-slate-50 dark:bg-zinc-800/50 sticky top-0 flex items-center gap-2">
                        {group.icon}
                        {group.label}
                        <span className="text-slate-300 dark:text-zinc-600">({group.pools.length})</span>
                      </div>

                      {group.pools.map((pool) => {
                        const isSelected = currentSimPoolId === pool.id;

                        return (
                          <div
                            key={pool.id}
                            className={`w-full hover:bg-slate-50 dark:hover:bg-zinc-800 ${isSelected ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}
                          >
                            <button
                              onClick={() => onSwitchPool(pool.id)}
                              className="w-full text-left"
                              title={pool.name}
                            >
                              {pool.banner_url && (
                                <div className="relative w-full h-16 overflow-hidden">
                                  <img
                                    src={pool.banner_url}
                                    alt={pool.name}
                                    className="w-full h-full object-cover"
                                    onError={(event) => {
                                      event.target.style.display = 'none';
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                                </div>
                              )}

                              <div className="px-3 py-2 flex items-center justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className={`flex items-center gap-2 text-sm ${isSelected ? 'text-yellow-600 dark:text-endfield-yellow font-bold' : 'text-slate-600 dark:text-zinc-400'}`}>
                                    <span className="truncate">{pool.name}</span>
                                  </div>

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

                                <div className="flex items-center gap-2 shrink-0">
                                  {isSelected && <div className="w-1.5 h-1.5 rounded-sm bg-endfield-yellow"></div>}
                                </div>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>

    <div className="flex items-center gap-4 ml-auto">
      {poolType === 'limited' && (
        <div
          onClick={onToggleMultipleFreeTen}
          className={`
            flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all border select-none
            ${multipleFreeTen
              ? 'bg-blue-500/10 border-blue-500 text-blue-500'
              : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-500 hover:border-slate-300 dark:hover:border-zinc-700'
            }
          `}
          title="多次十连是BUG（划掉）特性哦~"
        >
          <div className={`w-3 h-3 border flex items-center justify-center transition-colors ${multipleFreeTen ? 'border-blue-500 bg-blue-500' : 'border-current'}`}>
            {multipleFreeTen && <Check size={10} className="text-white" strokeWidth={4} />}
          </div>
          <span className="text-xs font-bold uppercase">多次免费十连</span>
        </div>
      )}

      <div
        onClick={onToggleSkipAnimation}
        className={`
          flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all border select-none
          ${skipAnimation
            ? 'bg-yellow-50 dark:bg-endfield-yellow/10 border-yellow-600 dark:border-endfield-yellow text-yellow-700 dark:text-endfield-yellow'
            : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-500 hover:border-slate-300 dark:hover:border-zinc-700'
          }
        `}
      >
        <div className={`w-3 h-3 border flex items-center justify-center transition-colors ${skipAnimation ? 'border-yellow-600 dark:border-endfield-yellow bg-yellow-500 dark:bg-endfield-yellow' : 'border-current'}`}>
          {skipAnimation && <Check size={10} className="text-white dark:text-black" strokeWidth={4} />}
        </div>
        <span className="text-xs font-bold uppercase">跳过动画</span>
      </div>

      <button
        onClick={onShare}
        className="px-3 py-1.5 flex items-center gap-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-endfield-yellow hover:border-endfield-yellow transition-colors"
        title="分享到剪贴板"
      >
        <Share2 size={14} />
        <span className="hidden sm:inline">分享</span>
      </button>

      <div className="relative group">
        <button
          className="px-3 py-1.5 flex items-center gap-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-endfield-yellow hover:border-endfield-yellow transition-colors"
          title="导出数据"
        >
          <Download size={14} />
          <span className="hidden sm:inline">导出</span>
          <ChevronDown size={12} />
        </button>

        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          <button
            onClick={() => onExportData('json')}
            className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
          >
            导出为 JSON（可导入）
          </button>
          <button
            onClick={() => onExportData('csv')}
            className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border-t border-zinc-100 dark:border-zinc-800"
          >
            导出为 CSV（可导入）
          </button>
          <button
            onClick={onExportReport}
            className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border-t border-zinc-100 dark:border-zinc-800"
          >
            导出统计报告
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-xs font-mono text-slate-500 dark:text-zinc-500">SYSTEM ONLINE</span>
      </div>

      <button
        onClick={onReset}
        className="px-3 py-1.5 flex items-center gap-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-red-500 hover:border-red-500 transition-colors"
        title="重置模拟器"
      >
        <RefreshCw size={14} />
        <span className="hidden sm:inline">重置</span>
      </button>
    </div>
  </div>
);

export default SimulatorToolbar;
