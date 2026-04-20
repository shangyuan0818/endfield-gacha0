import React from 'react';
import { Star, User, Cloud, Layers, RefreshCw, Swords } from 'lucide-react';
import { useAppStore, useAuthStore, useHistoryStore, usePoolStore } from '../stores';
import { useI18n } from '../i18n/index.js';

// 拆分后的组件
import { RankingCard, ChartSection, SummarySidebar } from './summary';
import ResourceSummaryPanel from './resources/ResourceSummaryPanel';
import { characterCache } from '../utils/characterUtils';
import { localizeEntityName } from '../utils/gameDataI18n.js';

// 拆分后的 Hooks
import { useThemeDetection, getTooltipStyle, useSummaryViewState } from '../hooks/summary';

/**
 * 统计视图组件 (重构后)
 * REFACTOR-002: 从 1,390 行拆分为多个子组件和 hooks
 * 2026-02-07 重构完成
 */
const SummaryView = React.memo(() => {
  const { t, formatNumber, locale } = useI18n();
  const tt = (key, fallback, params = {}) => t(key, params, fallback);
  const formatCount = (value) => formatNumber(Number(value) || 0);
  const formatPercent = (value, digits = 1) => `${formatNumber(value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}%`;
  const user = useAuthStore(state => state.user);
  const pools = usePoolStore(state => state.pools);
  const history = useHistoryStore(state => state.history);
  const globalStats = useAppStore(state => state.globalStats);
  const globalStatsLoading = useAppStore(state => state.globalStatsLoading);
  const fetchGlobalStats = useAppStore(state => state.fetchGlobalStats);

  const isDark = useThemeDetection();
  const tooltipStyle = getTooltipStyle(isDark);
  const {
    dataSource,
    setDataSource,
    poolTypeFilter,
    setPoolTypeFilter,
    localStats,
    currentStats,
    chartDisplayData,
    ranking,
    isRankingLoading
  } = useSummaryViewState({
    history,
    pools,
    user,
    globalStats,
    fetchGlobalStats,
    variant: 'desktop'
  });
  const limitedUpEntries = (ranking?.limited?.sixStarUp || ranking?.limited?.sixStar || []).slice(0, 6);
  const globalStatsMeta = dataSource === 'global' ? currentStats?.meta : null;
  const showGlobalStatsFallbackNotice = globalStatsMeta && globalStatsMeta.status && globalStatsMeta.status !== 'ready';
  const contributorRegionStats = dataSource === 'global' ? currentStats?.contributorsByRegion : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex gap-6 min-w-0">
        <SummarySidebar
          dataSource={dataSource}
          setDataSource={setDataSource}
          poolTypeFilter={poolTypeFilter}
          setPoolTypeFilter={setPoolTypeFilter}
          globalStats={globalStats}
          localStats={localStats}
        />

        {/* 右侧内容区 */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* 统计信息卡片 */}
          {(globalStatsLoading || (dataSource === 'global' && !globalStats)) ? (
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-12 text-center flex flex-col items-center justify-center gap-3">
              <RefreshCw size={32} className="animate-spin text-zinc-400" />
              <span className="text-sm font-mono text-zinc-500 uppercase tracking-widest">{tt('summary.loading.data', '正在获取数据...')}</span>
            </div>
          ) : currentStats ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 relative overflow-hidden group">
              {/* 背景装饰网格 */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
              <div className="h-1 w-full bg-endfield-yellow"></div>

              <div className="relative z-10 p-6">
                {showGlobalStatsFallbackNotice && (
                  <div className="mb-4 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                    {globalStatsMeta.status === 'stale'
                      ? tt('summary.notice.globalStale', '全服汇总暂时使用上次成功缓存，跨境网络较慢时请稍后重试。')
                      : tt('summary.notice.globalUnavailable', '全服汇总暂时不可用，当前网络或数据库响应较慢；排行榜和本地统计仍可继续查看。')}
                  </div>
                )}
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
                          {dataSource === 'global'
                            ? tt('summary.badge.global', '全服')
                            : tt('summary.badge.local', '本地')}
                        </span>
                      </h2>
                      <span className="text-zinc-500 text-xs font-mono block mt-0.5">
                        {tt('summary.metric.scopeLabel', '范围')} // {currentStats.subtitle}
                      </span>
                    </div>
                  </div>
                  {currentStats.totalUsers && (
                    <div className="text-right">
                      <span className="block text-[10px] text-zinc-400 uppercase font-mono tracking-widest">{tt('summary.metric.contributors', '贡献者')}</span>
                      <span className="text-xl font-bold text-slate-700 dark:text-zinc-300 font-mono">
                        {formatCount(currentStats.totalContributors || currentStats.totalUsers)}
                      </span>
                      {currentStats.totalContributors && currentStats.totalContributors !== currentStats.totalUsers && (
                        <span className="block text-[10px] text-zinc-500 font-mono">
                          {tt('summary.metric.registered', '注册')}: {formatCount(currentStats.totalUsers)}
                        </span>
                      )}
                      {contributorRegionStats && (
                        <div className="mt-1 flex flex-wrap justify-end gap-1 text-[10px] font-mono text-zinc-500">
                          <span>{tt('summary.metric.cn', '国服')}: {formatCount(contributorRegionStats.cn || 0)}</span>
                          <span>{tt('summary.metric.intl', '国际服')}: {formatCount(contributorRegionStats.intl || 0)}</span>
                        </div>
                      )}
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
                        <div className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">{tt('summary.metric.totalPulls', '总抽数')}</div>
                        <div className="text-3xl font-black text-slate-800 dark:text-white font-mono">{formatCount(currentStats.total || 0)}</div>
                      </div>

                      {/* 限定池 UP 六星排名 & 分类统计 (合并卡片) */}
                      <div className="bg-zinc-50 dark:bg-zinc-950/30 border border-zinc-200 dark:border-zinc-800 p-5 flex-1">
                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-800 border-dashed">
                          <Star size={16} className="text-amber-500" />
                          <h4 className="font-bold text-sm text-slate-700 dark:text-zinc-300 uppercase tracking-wide">{tt('summary.section.limitedUpAnalysis', '限定池 UP 6★ 分析')}</h4>
                        </div>
                        
                        <div className="grid grid-cols-1 xl:grid-cols-10 gap-6">
                          {/* 左侧：UP 六星列表 */}
                          <div className="h-full xl:col-span-4 border-r-0 xl:border-r border-zinc-100 dark:border-zinc-800 xl:pr-6 border-b xl:border-b-0 pb-6 xl:pb-0">
                            <div className="h-full">
                              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider pl-1 border-l-2 border-zinc-300 dark:border-zinc-700 mb-3">
                                {tt('summary.ranking.limitedUpSix', '限定池 UP 6★')}
                              </div>
                              {isRankingLoading ? (
                                <div className="flex items-center justify-center h-full text-zinc-400 text-xs">
                                  <RefreshCw size={14} className="animate-spin mr-2" />
                                  {tt('summary.loading.ranking', '加载排名...')}
                                </div>
                              ) : limitedUpEntries.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-zinc-400 text-xs italic">
                                  {tt('summary.ranking.empty', '暂无排名数据')}
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 gap-3">
                                  {limitedUpEntries.map((char) => {
                                    const charData = characterCache.searchByName(char.name, false);
                                    const avatarUrl = charData?.avatar_url;
                                    const localizedName = localizeEntityName(char.name, { locale, type: 'character' });

                                    return (
                                      <div
                                        key={char.name}
                                        className="flex items-center gap-2 rounded-sm bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1.5 min-w-0"
                                      >
                                        <div className="w-8 h-8 rounded-sm overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex-shrink-0">
                                          {avatarUrl ? (
                                            <img src={avatarUrl} alt={localizedName} loading="lazy" className="w-full h-full object-cover" />
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                              <User size={14} className="text-zinc-400" />
                                            </div>
                                          )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="text-[11px] leading-tight font-medium text-slate-700 dark:text-zinc-300 break-words">
                                            {localizedName}
                                          </div>
                                          <div className="text-[10px] leading-none font-mono text-zinc-400 mt-1">
                                            ×{char.count}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 右侧：六星出货分类统计 */}
                          <div className="xl:col-span-6 grid grid-cols-3 xl:grid-cols-4 gap-4 content-start pt-2">
                            {/* UP六星 */}
                            <div className="space-y-1">
                              <div className="text-zinc-400 text-[10px] uppercase font-bold flex items-center gap-1">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                {tt('summary.metric.upSixNoMiss', 'UP 6★ (不歪)')}
                              </div>
                              <div className="text-xl font-bold font-mono text-emerald-500">
                                {ranking?.limited?.sixStarUpExcludingFree ?? ranking?.limited?.sixStarUpCount ?? '-'}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono leading-tight">
                                {tt('summary.metric.hitUpLimitedHint', '限定池抽中UP角色')}
                              </div>
                            </div>
                            {/* 歪出六星 - 歪常驻 */}
                            <div className="space-y-1">
                              <div className="text-zinc-400 text-[10px] uppercase font-bold flex items-center gap-1">
                                <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
                                {tt('summary.metric.offStandardSix', '歪常驻 6★')}
                              </div>
                              <div className="text-xl font-bold font-mono text-rose-500">
                                {ranking?.limited?.sixStarOffStandardExcludingFree ?? ranking?.limited?.sixStarOffStandardCount ?? ranking?.limited?.sixStarOffExcludingFree ?? '-'}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono leading-tight">
                                {tt('summary.metric.hitOffStandardHint', '歪到常驻角色')}
                              </div>
                            </div>
                            {/* 歪出六星 - 歪限定 */}
                            <div className="space-y-1">
                              <div className="text-zinc-400 text-[10px] uppercase font-bold flex items-center gap-1">
                                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                                {tt('summary.metric.offLimitedSix', '歪限定 6★')}
                              </div>
                              <div className="text-xl font-bold font-mono text-orange-500">
                                {ranking?.limited?.sixStarOffLimitedExcludingFree ?? ranking?.limited?.sixStarOffLimitedCount ?? 0}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono leading-tight">
                                {tt('summary.metric.hitOffLimitedHint', '歪到非当期限定')}
                              </div>
                            </div>
                            {/* 吃井次数 */}
                            <div className="space-y-1">
                              <div className="text-zinc-400 text-[10px] uppercase font-bold flex items-center gap-1">
                                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                {tt('summary.metric.sparkCount', '吃井次数')}
                              </div>
                              <div className="text-xl font-bold font-mono text-red-500">
                                {currentStats.byType?.limited?.sparkCount || 0}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono leading-tight">
                                {tt('summary.metric.sparkHint', '120抽触发保底')}
                              </div>
                            </div>
                            {/* 不歪率 */}
                            <div className="space-y-1">
                              <div className="text-zinc-400 text-[10px] uppercase font-bold">{tt('summary.metric.targetRate', '不歪率')}</div>
                              <div className="text-xl font-bold font-mono text-indigo-500">
                                {(() => {
                                  const upCount = ranking?.limited?.sixStarUpExcludingFree ?? ranking?.limited?.sixStarUpCount ?? 0;
                                  const offCount = ranking?.limited?.sixStarOffExcludingFree ?? ranking?.limited?.sixStarOffCount ?? 0;
                                  const total = upCount + offCount;
                                  if (total === 0) return '-';
                                  return formatPercent((upCount / total) * 100);
                                })()}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono leading-tight">
                                {tt('summary.metric.targetRateHint', '抽中UP的概率')}
                              </div>
                            </div>
                            {/* 常驻池六星 */}
                            <div className="space-y-1">
                              <div className="text-zinc-400 text-[10px] uppercase font-bold flex items-center gap-1">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                                {tt('summary.metric.standardBannerSix', '常驻池 6★')}
                              </div>
                              <div className="text-xl font-bold font-mono text-indigo-400">
                                {currentStats.byType?.standard?.six || currentStats.byType?.standard?.sixStarTotal || 0}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono leading-tight">
                                {tt('summary.metric.standardBannerDropsHint', '常驻池出货')}
                              </div>
                            </div>
                            {/* 限定率 */}
                            <div className="space-y-1">
                              <div className="text-zinc-400 text-[10px] uppercase font-bold flex items-center gap-1">
                                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                                {tt('summary.metric.limitedRate', '限定率')}
                              </div>
                              <div className="text-xl font-bold font-mono text-amber-500">
                                {(() => {
                                  const offStd = ranking?.limited?.sixStarOffStandardCount ?? 0;
                                  const offLtd = ranking?.limited?.sixStarOffLimitedCount ?? 0;
                                  const totalOff = offStd + offLtd;
                                  if (totalOff === 0) return '-';
                                  return formatPercent((offLtd / totalOff) * 100);
                                })()}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono leading-tight">
                                {tt('summary.metric.limitedRateHint', '歪中限定占比')}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 右侧列：其他排名 */}
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 p-4 h-full">
                      <RankingCard
                        ranking={ranking}
                        loading={isRankingLoading}
                        poolType="all"
                        title={dataSource === 'global'
                          ? tt('summary.section.otherRankingGlobal', '全服出货排名 (其他)')
                          : tt('summary.section.otherRankingLocal', '我的出货排名 (其他)')}
                        visibleSections={['limitedOff', 'standard', 'limitedFive', 'standardFive']}
                      />
                    </div>
                  </div>

                  {/* 角色池统计 */}
                    <div className="bg-zinc-50 dark:bg-zinc-950/30 border border-zinc-200 dark:border-zinc-800 p-5">
                      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-800 border-dashed">
                        <Star size={16} className="text-violet-500" />
                        <h4 className="font-bold text-sm text-slate-700 dark:text-zinc-300 uppercase tracking-wide">{tt('summary.section.characterBannerData', '角色池数据')}</h4>
                        <span className="text-[10px] text-zinc-400 ml-auto font-mono">{tt('summary.section.characterBannerSubtitle', '附加 + 限定 + 常驻')}</span>
                      </div>
                      <div className={`grid grid-cols-2 ${currentStats.byType?.character?.avgPityUp ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-6`}>
                        <div className="space-y-1">
                          <div className="text-zinc-400 text-[10px] uppercase font-bold">{tt('summary.metric.totalPulls', '总抽数')}</div>
                          <div className="text-xl font-bold font-mono text-slate-700 dark:text-zinc-200">{formatCount(currentStats.byType?.character?.total || 0)}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-zinc-400 text-[10px] uppercase font-bold">{tt('summary.metric.sixStarCount', '6★ 数量')}</div>
                          <div className="text-xl font-bold font-mono text-amber-500">
                            {(() => {
                              // 优先显示不含免费的6★数量
                              const extraSixTotal = currentStats.byType?.extra?.six || 0;
                              const limitedSixTotal = currentStats.byType?.limited?.six || 0;
                              const standardSixTotal = currentStats.byType?.standard?.six || 0;
                              const totalSix = extraSixTotal + limitedSixTotal + standardSixTotal;

                              // 全服数据优先显示排除免费十连后的限定池 6★ 数量
                              const limitedSixExcl = dataSource === 'global' ? ranking?.limited?.sixStarExcludingFree : undefined;
                              const hasExclData = limitedSixExcl !== undefined && limitedSixExcl !== null;

                              if (hasExclData) {
                                // 显示不含免费的数量（附加池全部 + 限定池不含免费 + 常驻池全部）
                                return extraSixTotal + limitedSixExcl + standardSixTotal;
                              }
                              return totalSix;
                            })()}
                            {currentStats.charGift > 0 && (
                              <span className="text-xs text-purple-500 ml-1">+{currentStats.charGift}</span>
                            )}
                          </div>
                          {/* 含免费的6★数量（如果与不含免费不同则显示） */}
                          {(() => {
                            const extraSixTotal = currentStats.byType?.extra?.six || 0;
                            const limitedSixTotal = currentStats.byType?.limited?.six || 0;
                            const standardSixTotal = currentStats.byType?.standard?.six || 0;
                            const totalSix = extraSixTotal + limitedSixTotal + standardSixTotal;
                            const limitedSixExcl = dataSource === 'global' ? ranking?.limited?.sixStarExcludingFree : undefined;

                            if (limitedSixExcl === undefined || limitedSixExcl === null) return null;

                            const totalExcl = extraSixTotal + limitedSixExcl + standardSixTotal;
                            if (totalExcl === totalSix) return null;

                            return (
                              <div className="text-[10px] text-zinc-500 font-mono">
                                {tt('summary.metric.withFree', '含免费')}: <span className="text-zinc-400">{totalSix}</span>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="space-y-1">
                          <div className="text-zinc-400 text-[10px] uppercase font-bold">{tt('summary.metric.avgSixStarDrop', '六星平均出货')}</div>
                          <div className="text-xl font-bold font-mono text-indigo-500">
                            {(() => {
                              // 优先显示不含免费的平均出货
                              const extraAvgExcl = currentStats.byType?.extra?.avgPityExcludingFree || currentStats.byType?.extra?.avgPity;
                              const extraSix = currentStats.byType?.extra?.six || 0;
                              const limitedAvgExcl = currentStats.byType?.limited?.avgPityExcludingFree;
                              const standardAvgExcl = currentStats.byType?.standard?.avgPityExcludingFree || currentStats.byType?.standard?.avgPity;
                              const limitedSix = currentStats.byType?.limited?.six || 0;
                              const standardSix = currentStats.byType?.standard?.six || 0;

                              if (extraSix + limitedSix + standardSix === 0) return '-';

                              // 如果有不含免费的数据，优先使用
                              if (currentStats.byType?.character?.avgPityExcludingFree) {
                                return currentStats.byType.character.avgPityExcludingFree;
                              }

                              if (limitedAvgExcl || extraAvgExcl) {
                                const weighted = (
                                  (parseFloat(extraAvgExcl) || 0) * extraSix +
                                  (parseFloat(limitedAvgExcl) || 0) * limitedSix +
                                  (parseFloat(standardAvgExcl) || 0) * standardSix
                                ) / (extraSix + limitedSix + standardSix);
                                return weighted.toFixed(1);
                              }

                              // 否则回退到含免费的
                              const extraAvg = currentStats.byType?.extra?.avgPity;
                              const limitedAvg = currentStats.byType?.limited?.avgPity;
                              const standardAvg = currentStats.byType?.standard?.avgPity;
                              const weighted = (
                                (parseFloat(extraAvg) || 0) * extraSix +
                                (parseFloat(limitedAvg) || 0) * limitedSix +
                                (parseFloat(standardAvg) || 0) * standardSix
                              ) / (extraSix + limitedSix + standardSix);
                              return weighted.toFixed(1);
                            })()}
                          </div>
                          {/* 含免费十连的平均出货（如果与不含免费不同则显示） */}
                          {(() => {
                            const extraAvg = currentStats.byType?.extra?.avgPity;
                            const extraAvgExcl = currentStats.byType?.extra?.avgPityExcludingFree || extraAvg;
                            const limitedAvgExcl = currentStats.byType?.limited?.avgPityExcludingFree;
                            const limitedAvg = currentStats.byType?.limited?.avgPity;
                            const standardAvg = currentStats.byType?.standard?.avgPity;
                            const extraSix = currentStats.byType?.extra?.six || 0;
                            const limitedSix = currentStats.byType?.limited?.six || 0;
                            const standardSix = currentStats.byType?.standard?.six || 0;

                            if (extraSix + limitedSix + standardSix === 0 || (!limitedAvgExcl && !extraAvgExcl)) return null;

                            const weightedWithFree = (
                              (parseFloat(extraAvg) || 0) * extraSix +
                              (parseFloat(limitedAvg) || 0) * limitedSix +
                              (parseFloat(standardAvg) || 0) * standardSix
                            ) / (extraSix + limitedSix + standardSix);
                            const standardAvgExcl = currentStats.byType?.standard?.avgPityExcludingFree || standardAvg;
                            const weightedExclFree = (
                              (parseFloat(extraAvgExcl) || 0) * extraSix +
                              (parseFloat(limitedAvgExcl) || 0) * limitedSix +
                              (parseFloat(standardAvgExcl) || 0) * standardSix
                            ) / (extraSix + limitedSix + standardSix);

                            // 如果差异小于0.1，不显示
                            if (Math.abs(weightedWithFree - weightedExclFree) < 0.1) return null;

                            return (
                              <div className="text-[10px] text-zinc-500 font-mono">
                                {tt('summary.metric.withFree', '含免费')}: <span className="text-zinc-400">{weightedWithFree.toFixed(1)}</span>
                              </div>
                            );
                          })()}
                        </div>
                        {/* UP六星平均出货 - 角色池 */}
                        {(currentStats.byType?.character?.avgPityUp || currentStats.byType?.limited?.avgPityUp) && (
                          <div className="space-y-1">
                            <div className="text-zinc-400 text-[10px] uppercase font-bold">{tt('summary.metric.avgTargetSixStarDrop', 'UP六星平均出货')}</div>
                            <div className="text-xl font-bold font-mono text-emerald-500">
                              {currentStats.byType?.character?.avgPityUp || currentStats.byType?.limited?.avgPityUp}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                              {tt('summary.metric.avgTargetSixHint', '仅当期目标6★ 抽/个')}
                            </div>
                          </div>
                        )}
                        <div className="space-y-1">
                          <div className="text-zinc-400 text-[10px] uppercase font-bold">{tt('summary.metric.targetVsOff', '不歪/歪')}</div>
                          <div className="text-lg font-bold font-mono">
                            {(() => {
                              const extraPool = currentStats.byType?.extra || {};
                              const limitedPool = currentStats.byType?.limited || {};
                              const standardPool = currentStats.byType?.standard || {};
                              const extraUp = (extraPool.sixStarLimited ?? extraPool.limitedSix ?? 0);
                              const limitedUp = (limitedPool.sixStarLimited ?? limitedPool.limitedSix ?? 0);
                              const standardUp = (standardPool.sixStarLimited ?? standardPool.limitedSix ?? 0);
                              const totalLimited = extraUp + limitedUp + standardUp;
                              const extraStd = (extraPool.six || 0) - extraUp;
                              const limitedStd = (limitedPool.six || 0) - limitedUp;
                              const standardStd = (standardPool.six || 0) - standardUp;
                              const totalStd = extraStd + limitedStd + standardStd;
                              const totalSix = (extraPool.six || 0) + (limitedPool.six || 0) + (standardPool.six || 0);
                              const rate = totalSix > 0 ? ((totalLimited / totalSix) * 100).toFixed(1) : 0;
                              return (
                                <>
                                  <span className="text-emerald-500">{totalLimited}</span>
                                  <span className="text-zinc-400 mx-1">/</span>
                                  <span className="text-rose-500">{totalStd}</span>
                                  <span className="text-zinc-400 text-xs ml-1">({formatPercent(Number(rate), 1)})</span>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                      {/* 角色池细分 */}
                      <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800/50 grid grid-cols-1 xl:grid-cols-3 gap-4 text-xs font-mono">
                        <div className="flex items-center gap-2 text-zinc-500 flex-wrap">
                          <span className="w-2 h-2 bg-cyan-500/50 rounded-sm flex-shrink-0"></span>
                          <span>{tt('summary.scope.extra', '附加寻访')}: {formatCount(currentStats.byType?.extra?.total || 0)} {tt('summary.metric.pullsUnit', '抽')}</span>
                          <span className="ml-auto flex items-center gap-1">
                            <span className="text-cyan-600 dark:text-cyan-400">
                              {currentStats.byType?.extra?.avgPityExcludingFree || currentStats.byType?.extra?.avgPity || '-'} {tt('summary.metric.averageShort', '平均')}
                            </span>
                            {currentStats.byType?.extra?.avgPityExcludingFree &&
                             currentStats.byType?.extra?.avgPity &&
                             currentStats.byType?.extra?.avgPityExcludingFree !== currentStats.byType?.extra?.avgPity && (
                              <span className="text-zinc-400">
                                ({tt('summary.metric.withFree', '含免费')}: {currentStats.byType?.extra?.avgPity})
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-500 flex-wrap">
                          <span className="w-2 h-2 bg-emerald-500/50 rounded-sm flex-shrink-0"></span>
                          <span>{tt('summary.scope.limited', '限定角色池')}: {formatCount(currentStats.byType?.limited?.total || 0)} {tt('summary.metric.pullsUnit', '抽')}</span>
                          <span className="ml-auto flex items-center gap-1">
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {currentStats.byType?.limited?.avgPityExcludingFree || currentStats.byType?.limited?.avgPity || '-'} {tt('summary.metric.averageShort', '平均')}
                            </span>
                            {currentStats.byType?.limited?.avgPityExcludingFree &&
                             currentStats.byType?.limited?.avgPity &&
                             currentStats.byType?.limited?.avgPityExcludingFree !== currentStats.byType?.limited?.avgPity && (
                              <span className="text-zinc-400">
                                ({tt('summary.metric.withFree', '含免费')}: {currentStats.byType?.limited?.avgPity})
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-500">
                          <span className="w-2 h-2 bg-indigo-500/50 rounded-sm flex-shrink-0"></span>
                          <span>{tt('summary.scope.standard', '常驻池')}: {formatCount(currentStats.byType?.standard?.total || 0)} {tt('summary.metric.pullsUnit', '抽')}</span>
                          <span className="ml-auto text-indigo-600 dark:text-indigo-400">{currentStats.byType?.standard?.avgPity || '-'} {tt('summary.metric.averageShort', '平均')}</span>
                        </div>
                      </div>
                    </div>

                    {/* 武器池统计 */}
                    <div className="bg-zinc-50 dark:bg-zinc-950/30 border border-zinc-200 dark:border-zinc-800 p-5">
                      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-800 border-dashed">
                        <Swords size={16} className="text-slate-500" />
                        <h4 className="font-bold text-sm text-slate-700 dark:text-zinc-300 uppercase tracking-wide">{tt('summary.section.weaponBannerData', '武器池数据')}</h4>
                      </div>
                      <div className={`grid grid-cols-2 ${currentStats.byType?.weapon?.avgPityUp ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-6`}>
                        <div className="space-y-1">
                          <div className="text-zinc-400 text-[10px] uppercase font-bold">{tt('summary.metric.totalPulls', '总抽数')}</div>
                          <div className="text-xl font-bold font-mono text-slate-700 dark:text-zinc-200">{formatCount(currentStats.byType?.weapon?.total || 0)}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-zinc-400 text-[10px] uppercase font-bold">{tt('summary.metric.sixStarCount', '6★ 数量')}</div>
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
                          <div className="text-zinc-400 text-[10px] uppercase font-bold">{tt('summary.metric.avgSixStarDrop', '六星平均出货')}</div>
                          <div className="text-xl font-bold font-mono text-indigo-500">{currentStats.byType?.weapon?.avgPity || '-'}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">{tt('summary.metric.avgAllSixHint', '全部6★ 抽/个')}</div>
                        </div>
                        {currentStats.byType?.weapon?.avgPityUp && (
                          <div className="space-y-1">
                            <div className="text-zinc-400 text-[10px] uppercase font-bold">{tt('summary.metric.avgTargetSixStarDrop', 'UP六星平均出货')}</div>
                            <div className="text-xl font-bold font-mono text-emerald-500">{currentStats.byType.weapon.avgPityUp}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">{tt('summary.metric.avgTargetSixHint', '仅当期目标6★ 抽/个')}</div>
                          </div>
                        )}
                        <div className="space-y-1">
                          <div className="text-zinc-400 text-[10px] uppercase font-bold">{tt('summary.metric.targetVsOff', '不歪/歪')}</div>
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
                                  <span className="text-zinc-400 text-xs ml-1">({formatPercent(Number(rate), 1)})</span>
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
                  <div className={`grid grid-cols-2 ${currentStats.avgPityUp ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4`}>
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 p-4">
                      <div className="text-zinc-400 text-[10px] uppercase font-bold mb-1">{tt('summary.metric.totalPulls', '总抽数')}</div>
                      <div className="text-3xl font-black font-mono text-slate-800 dark:text-white">{formatCount(currentStats.total || 0)}</div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 p-4">
                      <div className="text-zinc-400 text-[10px] uppercase font-bold mb-1">{tt('summary.metric.sixStarCount', '6★ 数量')}</div>
                      <div className="text-3xl font-black font-mono text-amber-500">{currentStats.sixStar || 0}</div>
                      <div className="text-xs text-zinc-500 mt-1 font-mono">
                        {tt('summary.metric.probability', '概率')}: {currentStats.total > 0 ? formatPercent((currentStats.sixStar / currentStats.total) * 100, 2) : formatPercent(0, 2)}
                      </div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 p-4">
                      <div className="text-zinc-400 text-[10px] uppercase font-bold mb-1">{tt('summary.metric.avgSixStarDrop', '六星平均出货')}</div>
                      <div className="text-3xl font-black font-mono text-indigo-500">{currentStats.avgPityExcludingFree || currentStats.avgPity || '-'}</div>
                      <div className="text-xs text-zinc-500 mt-1 font-mono">{tt('summary.metric.avgAllSixHint', '全部6★ 抽/个')}</div>
                    </div>
                    {currentStats.avgPityUp && (
                      <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 p-4">
                        <div className="text-zinc-400 text-[10px] uppercase font-bold mb-1">{tt('summary.metric.avgTargetSixStarDrop', 'UP六星平均出货')}</div>
                        <div className="text-3xl font-black font-mono text-emerald-500">{currentStats.avgPityUp}</div>
                        <div className="text-xs text-zinc-500 mt-1 font-mono">{tt('summary.metric.avgTargetSixHint', '仅当期目标6★ 抽/个')}</div>
                      </div>
                    )}
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 p-4">
                      <div className="text-zinc-400 text-[10px] uppercase font-bold mb-1">{tt('summary.metric.targetVsOff', '不歪/歪')}</div>
                      <div className="text-xl font-black font-mono mt-1">
                        <span className="text-emerald-500">{currentStats.sixStarLimited || 0}</span>
                        <span className="text-zinc-400 mx-1">/</span>
                        <span className="text-rose-500">{currentStats.sixStarStandard || 0}</span>
                      </div>
                      <div className="text-xs text-zinc-500 mt-1 font-mono">
                        {tt('summary.metric.targetRate', '不歪率')}: {currentStats.sixStar > 0
                          ? formatPercent(((currentStats.sixStarLimited || 0) / currentStats.sixStar) * 100)
                          : formatPercent(0)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.05)_10px,rgba(0,0,0,0.05)_20px)] dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.02)_10px,rgba(255,255,255,0.02)_20px)]"></div>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 p-12 text-center text-zinc-500 font-mono">{tt('summary.empty', '暂无数据')}</div>
          )}

          {currentStats?.resources && (
            poolTypeFilter === 'all' ? (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <ResourceSummaryPanel
                  title={tt('summary.section.allResourceSummary', '全卡池资源统计')}
                  resources={currentStats.resources}
                  variant="all"
                />
                <ResourceSummaryPanel
                  title={tt('summary.section.characterResourceSummary', '角色池资源统计')}
                  resources={currentStats.byType?.character?.resources}
                  variant="character"
                  layout="two-plus-one"
                />
                <ResourceSummaryPanel
                  title={tt('summary.section.weaponResourceSummary', '武器池资源统计')}
                  resources={currentStats.byType?.weapon?.resources}
                  variant="weapon"
                  stacked
                />
              </div>
            ) : (
              <ResourceSummaryPanel
                title={poolTypeFilter === 'weapon'
                  ? tt('summary.section.weaponResourceSummary', '武器池资源统计')
                  : tt('summary.section.characterResourceSummary', '角色池资源统计')}
                resources={currentStats.resources}
                variant={poolTypeFilter === 'weapon' ? 'weapon' : 'character'}
              />
            )
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
