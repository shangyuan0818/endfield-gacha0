import React, { useState, useMemo } from 'react';
import { Star, User, Cloud, Layers, RefreshCw, Swords, ChevronDown } from 'lucide-react';
import usePoolStore from '../../stores/usePoolStore';
import useHistoryStore from '../../stores/useHistoryStore';
import useAppStore from '../../stores/useAppStore';
import useAuthStore from '../../stores/useAuthStore';
import { useSummaryStats, useRankingData } from '../../hooks/summary';
import { RARITY_CONFIG } from '../../constants';
import MobileChartContainer from '../components/MobileChartContainer';

/**
 * 移动端统计视图 - 工业风重构版 (中文)
 */
function MobileSummaryView() {
  const { user } = useAuthStore();
  const { pools } = usePoolStore();
  const { history } = useHistoryStore();
  const { globalStats, globalStatsLoading } = useAppStore();

  const [dataSource, setDataSource] = useState('global');
  const [poolTypeFilter, setPoolTypeFilter] = useState('all');

  const { characterRanking, rankingLoading, userRanking, userRankingLoading } = useRankingData(dataSource, user);
  const localStats = useSummaryStats(history, pools, user);

  const currentStats = useMemo(() => {
    const isGlobal = dataSource === 'global';
    const baseStats = isGlobal ? globalStats : localStats;

    if (isGlobal && !globalStats) return null;
    if (!baseStats) return null;

    if (poolTypeFilter === 'all') {
      return {
        title: isGlobal ? '全服统计数据' : '个人记录',
        subtitle: '全卡池汇总',
        total: baseStats.totalPulls ?? baseStats.total,
        sixStar: baseStats.sixStarTotal ?? baseStats.sixStar,
        sixStarLimited: baseStats.sixStarLimited ?? baseStats.counts?.[6],
        sixStarStandard: baseStats.sixStarStandard ?? baseStats.counts?.['6_std'],
        avgPity: baseStats.avgPity,
        counts: baseStats.counts,
        byType: baseStats.byType,
        totalUsers: baseStats.totalUsers,
      };
    }

    const typeData = baseStats.byType?.[poolTypeFilter];
    if (!typeData) return null;

    const typeNames = {
      character: '角色池',
      limited: '限定池',
      weapon: '武器池',
      standard: '常驻池'
    };

    let avgPity = '-';
    if (typeData.avgPity) {
      avgPity = typeData.avgPity;
    } else if (typeData.pityList?.length > 0) {
      avgPity = (typeData.pityList.reduce((sum, p) => sum + p.count, 0) / typeData.pityList.length).toFixed(1);
    }

    return {
      title: isGlobal ? '全服统计数据' : '个人记录',
      subtitle: typeNames[poolTypeFilter],
      total: typeData.total,
      sixStar: typeData.six ?? typeData.sixStar,
      sixStarLimited: typeData.limitedSix ?? typeData.sixStarLimited,
      sixStarStandard: typeData.counts?.['6_std'] ?? typeData.sixStarStandard,
      avgPity,
      counts: typeData.counts,
      distribution: typeData.distribution,
      totalUsers: baseStats.totalUsers
    };
  }, [dataSource, poolTypeFilter, globalStats, localStats]);

  const ranking = dataSource === 'global' ? characterRanking : userRanking;
  const isRankingLoading = dataSource === 'global' ? rankingLoading : userRankingLoading;

  const filterOptions = [
    { value: 'all', label: '全部' },
    { value: 'limited', label: '限定' },
    { value: 'standard', label: '常驻' },
    { value: 'weapon', label: '武器' },
  ];

  return (
    <div className="px-4 py-4 space-y-4">
      {/* 标题和数据源切换 */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
          数据总览
        </h1>
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1">
          <button
            onClick={() => setDataSource('global')}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase transition-colors rounded-none ${
              dataSource === 'global'
                ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <Cloud size={10} className="inline mr-1" />
            全服
          </button>
          <button
            onClick={() => setDataSource('local')}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase transition-colors rounded-none ${
              dataSource === 'local'
                ? 'bg-endfield-yellow text-black'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <User size={10} className="inline mr-1" />
            本地
          </button>
        </div>
      </div>

      {/* 卡池类型筛选 */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setPoolTypeFilter(option.value)}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors rounded-none border ${
              poolTypeFilter === option.value
                ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white'
                : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* 加载状态 */}
      {(globalStatsLoading || (dataSource === 'global' && !globalStats)) ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 flex flex-col items-center justify-center gap-3 rounded-none">
          <RefreshCw size={24} className="animate-spin text-zinc-400" />
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">正在获取数据...</span>
        </div>
      ) : currentStats ? (
        <>
          {/* 统计卡片 */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden rounded-none shadow-sm">
            <div className={`h-1 w-full ${dataSource === 'global' ? 'bg-indigo-500' : 'bg-endfield-yellow'}`} />
            <div className="p-4">
              {/* 标题 */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-none border border-current ${dataSource === 'global' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/10' : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10'}`}>
                    {dataSource === 'global' ? <Cloud size={16} /> : <User size={16} />}
                  </div>
                  <div>
                    <h2 className="font-bold text-zinc-800 dark:text-white text-sm uppercase tracking-tight">{currentStats.title}</h2>
                    <span className="text-zinc-400 text-[10px] font-mono uppercase tracking-widest">{currentStats.subtitle}</span>
                  </div>
                </div>
                {currentStats.totalUsers && (
                  <div className="text-right">
                    <span className="block text-[9px] text-zinc-400 uppercase font-mono mb-0.5">贡献者</span>
                    <span className="text-lg font-bold text-zinc-700 dark:text-zinc-300 font-mono leading-none">{currentStats.totalUsers.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* 核心数据 */}
              <div className="grid grid-cols-2 gap-3">
                {/* 总抽数 */}
                <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 p-3 rounded-none relative group hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                  <div className="text-zinc-400 text-[9px] uppercase font-bold tracking-wider mb-1">总抽数</div>
                  <div className="text-2xl font-black text-zinc-800 dark:text-white font-mono">
                    {(currentStats.total || 0).toLocaleString()}
                  </div>
                  <div className="absolute top-3 right-3 w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-700 group-hover:bg-zinc-400 dark:group-hover:bg-zinc-600" />
                </div>

                {/* 6星数量 */}
                <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 p-3 rounded-none relative group hover:border-amber-300 dark:hover:border-amber-900 transition-colors">
                  <div className="text-zinc-400 text-[9px] uppercase font-bold tracking-wider mb-1">6★ 总数</div>
                  <div className="text-2xl font-black text-amber-500 font-mono">
                    {currentStats.sixStar || 0}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                    概率: {currentStats.total > 0 ? ((currentStats.sixStar / currentStats.total) * 100).toFixed(2) : 0}%
                  </div>
                </div>

                {/* 平均出货 */}
                <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 p-3 rounded-none relative group hover:border-indigo-300 dark:hover:border-indigo-900 transition-colors">
                  <div className="text-zinc-400 text-[9px] uppercase font-bold tracking-wider mb-1">平均出货</div>
                  <div className="text-2xl font-black text-indigo-500 font-mono">
                    {currentStats.avgPity || '-'}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5 uppercase">抽 / 6★</div>
                </div>

                {/* 不歪/歪 */}
                <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 p-3 rounded-none relative group hover:border-emerald-300 dark:hover:border-emerald-900 transition-colors">
                  <div className="text-zinc-400 text-[9px] uppercase font-bold tracking-wider mb-1">不歪 / 歪</div>
                  <div className="text-xl font-black font-mono">
                    <span className="text-emerald-500">{currentStats.sixStarLimited || 0}</span>
                    <span className="text-zinc-300 mx-1">/</span>
                    <span className="text-rose-500">{currentStats.sixStarStandard || 0}</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5 uppercase">
                    不歪率: {currentStats.sixStar > 0 ? (((currentStats.sixStarLimited || 0) / currentStats.sixStar) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 分池统计 - 仅在全部时显示 */}
          {poolTypeFilter === 'all' && currentStats.byType && (
            <>
              {/* 角色池统计 */}
              <MobileChartContainer title="角色池数据" defaultExpanded={true} className="rounded-none">
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-zinc-50 dark:bg-zinc-900/30 p-2 border border-zinc-100 dark:border-zinc-800 rounded-none">
                    <div className="text-zinc-400 text-[9px] uppercase font-bold mb-1">限定池</div>
                    <div className="text-lg font-bold font-mono text-zinc-700 dark:text-zinc-200">
                      {(currentStats.byType?.limited?.total || 0).toLocaleString()} <span className="text-xs font-normal text-zinc-400">抽</span>
                    </div>
                    <div className="text-xs text-emerald-500 font-mono font-bold mt-1">
                      {currentStats.byType?.limited?.six || 0} <span className="text-[9px] font-normal text-zinc-400">个 6★</span>
                    </div>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-900/30 p-2 border border-zinc-100 dark:border-zinc-800 rounded-none">
                    <div className="text-zinc-400 text-[9px] uppercase font-bold mb-1">常驻池</div>
                    <div className="text-lg font-bold font-mono text-zinc-700 dark:text-zinc-200">
                      {(currentStats.byType?.standard?.total || 0).toLocaleString()} <span className="text-xs font-normal text-zinc-400">抽</span>
                    </div>
                    <div className="text-xs text-indigo-500 font-mono font-bold mt-1">
                      {currentStats.byType?.standard?.six || 0} <span className="text-[9px] font-normal text-zinc-400">个 6★</span>
                    </div>
                  </div>
                </div>

                {/* 平均出货对比 */}
                <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-3 text-[10px] font-mono">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <span className="w-1.5 h-1.5 bg-emerald-500" />
                    <span className="uppercase">限定平均: {currentStats.byType?.limited?.avgPity || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-500">
                    <span className="w-1.5 h-1.5 bg-indigo-500" />
                    <span className="uppercase">常驻平均: {currentStats.byType?.standard?.avgPity || '-'}</span>
                  </div>
                </div>
              </MobileChartContainer>

              {/* 武器池统计 */}
              <MobileChartContainer title="武器池数据" defaultExpanded={true} className="rounded-none">
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-zinc-50 dark:bg-zinc-900/30 p-2 border border-zinc-100 dark:border-zinc-800 rounded-none">
                    <div className="text-zinc-400 text-[9px] uppercase font-bold mb-1">总抽数</div>
                    <div className="text-lg font-bold font-mono text-zinc-700 dark:text-zinc-200">
                      {(currentStats.byType?.weapon?.total || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-900/30 p-2 border border-zinc-100 dark:border-zinc-800 rounded-none">
                    <div className="text-zinc-400 text-[9px] uppercase font-bold mb-1">6★ 数量</div>
                    <div className="text-lg font-bold font-mono text-amber-500">
                      {currentStats.byType?.weapon?.six || 0}
                    </div>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-900/30 p-2 border border-zinc-100 dark:border-zinc-800 rounded-none">
                    <div className="text-zinc-400 text-[9px] uppercase font-bold mb-1">平均出货</div>
                    <div className="text-lg font-bold font-mono text-indigo-500">
                      {currentStats.byType?.weapon?.avgPity || '-'}
                    </div>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-900/30 p-2 border border-zinc-100 dark:border-zinc-800 rounded-none">
                    <div className="text-zinc-400 text-[9px] uppercase font-bold mb-1">不歪 / 歪</div>
                    <div className="text-lg font-bold font-mono">
                      <span className="text-emerald-500">{currentStats.byType?.weapon?.limitedSix || 0}</span>
                      <span className="text-zinc-300 mx-1">/</span>
                      <span className="text-rose-500">{(currentStats.byType?.weapon?.six || 0) - (currentStats.byType?.weapon?.limitedSix || 0)}</span>
                    </div>
                  </div>
                </div>
              </MobileChartContainer>
            </>
          )}

          {/* UP 6★ 排名 */}
          {ranking && (
            <MobileChartContainer title="UP 6★ 排名" defaultExpanded={true} className="rounded-none">
              {isRankingLoading ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw size={20} className="animate-spin text-zinc-400" />
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  {/* 限定池 UP */}
                  {ranking.limited?.characters?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2 px-1 border-l-2 border-fuchsia-500">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">限定池 6★</span>
                      </div>
                      <div className="space-y-1">
                        {ranking.limited.characters.slice(0, 5).map((char, index) => (
                          <div key={char.name} className="flex items-center justify-between py-2 border-b border-dashed border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors px-1">
                            <div className="flex items-center gap-3">
                              <span className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold font-mono rounded-none ${
                                index === 0 ? 'bg-amber-500 text-white' :
                                index === 1 ? 'bg-zinc-400 text-white' :
                                index === 2 ? 'bg-amber-700 text-white' :
                                'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                              }`}>
                                {index + 1}
                              </span>
                              <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase">{char.name}</span>
                            </div>
                            <span className="text-sm font-bold font-mono text-amber-500">{char.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 六星分类统计 */}
                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-zinc-50 dark:bg-zinc-900/30 p-2 border border-zinc-100 dark:border-zinc-800">
                        <div className="text-[9px] text-zinc-400 uppercase font-bold mb-1">UP 6★</div>
                        <div className="text-lg font-bold font-mono text-emerald-500">
                          {ranking?.limited?.sixStarUpCount ?? ranking?.limited?.sixStarUpExcludingFree ?? '-'}
                        </div>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-900/30 p-2 border border-zinc-100 dark:border-zinc-800">
                        <div className="text-[9px] text-zinc-400 uppercase font-bold mb-1">歪 6★</div>
                        <div className="text-lg font-bold font-mono text-rose-500">
                          {ranking?.limited?.sixStarOffCount ?? ranking?.limited?.sixStarOffExcludingFree ?? '-'}
                        </div>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-900/30 p-2 border border-zinc-100 dark:border-zinc-800">
                        <div className="text-[9px] text-zinc-400 uppercase font-bold mb-1">不歪率</div>
                        <div className="text-lg font-bold font-mono text-indigo-500">
                          {(() => {
                            const upCount = ranking?.limited?.sixStarUpCount ?? ranking?.limited?.sixStarUpExcludingFree ?? 0;
                            const offCount = ranking?.limited?.sixStarOffCount ?? ranking?.limited?.sixStarOffExcludingFree ?? 0;
                            const total = upCount + offCount;
                            if (total === 0) return '-';
                            return ((upCount / total) * 100).toFixed(1) + '%';
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </MobileChartContainer>
          )}

          {/* 星级分布 */}
          <MobileChartContainer title="稀有度分布" defaultExpanded={false} className="rounded-none">
            {currentStats.counts ? (
              <div className="space-y-4 pt-2">
                {[
                    { label: '6★ (限定)', key: 6, color: 'bg-amber-500', text: 'text-amber-500' },
                    { label: '6★ (常驻)', key: '6_std', color: 'bg-orange-500', text: 'text-orange-500' },
                    { label: '5★', key: 5, color: 'bg-purple-500', text: 'text-purple-500' },
                    { label: '4★', key: 4, color: 'bg-blue-500', text: 'text-blue-500' }
                ].map((item) => (
                    <div key={item.key}>
                      <div className="flex justify-between text-xs mb-1 font-mono uppercase font-bold">
                        <span className={item.text}>{item.label}</span>
                        <span className="text-zinc-600 dark:text-zinc-300">{currentStats.counts[item.key] || 0}</span>
                      </div>
                      <div className="h-2 bg-zinc-100 dark:bg-zinc-800 w-full overflow-hidden">
                        <div
                          className={`h-full ${item.color} transition-all`}
                          style={{ width: `${currentStats.total > 0 ? ((currentStats.counts[item.key] || 0) / currentStats.total) * 100 * (item.key >= 5 ? 10 : 1) : 0}%` }}
                        />
                      </div>
                    </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 text-center py-4 font-mono uppercase tracking-widest">暂无数据</p>
            )}
          </MobileChartContainer>
        </>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 text-center text-zinc-500 font-mono text-xs uppercase tracking-widest rounded-none">
          暂无数据
        </div>
      )}

      {/* 底部留白 */}
      <div className="h-4" />
    </div>
  );
}

export default MobileSummaryView;