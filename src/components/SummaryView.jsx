import React, { useState, useMemo } from 'react';
import { Star, User, Cloud, Layers, Search, RefreshCw, Swords } from 'lucide-react';
import { RARITY_CONFIG } from '../constants';

// 拆分后的组件
import { SidebarItem, RankingCard, ChartSection } from './summary';

// 拆分后的 Hooks
import { useThemeDetection, getTooltipStyle, useRankingData, useSummaryStats } from '../hooks/summary';

/**
 * 统计视图组件 (重构后)
 * REFACTOR-002: 从 1,390 行拆分为多个子组件和 hooks
 * 2026-02-07 重构完成
 */
const SummaryView = React.memo(({ history, pools, globalStats, globalStatsLoading, user }) => {
  // 状态管理：数据源和卡池类型筛选
  const [dataSource, setDataSource] = useState('global');
  const [poolTypeFilter, setPoolTypeFilter] = useState('all');

  // 使用拆分后的 hooks
  const isDark = useThemeDetection();
  const tooltipStyle = getTooltipStyle(isDark);
  const { characterRanking, rankingLoading, userRanking, userRankingLoading } = useRankingData(dataSource, user);
  const localStats = useSummaryStats(history, pools, user);

  // 根据数据源和筛选条件获取当前显示的统计数据
  const currentStats = useMemo(() => {
    const isGlobal = dataSource === 'global';
    const baseStats = isGlobal ? globalStats : localStats;

    if (isGlobal && !globalStats) return null;
    if (!baseStats) return null;

    if (poolTypeFilter === 'all') {
      return {
        title: isGlobal ? '全服数据' : '我的数据',
        subtitle: '全部卡池',
        total: baseStats.totalPulls ?? baseStats.total,
        sixStar: baseStats.sixStarTotal ?? baseStats.sixStar,
        sixStarLimited: baseStats.sixStarLimited ?? baseStats.counts?.[6],
        sixStarStandard: baseStats.sixStarStandard ?? baseStats.counts?.['6_std'],
        avgPity: baseStats.avgPity,
        counts: baseStats.counts,
        byType: baseStats.byType,
        totalUsers: baseStats.totalUsers,
        charGift: baseStats.charGift || 0,
        weaponGiftLimited: baseStats.weaponGiftLimited || 0,
        weaponGiftStandard: baseStats.weaponGiftStandard || 0,
        giftTotal: baseStats.giftTotal || 0
      };
    }

    const typeData = baseStats.byType?.[poolTypeFilter];
    if (!typeData) return null;

    const typeNames = {
      character: '角色池（限定+常驻）',
      limited: '限定角色池',
      weapon: '武器池',
      standard: '常驻池'
    };

    let avgPity = '-';
    if (typeData.avgPity) {
      avgPity = typeData.avgPity;
    } else if (typeData.pityList?.length > 0) {
      avgPity = (typeData.pityList.reduce((sum, p) => sum + p.count, 0) / typeData.pityList.length).toFixed(1);
    }

    let avgPityExcludingFree = null;
    if (poolTypeFilter === 'limited' || poolTypeFilter === 'character') {
      if (typeData.avgPityExcludingFree) {
        avgPityExcludingFree = typeData.avgPityExcludingFree;
      } else if (typeData.pityListExcludingFree?.length > 0) {
        avgPityExcludingFree = (typeData.pityListExcludingFree.reduce((sum, p) => sum + p.count, 0) / typeData.pityListExcludingFree.length).toFixed(1);
      }
    }

    return {
      title: isGlobal ? '全服数据' : '我的数据',
      subtitle: typeNames[poolTypeFilter],
      total: typeData.total,
      sixStar: typeData.six ?? typeData.sixStar,
      sixStarLimited: typeData.limitedSix ?? typeData.sixStarLimited ?? typeData.counts?.[6],
      sixStarStandard: typeData.counts?.['6_std'] ?? typeData.sixStarStandard,
      avgPity,
      avgPityExcludingFree,
      counts: typeData.counts,
      distribution: typeData.distribution,
      chartData: typeData.chartData,
      totalUsers: baseStats.totalUsers
    };
  }, [dataSource, poolTypeFilter, globalStats, localStats]);

  // 辅助函数：为全服数据生成 chartData
  const generateChartDataFromCounts = (counts) => {
    if (!counts) return [];
    const rawData = [
      { name: '6星(限定)', value: counts[6] || counts['6'] || 0, color: RARITY_CONFIG[6].color },
      { name: '6星(常驻)', value: counts['6_std'] || 0, color: RARITY_CONFIG['6_std'].color },
      { name: '5星', value: counts[5] || counts['5'] || 0, color: RARITY_CONFIG[5].color },
      { name: '4星', value: counts[4] || counts['4'] || 0, color: RARITY_CONFIG[4].color },
    ].filter(item => item.value > 0);

    const totalValue = rawData.reduce((sum, d) => sum + d.value, 0);
    return rawData.map(item => {
      const currentPercent = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
      let minPercent = 0;
      if (item.name.includes('6星')) minPercent = 15;
      else if (item.name.includes('5星')) minPercent = 20;

      if (currentPercent < minPercent && totalValue > 0) {
        return { ...item, displayValue: Math.ceil(totalValue * minPercent / 100) };
      }
      return { ...item, displayValue: item.value };
    });
  };

  // 获取图表显示数据
  const chartDisplayData = useMemo(() => {
    const isGlobal = dataSource === 'global';
    const baseStats = isGlobal ? globalStats : localStats;

    if (!baseStats) return { charts: [], isGlobal };

    if (poolTypeFilter !== 'all') {
      const typeData = baseStats.byType?.[poolTypeFilter];
      if (!typeData) return { charts: [], isGlobal };

      const typeNames = { character: '角色池', limited: '限定池', weapon: '武器池', standard: '常驻池' };
      const typeColors = { character: 'rainbow-text', limited: 'rainbow-text', weapon: 'text-slate-500', standard: 'text-indigo-500' };
      const chartData = typeData.chartData || generateChartDataFromCounts(typeData.counts);

      return {
        isGlobal,
        charts: [{
          title: typeNames[poolTypeFilter],
          color: typeColors[poolTypeFilter],
          data: { ...typeData, chartData }
        }]
      };
    }

    // 全部数据时：角色池（合并）+ 武器池
    const limitedCounts = baseStats.byType?.limited?.counts || {};
    const standardCounts = baseStats.byType?.standard?.counts || {};
    const characterCounts = {
      6: (limitedCounts[6] || 0) + (standardCounts[6] || 0),
      '6_std': (limitedCounts['6_std'] || 0) + (standardCounts['6_std'] || 0),
      5: (limitedCounts[5] || 0) + (standardCounts[5] || 0),
      4: (limitedCounts[4] || 0) + (standardCounts[4] || 0)
    };

    const mergeDistributions = (limited, standard) => {
      if (!limited?.length && !standard?.length) return [];
      const merged = {};
      (limited || []).forEach(item => {
        merged[item.range] = { range: item.range, limited: item.limited || 0, standard: item.standard || 0 };
      });
      (standard || []).forEach(item => {
        if (merged[item.range]) {
          merged[item.range].limited += item.limited || 0;
          merged[item.range].standard += item.standard || 0;
        } else {
          merged[item.range] = { range: item.range, limited: item.limited || 0, standard: item.standard || 0 };
        }
      });
      return Object.values(merged).sort((a, b) => parseInt(a.range) - parseInt(b.range));
    };

    return {
      isGlobal,
      charts: [
        {
          title: '角色池',
          subtitle: '限定 + 常驻',
          color: 'text-violet-500',
          data: baseStats.byType?.character || {
            total: (baseStats.byType?.limited?.total || 0) + (baseStats.byType?.standard?.total || 0),
            six: (baseStats.byType?.limited?.six || 0) + (baseStats.byType?.standard?.six || 0),
            counts: characterCounts,
            distribution: mergeDistributions(baseStats.byType?.limited?.distribution, baseStats.byType?.standard?.distribution),
            chartData: generateChartDataFromCounts(characterCounts)
          }
        },
        {
          title: '武器池',
          color: 'text-slate-500',
          data: {
            ...(baseStats.byType?.weapon || { total: 0, six: 0, counts: {}, distribution: [] }),
            chartData: baseStats.byType?.weapon?.chartData || generateChartDataFromCounts(baseStats.byType?.weapon?.counts)
          }
        }
      ]
    };
  }, [dataSource, poolTypeFilter, globalStats, localStats]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex gap-6">
        {/* 左侧边栏 */}
        <div className="w-56 flex-shrink-0">
          <div className="bg-zinc-900 border border-zinc-800 sticky top-4">
            {/* 全服数据分组 */}
            <div className="border-b border-zinc-800">
              <SidebarItem
                label="全服数据"
                icon={Cloud}
                isActive={dataSource === 'global' && poolTypeFilter === 'all'}
                onClick={() => { setDataSource('global'); setPoolTypeFilter('all'); }}
                count={globalStats?.totalPulls}
              />
              {dataSource === 'global' && (
                <div className="bg-zinc-950">
                  <SidebarItem label="限定池" icon={Star} indent isActive={dataSource === 'global' && poolTypeFilter === 'limited'} onClick={() => { setDataSource('global'); setPoolTypeFilter('limited'); }} count={globalStats?.byType?.limited?.total} />
                  <SidebarItem label="常驻池" icon={Layers} indent isActive={dataSource === 'global' && poolTypeFilter === 'standard'} onClick={() => { setDataSource('global'); setPoolTypeFilter('standard'); }} count={globalStats?.byType?.standard?.total} />
                  <SidebarItem label="武器池" icon={Search} indent isActive={dataSource === 'global' && poolTypeFilter === 'weapon'} onClick={() => { setDataSource('global'); setPoolTypeFilter('weapon'); }} count={globalStats?.byType?.weapon?.total} />
                </div>
              )}
            </div>

            {/* 我的数据分组 */}
            <div>
              <SidebarItem
                label="我的数据"
                icon={User}
                isActive={dataSource === 'local' && poolTypeFilter === 'all'}
                onClick={() => { setDataSource('local'); setPoolTypeFilter('all'); }}
                count={localStats.total}
              />
              {dataSource === 'local' && (
                <div className="bg-zinc-950">
                  <SidebarItem label="限定池" icon={Star} indent isActive={dataSource === 'local' && poolTypeFilter === 'limited'} onClick={() => { setDataSource('local'); setPoolTypeFilter('limited'); }} count={localStats.byType.limited.total} />
                  <SidebarItem label="常驻池" icon={Layers} indent isActive={dataSource === 'local' && poolTypeFilter === 'standard'} onClick={() => { setDataSource('local'); setPoolTypeFilter('standard'); }} count={localStats.byType.standard.total} />
                  <SidebarItem label="武器池" icon={Search} indent isActive={dataSource === 'local' && poolTypeFilter === 'weapon'} onClick={() => { setDataSource('local'); setPoolTypeFilter('weapon'); }} count={localStats.byType.weapon.total} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 space-y-6">
          {/* 统计信息卡片 */}
          {(globalStatsLoading || (dataSource === 'global' && !globalStats)) ? (
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-12 text-center flex flex-col items-center justify-center gap-3">
              <RefreshCw size={32} className="animate-spin text-zinc-400" />
              <span className="text-sm font-mono text-zinc-500 uppercase tracking-widest">Loading Global Data...</span>
            </div>
          ) : currentStats ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 relative overflow-hidden group">
              {/* 背景装饰网格 */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
              <div className="h-1 w-full bg-endfield-yellow"></div>

              <div className="relative z-10 p-6">
                {/* 标题 */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-sm ${dataSource === 'global' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500'}`}>
                      {dataSource === 'global' ? <Cloud size={20} /> : <User size={20} />}
                    </div>
                    <div>
                      <h2 className="font-bold text-lg text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        {currentStats.title}
                        <span className="px-1.5 py-0.5 text-[10px] border border-zinc-200 dark:border-zinc-700 text-zinc-500 rounded-sm font-mono">
                          {dataSource === 'global' ? '全服' : '本地'}
                        </span>
                      </h2>
                      <span className="text-zinc-500 text-xs font-mono block mt-0.5">TARGET // {currentStats.subtitle}</span>
                    </div>
                  </div>
                  {currentStats.totalUsers && (
                    <div className="text-right">
                      <span className="block text-[10px] text-zinc-400 uppercase font-mono tracking-widest">贡献人数</span>
                      <span className="text-xl font-bold text-slate-700 dark:text-zinc-300 font-mono">{currentStats.totalUsers.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* 统计数据 */}
                {poolTypeFilter === 'all' ? (
                  <div className="space-y-4">
                    {/* 排名区域：左右双栏 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* 左侧列：总抽数 + 限定池UP分析 */}
                    <div className="space-y-4 flex flex-col">
                      {/* 总抽数 */}
                      <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 p-4 relative overflow-hidden group/stat flex-shrink-0">
                        <div className="absolute right-0 top-0 p-2 text-zinc-200 dark:text-zinc-800 group-hover/stat:scale-110 transition-transform"><Layers size={40} /></div>
                        <div className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">总抽数</div>
                        <div className="text-3xl font-black text-slate-800 dark:text-white font-mono">{(currentStats.total || 0).toLocaleString()}</div>
                      </div>

                      {/* 限定池 UP 六星排名 & 分类统计 (合并卡片) */}
                      <div className="bg-zinc-50 dark:bg-zinc-950/30 border border-zinc-200 dark:border-zinc-800 p-5 flex-1">
                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-800 border-dashed">
                          <Star size={16} className="text-amber-500" />
                          <h4 className="font-bold text-sm text-slate-700 dark:text-zinc-300 uppercase tracking-wide">限定池 UP 6★ 分析</h4>
                          <span className="text-[10px] text-zinc-400 ml-auto font-mono">排名 & 分布</span>
                        </div>
                        
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                          {/* 左侧：UP 六星排名 */}
                          <div className="h-full border-r-0 xl:border-r border-zinc-100 dark:border-zinc-800 xl:pr-6 border-b xl:border-b-0 pb-6 xl:pb-0">
                             <RankingCard
                                ranking={dataSource === 'global' ? characterRanking : userRanking}
                                loading={dataSource === 'global' ? rankingLoading : userRankingLoading}
                                poolType="limited"
                                title="限定池 UP 6★ 数量"
                                visibleSections={['limitedUp']}
                                flatLayout={true}
                              />
                          </div>

                          {/* 右侧：六星出货分类统计 */}
                          <div className="grid grid-cols-3 gap-4 content-start pt-2">
                            {/* UP六星 */}
                            <div className="space-y-1">
                              <div className="text-zinc-400 text-[10px] uppercase font-bold flex items-center gap-1">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                UP 6★ (不歪)
                              </div>
                              <div className="text-xl font-bold font-mono text-emerald-500">
                                {(() => {
                                  const ranking = dataSource === 'global' ? characterRanking : userRanking;
                                  return ranking?.limited?.sixStarUpCount ?? ranking?.limited?.sixStarUpExcludingFree ?? '-';
                                })()}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono leading-tight">
                                限定池抽中UP角色
                              </div>
                            </div>
                            {/* 歪出六星 - 歪常驻 */}
                            <div className="space-y-1">
                              <div className="text-zinc-400 text-[10px] uppercase font-bold flex items-center gap-1">
                                <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
                                歪常驻 6★
                              </div>
                              <div className="text-xl font-bold font-mono text-rose-500">
                                {(() => {
                                  const ranking = dataSource === 'global' ? characterRanking : userRanking;
                                  return ranking?.limited?.sixStarOffStandardCount ?? ranking?.limited?.sixStarOffCount ?? ranking?.limited?.sixStarOffExcludingFree ?? '-';
                                })()}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono leading-tight">
                                歪到常驻角色
                              </div>
                            </div>
                            {/* 歪出六星 - 歪限定 */}
                            <div className="space-y-1">
                              <div className="text-zinc-400 text-[10px] uppercase font-bold flex items-center gap-1">
                                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                                歪限定 6★
                              </div>
                              <div className="text-xl font-bold font-mono text-orange-500">
                                {(() => {
                                  const ranking = dataSource === 'global' ? characterRanking : userRanking;
                                  return ranking?.limited?.sixStarOffLimitedCount ?? 0;
                                })()}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono leading-tight">
                                歪到非当期限定
                              </div>
                            </div>
                            {/* 不歪率 */}
                            <div className="space-y-1">
                              <div className="text-zinc-400 text-[10px] uppercase font-bold">不歪率</div>
                              <div className="text-xl font-bold font-mono text-indigo-500">
                                {(() => {
                                  const ranking = dataSource === 'global' ? characterRanking : userRanking;
                                  const upCount = ranking?.limited?.sixStarUpCount ?? ranking?.limited?.sixStarUpExcludingFree ?? 0;
                                  const offCount = ranking?.limited?.sixStarOffCount ?? ranking?.limited?.sixStarOffExcludingFree ?? 0;
                                  const total = upCount + offCount;
                                  if (total === 0) return '-';
                                  return ((upCount / total) * 100).toFixed(1) + '%';
                                })()}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono leading-tight">
                                抽中UP的概率
                              </div>
                            </div>
                            {/* 常驻池六星 */}
                            <div className="space-y-1">
                              <div className="text-zinc-400 text-[10px] uppercase font-bold flex items-center gap-1">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                                常驻池 6★
                              </div>
                              <div className="text-xl font-bold font-mono text-indigo-400">
                                {currentStats.byType?.standard?.six || currentStats.byType?.standard?.sixStarTotal || 0}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono leading-tight">
                                常驻池出货
                              </div>
                            </div>
                            {/* 限定率 */}
                            <div className="space-y-1">
                              <div className="text-zinc-400 text-[10px] uppercase font-bold flex items-center gap-1">
                                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                                限定率
                              </div>
                              <div className="text-xl font-bold font-mono text-amber-500">
                                {(() => {
                                  const ranking = dataSource === 'global' ? characterRanking : userRanking;
                                  const offStd = ranking?.limited?.sixStarOffStandardCount ?? 0;
                                  const offLtd = ranking?.limited?.sixStarOffLimitedCount ?? 0;
                                  const totalOff = offStd + offLtd;
                                  if (totalOff === 0) return '-';
                                  return ((offLtd / totalOff) * 100).toFixed(1) + '%';
                                })()}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono leading-tight">
                                歪中限定占比
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 右侧列：其他排名 */}
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 p-4 h-full">
                      <RankingCard
                        ranking={dataSource === 'global' ? characterRanking : userRanking}
                        loading={dataSource === 'global' ? rankingLoading : userRankingLoading}
                        poolType="all"
                        title={dataSource === 'global' ? "全服出货排名 (其他)" : "我的出货排名 (其他)"}
                        visibleSections={['limitedOff', 'standard', 'limitedFive', 'standardFive']}
                      />
                    </div>
                  </div>

                  {/* 角色池统计 */}
                    <div className="bg-zinc-50 dark:bg-zinc-950/30 border border-zinc-200 dark:border-zinc-800 p-5">
                      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-800 border-dashed">
                        <Star size={16} className="text-violet-500" />
                        <h4 className="font-bold text-sm text-slate-700 dark:text-zinc-300 uppercase tracking-wide">角色池数据</h4>
                        <span className="text-[10px] text-zinc-400 ml-auto font-mono">限定 + 常驻</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="space-y-1">
                          <div className="text-zinc-400 text-[10px] uppercase font-bold">总抽数</div>
                          <div className="text-xl font-bold font-mono text-slate-700 dark:text-zinc-200">{((currentStats.byType?.limited?.total || 0) + (currentStats.byType?.standard?.total || 0)).toLocaleString()}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-zinc-400 text-[10px] uppercase font-bold">6★ 数量</div>
                          <div className="text-xl font-bold font-mono text-amber-500">
                            {(() => {
                              // 优先显示不含免费的6★数量
                              const limitedSixTotal = currentStats.byType?.limited?.six || 0;
                              const standardSixTotal = currentStats.byType?.standard?.six || 0;
                              const totalSix = limitedSixTotal + standardSixTotal;

                              // 从characterRanking获取不含免费的数量（仅全服数据时使用）
                              const limitedSixExcl = dataSource === 'global' ? characterRanking?.limited?.sixStarExcludingFree : undefined;
                              const hasExclData = limitedSixExcl !== undefined && limitedSixExcl !== null;

                              if (hasExclData) {
                                // 显示不含免费的数量（限定池不含免费 + 常驻池全部）
                                return limitedSixExcl + standardSixTotal;
                              }
                              return totalSix;
                            })()}
                            {currentStats.charGift > 0 && (
                              <span className="text-xs text-purple-500 ml-1">+{currentStats.charGift}</span>
                            )}
                          </div>
                          {/* 含免费的6★数量（如果与不含免费不同则显示） */}
                          {(() => {
                            const limitedSixTotal = currentStats.byType?.limited?.six || 0;
                            const standardSixTotal = currentStats.byType?.standard?.six || 0;
                            const totalSix = limitedSixTotal + standardSixTotal;
                            const limitedSixExcl = dataSource === 'global' ? characterRanking?.limited?.sixStarExcludingFree : undefined;

                            if (limitedSixExcl === undefined || limitedSixExcl === null) return null;

                            const totalExcl = limitedSixExcl + standardSixTotal;
                            if (totalExcl === totalSix) return null;

                            return (
                              <div className="text-[10px] text-zinc-500 font-mono">
                                含免费: <span className="text-zinc-400">{totalSix}</span>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="space-y-1">
                          <div className="text-zinc-400 text-[10px] uppercase font-bold">平均出货</div>
                          <div className="text-xl font-bold font-mono text-indigo-500">
                            {(() => {
                              // 优先显示不含免费的平均出货
                              const limitedAvgExcl = currentStats.byType?.limited?.avgPityExcludingFree;
                              const standardAvgExcl = currentStats.byType?.standard?.avgPityExcludingFree || currentStats.byType?.standard?.avgPity;
                              const limitedSix = currentStats.byType?.limited?.six || 0;
                              const standardSix = currentStats.byType?.standard?.six || 0;

                              if (limitedSix + standardSix === 0) return '-';

                              // 如果有不含免费的数据，优先使用
                              if (limitedAvgExcl) {
                                const weighted = ((parseFloat(limitedAvgExcl) || 0) * limitedSix + (parseFloat(standardAvgExcl) || 0) * standardSix) / (limitedSix + standardSix);
                                return weighted.toFixed(1);
                              }

                              // 否则回退到含免费的
                              const limitedAvg = currentStats.byType?.limited?.avgPity;
                              const standardAvg = currentStats.byType?.standard?.avgPity;
                              const weighted = ((parseFloat(limitedAvg) || 0) * limitedSix + (parseFloat(standardAvg) || 0) * standardSix) / (limitedSix + standardSix);
                              return weighted.toFixed(1);
                            })()}
                          </div>
                          {/* 含免费十连的平均出货（如果与不含免费不同则显示） */}
                          {(() => {
                            const limitedAvgExcl = currentStats.byType?.limited?.avgPityExcludingFree;
                            const limitedAvg = currentStats.byType?.limited?.avgPity;
                            const standardAvg = currentStats.byType?.standard?.avgPity;
                            const limitedSix = currentStats.byType?.limited?.six || 0;
                            const standardSix = currentStats.byType?.standard?.six || 0;

                            if (limitedSix + standardSix === 0 || !limitedAvgExcl) return null;

                            const weightedWithFree = ((parseFloat(limitedAvg) || 0) * limitedSix + (parseFloat(standardAvg) || 0) * standardSix) / (limitedSix + standardSix);
                            const standardAvgExcl = currentStats.byType?.standard?.avgPityExcludingFree || standardAvg;
                            const weightedExclFree = ((parseFloat(limitedAvgExcl) || 0) * limitedSix + (parseFloat(standardAvgExcl) || 0) * standardSix) / (limitedSix + standardSix);

                            // 如果差异小于0.1，不显示
                            if (Math.abs(weightedWithFree - weightedExclFree) < 0.1) return null;

                            return (
                              <div className="text-[10px] text-zinc-500 font-mono">
                                含免费: <span className="text-zinc-400">{weightedWithFree.toFixed(1)}</span>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="space-y-1">
                          <div className="text-zinc-400 text-[10px] uppercase font-bold">比率 (不歪/歪)</div>
                          <div className="text-lg font-bold font-mono">
                            {(() => {
                              const limitedPool = currentStats.byType?.limited || {};
                              const standardPool = currentStats.byType?.standard || {};
                              const limitedUp = (limitedPool.sixStarLimited ?? limitedPool.limitedSix ?? 0);
                              const standardUp = (standardPool.sixStarLimited ?? standardPool.limitedSix ?? 0);
                              const totalLimited = limitedUp + standardUp;
                              const limitedStd = (limitedPool.six || 0) - limitedUp;
                              const standardStd = (standardPool.six || 0) - standardUp;
                              const totalStd = limitedStd + standardStd;
                              const totalSix = (limitedPool.six || 0) + (standardPool.six || 0);
                              const rate = totalSix > 0 ? ((totalLimited / totalSix) * 100).toFixed(1) : 0;
                              return (
                                <>
                                  <span className="text-emerald-500">{totalLimited}</span>
                                  <span className="text-zinc-400 mx-1">/</span>
                                  <span className="text-rose-500">{totalStd}</span>
                                  <span className="text-zinc-400 text-xs ml-1">({rate}%)</span>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                      {/* 限定池 vs 常驻池细分 */}
                      <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800/50 grid grid-cols-2 gap-4 text-xs font-mono">
                        <div className="flex items-center gap-2 text-zinc-500 flex-wrap">
                          <span className="w-2 h-2 bg-emerald-500/50 rounded-sm flex-shrink-0"></span>
                          <span>限定池: {(currentStats.byType?.limited?.total || 0).toLocaleString()} 抽</span>
                          <span className="ml-auto flex items-center gap-1">
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {currentStats.byType?.limited?.avgPityExcludingFree || currentStats.byType?.limited?.avgPity || '-'} 平均
                            </span>
                            {currentStats.byType?.limited?.avgPityExcludingFree &&
                             currentStats.byType?.limited?.avgPity &&
                             currentStats.byType?.limited?.avgPityExcludingFree !== currentStats.byType?.limited?.avgPity && (
                              <span className="text-zinc-400">
                                (含免费: {currentStats.byType?.limited?.avgPity})
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-500">
                          <span className="w-2 h-2 bg-indigo-500/50 rounded-sm flex-shrink-0"></span>
                          <span>常驻池: {(currentStats.byType?.standard?.total || 0).toLocaleString()} 抽</span>
                          <span className="ml-auto text-indigo-600 dark:text-indigo-400">{currentStats.byType?.standard?.avgPity || '-'} 平均</span>
                        </div>
                      </div>
                    </div>

                    {/* 武器池统计 */}
                    <div className="bg-zinc-50 dark:bg-zinc-950/30 border border-zinc-200 dark:border-zinc-800 p-5">
                      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-800 border-dashed">
                        <Swords size={16} className="text-slate-500" />
                        <h4 className="font-bold text-sm text-slate-700 dark:text-zinc-300 uppercase tracking-wide">武器池数据</h4>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="space-y-1">
                          <div className="text-zinc-400 text-[10px] uppercase font-bold">总抽数</div>
                          <div className="text-xl font-bold font-mono text-slate-700 dark:text-zinc-200">{(currentStats.byType?.weapon?.total || 0).toLocaleString()}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-zinc-400 text-[10px] uppercase font-bold">6★ 数量</div>
                          <div className="text-xl font-bold font-mono text-amber-500">
                            {currentStats.byType?.weapon?.six || 0}
                            {(currentStats.weaponGiftLimited > 0 || currentStats.weaponGiftStandard > 0) && (
                              <span className="text-xs text-purple-500 ml-1">
                                +{(currentStats.weaponGiftLimited || 0) + (currentStats.weaponGiftStandard || 0)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-zinc-400 text-[10px] uppercase font-bold">平均出货</div>
                          <div className="text-xl font-bold font-mono text-indigo-500">{currentStats.byType?.weapon?.avgPity || '-'}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-zinc-400 text-[10px] uppercase font-bold">比率 (不歪/歪)</div>
                          <div className="text-lg font-bold font-mono">
                            {(() => {
                              const weaponPool = currentStats.byType?.weapon || {};
                              const weaponUp = (weaponPool.sixStarLimited ?? weaponPool.limitedSix ?? 0);
                              const weaponStd = (weaponPool.six || 0) - weaponUp;
                              const totalSix = weaponPool.six || 0;
                              const rate = totalSix > 0 ? ((weaponUp / totalSix) * 100).toFixed(1) : 0;
                              return (
                                <>
                                  <span className="text-emerald-500">{weaponUp}</span>
                                  <span className="text-zinc-400 mx-1">/</span>
                                  <span className="text-rose-500">{weaponStd}</span>
                                  <span className="text-zinc-400 text-xs ml-1">({rate}%)</span>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 特定卡池类型时 */
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 p-4">
                      <div className="text-zinc-400 text-[10px] uppercase font-bold mb-1">总抽数</div>
                      <div className="text-3xl font-black font-mono text-slate-800 dark:text-white">{(currentStats.total || 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 p-4">
                      <div className="text-zinc-400 text-[10px] uppercase font-bold mb-1">6★ 数量</div>
                      <div className="text-3xl font-black font-mono text-amber-500">{currentStats.sixStar || 0}</div>
                      <div className="text-xs text-zinc-500 mt-1 font-mono">概率: {currentStats.total > 0 ? ((currentStats.sixStar / currentStats.total) * 100).toFixed(2) : 0}%</div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 p-4">
                      <div className="text-zinc-400 text-[10px] uppercase font-bold mb-1">平均出货</div>
                      <div className="text-3xl font-black font-mono text-indigo-500">{currentStats.avgPityExcludingFree || currentStats.avgPity || '-'}</div>
                      <div className="text-xs text-zinc-500 mt-1 font-mono">抽/6★</div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 p-4">
                      <div className="text-zinc-400 text-[10px] uppercase font-bold mb-1">不歪/歪</div>
                      <div className="text-xl font-black font-mono mt-1">
                        <span className="text-emerald-500">{currentStats.sixStarLimited || 0}</span>
                        <span className="text-zinc-400 mx-1">/</span>
                        <span className="text-rose-500">{currentStats.sixStarStandard || 0}</span>
                      </div>
                      <div className="text-xs text-zinc-500 mt-1 font-mono">不歪率: {currentStats.sixStar > 0 ? ((currentStats.sixStarLimited / currentStats.sixStar) * 100).toFixed(1) : 0}%</div>
                    </div>
                  </div>
                )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.05)_10px,rgba(0,0,0,0.05)_20px)] dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.02)_10px,rgba(255,255,255,0.02)_20px)]"></div>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 p-12 text-center text-zinc-500 font-mono">NO DATA AVAILABLE</div>
          )}

          {/* 图表区域 */}
          <div className="space-y-6">
            {chartDisplayData.charts.map((chart, index) => (
              <ChartSection
                key={index}
                title={chart.title}
                subtitle={chart.subtitle}
                color={chart.color}
                data={chart.data}
                isGlobal={chartDisplayData.isGlobal}
                tooltipStyle={tooltipStyle}
                isDark={isDark}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export default SummaryView;
