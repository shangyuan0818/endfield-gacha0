import React from 'react';
import { User, Cloud, RefreshCw } from 'lucide-react';
import usePoolStore from '../../stores/usePoolStore';
import useHistoryStore from '../../stores/useHistoryStore';
import useAppStore from '../../stores/useAppStore';
import useAuthStore from '../../stores/useAuthStore';
import { useSummaryViewState } from '../../hooks/summary';
import MobileChartContainer from '../components/MobileChartContainer';
import ResourceSummaryPanel from '../../components/resources/ResourceSummaryPanel';
import { useI18n } from '../../i18n/index.js';

/**
 * 移动端统计视图 - 工业风重构版 (中文)
 */
function MobileSummaryView() {
  const { t, formatNumber } = useI18n();
  const tt = (key, fallback, params = {}) => t(key, params, fallback);
  const formatCount = (value) => formatNumber(Number(value) || 0);
  const formatPercent = (value, digits = 1) => `${formatNumber(value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}%`;
  const { user } = useAuthStore();
  const { pools } = usePoolStore();
  const { history } = useHistoryStore();
  const { globalStats, globalStatsLoading, fetchGlobalStats } = useAppStore();

  const {
    dataSource,
    setDataSource,
    poolTypeFilter,
    setPoolTypeFilter,
    currentStats,
    ranking,
    isRankingLoading,
    filterOptions
  } = useSummaryViewState({
    history,
    pools,
    user,
    globalStats,
    fetchGlobalStats,
    variant: 'mobile'
  });

  const limitedSixStarUpRanking = ranking?.limited?.sixStarUp || ranking?.limited?.sixStar || [];
  const globalStatsMeta = dataSource === 'global' ? currentStats?.meta : null;
  const showGlobalStatsFallbackNotice = globalStatsMeta && globalStatsMeta.status && globalStatsMeta.status !== 'ready';
  const contributorRegionStats = dataSource === 'global' ? currentStats?.contributorsByRegion : null;

  return (
    <div className="px-4 py-4 space-y-4">
      {/* 标题和数据源切换 */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
          {tt('summary.viewTitle', '统计总览')}
        </h1>
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1">
          <button
            onClick={() => setDataSource('global')}
            className={`px-4 py-2 text-[10px] font-bold uppercase transition-colors rounded-none ${
              dataSource === 'global'
                ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <Cloud size={12} className="inline mr-1" />
            {tt('summary.source.global', '全服数据')}
          </button>
          <button
            onClick={() => setDataSource('local')}
            className={`px-4 py-2 text-[10px] font-bold uppercase transition-colors rounded-none ${
              dataSource === 'local'
                ? 'bg-endfield-yellow text-black'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <User size={12} className="inline mr-1" />
            {tt('summary.source.local', '我的数据')}
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
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">{tt('summary.loading.data', '正在获取数据...')}</span>
        </div>
      ) : currentStats ? (
        <>
          {/* 统计卡片 */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden rounded-none shadow-sm">
          <div className={`h-1 w-full ${dataSource === 'global' ? 'bg-indigo-500' : 'bg-endfield-yellow'}`} />
          <div className="p-4">
            {showGlobalStatsFallbackNotice && (
              <div className="mb-4 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                {globalStatsMeta.status === 'stale'
                  ? tt('summary.notice.globalStale', '全服汇总暂时使用上次成功缓存，跨境网络较慢时请稍后重试。')
                  : tt('summary.notice.globalUnavailable', '全服汇总暂时不可用，当前网络或数据库响应较慢；排行榜和本地统计仍可继续查看。')}
              </div>
            )}
            {/* 标题 */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-none border border-current ${dataSource === 'global' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/10' : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10'}`}>
                    {dataSource === 'global' ? <Cloud size={16} /> : <User size={16} />}
                  </div>
                  <div>
                    <h2 className="font-bold text-zinc-800 dark:text-white text-sm uppercase tracking-tight">{currentStats.title}</h2>
                    <span className="text-zinc-500 dark:text-zinc-400 text-[11px] font-mono uppercase tracking-widest">{currentStats.subtitle}</span>
                  </div>
                </div>
                {currentStats.totalUsers && (
                  <div className="text-right">
                    <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-mono mb-0.5">{tt('summary.metric.contributors', '贡献者')}</span>
                    <span className="text-lg font-bold text-zinc-700 dark:text-zinc-300 font-mono leading-none">{formatCount(currentStats.totalContributors || currentStats.totalUsers)}</span>
                    {currentStats.totalContributors && currentStats.totalContributors !== currentStats.totalUsers && (
                      <span className="block text-[11px] text-zinc-500 font-mono">{tt('summary.metric.registered', '注册')}: {formatCount(currentStats.totalUsers)}</span>
                    )}
                    {contributorRegionStats && (
                      <div className="mt-1 flex flex-col items-end gap-0.5 text-[10px] font-mono text-zinc-500">
                        <span>{tt('summary.metric.cn', '国服')}: {formatCount(contributorRegionStats.cn || 0)}</span>
                        <span>{tt('summary.metric.intl', '国际服')}: {formatCount(contributorRegionStats.intl || 0)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 核心数据 */}
              <div className="grid grid-cols-2 gap-3">
                {/* 总抽数 */}
                <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 p-3 rounded-none relative group hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                  <div className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold tracking-wider mb-1">{tt('summary.metric.totalPulls', '总抽数')}</div>
                  <div className="text-2xl font-black text-zinc-800 dark:text-white font-mono">
                    {formatCount(currentStats.total || 0)}
                  </div>
                  <div className="absolute top-3 right-3 w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-700 group-hover:bg-zinc-400 dark:group-hover:bg-zinc-600" />
                </div>

                {/* 6星数量 */}
                <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 p-3 rounded-none relative group hover:border-amber-300 dark:hover:border-amber-900 transition-colors">
                  <div className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold tracking-wider mb-1">{tt('summary.metric.sixStarCount', '6★ 数量')}</div>
                  <div className="text-2xl font-black text-amber-500 font-mono">
                    {currentStats.sixStar || 0}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                    {tt('summary.metric.probability', '概率')}: {currentStats.total > 0 ? formatPercent((currentStats.sixStar / currentStats.total) * 100, 2) : formatPercent(0, 2)}
                  </div>
                </div>

                {/* 平均出货 */}
                <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 p-3 rounded-none relative group hover:border-indigo-300 dark:hover:border-indigo-900 transition-colors">
                  <div className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold tracking-wider mb-1">{tt('summary.metric.avgSixStarDrop', '六星平均出货')}</div>
                  <div className="text-2xl font-black text-indigo-500 font-mono">
                    {currentStats.avgPityExcludingFree || currentStats.avgPity || '-'}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5 uppercase">{tt('summary.metric.avgAllSixHint', '全部6★ 抽/个')}</div>
                </div>

                {/* UP六星平均出货 */}
                {currentStats.avgPityUp ? (
                  <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 p-3 rounded-none relative group hover:border-emerald-300 dark:hover:border-emerald-900 transition-colors">
                    <div className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold tracking-wider mb-1">{tt('summary.metric.avgTargetSixStarDrop', 'UP六星平均出货')}</div>
                    <div className="text-2xl font-black text-emerald-500 font-mono">
                      {currentStats.avgPityUp}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono mt-0.5 uppercase">{tt('summary.metric.avgTargetSixHint', '仅当期目标6★ 抽/个')}</div>
                  </div>
                ) : (
                  <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 p-3 rounded-none relative group hover:border-emerald-300 dark:hover:border-emerald-900 transition-colors">
                    <div className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold tracking-wider mb-1">{tt('summary.metric.targetVsOff', '不歪/歪')}</div>
                    <div className="text-xl font-black font-mono">
                      <span className="text-emerald-500">{currentStats.sixStarLimited || 0}</span>
                      <span className="text-zinc-300 mx-1">/</span>
                      <span className="text-rose-500">{currentStats.sixStarStandard || 0}</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono mt-0.5 uppercase">
                      {tt('summary.metric.targetRate', '不歪率')}: {currentStats.sixStar > 0 ? formatPercent(((currentStats.sixStarLimited || 0) / currentStats.sixStar) * 100) : formatPercent(0)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {currentStats?.resources && (
            poolTypeFilter === 'all' ? (
              <>
                <ResourceSummaryPanel
                  title={tt('summary.section.allResourceSummary', '全卡池资源统计')}
                  resources={currentStats.resources}
                  variant="all"
                  compact={true}
                  className="rounded-none"
                />
                <ResourceSummaryPanel
                  title={tt('summary.section.characterResourceSummary', '角色池资源统计')}
                  resources={currentStats.byType?.character?.resources}
                  variant="character"
                  compact={true}
                  layout="two-plus-one"
                  className="rounded-none"
                />
                <ResourceSummaryPanel
                  title={tt('summary.section.weaponResourceSummary', '武器池资源统计')}
                  resources={currentStats.byType?.weapon?.resources}
                  variant="weapon"
                  compact={true}
                  className="rounded-none"
                />
              </>
            ) : (
              <ResourceSummaryPanel
                title={poolTypeFilter === 'weapon'
                  ? tt('summary.section.weaponResourceSummary', '武器池资源统计')
                  : tt('summary.section.characterResourceSummary', '角色池资源统计')}
                resources={currentStats.resources}
                variant={poolTypeFilter === 'weapon' ? 'weapon' : 'character'}
                compact={true}
                className="rounded-none"
              />
            )
          )}

          {/* 分池统计 - 仅在全部时显示 */}
          {poolTypeFilter === 'all' && currentStats.byType && (
            <>
              {/* 角色池统计 */}
              <MobileChartContainer title={tt('summary.section.characterBannerData', '角色池数据')} defaultExpanded={true} className="rounded-none">
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-zinc-50 dark:bg-zinc-900/30 p-2 border border-zinc-100 dark:border-zinc-800 rounded-none">
                    <div className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold mb-1">{tt('summary.scope.limited', '限定角色池')}</div>
                    <div className="text-lg font-bold font-mono text-zinc-700 dark:text-zinc-200">
                      {formatCount(currentStats.byType?.limited?.total || 0)} <span className="text-xs font-normal text-zinc-400">{tt('summary.metric.pullsUnit', '抽')}</span>
                    </div>
                    <div className="text-xs text-emerald-500 font-mono font-bold mt-1">
                      {currentStats.byType?.limited?.six || 0} <span className="text-[11px] font-normal text-zinc-400">6★</span>
                    </div>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-900/30 p-2 border border-zinc-100 dark:border-zinc-800 rounded-none">
                    <div className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold mb-1">{tt('summary.scope.standard', '常驻池')}</div>
                    <div className="text-lg font-bold font-mono text-zinc-700 dark:text-zinc-200">
                      {formatCount(currentStats.byType?.standard?.total || 0)} <span className="text-xs font-normal text-zinc-400">{tt('summary.metric.pullsUnit', '抽')}</span>
                    </div>
                    <div className="text-xs text-indigo-500 font-mono font-bold mt-1">
                      {currentStats.byType?.standard?.six || 0} <span className="text-[11px] font-normal text-zinc-400">6★</span>
                    </div>
                  </div>
                </div>

                {/* 平均出货对比 */}
                <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-3 text-[10px] font-mono">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <span className="w-1.5 h-1.5 bg-emerald-500" />
                    <span className="uppercase">{tt('summary.metric.limitedAverage', '限定平均')}: {currentStats.byType?.limited?.avgPity || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-500">
                    <span className="w-1.5 h-1.5 bg-indigo-500" />
                    <span className="uppercase">{tt('summary.metric.standardAverage', '常驻平均')}: {currentStats.byType?.standard?.avgPity || '-'}</span>
                  </div>
                </div>
              </MobileChartContainer>

              {/* 武器池统计 */}
              <MobileChartContainer title={tt('summary.section.weaponBannerData', '武器池数据')} defaultExpanded={true} className="rounded-none">
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-zinc-50 dark:bg-zinc-900/30 p-2 border border-zinc-100 dark:border-zinc-800 rounded-none">
                    <div className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold mb-1">{tt('summary.metric.totalPulls', '总抽数')}</div>
                    <div className="text-lg font-bold font-mono text-zinc-700 dark:text-zinc-200">
                      {formatCount(currentStats.byType?.weapon?.total || 0)}
                    </div>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-900/30 p-2 border border-zinc-100 dark:border-zinc-800 rounded-none">
                    <div className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold mb-1">{tt('summary.metric.sixStarCount', '6★ 数量')}</div>
                    <div className="text-lg font-bold font-mono text-amber-500">
                      {currentStats.byType?.weapon?.six || 0}
                    </div>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-900/30 p-2 border border-zinc-100 dark:border-zinc-800 rounded-none">
                    <div className="text-zinc-400 text-[11px] uppercase font-bold mb-1">{tt('summary.metric.avgSixStarDrop', '六星平均出货')}</div>
                    <div className="text-lg font-bold font-mono text-indigo-500">
                      {currentStats.byType?.weapon?.avgPity || '-'}
                    </div>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-900/30 p-2 border border-zinc-100 dark:border-zinc-800 rounded-none">
                    <div className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold mb-1">{tt('summary.metric.targetVsOff', '不歪/歪')}</div>
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
                            <span className="text-zinc-300 mx-1">/</span>
                            <span className="text-rose-500">{weaponStd}</span>
                            <span className="text-zinc-400 text-xs ml-1">({formatPercent(Number(rate), 1)})</span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </MobileChartContainer>
            </>
          )}

          {/* UP 6★ 排名 */}
          {(isRankingLoading || ranking) && (
            <MobileChartContainer title={tt('summary.section.upSixRanking', 'UP 6★ 排名')} defaultExpanded={true} className="rounded-none">
              {isRankingLoading ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw size={20} className="animate-spin text-zinc-400" />
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  {/* 限定池 UP */}
                  {limitedSixStarUpRanking.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2 px-1 border-l-2 border-fuchsia-500">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{tt('summary.ranking.limitedUpSix', '限定池 UP 6★')}</span>
                      </div>
                      <div className="space-y-1">
                        {limitedSixStarUpRanking.slice(0, 5).map((char, index) => (
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
                  {limitedSixStarUpRanking.length === 0 && (
                    <p className="text-xs text-zinc-400 text-center py-2 font-mono uppercase tracking-widest">{tt('summary.ranking.empty', '暂无排名数据')}</p>
                  )}

                  {/* 六星分类统计 */}
                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-zinc-50 dark:bg-zinc-900/30 p-2 border border-zinc-100 dark:border-zinc-800">
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold mb-1">{tt('summary.metric.upSixNoMiss', 'UP 6★ (不歪)')}</div>
                        <div className="text-lg font-bold font-mono text-emerald-500">
                          {ranking?.limited?.sixStarUpExcludingFree ?? ranking?.limited?.sixStarUpCount ?? '-'}
                        </div>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-900/30 p-2 border border-zinc-100 dark:border-zinc-800">
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold mb-1">{tt('summary.metric.offStandardSix', '歪常驻 6★')}</div>
                        <div className="text-lg font-bold font-mono text-rose-500">
                          {ranking?.limited?.sixStarOffStandardExcludingFree ?? ranking?.limited?.sixStarOffStandardCount ?? ranking?.limited?.sixStarOffExcludingFree ?? '-'}
                        </div>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-900/30 p-2 border border-zinc-100 dark:border-zinc-800">
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold mb-1">{tt('summary.metric.offLimitedSix', '歪限定 6★')}</div>
                        <div className="text-lg font-bold font-mono text-orange-500">
                          {ranking?.limited?.sixStarOffLimitedExcludingFree ?? ranking?.limited?.sixStarOffLimitedCount ?? 0}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center mt-3">
                      <div className="bg-zinc-50 dark:bg-zinc-900/30 p-2 border border-zinc-100 dark:border-zinc-800">
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold mb-1">{tt('summary.metric.targetRate', '不歪率')}</div>
                        <div className="text-lg font-bold font-mono text-indigo-500">
                          {(() => {
                            const upCount = ranking?.limited?.sixStarUpExcludingFree ?? ranking?.limited?.sixStarUpCount ?? 0;
                            const offCount = ranking?.limited?.sixStarOffExcludingFree ?? ranking?.limited?.sixStarOffCount ?? 0;
                            const total = upCount + offCount;
                            if (total === 0) return '-';
                            return formatPercent((upCount / total) * 100);
                          })()}
                        </div>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-900/30 p-2 border border-zinc-100 dark:border-zinc-800">
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold mb-1">{tt('summary.metric.limitedRate', '限定率')}</div>
                        <div className="text-lg font-bold font-mono text-amber-500">
                          {(() => {
                            const offStd = ranking?.limited?.sixStarOffStandardCount ?? 0;
                            const offLtd = ranking?.limited?.sixStarOffLimitedCount ?? 0;
                            const totalOff = offStd + offLtd;
                            if (totalOff === 0) return '-';
                            return formatPercent((offLtd / totalOff) * 100);
                          })()}
                        </div>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-900/30 p-2 border border-zinc-100 dark:border-zinc-800">
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold mb-1">{tt('summary.metric.sparkCount', '吃井次数')}</div>
                        <div className="text-lg font-bold font-mono text-red-500">
                          {currentStats.byType?.limited?.sparkCount || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </MobileChartContainer>
          )}

          {/* 星级分布 */}
          <MobileChartContainer title={tt('summary.section.rarityDistribution', '稀有度分布')} defaultExpanded={false} className="rounded-none">
            {currentStats.counts ? (
              <div className="space-y-4 pt-2">
                {[
                    { label: tt('summary.chart.sixLimited', '6★ (限定)'), key: 6, color: 'bg-amber-500', text: 'text-amber-500' },
                    { label: tt('summary.chart.sixStandard', '6★ (常驻)'), key: '6_std', color: 'bg-orange-500', text: 'text-orange-500' },
                    { label: tt('summary.chart.fiveStar', '5★'), key: 5, color: 'bg-purple-500', text: 'text-purple-500' },
                    { label: tt('summary.chart.fourStar', '4★'), key: 4, color: 'bg-blue-500', text: 'text-blue-500' }
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
              <p className="text-xs text-zinc-400 text-center py-4 font-mono uppercase tracking-widest">{tt('summary.empty', '暂无数据')}</p>
            )}
          </MobileChartContainer>
        </>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 text-center text-zinc-500 font-mono text-xs uppercase tracking-widest rounded-none">
          {tt('summary.empty', '暂无数据')}
        </div>
      )}

      {/* 底部留白 */}
      <div className="h-4" />
    </div>
  );
}

export default MobileSummaryView;
