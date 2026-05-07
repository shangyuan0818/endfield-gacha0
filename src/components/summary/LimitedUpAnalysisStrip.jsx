import React from 'react';
import { RefreshCw, Star, User } from 'lucide-react';
import { characterCache } from '../../utils/characterUtils';
import { localizeEntityName } from '../../utils/gameDataI18n.js';

function StripMetric({ label, value, hint, tone = 'text-slate-800 dark:text-white', dot, mobile = false }) {
  return (
    <div className={`min-w-0 border border-zinc-200 bg-white/70 ${mobile ? 'p-2' : 'p-3'} dark:border-zinc-800 dark:bg-zinc-900/60`}>
      <div className={`flex items-center gap-1 ${mobile ? 'text-[9px]' : 'text-[10px]'} font-bold uppercase leading-tight text-zinc-500`}>
        {dot && <span className={`${mobile ? 'h-1.5 w-1.5' : 'h-2 w-2'} shrink-0 rounded-full ${dot}`} />}
        <span className="break-words">{label}</span>
      </div>
      <div className={`mt-1 font-mono ${mobile ? 'text-base' : 'text-lg'} font-black leading-tight ${tone}`}>{value}</div>
      {hint && <div className={`mt-1 break-words font-mono ${mobile ? 'text-[9px]' : 'text-[10px]'} leading-tight text-zinc-500`}>{hint}</div>}
    </div>
  );
}

export default function LimitedUpAnalysisStrip({
  currentStats,
  ranking,
  loading = false,
  locale,
  formatCount,
  formatPercent,
  tt,
  mobile = false
}) {
  const limitedUpEntries = (ranking?.limited?.sixStarUp || ranking?.limited?.sixStar || []).slice(0, 6);

  if (!currentStats && !ranking && !loading) {
    return null;
  }

  const upCount = ranking?.limited?.sixStarUpExcludingFree ?? ranking?.limited?.sixStarUpCount ?? 0;
  const offCount = ranking?.limited?.sixStarOffExcludingFree ?? ranking?.limited?.sixStarOffCount ?? 0;
  const offStd = ranking?.limited?.sixStarOffStandardCount ?? 0;
  const offLtd = ranking?.limited?.sixStarOffLimitedCount ?? 0;
  const total = Number(upCount || 0) + Number(offCount || 0);
  const totalOff = Number(offStd || 0) + Number(offLtd || 0);

  const metrics = [
    {
      key: 'up',
      label: tt('summary.metric.upSixNoMiss', 'UP 6★ (不歪)'),
      value: upCount || '-',
      hint: tt('summary.metric.hitUpLimitedHint', '限定池抽中UP角色'),
      tone: 'text-emerald-500',
      dot: 'bg-emerald-500'
    },
    {
      key: 'off-standard',
      label: tt('summary.metric.offStandardSix', '歪常驻 6★'),
      value: ranking?.limited?.sixStarOffStandardExcludingFree ?? offStd ?? '-',
      hint: tt('summary.metric.hitOffStandardHint', '歪到常驻角色'),
      tone: 'text-rose-500',
      dot: 'bg-rose-500'
    },
    {
      key: 'off-limited',
      label: tt('summary.metric.offLimitedSix', '歪限定 6★'),
      value: offLtd || 0,
      hint: tt('summary.metric.hitOffLimitedHint', '歪到非当期限定'),
      tone: 'text-orange-500',
      dot: 'bg-orange-500'
    },
    {
      key: 'spark',
      label: tt('summary.metric.sparkCount', '吃井次数'),
      value: currentStats?.byType?.limited?.sparkCount || 0,
      hint: tt('summary.metric.sparkHint', '120抽触发保底'),
      tone: 'text-red-500',
      dot: 'bg-red-500'
    },
    {
      key: 'target-rate',
      label: tt('summary.metric.targetRate', '不歪率'),
      value: total === 0 ? '-' : formatPercent((Number(upCount || 0) / total) * 100),
      hint: tt('summary.metric.targetRateHint', '抽中UP的概率'),
      tone: 'text-indigo-500'
    },
    {
      key: 'standard',
      label: tt('summary.metric.standardBannerSix', '常驻池 6★'),
      value: currentStats?.byType?.standard?.six || currentStats?.byType?.standard?.sixStarTotal || 0,
      hint: tt('summary.metric.standardBannerDropsHint', '常驻池出货'),
      tone: 'text-indigo-400',
      dot: 'bg-indigo-500'
    },
    {
      key: 'limited-rate',
      label: tt('summary.metric.limitedRate', '限定率'),
      value: totalOff === 0 ? '-' : formatPercent((Number(offLtd || 0) / totalOff) * 100),
      hint: tt('summary.metric.limitedRateHint', '歪中限定占比'),
      tone: 'text-amber-500',
      dot: 'bg-amber-500'
    }
  ];

  return (
    <div
      className={`border border-zinc-200 bg-zinc-50 ${mobile ? 'p-3' : 'p-4'} dark:border-zinc-800 dark:bg-zinc-950/30`}
      style={!mobile ? { clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)' } : {}}
    >
      <div className={`${mobile ? 'mb-2.5' : 'mb-3'} flex items-center gap-2 border-b border-dashed border-zinc-200 pb-2 dark:border-zinc-800`}>
        <Star size={mobile ? 13 : 15} className="text-amber-500" />
        <h4 className={`${mobile ? 'text-xs' : 'text-sm'} font-bold uppercase tracking-wide text-slate-700 dark:text-zinc-300`}>
          {tt('summary.section.limitedUpAnalysis', '限定池 UP 6★ 分析')}
        </h4>
      </div>

      <div className={`${mobile ? 'space-y-3' : 'flex flex-col gap-4 xl:flex-row'}`}>
        <div className={`${mobile ? '' : 'xl:w-[30rem] xl:shrink-0 xl:border-r xl:border-zinc-200 xl:pr-4 dark:xl:border-zinc-800'}`}>
          <div className={`mb-2 border-l-2 border-zinc-300 pl-1 ${mobile ? 'text-[9px]' : 'text-[10px]'} font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-700`}>
            {tt('summary.ranking.limitedUpSix', '限定池 UP 6★')}
          </div>
          {loading ? (
            <div className="flex min-h-16 items-center justify-center text-xs text-zinc-400">
              <RefreshCw size={14} className="mr-2 animate-spin" />
              {tt('summary.loading.ranking', '加载排名...')}
            </div>
          ) : limitedUpEntries.length === 0 ? (
            <div className="flex min-h-16 items-center justify-center text-xs italic text-zinc-400">
              {tt('summary.ranking.empty', '暂无排名数据')}
            </div>
          ) : (
            <div className={`grid grid-cols-2 ${mobile ? 'gap-1.5' : 'gap-2 md:grid-cols-3'}`}>
              {limitedUpEntries.map((char) => {
                const charData = characterCache.searchByName(char.name, false);
                const avatarUrl = charData?.avatar_url;
                const localizedName = localizeEntityName(char.name, { locale, type: 'character' });

                return (
                  <div key={char.name} className={`flex min-w-0 items-center ${mobile ? 'gap-1.5 px-1.5 py-1' : 'gap-2 px-2 py-1.5'} bg-white dark:bg-zinc-800/50`}>
                    <div className={`${mobile ? 'h-7 w-7' : 'h-8 w-8'} shrink-0 overflow-hidden border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800`}>
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={localizedName} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <User size={14} className="text-zinc-400" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`truncate ${mobile ? 'text-[10px]' : 'text-[11px]'} font-medium leading-tight text-slate-700 dark:text-zinc-300`} title={localizedName}>
                        {localizedName}
                      </div>
                      <div className={`mt-1 font-mono ${mobile ? 'text-[9px]' : 'text-[10px]'} leading-none text-zinc-400`}>
                        ×{formatCount(char.count || 0)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={`grid min-w-0 flex-1 grid-cols-2 ${mobile ? 'gap-2' : 'gap-3 md:grid-cols-4 xl:grid-cols-7'}`}>
          {metrics.map((metric) => (
            <StripMetric
              key={metric.key}
              label={metric.label}
              value={metric.value}
              hint={metric.hint}
              tone={metric.tone}
              dot={metric.dot}
              mobile={mobile}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
