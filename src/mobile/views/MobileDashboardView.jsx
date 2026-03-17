import React from 'react';
import {
  Star, Calculator, Clock, FileText,
  Layers, Swords, User, PieChart as PieChartIcon,
  BarChart3, LayoutGrid, Share2, Copy, Sun, Moon
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useDashboardViewState, useToast } from '../../hooks';
import { RARITY_CONFIG } from '../../constants';
import { useTheme } from '../../contexts/ThemeContext';
import RainbowGradientDefs from '../../components/charts/RainbowGradientDefs';
import MobileChartContainer from '../components/MobileChartContainer';
import MobilePoolSelector from '../components/MobilePoolSelector';
import ResourceSummaryPanel from '../../components/resources/ResourceSummaryPanel';
import AveragePullStatsPanel from '../../components/dashboard/AveragePullStatsPanel';
import PoolTimelinePanel from '../../components/dashboard/PoolTimelinePanel';
import DashboardShareCard from '../../components/dashboard/DashboardShareCard';
import { Toast } from '../../components/ui';
import { calculateCurrentProbability } from '../../utils';
import { buildOverviewPoolAnalysisPityMap, getPoolAnalysisPityState } from '../../utils/poolAnalysisPity';
import { buildDashboardTimelineSections } from '../../utils/dashboardTimelineSections';
import { buildDashboardOverviewSplitStats } from '../../utils/dashboardOverviewSplitStats';
import {
  buildDashboardShareCardFileName,
  buildDashboardSharePayload,
  buildDashboardShareText
} from '../../utils/dashboardShare';
import {
  buildShareFile,
  canNativeShareFile,
  downloadShareCard,
  renderShareCardToBlob,
  shareImageFile
} from '../../utils/simulatorShare';
import { copyToClipboard } from '../../utils/simulatorStorage';

const DASHBOARD_SHARE_THEME_KEY = 'dashboard_share_theme';

/**
 * 移动端卡池分析视图 - 工业风重构版 (中文)
 */
function MobileDashboardView() {
  const { isDark } = useTheme();
  const { toasts, showToast, removeToast } = useToast();
  const shareCardRef = React.useRef(null);
  const [shareTheme, setShareTheme] = React.useState(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }

    return localStorage.getItem(DASHBOARD_SHARE_THEME_KEY)
      || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  });
  const {
    user,
    charViewMode,
    setCharViewMode,
    currentPool,
    normalizedPoolHistory,
    selectedPools,
    allLimitedHistory,
    normalizedPoolType,
    isLimited,
    isWeapon,
    isStandard,
    maxPity,
    hasPoolData,
    isGroupMode,
    isAllPoolsOverview,
    hasMergedAccountView,
    stats,
    effectivePity,
    groupedHistory,
    characterStats,
    checkLimitedInFirstN,
    hasReceivedFreeTen,
    weaponGifts,
    currentUpPool,
    getProgressClass,
    getCharacterAvatar
  } = useDashboardViewState();
  const displayPity6 = isLimited ? effectivePity.pity6 : stats.currentPity;
  const currentProbabilityInfo = !isGroupMode && !hasMergedAccountView
    ? calculateCurrentProbability(displayPity6, normalizedPoolType)
    : null;
  const analysisPity = React.useMemo(
    () => getPoolAnalysisPityState(currentPool, stats, effectivePity),
    [currentPool, effectivePity, stats]
  );
  const overviewAnalysisPityMap = React.useMemo(() => {
    if (!currentPool?.isGroupMode) {
      return null;
    }

    return buildOverviewPoolAnalysisPityMap({
      pools: selectedPools,
      history: normalizedPoolHistory,
      allLimitedHistory
    });
  }, [allLimitedHistory, currentPool?.isGroupMode, normalizedPoolHistory, selectedPools]);
  const timelineSections = React.useMemo(() => buildDashboardTimelineSections({
    currentPool,
    currentPoolHistory: normalizedPoolHistory,
    groupedHistory,
    selectedPools,
    isGroupMode,
    isAllPoolsOverview,
    effectivePity,
    analysisPity,
    overviewAnalysisPityMap,
    overviewPoolFilter: 'all',
    hasMergedAccountView
  }), [analysisPity, currentPool, effectivePity, groupedHistory, hasMergedAccountView, isAllPoolsOverview, isGroupMode, normalizedPoolHistory, overviewAnalysisPityMap, selectedPools]);
  const overviewSplitStats = React.useMemo(() => {
    if (!isAllPoolsOverview) {
      return null;
    }

    return buildDashboardOverviewSplitStats({
      history: normalizedPoolHistory,
      selectedPools
    });
  }, [isAllPoolsOverview, normalizedPoolHistory, selectedPools]);
  const dashboardSharePayload = React.useMemo(() => buildDashboardSharePayload({
    currentPool,
    normalizedPoolType,
    isGroupMode,
    isAllPoolsOverview,
    hasMergedAccountView,
    overviewPoolFilter: 'all',
    stats,
    analysisPity,
    sections: timelineSections,
    overviewSplitStats
  }), [analysisPity, currentPool, hasMergedAccountView, isAllPoolsOverview, isGroupMode, normalizedPoolType, overviewSplitStats, stats, timelineSections]);
  const hasDashboardShareData = (Number(stats?.total) || 0) > 0 || timelineSections.length > 0;
  const supportsNativeImageShare = React.useMemo(() => {
    if (typeof window === 'undefined' || typeof File === 'undefined' || typeof navigator?.share !== 'function') {
      return false;
    }

    if (typeof navigator.canShare !== 'function') {
      return false;
    }

    try {
      return navigator.canShare({
        files: [
          new File(['share'], 'share.txt', { type: 'text/plain' })
        ]
      });
    } catch {
      return false;
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(DASHBOARD_SHARE_THEME_KEY, shareTheme);
  }, [shareTheme]);
  const shareImageActionLabel = supportsNativeImageShare ? '系统分享图片' : '下载分享长图';
  const shareTextActionLabel = '复制分享文本';
  const resourceSummaryTitle = isGroupMode ? `${currentPool.name}资源统计` : '资源统计';
  const primarySixStarLabel = isAllPoolsOverview
    ? '目标6★'
    : normalizedPoolType === 'standard'
      ? '常驻6★'
      : '限定6★';
  const secondarySixStarLabel = normalizedPoolType === 'standard' ? '额外6★' : '常驻6★';

  const handleCopyShareText = React.useCallback(async () => {
    if (!hasDashboardShareData) {
      showToast('当前没有可分享的详情数据', 'warning');
      return;
    }

    const success = await copyToClipboard(buildDashboardShareText(dashboardSharePayload));
    showToast(success ? '详情分享文本已复制' : '分享文本复制失败，请手动重试', success ? 'success' : 'error');
  }, [dashboardSharePayload, hasDashboardShareData, showToast]);

  const handleShareImage = React.useCallback(async () => {
    if (!hasDashboardShareData) {
      showToast('当前没有可导出的卡池详情', 'warning');
      return;
    }

    if (!shareCardRef.current) {
      showToast('分享卡未准备好，请稍后重试', 'error');
      return;
    }

    try {
      const blob = await renderShareCardToBlob(shareCardRef.current, {
        backgroundColor: shareTheme === 'dark' ? '#09090b' : '#f4f4f5'
      });
      const fileName = buildDashboardShareCardFileName(dashboardSharePayload);
      const file = buildShareFile(blob, fileName);

      if (file && supportsNativeImageShare && canNativeShareFile(file)) {
        showToast('系统分享已打开', 'success');
        await shareImageFile(file, {
          title: `${dashboardSharePayload.scopeLabel}分享`,
          text: buildDashboardShareText(dashboardSharePayload)
        });
        return;
      }

      const downloaded = downloadShareCard(blob, fileName);
      showToast(downloaded ? '详情分享卡已下载' : '分享卡下载失败，请稍后重试', downloaded ? 'success' : 'error');
    } catch (error) {
      if (error?.name === 'AbortError') {
        return;
      }

      showToast('详情分享卡生成失败，请稍后重试', 'error');
    }
  }, [dashboardSharePayload, hasDashboardShareData, shareTheme, showToast, supportsNativeImageShare]);

  if (!hasPoolData) {
    return (
      <div className="px-4 py-4 space-y-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 flex items-center justify-between rounded-none shadow-sm">
          <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">目标卡池</span>
          <MobilePoolSelector />
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 text-center rounded-none shadow-sm">
          <Calculator size={48} className="mx-auto mb-4 text-zinc-300 dark:text-zinc-700" />
          <p className="text-zinc-500 dark:text-zinc-400">
            {user ? '请先导入或创建一个卡池' : '登录后导入抽卡数据即可开始分析'}
          </p>
        </div>
      </div>
    );
  }

  if (!currentPool) {
    return (
      <div className="px-4 py-8">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 text-center rounded-none shadow-sm">
          <Calculator size={48} className="mx-auto mb-4 text-zinc-300 dark:text-zinc-700" />
          <p className="text-zinc-500 dark:text-zinc-400">请先选择或创建一个卡池</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {hasDashboardShareData && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '-200vw',
            top: 0,
            opacity: 0,
            pointerEvents: 'none',
          }}
        >
          <DashboardShareCard ref={shareCardRef} payload={dashboardSharePayload} sections={timelineSections} theme={shareTheme} />
        </div>
      )}
      {/* 卡池选择器 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 flex items-center justify-between rounded-none shadow-sm">
        <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">目标卡池</span>
        <MobilePoolSelector />
      </div>

      {/* 卡池标题卡片 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden rounded-none shadow-md">
        <div className={`h-1.5 w-full ${isLimited ? 'rainbow-bg' : isWeapon ? 'bg-slate-500' : 'bg-amber-500'}`} />
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-none border border-current ${
                isLimited ? 'text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-900/10' :
                isWeapon ? 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/10' :
                'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10'
              }`}>
                {isWeapon ? <Swords size={20} /> : isLimited ? <Star size={20} /> : <Layers size={20} />}
              </div>
              <div>
                <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
                  {currentPool.name}
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-2">
                  <span className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold">
                    {isLimited ? '限定' : isWeapon ? '武器' : '常驻'}
                  </span>
                  <span>总抽数: {stats.total} 抽</span>
                </p>
              </div>
            </div>

            {currentPool.up_character && (
              <div className="text-right bg-zinc-50 dark:bg-zinc-800/50 p-1.5 border border-zinc-100 dark:border-zinc-700">
                <div className="text-[11px] text-zinc-400 uppercase font-mono mb-0.5">UP 角色</div>
                <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase">
                  {currentPool.up_character}
                </div>
              </div>
            )}
          </div>

          {isLimited && (
            <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-500 font-mono bg-zinc-50 dark:bg-zinc-900/50 p-2 border-l-2 border-endfield-yellow">
              <Clock size={10} className="text-endfield-yellow" />
              <span className="text-zinc-700 dark:text-zinc-300 font-bold uppercase">活动状态</span>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <span className="uppercase">
                剩余时间: {currentUpPool.remainingDays || 0}天 {currentUpPool.remainingHours || 0}时
              </span>
            </div>
          )}

          {hasDashboardShareData && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-3 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  分享主题
                </div>
                <div className="flex border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShareTheme('light')}
                    className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      shareTheme === 'light'
                        ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100'
                        : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    <Sun size={12} />
                    亮色
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareTheme('dark')}
                    className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      shareTheme === 'dark'
                        ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100'
                        : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    <Moon size={12} />
                    暗色
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void handleShareImage()}
                  className="flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-200"
                >
                  <Share2 size={14} />
                  {shareImageActionLabel}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopyShareText()}
                  className="flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-200"
                >
                  <Copy size={14} />
                  {shareTextActionLabel}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 总投入 Banner */}
      <div className="bg-zinc-900 text-white border-l-4 border-endfield-yellow p-4 flex items-center justify-between rounded-none shadow-md relative overflow-hidden group">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:10px_10px]" />
        
        <div className="relative z-10">
          <h3 className="text-[10px] text-endfield-yellow font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
             <Calculator size={10} /> 总投入资源
          </h3>
          <div className="text-4xl font-black font-mono flex items-baseline gap-2">
            {stats.total}
            <span className="text-xs font-bold text-zinc-500">抽</span>
          </div>
        </div>
        <div className="relative z-10 h-12 w-12 bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500">
          <Layers size={24} />
        </div>
      </div>

      <ResourceSummaryPanel
        title={resourceSummaryTitle}
        resources={stats.resourceSummary}
        variant={isWeapon ? 'weapon' : 'character'}
        compact={true}
        className="rounded-none"
      />

      {/* 保底进度（聚合模式下隐藏） */}
      {!isGroupMode && !hasMergedAccountView && (
      <div className="grid grid-cols-2 gap-3">
        {/* 6星保底 */}
        {(() => {
          const displayPity = displayPity6;
          return (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-none relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wide">6★ 保底 ({maxPity})</span>
                {currentProbabilityInfo?.hasSoftPity && currentProbabilityInfo?.isInSoftPity && (
                  <span className="text-[11px] px-1 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-mono font-bold animate-pulse">
                    概率提升 {(currentProbabilityInfo.probability * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-bold font-mono text-zinc-800 dark:text-zinc-100">
                  {Math.max(maxPity - displayPity, 0)}
                </span>
                <span className="text-[10px] text-zinc-400 uppercase">剩余</span>
              </div>
              <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 overflow-hidden w-full">
                <div
                  className={`h-full transition-all ${getProgressClass()}`}
                  style={{ width: `${(displayPity / maxPity) * 100}%` }}
                />
              </div>
               <div className="mt-1.5 flex justify-between text-[10px] text-zinc-500 font-mono">
                 <span>当前垫刀: {displayPity}{effectivePity?.isInherited && isLimited ? ' (跨池)' : ''}</span>
                 <span>上限: {maxPity}</span>
               </div>
            </div>
          );
        })()}

        {/* 5星保底 */}
        {(() => {
          const displayPity5 = isLimited ? effectivePity.pity5 : stats.currentPity5;
          return (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-none">
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wide mb-2">5★ 保底 (10)</div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-bold font-mono text-zinc-800 dark:text-zinc-100">
                  {Math.max(10 - displayPity5, 0)}
                </span>
                <span className="text-[10px] text-zinc-400 uppercase">剩余</span>
              </div>
              <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 overflow-hidden w-full">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${(displayPity5 / 10) * 100}%` }}
                />
              </div>
               <div className="mt-1.5 flex justify-between text-[10px] text-zinc-500 font-mono">
                 <span>当前垫刀: {displayPity5}{effectivePity?.isInherited && isLimited ? ' (跨池)' : ''}</span>
                 <span>上限: 10</span>
               </div>
            </div>
          );
        })()}
      </div>
      )}

      {!isGroupMode && hasMergedAccountView && (
        <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 p-3 text-xs text-zinc-500 dark:text-zinc-400 rounded-none shadow-sm">
          当前为多账号汇总视图。6★ / 5★ 当前保底、软保底概率提示仅在单账号上下文中有确定语义，因此这里已隐藏。
        </div>
      )}

      {/* 核心数据网格 */}
      <div className={`grid ${normalizedPoolType !== 'standard' ? 'grid-cols-4' : 'grid-cols-3'} gap-2`}>
        {normalizedPoolType !== 'standard' && (
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 text-center rounded-none group hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors">
            <div className="text-[11px] text-zinc-400 uppercase font-bold tracking-tight mb-1">{primarySixStarLabel}</div>
            <div className={`text-xl font-bold font-mono ${isLimited ? 'rainbow-text' : 'text-zinc-700 dark:text-zinc-300'}`}>
              {stats.counts[6]}
            </div>
          </div>
        )}
        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 text-center rounded-none group hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors">
          <div className="text-[11px] text-zinc-400 uppercase font-bold tracking-tight mb-1">{secondarySixStarLabel}</div>
          <div className="text-xl font-bold font-mono text-red-600 dark:text-red-400">{stats.counts['6_std']}</div>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 text-center rounded-none group hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors">
          <div className="text-[11px] text-zinc-400 uppercase font-bold tracking-tight mb-1">5★</div>
          <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">{stats.counts[5]}</div>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 text-center rounded-none group hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors">
          <div className="text-[11px] text-zinc-400 uppercase font-bold tracking-tight mb-1">4★</div>
          <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400">{stats.counts[4]}</div>
        </div>
      </div>

      {/* 图表：分布概览 + 出货分布 */}
      {stats.total > 0 && (
        <div className="space-y-3">
          {/* 饼图 - 分布概览 */}
          <MobileChartContainer title="分布概览" defaultExpanded={true} className="rounded-none">
            <div className="h-52 w-full pt-2">
              {stats.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <RainbowGradientDefs />
                    <Pie
                      data={stats.chartData}
                      cx="50%"
                      cy="45%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={2}
                      dataKey="displayValue"
                    >
                      {stats.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value, name, props) => [`${props.payload.value} (${(props.payload.value / stats.total * 100).toFixed(1)}%)`, name]}
                      contentStyle={{
                        backgroundColor: isDark ? '#18181b' : '#fff',
                        border: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`,
                        borderRadius: 0,
                        fontSize: 12,
                      }}
                      itemStyle={{ color: isDark ? '#e4e4e7' : '#27272a' }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconSize={8}
                      formatter={(value) => <span className="text-[11px] text-zinc-500 dark:text-zinc-400 ml-1">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-300 dark:text-zinc-700 text-sm">暂无数据</div>
              )}
            </div>
          </MobileChartContainer>

          {/* 柱状图 - 6星出货分布 */}
          {stats.pityStats.history.length > 0 && (
            <MobileChartContainer title="出货分布" defaultExpanded={true} className="rounded-none">
              <div className="h-48 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.pityStats.distribution} stackOffset="sign" margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <RainbowGradientDefs />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#27272a' : '#f4f4f5'} />
                    <XAxis dataKey="range" tick={{ fontSize: 10, fill: isDark ? '#71717a' : '#a1a1aa' }} interval={0} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: isDark ? '#71717a' : '#a1a1aa' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#18181b' : '#fff',
                        border: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`,
                        borderRadius: 0,
                        fontSize: 12,
                      }}
                      cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
                    />
                    <Bar dataKey="limited" stackId="a" fill={RARITY_CONFIG[6].color} name="限定" radius={[0, 0, 2, 2]} />
                    <Bar dataKey="standard" stackId="a" fill={RARITY_CONFIG['6_std'].color} name="常驻" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </MobileChartContainer>
          )}
        </div>
      )}

      {/* 不歪率和平均出货（限定/武器池） */}
      {(isLimited || isWeapon) && (
        <div className="grid grid-cols-1 gap-3">
          {/* 不歪率 */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-none">
            <div className="text-[10px] text-zinc-400 uppercase font-bold mb-2 flex justify-between">
              <span>不歪率</span>
              {isLimited && <span className="text-[11px] text-zinc-300">(免十不计)</span>}
            </div>
            <div className="text-2xl font-bold font-mono text-zinc-800 dark:text-zinc-100 mb-2">
              {stats.sixStarCount > 0 ? `${stats.winRate}%` : '-'}
            </div>
            <div className="h-1 bg-zinc-100 dark:bg-zinc-800 overflow-hidden w-full mb-2">
              <div
                className={`h-full ${isLimited ? 'rainbow-progress' : 'bg-blue-500'}`}
                style={{ width: `${parseFloat(stats.winRate) || 0}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-zinc-500 font-mono uppercase">
              <span>UP: {stats.counts[6]}</span>
              <span>歪: {stats.counts['6_std']}</span>
            </div>
          </div>
        </div>
      )}

      <AveragePullStatsPanel
        stats={stats}
        poolType={normalizedPoolType}
        isAllPoolsOverview={isAllPoolsOverview}
        compact={true}
        className="rounded-none"
      />

      {/* 特殊机制进度（聚合模式下隐藏） */}
      {!isGroupMode && (
      <MobileChartContainer title="特殊机制进度" defaultExpanded={true} className="rounded-none">
        <div className="space-y-3 pt-2">
          {/* 限定池特殊进度 */}
          {isLimited && (
            <>
              {/* 免费十连 */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border-l-2 border-blue-500 rounded-none">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">免费十连 (仅一次)</span>
                  <span className="text-xs font-mono text-zinc-500">
                    {hasReceivedFreeTen ? '已领取' : '0 / 1'}
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 overflow-hidden w-full">
                  <div
                    className={`h-full ${hasReceivedFreeTen ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: hasReceivedFreeTen ? '100%' : '0%' }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-zinc-400 font-mono">不计入保底次数</div>
              </div>

              {/* 120必出限定 */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border-l-2 border-green-500 rounded-none">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">必出限定 (120抽)</span>
                  <span className="text-xs font-mono text-zinc-500">
                    {checkLimitedInFirstN.firstLimitedIndex120 > 0 ? '已达成' : `${Math.min(checkLimitedInFirstN.validPullCount, 120)} / 120`}
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 overflow-hidden w-full">
                  <div
                    className={`h-full ${checkLimitedInFirstN.firstLimitedIndex120 > 0 ? 'bg-green-500' : 'rainbow-progress'}`}
                    style={{ width: checkLimitedInFirstN.firstLimitedIndex120 > 0 ? '100%' : `${Math.min((checkLimitedInFirstN.validPullCount / 120) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* 240赠送潜能 */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border-l-2 border-purple-500 rounded-none">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">赠送角色潜能 (每240抽)</span>
                  <span className="text-xs font-mono text-zinc-500">{stats.total % 240} / 240</span>
                </div>
                <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 overflow-hidden w-full">
                  <div className="h-full bg-purple-500" style={{ width: `${((stats.total % 240) / 240) * 100}%` }} />
                </div>
                {Math.floor(stats.total / 240) > 0 && (
                  <div className="mt-1 text-[10px] text-purple-600 dark:text-purple-400 font-bold font-mono">
                    已获得: {Math.floor(stats.total / 240)}
                  </div>
                )}
              </div>

              {/* 情报书 */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border-l-2 border-cyan-500 rounded-none">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                    <FileText size={12} /> 寻访情报书 (60抽)
                  </span>
                  <span className="text-xs font-mono text-zinc-500">
                    {stats.hasInfoBook ? '已达成' : `${Math.min(stats.total, 60)} / 60`}
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 overflow-hidden w-full">
                  <div
                    className={`h-full ${stats.hasInfoBook ? 'bg-green-500' : 'bg-cyan-500'}`}
                    style={{ width: stats.hasInfoBook ? '100%' : `${Math.min((stats.total / 60) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </>
          )}

          {/* 武器池特殊进度 */}
          {isWeapon && (
            <>
              {/* 80必出限定 */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border-l-2 border-slate-500 rounded-none">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">首轮限定必出 (80抽)</span>
                  <span className="text-xs font-mono text-zinc-500">
                    {checkLimitedInFirstN.firstLimitedIndex80 > 0 ? '已达成' : `${Math.min(stats.total, 80)} / 80`}
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 overflow-hidden w-full">
                  <div
                    className={`h-full ${checkLimitedInFirstN.firstLimitedIndex80 > 0 ? 'bg-green-500' : 'bg-slate-500'}`}
                    style={{ width: checkLimitedInFirstN.firstLimitedIndex80 > 0 ? '100%' : `${Math.min((stats.total / 80) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* 武器赠送 */}
              {weaponGifts && (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border-l-2 border-red-500 rounded-none">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2 uppercase">
                      下一档奖励
                      <span className={`px-1 py-0.5 text-[11px] font-bold text-white ${weaponGifts.nextGiftType === 'limited' ? 'rainbow-bg' : 'bg-red-500'}`}>
                        {weaponGifts.nextGiftType === 'limited' ? '限定' : '常驻'}
                      </span>
                    </span>
                    <span className="text-xs font-mono text-zinc-500">{stats.total} / {weaponGifts.nextGift}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 overflow-hidden w-full">
                    <div
                      className={`h-full ${weaponGifts.nextGiftType === 'limited' ? 'rainbow-progress' : 'bg-red-500'}`}
                      style={{ width: `${Math.min((stats.total / weaponGifts.nextGift) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="mt-1 flex gap-3 text-[11px] text-zinc-500 font-mono uppercase">
                    <span>已获得:</span>
                    <span className="text-red-600 dark:text-red-400 font-medium">{weaponGifts.standardCount} 常驻</span>
                    <span className="text-cyan-600 dark:text-cyan-400 font-medium">{weaponGifts.limitedCount} 限定</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 常驻池特殊进度 */}
          {isStandard && (
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border-l-2 border-amber-500 rounded-none">
                <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">首次赠送自选 (300抽)</span>
                <span className="text-xs font-mono text-zinc-500">{Math.min(stats.total, 300)} / 300</span>
              </div>
              <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 overflow-hidden w-full">
                <div
                  className={`h-full ${stats.total >= 300 ? 'bg-green-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min((stats.total / 300) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </MobileChartContainer>
      )}

      {/* 角色出货统计 */}
      <MobileChartContainer
        title={`角色出货统计 (${characterStats.length})`}
        defaultExpanded={characterStats.length > 0 || normalizedPoolHistory.length > 0}
        className="rounded-none"
        headerRight={(characterStats.length > 0 || normalizedPoolHistory.length > 0) ? (
          <div className="flex border border-zinc-200 dark:border-zinc-700 rounded-sm overflow-hidden">
            <button
              onClick={() => setCharViewMode('card')}
              className={`flex items-center gap-1 px-3 py-2 text-[11px] font-medium transition-colors ${
                charViewMode === 'card'
                  ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                  : 'text-zinc-400 dark:text-zinc-500'
              }`}
            >
              <LayoutGrid size={14} />
              卡片
            </button>
            <button
              onClick={() => setCharViewMode('waterfall')}
              className={`flex items-center gap-1 px-3 py-2 text-[11px] font-medium transition-colors ${
                charViewMode === 'waterfall'
                  ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                  : 'text-zinc-400 dark:text-zinc-500'
              }`}
            >
              <BarChart3 size={14} />
              时间线
            </button>
          </div>
        ) : null}
      >
        {characterStats.length > 0 ? (
          charViewMode === 'waterfall' ? (
            <div className="pt-2">
              <PoolTimelinePanel
                currentPool={currentPool}
                currentPoolHistory={normalizedPoolHistory}
                groupedHistory={groupedHistory}
                selectedPools={selectedPools}
                isGroupMode={isGroupMode}
                isAllPoolsOverview={isAllPoolsOverview}
                effectivePity={effectivePity}
                analysisPity={analysisPity}
                overviewAnalysisPityMap={overviewAnalysisPityMap}
                overviewPoolFilter="all"
                hasMergedAccountView={hasMergedAccountView}
                embedded={true}
              />
            </div>
          ) : (
          <div className="space-y-2 pt-2">
            {characterStats.map((char) => {
              const isSixStar = char.rarity === 6;
              const isLimitedChar = isSixStar && !char.isStandard;
              const isStandardChar = isSixStar && char.isStandard;
              const avatarUrl = getCharacterAvatar(char.name);

              // 生成出货抽数描述
              const pullInfoParts = char.pullIndices.map((idx, i) => {
                const pity = char.pities[i];
                const isInfoBook = char.infoBookFlags?.[i] === true;
                if (idx === 'free' || pity === 'free') return { type: 'free', text: '免费' };
                if (pity) return { type: isInfoBook ? 'infoBook' : 'normal', text: `${pity}(#${idx})` };
                return { type: isInfoBook ? 'infoBook' : 'normal', text: `#${idx}` };
              });

              return (
                <div
                  key={char.name}
                  className={`relative flex items-center gap-3 p-2 border transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                    isLimitedChar
                      ? 'bg-zinc-50 dark:bg-zinc-900/50 border-orange-200 dark:border-orange-900/30'
                      : isStandardChar
                        ? 'bg-white dark:bg-zinc-900 border-red-100 dark:border-red-900/20'
                        : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800'
                  }`}
                >
                  {/* 左侧颜色条 */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    isLimitedChar ? 'rainbow-bg' : isStandardChar ? 'bg-red-500' : 'bg-amber-400'
                  }`} />

                  {/* 头像 */}
                  <div className={`ml-2 w-10 h-10 rounded-none flex items-center justify-center shrink-0 overflow-hidden border ${
                    isLimitedChar
                      ? 'border-orange-300 dark:border-orange-700 bg-gradient-to-br from-orange-400 to-pink-500 text-white'
                      : isStandardChar
                        ? 'border-red-200 dark:border-red-800 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300'
                        : 'border-amber-200 dark:border-amber-800 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300'
                  }`}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={char.name} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <User size={18} />
                    )}
                  </div>

                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold truncate uppercase tracking-tight ${
                        isLimitedChar ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-700 dark:text-zinc-400'
                      }`}>
                        {char.name}
                      </span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: char.rarity }).map((_, i) => (
                          <Star key={i} size={8} className={`${isSixStar ? 'text-orange-400' : 'text-amber-400'} fill-current`} />
                        ))}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 truncate">
                      {pullInfoParts.map((part, i) => (
                        <span key={i}>
                          {part.type === 'free' ? (
                            <span className="text-blue-500 font-bold">{part.text}</span>
                          ) : part.type === 'infoBook' ? (
                            <span className="text-amber-600 dark:text-amber-400 font-bold">情报书 {part.text}</span>
                          ) : (
                            <span>{part.text}</span>
                          )}
                          {i < pullInfoParts.length - 1 && ', '}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 数量 */}
                  <div className="flex items-center gap-1">
                    {char.infoBookCount > 0 && (
                      <div className="text-[10px] font-mono font-bold px-1.5 py-0.5 border bg-amber-50 dark:bg-amber-900/20 border-amber-200 text-amber-700 dark:text-amber-300">
                        书×{char.infoBookCount}
                      </div>
                    )}
                    {char.freeCount > 0 && (
                      <div className="text-[10px] font-mono font-bold px-1.5 py-0.5 border bg-blue-50 dark:bg-blue-900/20 border-blue-200 text-blue-600 dark:text-blue-400">
                        免×{char.freeCount}
                      </div>
                    )}
                    <div className={`text-xs font-mono font-bold px-1.5 py-0.5 border ${
                      isLimitedChar ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 text-orange-600 dark:text-orange-400' :
                      isStandardChar ? 'bg-red-50 dark:bg-red-900/10 border-red-200 text-red-600 dark:text-red-400' :
                      'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 text-zinc-500'
                    }`}>
                      x{char.count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )
        ) : normalizedPoolHistory.length > 0 && charViewMode === 'waterfall' ? (
          <div className="pt-2">
            <PoolTimelinePanel
              currentPool={currentPool}
              currentPoolHistory={normalizedPoolHistory}
              groupedHistory={groupedHistory}
              selectedPools={selectedPools}
              isGroupMode={isGroupMode}
              isAllPoolsOverview={isAllPoolsOverview}
              effectivePity={effectivePity}
              analysisPity={analysisPity}
              overviewAnalysisPityMap={overviewAnalysisPityMap}
              overviewPoolFilter="all"
              hasMergedAccountView={hasMergedAccountView}
              embedded={true}
            />
          </div>
        ) : (
          <p className="text-xs text-zinc-400 font-mono text-center py-4 uppercase tracking-widest">暂无5星及以上记录</p>
        )}
      </MobileChartContainer>

      {/* 底部留白 */}
      <div className="h-4" />

      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default MobileDashboardView;
