import React from 'react';
import { BarChart3, Cloud, Globe, Layers, Star, Swords } from 'lucide-react';
import usePoolStore from '../../stores/usePoolStore';
import useHistoryStore from '../../stores/useHistoryStore';
import useAppStore from '../../stores/useAppStore';
import useAuthStore from '../../stores/useAuthStore';
import { useSummaryViewState } from '../../hooks/summary';
import ResourceSummaryPanel from '../../components/resources/ResourceSummaryPanel.jsx';
import { useI18n } from '../../i18n/index.js';
import {
  MobilePage,
  MobilePillTabs,
  MobileSectionTitle,
  MobileStatusBadge
} from '../components/ux/MobilePrimitives.jsx';

function SmallStat({ label, value, accent = 'text-white' }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/55 p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">{label}</div>
      <div className={`mt-2 tabular-nums text-xl font-black ${accent}`}>{value}</div>
    </div>
  );
}

function TypeCard({ title, subtitle, total, six, avgPity, avgPityUp, accent = 'text-white' }) {
  const { t } = useI18n();

  return (
    <div className="rounded-xl border border-zinc-800 bg-[#111] p-4">
      <div className="flex items-center justify-between gap-3 border-b border-dashed border-zinc-800 pb-3">
        <div>
          <div className="text-sm font-black text-white">{title}</div>
          <div className="mt-1 text-[11px] text-zinc-500">{subtitle}</div>
        </div>
        <div className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${accent} border-current/20 bg-white/5`}>
          6★
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-y-4 gap-x-3 text-[11px]">
        <div><div className="text-zinc-500">{t('summary.metric.totalPulls')}</div><div className="mt-1 tabular-nums text-xl font-black text-white">{total}</div></div>
        <div><div className="text-zinc-500">6★</div><div className={`mt-1 tabular-nums text-xl font-black ${accent}`}>{six}</div></div>
        <div><div className="text-zinc-500">{t('stats.avgSix')}</div><div className="mt-1 tabular-nums text-lg font-black text-indigo-400">{avgPity}</div></div>
        <div><div className="text-zinc-500">{t('stats.avgTarget')}</div><div className="mt-1 tabular-nums text-lg font-black text-emerald-400">{avgPityUp}</div></div>
      </div>
    </div>
  );
}

function MobileStatsView() {
  const user = useAuthStore((state) => state.user);
  const pools = usePoolStore((state) => state.pools);
  const history = useHistoryStore((state) => state.history);
  const globalStats = useAppStore((state) => state.globalStats);
  const globalStatsLoading = useAppStore((state) => state.globalStatsLoading);
  const fetchGlobalStats = useAppStore((state) => state.fetchGlobalStats);
  const { t, formatNumber } = useI18n();
  const {
    poolTypeFilter,
    setPoolTypeFilter,
    currentStats,
    ranking,
    filterOptions
  } = useSummaryViewState({
    history,
    pools,
    user,
    globalStats,
    fetchGlobalStats,
    variant: 'mobile',
    initialDataSource: 'global',
    lockedDataSource: 'global',
    initialPoolTypeFilter: 'all'
  });
  const totalContributors = Number(currentStats?.totalContributors ?? currentStats?.totalUsers ?? 0) || 0;
  const contributorRegionStats = currentStats?.contributorsByRegion || null;
  const contributorCn = Number(contributorRegionStats?.cn || 0) || 0;
  const contributorIntl = Number(contributorRegionStats?.intl || 0) || 0;

  const limitedRanking = ranking?.limited || {};
  const upHits = limitedRanking.sixStarUpExcludingFree ?? limitedRanking.sixStarUpCount ?? 0;
  const offStandardHits = limitedRanking.sixStarOffStandardExcludingFree ?? limitedRanking.sixStarOffStandardCount ?? 0;
  const offLimitedHits = limitedRanking.sixStarOffLimitedExcludingFree ?? limitedRanking.sixStarOffLimitedCount ?? 0;
  const sparkCount = currentStats?.byType?.limited?.sparkCount || 0;
  const limitedTotalSix = Number(upHits) + Number(offStandardHits) + Number(offLimitedHits);
  const onRate = limitedTotalSix > 0 ? `${((Number(upHits) / limitedTotalSix) * 100).toFixed(1)}%` : '0.0%';
  const loading = globalStatsLoading || !currentStats;

  return (
    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden slide-right-enter scroll-smooth w-full flex flex-col pb-20">
        {/* Fixed Top Controls */}
        <div className="pt-6 pb-3 px-4 bg-white/95 dark:bg-ef-dark/95 backdrop-blur-xl z-20 border-b border-zinc-200 dark:border-zinc-800/50 shrink-0">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-black tracking-widest text-slate-900 dark:text-white">{t('nav.stats')}</h1>
            </div>

            {/* Pill Tabs for Pool Selection */}
            <div className="flex bg-zinc-100 dark:bg-zinc-900/80 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto scrollbar-hide">
                {filterOptions.map((option) => (
                    <button
                        key={option.value}
                        onClick={() => setPoolTypeFilter(option.value)}
                        className={`flex-1 min-w-[70px] shrink-0 py-1.5 px-2 text-[11px] font-bold rounded-md transition-all ${
                            poolTypeFilter === option.value
                            ? 'bg-zinc-200 dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:text-zinc-300'
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
            {/* Title Bar */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                        <Globe size={16} />
                    </div>
                    <div>
                        <h2 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            {t('summary.ranking.globalStats')}
                        </h2>
                        <span className="text-slate-500 dark:text-zinc-500 text-[9px] font-mono block mt-0.5">TARGET // {filterOptions.find(o => o.value === poolTypeFilter)?.label || 'ALL'}</span>
                    </div>
                </div>
                <div className="text-right">
                    <span className="block text-[8px] text-slate-500 dark:text-zinc-500 uppercase font-mono tracking-widest">{t('stats.contributors')}</span>
                    <span className="text-sm font-bold text-slate-700 dark:text-zinc-300 font-mono">{formatNumber(totalContributors)}</span>
                    {contributorRegionStats ? (
                      <div className="mt-1 flex flex-wrap justify-end gap-1 text-[9px] font-mono text-slate-500 dark:text-zinc-500">
                        <span>{t('summary.metric.cn')}: {formatNumber(contributorCn)}</span>
                        <span>{t('summary.metric.intl')}: {formatNumber(contributorIntl)}</span>
                      </div>
                    ) : null}
                </div>
            </div>

            {loading ? (
                <div className="py-20 text-center text-sm font-mono text-slate-500 dark:text-zinc-500">{t('common.loading')}</div>
            ) : poolTypeFilter === 'all' ? (
                <div className="space-y-4">
                    {/* Total Pulls */}
                    <div className="bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200 dark:border-white/5 shadow-sm border-zinc-200 dark:border-zinc-800/50 p-4 relative overflow-hidden group/stat rounded-xl flex items-center justify-between">
                        <div>
                            <div className="text-slate-600 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1">{t('summary.metric.totalPulls')}</div>
                            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">{formatNumber(currentStats?.total || 0)}</div>
                        </div>
                        <Layers size={40} className="text-slate-200 dark:text-zinc-800 opacity-50" />
                    </div>

                    {/* Limited Pool UP Analysis */}
                    <div className="bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200 dark:border-white/5 shadow-sm border-zinc-200 dark:border-zinc-800/50 p-4 rounded-xl">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-200 dark:border-zinc-800 border-dashed">
                            <Star size={14} className="text-amber-500" />
                            <h4 className="font-bold text-[11px] text-slate-700 dark:text-zinc-300 uppercase tracking-wide">{t('summary.ranking.limitedUpSix')}</h4>
                        </div>

                        <div className="grid grid-cols-2 gap-y-4 gap-x-3">
                            <div className="space-y-0.5">
                                <div className="text-slate-600 dark:text-zinc-400 text-[9px] uppercase font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> {t('summary.metric.limitedUpSix')}
                                </div>
                                <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-500">{formatNumber(upHits)}</div>
                                <div className="text-[8px] text-slate-500 dark:text-zinc-500 font-mono">{t('summary.metric.limitedUpSixHint')}</div>
                            </div>
                            <div className="space-y-0.5">
                                <div className="text-slate-600 dark:text-zinc-400 text-[9px] uppercase font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span> {t('summary.metric.offStandardSix')}
                                </div>
                                <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-500">{formatNumber(offStandardHits)}</div>
                                <div className="text-[8px] text-slate-500 dark:text-zinc-500 font-mono">{t('summary.metric.offStandardSixHint')}</div>
                            </div>
                            <div className="space-y-0.5">
                                <div className="text-slate-600 dark:text-zinc-400 text-[9px] uppercase font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span> {t('summary.metric.offLimitedSix')}
                                </div>
                                <div className="text-lg font-bold font-mono text-orange-600 dark:text-orange-500">{formatNumber(offLimitedHits)}</div>
                                <div className="text-[8px] text-slate-500 dark:text-zinc-500 font-mono">{t('summary.metric.offLimitedSixHint')}</div>
                            </div>
                            <div className="space-y-0.5">
                                <div className="text-slate-600 dark:text-zinc-400 text-[9px] uppercase font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> {t('summary.metric.sparkCount')}
                                </div>
                                <div className="text-lg font-bold font-mono text-red-500">{formatNumber(sparkCount)}</div>
                                <div className="text-[8px] text-slate-500 dark:text-zinc-500 font-mono">{t('summary.metric.sparkCountHint')}</div>
                            </div>
                            <div className="space-y-0.5">
                                <div className="text-slate-600 dark:text-zinc-400 text-[9px] uppercase font-bold">{t('summary.metric.winRate')}</div>
                                <div className="text-lg font-bold font-mono text-indigo-600 dark:text-indigo-500">{onRate}</div>
                                <div className="text-[8px] text-slate-500 dark:text-zinc-500 font-mono">{t('summary.metric.winRateHint')}</div>
                            </div>
                            <div className="space-y-0.5">
                                <div className="text-slate-600 dark:text-zinc-400 text-[9px] uppercase font-bold">{t('summary.metric.limitedRate')}</div>
                                <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-500">
                                   {limitedTotalSix > 0 ? `${(((Number(upHits) + Number(offLimitedHits)) / limitedTotalSix) * 100).toFixed(1)}%` : '0.0%'}
                                </div>
                                <div className="text-[8px] text-slate-500 dark:text-zinc-500 font-mono">{t('summary.metric.limitedRateHint')}</div>
                            </div>
                        </div>
                    </div>

                    {/* Character Pool Stats */}
                    <div className="bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200 dark:border-white/5 shadow-sm border-zinc-200 dark:border-zinc-800/50 p-4 rounded-xl">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-200 dark:border-zinc-800 border-dashed">
                            <Star size={14} className="text-violet-500" />
                            <h4 className="font-bold text-[11px] text-slate-700 dark:text-zinc-300 uppercase tracking-wide">{t('home.poolMechanics.cards.limited.title')} & {t('home.poolMechanics.cards.standard.title')}</h4>
                            <span className="text-[8px] text-slate-500 dark:text-zinc-500 ml-auto font-mono">COMBINED</span>
                        </div>
                        <div className="grid grid-cols-2 gap-y-4 gap-x-3">
                            <div className="space-y-0.5">
                                <div className="text-slate-600 dark:text-zinc-400 text-[9px] uppercase font-bold">{t('summary.metric.totalPulls')}</div>
                                <div className="text-lg font-bold font-mono text-slate-900 dark:text-zinc-200">{formatNumber((currentStats?.byType?.limited?.total || 0) + (currentStats?.byType?.standard?.total || 0))}</div>
                            </div>
                            <div className="space-y-0.5">
                                <div className="text-slate-600 dark:text-zinc-400 text-[9px] uppercase font-bold">6★</div>
                                <div className="text-lg font-bold font-mono text-amber-500">{formatNumber((currentStats?.byType?.limited?.six || 0) + (currentStats?.byType?.standard?.six || 0))}</div>
                            </div>
                            <div className="space-y-0.5">
                                <div className="text-slate-600 dark:text-zinc-400 text-[9px] uppercase font-bold">{t('stats.avgSix')}</div>
                                <div className="text-lg font-bold font-mono text-indigo-500">
                                   {((currentStats?.byType?.limited?.six || 0) + (currentStats?.byType?.standard?.six || 0)) > 0 ? (((currentStats?.byType?.limited?.total || 0) + (currentStats?.byType?.standard?.total || 0)) / ((currentStats?.byType?.limited?.six || 0) + (currentStats?.byType?.standard?.six || 0))).toFixed(1) : '0.0'}
                                </div>
                            </div>
                            <div className="space-y-0.5">
                                <div className="text-slate-600 dark:text-zinc-400 text-[9px] uppercase font-bold">{t('stats.avgTarget')}</div>
                                <div className="text-lg font-bold font-mono text-emerald-500">{(currentStats?.byType?.limited?.avgPityUp || 0).toFixed(1)}</div>
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800/50 flex flex-col gap-2 text-[10px] font-mono">
                            <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-400">
                                <span className="w-1.5 h-1.5 bg-emerald-500/50 rounded-sm"></span>  
                                <span>{t('home.poolMechanics.cards.limited.title')}: {formatNumber(currentStats?.byType?.limited?.total || 0)}</span>
                                <span className="ml-auto text-emerald-600 dark:text-emerald-500">{(currentStats?.byType?.limited?.avgPity || 0).toFixed(1)} {t('overview.unit.pullsPerItem').replace('/', '')}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-400">
                                <span className="w-1.5 h-1.5 bg-indigo-500/50 rounded-sm"></span>   
                                <span>{t('home.poolMechanics.cards.standard.title')}: {formatNumber(currentStats?.byType?.standard?.total || 0)}</span>
                                <span className="ml-auto text-indigo-600 dark:text-indigo-400">{(currentStats?.byType?.standard?.avgPity || 0).toFixed(1)} {t('overview.unit.pullsPerItem').replace('/', '')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Weapon Pool Stats */}
                    <div className="bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200 dark:border-white/5 shadow-sm border-zinc-200 dark:border-zinc-800/50 p-4 rounded-xl mb-6">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-200 dark:border-zinc-800 border-dashed">
                            <Swords size={14} className="text-slate-400" />
                            <h4 className="font-bold text-[11px] text-slate-700 dark:text-zinc-300 uppercase tracking-wide">{t('home.poolMechanics.cards.weapon.title')}</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-y-4 gap-x-3">
                            <div className="space-y-0.5">
                                <div className="text-slate-600 dark:text-zinc-400 text-[9px] uppercase font-bold">{t('summary.metric.totalPulls')}</div>
                                <div className="text-lg font-bold font-mono text-slate-900 dark:text-zinc-200">{formatNumber(currentStats?.byType?.weapon?.total || 0)}</div>
                            </div>
                            <div className="space-y-0.5">
                                <div className="text-slate-600 dark:text-zinc-400 text-[9px] uppercase font-bold">6★</div>
                                <div className="text-lg font-bold font-mono text-amber-500">{formatNumber(currentStats?.byType?.weapon?.six || 0)}</div>
                            </div>
                            <div className="space-y-0.5">
                                <div className="text-slate-600 dark:text-zinc-400 text-[9px] uppercase font-bold">{t('stats.avgSix')}</div>
                                <div className="text-lg font-bold font-mono text-indigo-600 dark:text-indigo-500">{(currentStats?.byType?.weapon?.avgPity || 0).toFixed(1)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Specific Pool Type Stats using TypeCard equivalent */}
                    <TypeCard
                        title={filterOptions.find(o => o.value === poolTypeFilter)?.label || poolTypeFilter}
                        subtitle={t('stats.totalPullsSubtitle')}
                        total={formatNumber(currentStats?.byType?.[poolTypeFilter]?.total || 0)}
                        six={formatNumber(currentStats?.byType?.[poolTypeFilter]?.six || 0)}
                        avgPity={(currentStats?.byType?.[poolTypeFilter]?.avgPity || 0).toFixed(1)}
                        avgPityUp={(currentStats?.byType?.[poolTypeFilter]?.avgPityUp || 0).toFixed(1)}
                        accent="text-white"
                    />
                </div>
            )}
        </div>
    </div>
  );
}

export default MobileStatsView;
