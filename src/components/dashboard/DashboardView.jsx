import React from 'react';
import {
  Calculator,
  Star,
  FileText,
  Sparkles,
  User,
  TrendingUp,
  Layers,
  PieChart as PieChartIcon,
  Clock,
  Upload,
  BarChart3,
  LayoutGrid,
  Share2,
  Download,
  Copy,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { RARITY_CONFIG } from '../../constants';
import { DistributionAreaChart, RainbowGradientDefs } from '../charts';
import { useDashboardViewState } from '../../hooks';
import { useTheme } from '../../contexts/ThemeContext';
import PoolSelector from '../pool/PoolSelector';
import PoolAnalysisCard from './PoolAnalysisCard';
import PoolTimelinePanel from './PoolTimelinePanel';
import AveragePullStatsPanel from './AveragePullStatsPanel';
import DashboardShareCard from './DashboardShareCard';
import ShareActionStatus from '../share/ShareActionStatus';
import { characterCache } from '../../utils/characterUtils';
import ResourceSummaryPanel from '../resources/ResourceSummaryPanel';
import { buildCharacterStats } from '../../utils/dashboardCharacterStats';
import { normalizePoolGroupType } from '../../utils/poolSelectorDisplay';
import { buildOverviewPoolAnalysisPityMap, getPoolAnalysisPityState } from '../../utils/poolAnalysisPity';
import { buildDashboardTimelineSections } from '../../utils/dashboardTimelineSections';
import { buildDashboardOverviewSplitStats } from '../../utils/dashboardOverviewSplitStats';
import {
  buildDashboardShareCardFileName,
  buildDashboardSharePayload,
  buildDashboardShareText,
} from '../../utils/dashboardShare';
import {
  buildShareFile,
  canCopyImageToClipboard,
  canNativeShareFile,
  copyImageBlobToClipboard,
  downloadShareCard,
  renderShareCardToBlob,
  shareImageFile,
} from '../../utils/simulatorShare';
import { copyToClipboard } from '../../utils/simulatorStorage';
import useShareActionFeedback from '../../hooks/useShareActionFeedback';
import { useI18n } from '../../i18n/index.js';
import { localizeEntityName, localizeHistoryItemName, localizePoolName } from '../../utils/gameDataI18n.js';

const ALL_OVERVIEW_FILTER_OPTIONS = [
  { id: 'all', label: '全部卡池' },
  { id: 'limited', label: '限定池' },
  { id: 'weapon', label: '武器池' },
  { id: 'standard', label: '常驻池' },
];
const DASHBOARD_SHARE_THEME_KEY = 'dashboard_share_theme';

function getDistributionVariant(poolType) {
  if (poolType === 'weapon') {
    return 'weapon';
  }

  if (poolType === 'standard') {
    return 'standard';
  }

  return 'character';
}

function getOverviewPoolBucket(pool) {
  const groupType = normalizePoolGroupType(pool);
  if (groupType === 'limited') {
    return 'limited';
  }

  if (groupType === 'weapon_limited' || groupType === 'weapon_standard') {
    return 'weapon';
  }

  return 'standard';
}

/**
 * 仪表盘小统计卡片 (Updated Style)
 */
const StatBox = ({ title, value, subValue, colorClass, icon: Icon, isAnimated }) => (
  <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 relative overflow-hidden group hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
    {isAnimated && (
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
    )}

    <div className="flex justify-between items-start mb-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 font-bold">{title}</div>
      {Icon && <Icon size={14} className="text-slate-400 dark:text-zinc-600" />}
    </div>

    <div className="flex items-baseline gap-2">
      <div className={`text-2xl font-bold font-mono ${colorClass || 'text-slate-800 dark:text-zinc-100'}`}>{value}</div>
    </div>

    {subValue && <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 font-mono">{subValue}</div>}
  </div>
);

const OverviewBanner = ({ title, value, accentClass = 'text-slate-800 dark:text-zinc-100', unitLabel = 'PULLS' }) => (
  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 flex items-center justify-between shadow-sm relative overflow-hidden group">
    <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-zinc-50 dark:from-zinc-800 to-transparent" />
    <div className="relative z-10">
      <h3 className="text-xs text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">{title}</h3>
      <div className={`text-4xl font-black font-mono flex items-baseline gap-2 ${accentClass}`}>
        {value}
        <span className="text-lg font-medium text-slate-400 dark:text-zinc-600">{unitLabel}</span>
      </div>
    </div>
    <div className="relative z-10 h-12 w-12 bg-zinc-100 dark:bg-zinc-800 rounded-sm flex items-center justify-center text-slate-400 dark:text-zinc-500">
      <Layers size={24} />
    </div>
  </div>
);

/**
 * 仪表盘视图组件
 */
const DashboardView = ({ showToast }) => {
  const { isDark } = useTheme();
  const { t, formatNumber, isEnglish, locale } = useI18n();
  const [allOverviewPoolFilter, setAllOverviewPoolFilter] = React.useState('all');
  const [showShareMenu, setShowShareMenu] = React.useState(false);
  const [shareTheme, setShareTheme] = React.useState(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }

    return (
      localStorage.getItem(DASHBOARD_SHARE_THEME_KEY) ||
      (document.documentElement.classList.contains('dark') ? 'dark' : 'light')
    );
  });
  const shareCardRef = React.useRef(null);
  const shareMenuRef = React.useRef(null);
  const {
    feedback: shareActionFeedback,
    isBusy: isShareActionBusy,
    beginAction: beginShareAction,
    updateAction: updateShareAction,
    finishAction: finishShareAction,
    failAction: failShareAction,
    resetFeedback: resetShareActionFeedback,
  } = useShareActionFeedback();
  const {
    user,
    charViewMode,
    setCharViewMode,
    currentPool,
    currentPoolHistory,
    allLimitedHistory,
    selectedPools,
    normalizedPoolType,
    hasPoolData,
    isGroupMode,
    isAllPoolsOverview,
    hasMergedAccountView,
    normalizedPoolHistory,
    crossPoolPityMap,
    stats,
    effectivePity,
    groupedHistory,
    characterStats,
    checkLimitedInFirstN,
    hasReceivedFreeTen,
    dashboardResourceSummary,
    resourceSummaryVariant,
  } = useDashboardViewState();
  const allOverviewFilterOptions = React.useMemo(
    () => ALL_OVERVIEW_FILTER_OPTIONS.map((option) => ({
      ...option,
      label: t(`dashboard.overview.filter.${option.id}`),
    })),
    [t]
  );
  const pullUnitLabel = isEnglish ? 'PULLS' : t('dashboard.unit.pull');
  const characterPoolLabel = isEnglish ? 'Character Banner' : '角色池';
  const weaponPoolLabel = isEnglish ? 'Weapon Banner' : '武器池';
  const standardSixLabel = isEnglish ? 'Standard 6★' : '常驻6★';
  const crossBannerSummary = isEnglish ? 'Cross-banner summary' : '跨卡池汇总';
  const offrateShort = isEnglish ? 'Off-rate' : '歪';
  const localizedCurrentPoolName = React.useMemo(() => localizePoolName(currentPool, { locale }), [currentPool, locale]);
  const totalPullBannerTitle = isGroupMode
    ? (isEnglish ? `${localizedCurrentPoolName || ''} Total Pulls` : `${localizedCurrentPoolName || ''}总投入`)
    : (isEnglish ? 'Current Banner Total Pulls' : '当前卡池总投入');
  const primarySixStarLabel = isAllPoolsOverview
    ? t('dashboard.overview.targetSixStar')
    : normalizedPoolType === 'weapon'
      ? t('dashboard.overview.upSixStar')
      : t('dashboard.average.limitedSix');
  const secondarySixStarLabel = isAllPoolsOverview
    ? t('dashboard.overview.offrateSixStar')
    : standardSixLabel;
  const resourceSummaryTitle = isGroupMode
    ? t('dashboard.resources.groupTitle', { name: localizedCurrentPoolName || '' })
    : t('dashboard.resources.title');
  const formatPercentValue = React.useCallback(
    (value) =>
      formatNumber(value, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [formatNumber]
  );
  const localizeChartData = React.useCallback((items = [], primaryLabel, secondaryLabel) => (
    items.map((item) => {
      if (item?.name === '6星(限定)' || item?.name === '6星(目标)') {
        return { ...item, name: primaryLabel };
      }

      if (item?.name === '6星(常驻)' || item?.name === '6星(常驻/偏移)') {
        return { ...item, name: secondaryLabel };
      }

      if (item?.name === '5星') {
        return { ...item, name: '5★' };
      }

      if (item?.name === '4星') {
        return { ...item, name: '4★' };
      }

      return item;
    })
  ), []);

  const allOverviewFilterPoolIds = React.useMemo(() => {
    if (!isAllPoolsOverview || allOverviewPoolFilter === 'all') {
      return null;
    }

    return new Set(
      selectedPools.filter((pool) => getOverviewPoolBucket(pool) === allOverviewPoolFilter).map((pool) => pool.id)
    );
  }, [allOverviewPoolFilter, isAllPoolsOverview, selectedPools]);

  const visibleCharacterStats = React.useMemo(() => {
    if (!isAllPoolsOverview || !allOverviewFilterPoolIds) {
      return characterStats;
    }

    const filteredHistory = normalizedPoolHistory.filter((item) => {
      const poolId = item?.poolId || item?.pool_id || null;
      return poolId && allOverviewFilterPoolIds.has(poolId);
    });

    return buildCharacterStats({
      history: filteredHistory,
      isLimitedPool: normalizedPoolType === 'limited',
      crossPoolPityMap,
    });
  }, [
    allOverviewFilterPoolIds,
    characterStats,
    crossPoolPityMap,
    isAllPoolsOverview,
    normalizedPoolHistory,
    normalizedPoolType,
  ]);

  const visibleTotalCharacterCount = React.useMemo(
    () => visibleCharacterStats.reduce((sum, char) => sum + char.count, 0),
    [visibleCharacterStats]
  );
  const analysisPity = React.useMemo(
    () => getPoolAnalysisPityState(currentPool, stats, effectivePity),
    [currentPool, effectivePity, stats]
  );
  const overviewAnalysisPityMap = React.useMemo(() => {
    if (!isGroupMode) {
      return null;
    }

    return buildOverviewPoolAnalysisPityMap({
      pools: selectedPools,
      history: normalizedPoolHistory,
      allLimitedHistory,
    });
  }, [allLimitedHistory, isGroupMode, normalizedPoolHistory, selectedPools]);
  const timelineSections = React.useMemo(
    () =>
      buildDashboardTimelineSections({
        currentPool,
        currentPoolHistory: normalizedPoolHistory,
        groupedHistory,
        selectedPools,
        isGroupMode,
        isAllPoolsOverview,
        effectivePity,
        analysisPity,
        overviewAnalysisPityMap,
        overviewPoolFilter: allOverviewPoolFilter,
        hasMergedAccountView,
        locale,
      }),
    [
      allOverviewPoolFilter,
      analysisPity,
      currentPool,
      effectivePity,
      groupedHistory,
      hasMergedAccountView,
      isAllPoolsOverview,
      isGroupMode,
      locale,
      normalizedPoolHistory,
      overviewAnalysisPityMap,
      selectedPools,
    ]
  );
  const splitOverviewStats = React.useMemo(() => {
    if (!isAllPoolsOverview || allOverviewPoolFilter !== 'all') {
      return null;
    }

    return buildDashboardOverviewSplitStats({
      history: normalizedPoolHistory,
      selectedPools,
    });
  }, [allOverviewPoolFilter, isAllPoolsOverview, normalizedPoolHistory, selectedPools]);
  const dashboardSharePayload = React.useMemo(
    () =>
      buildDashboardSharePayload({
        currentPool,
        normalizedPoolType,
        isGroupMode,
        isAllPoolsOverview,
        hasMergedAccountView,
        overviewPoolFilter: allOverviewPoolFilter,
        stats,
        analysisPity,
        sections: timelineSections,
        overviewSplitStats: splitOverviewStats,
      }),
    [
      allOverviewPoolFilter,
      analysisPity,
      currentPool,
      hasMergedAccountView,
      isAllPoolsOverview,
      isGroupMode,
      normalizedPoolType,
      splitOverviewStats,
      stats,
      timelineSections,
    ]
  );
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
        files: [new File(['share'], 'share.txt', { type: 'text/plain' })],
      });
    } catch {
      return false;
    }
  }, []);
  const supportsClipboardImageCopy = React.useMemo(() => canCopyImageToClipboard(), []);

  React.useEffect(() => {
    if (!showShareMenu) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (!shareMenuRef.current?.contains(event.target)) {
        setShowShareMenu(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showShareMenu]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(DASHBOARD_SHARE_THEME_KEY, shareTheme);
  }, [shareTheme]);

  const activeShareAction = shareActionFeedback.action;
  const shareTriggerLabel =
    shareActionFeedback.phase === 'running'
      ? activeShareAction === 'download'
        ? t('dashboard.share.trigger.downloading')
        : activeShareAction === 'copy-image' || activeShareAction === 'copy-text'
          ? t('dashboard.share.trigger.copying')
          : t('dashboard.share.trigger.sharing')
      : t('dashboard.share.trigger.idle');

  const handleCopyShareText = React.useCallback(async () => {
    if (!hasDashboardShareData) {
      showToast?.(t('dashboard.share.noData'), 'warning');
      return;
    }

    if (!beginShareAction('copy-text', t('dashboard.share.progress.copyText'))) {
      return;
    }

    try {
      const shareText = buildDashboardShareText(dashboardSharePayload);
      const success = await copyToClipboard(shareText);
      const message = success ? t('dashboard.share.copyTextSuccess') : t('dashboard.share.copyTextFailure');
      if (success) {
        finishShareAction('copy-text', message);
      } else {
        failShareAction('copy-text', message);
      }
      showToast?.(message, success ? 'success' : 'error');
    } catch {
      const message = t('dashboard.share.copyTextFailure');
      failShareAction('copy-text', message);
      showToast?.(message, 'error');
    }
  }, [beginShareAction, dashboardSharePayload, failShareAction, finishShareAction, hasDashboardShareData, showToast, t]);

  const waitForShareCard = React.useCallback(async () => {
    if (shareCardRef.current) return shareCardRef.current;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return shareCardRef.current;
  }, []);

  const handleShareImage = React.useCallback(async () => {
    if (!hasDashboardShareData) {
      showToast?.(t('dashboard.share.noData'), 'warning');
      return;
    }

    if (!beginShareAction('share', t('dashboard.share.progress.generateImage'))) {
      return;
    }

    const cardNode = await waitForShareCard();
    if (!cardNode) {
      const message = t('dashboard.share.notReady');
      failShareAction('share', message);
      showToast?.(message, 'error');
      return;
    }

    try {
      const blob = await renderShareCardToBlob(cardNode, {
        backgroundColor: shareTheme === 'dark' ? '#09090b' : '#f4f4f5',
      });
      const fileName = buildDashboardShareCardFileName(dashboardSharePayload);
      const file = buildShareFile(blob, fileName);

      if (file && supportsNativeImageShare && canNativeShareFile(file)) {
        updateShareAction('share', t('dashboard.share.progress.openSystemShare'));
        await shareImageFile(file, {
          title: t('share.dashboard.scope', { scope: dashboardSharePayload.scopeLabel }),
          text: buildDashboardShareText(dashboardSharePayload),
        });
        const message = t('dashboard.share.systemOpened');
        finishShareAction('share', message);
        showToast?.(message, 'success');
        return;
      }

      updateShareAction('share', t('dashboard.share.progress.downloadImage'));
      const downloaded = downloadShareCard(blob, fileName);
      const message = downloaded ? t('dashboard.share.systemUnavailableDownloaded') : t('dashboard.share.downloadFailure');
      if (downloaded) {
        finishShareAction('share', message);
      } else {
        failShareAction('share', message);
      }
      showToast?.(message, downloaded ? 'success' : 'error');
    } catch (error) {
      if (error?.name === 'AbortError') {
        resetShareActionFeedback();
        return;
      }

      console.error('[DashboardView] share card generation failed:', error);
      const message = t('dashboard.share.generateFailure');
      failShareAction('share', message);
      showToast?.(message, 'error');
    }
  }, [
    beginShareAction,
    dashboardSharePayload,
    failShareAction,
    finishShareAction,
    hasDashboardShareData,
    resetShareActionFeedback,
    shareTheme,
    showToast,
    supportsNativeImageShare,
    t,
    updateShareAction,
    waitForShareCard,
  ]);

  const handleDownloadShareImage = React.useCallback(async () => {
    if (!hasDashboardShareData) {
      showToast?.(t('dashboard.share.noData'), 'warning');
      return;
    }

    if (!beginShareAction('download', t('dashboard.share.progress.generateImage'))) {
      return;
    }

    const cardNode = await waitForShareCard();
    if (!cardNode) {
      const message = t('dashboard.share.notReady');
      failShareAction('download', message);
      showToast?.(message, 'error');
      return;
    }

    try {
      const blob = await renderShareCardToBlob(cardNode, {
        backgroundColor: shareTheme === 'dark' ? '#09090b' : '#f4f4f5',
      });
      updateShareAction('download', t('dashboard.share.progress.saveImage'));
      const fileName = buildDashboardShareCardFileName(dashboardSharePayload);
      const downloaded = downloadShareCard(blob, fileName);
      const message = downloaded ? t('dashboard.share.downloadSuccess') : t('dashboard.share.downloadFailure');
      if (downloaded) {
        finishShareAction('download', message);
      } else {
        failShareAction('download', message);
      }
      showToast?.(message, downloaded ? 'success' : 'error');
    } catch {
      const message = t('dashboard.share.generateFailure');
      failShareAction('download', message);
      showToast?.(message, 'error');
    }
  }, [
    beginShareAction,
    dashboardSharePayload,
    failShareAction,
    finishShareAction,
    hasDashboardShareData,
    shareTheme,
    showToast,
    t,
    updateShareAction,
    waitForShareCard,
  ]);

  const handleCopyShareImage = React.useCallback(async () => {
    if (!hasDashboardShareData) {
      showToast?.(t('dashboard.share.noData'), 'warning');
      return;
    }

    if (!beginShareAction('copy-image', t('dashboard.share.progress.generateCopyImage'))) {
      return;
    }

    const cardNode = await waitForShareCard();
    if (!cardNode) {
      const message = t('dashboard.share.notReady');
      failShareAction('copy-image', message);
      showToast?.(message, 'error');
      return;
    }

    if (!supportsClipboardImageCopy) {
      const message = t('dashboard.share.browserCopyUnsupported');
      failShareAction('copy-image', message);
      showToast?.(message, 'warning');
      return;
    }

    try {
      const blob = await renderShareCardToBlob(cardNode, {
        backgroundColor: shareTheme === 'dark' ? '#09090b' : '#f4f4f5',
      });
      updateShareAction('copy-image', t('dashboard.share.progress.writeClipboard'));
      const copied = await copyImageBlobToClipboard(blob);
      const message = copied ? t('dashboard.share.copyImageSuccess') : t('dashboard.share.copyImageFailure');
      if (copied) {
        finishShareAction('copy-image', message);
      } else {
        failShareAction('copy-image', message);
      }
      showToast?.(message, copied ? 'success' : 'error');
    } catch {
      const message = t('dashboard.share.copyImageFailure');
      failShareAction('copy-image', message);
      showToast?.(message, 'error');
    }
  }, [
    beginShareAction,
    failShareAction,
    finishShareAction,
    hasDashboardShareData,
    shareTheme,
    showToast,
    supportsClipboardImageCopy,
    t,
    updateShareAction,
    waitForShareCard,
  ]);

  const tooltipStyle = {
    borderRadius: '0px',
    border: isDark ? '1px solid #3f3f46' : '1px solid #e4e4e7',
    boxShadow: isDark ? '0 4px 6px -1px rgb(0 0 0 / 0.3)' : '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    fontSize: '12px',
    backgroundColor: isDark ? '#18181b' : '#ffffff',
    color: isDark ? '#e4e4e7' : '#27272a',
  };

  // 如果用户没有任何卡池数据，只显示卡池选择器（导入提示）
  if (!hasPoolData) {
    return (
      <div className="space-y-6">
        {/* 卡池选择器 - 显示导入提示 */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
          <PoolSelector />
        </div>

        {/* 欢迎提示 */}
        {user && (
          <div className="bg-gradient-to-br from-zinc-50 to-slate-50 dark:from-zinc-900 dark:to-zinc-950 border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload size={28} className="text-zinc-400 dark:text-zinc-500" />
            </div>
            <h3 className="font-bold text-lg text-slate-700 dark:text-zinc-300 mb-2">{t('dashboard.empty.startRecordTitle')}</h3>
            <p className="text-sm text-slate-500 dark:text-zinc-500 max-w-md mx-auto">
              {t('dashboard.empty.startRecordBody')}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
          <DashboardShareCard
            ref={shareCardRef}
            payload={dashboardSharePayload}
            sections={timelineSections}
            theme={shareTheme}
          />
        </div>
      )}

      {/* 卡池选择器 & 顶部状态栏 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <PoolSelector />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 左列：保底机制分析 (聚合模式下隐藏) */}
        {!isGroupMode && (
          <div className="md:col-span-1 space-y-6">
            <PoolAnalysisCard
              currentPool={currentPool}
              stats={stats}
              effectivePity={effectivePity}
              checkLimitedInFirstN={checkLimitedInFirstN}
              hasReceivedFreeTen={hasReceivedFreeTen}
              hasMergedAccountView={hasMergedAccountView}
            />
          </div>
        )}

        {/* 右列：详细数据与图表（聚合模式下全宽） */}
        <div className={`${isGroupMode ? 'md:col-span-3' : 'md:col-span-2'} space-y-6`}>
          {splitOverviewStats ? (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <OverviewBanner
                  title={t('dashboard.overview.characterTotal')}
                  value={formatNumber(splitOverviewStats.character.total)}
                  accentClass="rainbow-text"
                  unitLabel={pullUnitLabel}
                />
                <OverviewBanner
                  title={t('dashboard.overview.weaponTotal')}
                  value={formatNumber(splitOverviewStats.weapon.total)}
                  accentClass="text-amber-600 dark:text-amber-400"
                  unitLabel={pullUnitLabel}
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
                    {t('dashboard.overview.characterStats')}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <StatBox
                      title={t('dashboard.overview.targetSixStar')}
                      value={splitOverviewStats.character.counts[6]}
                      subValue={
                        splitOverviewStats.character.totalSixStar > 0
                          ? t('dashboard.overview.allSixRate', {
                            percent: formatPercentValue((splitOverviewStats.character.counts[6] / splitOverviewStats.character.totalSixStar) * 100),
                          })
                          : t('dashboard.empty.noSixStarData')
                      }
                      colorClass="rainbow-text"
                      icon={Star}
                      isAnimated
                    />
                    <StatBox
                      title={t('dashboard.overview.offrateSixStar')}
                      value={splitOverviewStats.character.counts['6_std']}
                      subValue={t('dashboard.overview.characterSummary')}
                      colorClass="text-red-600 dark:text-red-400"
                      icon={Star}
                    />
                    <StatBox
                      title={t('dashboard.overview.fiveStarTotal')}
                      value={splitOverviewStats.character.counts[5]}
                      subValue={t('dashboard.overview.ratio', {
                        percent: formatPercentValue(
                          splitOverviewStats.character.total > 0
                            ? (splitOverviewStats.character.counts[5] / splitOverviewStats.character.total) * 100
                            : 0
                        ),
                      })}
                      colorClass="text-amber-600 dark:text-amber-400"
                      icon={Star}
                    />
                    <StatBox
                      title={t('dashboard.overview.fourStarTotal')}
                      value={splitOverviewStats.character.counts[4]}
                      subValue={t('dashboard.overview.ratio', {
                        percent: formatPercentValue(
                          splitOverviewStats.character.total > 0
                            ? (splitOverviewStats.character.counts[4] / splitOverviewStats.character.total) * 100
                            : 0
                        ),
                      })}
                      colorClass="text-purple-600 dark:text-purple-400"
                      icon={Star}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StatBox
                      title={t('dashboard.overview.targetSixStarRate')}
                      value={`${splitOverviewStats.character.winRate}%`}
                      subValue={`${splitOverviewStats.character.counts[6] || 0}/${splitOverviewStats.character.totalSixStar || 0}`}
                      colorClass="text-green-600 dark:text-green-400"
                      icon={TrendingUp}
                    />
                    <StatBox
                      title={t('dashboard.overview.allSixStar')}
                      value={splitOverviewStats.character.totalSixStar}
                      subValue={t('dashboard.pool.totalPulls', { count: splitOverviewStats.character.total })}
                      colorClass="text-slate-700 dark:text-zinc-200"
                      icon={Star}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
                    {t('dashboard.overview.weaponStats')}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <StatBox
                      title={t('dashboard.overview.upSixStar')}
                      value={splitOverviewStats.weapon.counts[6]}
                      subValue={
                        splitOverviewStats.weapon.totalSixStar > 0
                          ? t('dashboard.overview.allSixRate', {
                            percent: formatPercentValue((splitOverviewStats.weapon.counts[6] / splitOverviewStats.weapon.totalSixStar) * 100),
                          })
                          : t('dashboard.empty.noSixStarData')
                      }
                      colorClass="text-amber-600 dark:text-amber-400"
                      icon={Star}
                    />
                    <StatBox
                      title={t('dashboard.overview.offrateSixStar')}
                      value={splitOverviewStats.weapon.counts['6_std']}
                      subValue={t('dashboard.overview.weaponSummary')}
                      colorClass="text-red-600 dark:text-red-400"
                      icon={Star}
                    />
                    <StatBox
                      title={t('dashboard.overview.fiveStarTotal')}
                      value={splitOverviewStats.weapon.counts[5]}
                      subValue={t('dashboard.overview.ratio', {
                        percent: formatPercentValue(
                          splitOverviewStats.weapon.total > 0
                            ? (splitOverviewStats.weapon.counts[5] / splitOverviewStats.weapon.total) * 100
                            : 0
                        ),
                      })}
                      colorClass="text-amber-600 dark:text-amber-400"
                      icon={Star}
                    />
                    <StatBox
                      title={t('dashboard.overview.fourStarTotal')}
                      value={splitOverviewStats.weapon.counts[4]}
                      subValue={t('dashboard.overview.ratio', {
                        percent: formatPercentValue(
                          splitOverviewStats.weapon.total > 0
                            ? (splitOverviewStats.weapon.counts[4] / splitOverviewStats.weapon.total) * 100
                            : 0
                        ),
                      })}
                      colorClass="text-purple-600 dark:text-purple-400"
                      icon={Star}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StatBox
                      title={t('dashboard.overview.upSixStarRate')}
                      value={`${splitOverviewStats.weapon.winRate}%`}
                      subValue={`${splitOverviewStats.weapon.counts[6] || 0}/${splitOverviewStats.weapon.totalSixStar || 0}`}
                      colorClass="text-green-600 dark:text-green-400"
                      icon={TrendingUp}
                    />
                    <StatBox
                      title={t('dashboard.overview.allSixStar')}
                      value={splitOverviewStats.weapon.totalSixStar}
                      subValue={t('dashboard.pool.totalPulls', { count: splitOverviewStats.weapon.total })}
                      colorClass="text-slate-700 dark:text-zinc-200"
                      icon={Star}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <AveragePullStatsPanel
                  stats={splitOverviewStats.character}
                  poolType="limited"
                  isAllPoolsOverview={true}
                />
                <AveragePullStatsPanel stats={splitOverviewStats.weapon} poolType="weapon" isAllPoolsOverview={true} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ResourceSummaryPanel
                  title={t('dashboard.resources.groupTitle', { name: characterPoolLabel })}
                  resources={splitOverviewStats.character.resourceSummary}
                  variant="character"
                  stacked={true}
                  className="bg-white dark:bg-zinc-900 shadow-sm"
                />
                <ResourceSummaryPanel
                  title={t('dashboard.resources.groupTitle', { name: weaponPoolLabel })}
                  resources={splitOverviewStats.weapon.resourceSummary}
                  variant="weapon"
                  stacked={true}
                  className="bg-white dark:bg-zinc-900 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {[
                  {
                    key: 'character',
                    title: characterPoolLabel,
                    stats: splitOverviewStats.character,
                    primaryLabel: t('dashboard.overview.targetSixStar'),
                  },
                  {
                    key: 'weapon',
                    title: weaponPoolLabel,
                    stats: splitOverviewStats.weapon,
                    primaryLabel: t('dashboard.overview.upSixStar'),
                  },
                ].map((group) => (
                  <div
                    key={`pie-${group.key}`}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                        <PieChartIcon size={16} />
                        {t('dashboard.chart.distributionGroup', { name: group.title })}
                      </h3>
                    </div>
                    <div className="h-64 w-full">
                      {group.stats.total === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-300 dark:text-zinc-700 text-sm">
                          {t('dashboard.empty.noChartData')}
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <RainbowGradientDefs />
                            <Pie
                              data={localizeChartData(group.stats.chartData, group.primaryLabel, t('dashboard.overview.offrateSixStar'))}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={2}
                              dataKey="displayValue"
                            >
                              {localizeChartData(group.stats.chartData, group.primaryLabel, t('dashboard.overview.offrateSixStar')).map((entry, index) => (
                                <Cell key={`cell-${group.key}-${index}`} fill={entry.color} stroke="none" />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              formatter={(value, name, props) => [
                                `${props.payload.value} (${((props.payload.value / group.stats.total) * 100).toFixed(1)}%)`,
                                name,
                              ]}
                              contentStyle={tooltipStyle}
                              itemStyle={{ color: isDark ? '#e4e4e7' : '#27272a' }}
                            />
                            <Legend
                              verticalAlign="bottom"
                              iconSize={8}
                              formatter={(value) => (
                                <span className="text-xs text-slate-500 dark:text-zinc-400 ml-1">{value}</span>
                              )}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {[
                  { key: 'character', title: characterPoolLabel, stats: splitOverviewStats.character },
                  { key: 'weapon', title: weaponPoolLabel, stats: splitOverviewStats.weapon },
                ].map((group) => (
                  <div
                    key={`bar-${group.key}`}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                        <TrendingUp size={16} />
                        {t('dashboard.chart.trendGroup', { name: group.title })}
                      </h3>
                    </div>
                    <div className="h-64 w-full">
                      {group.stats.pityStats.history.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-300 dark:text-zinc-700 text-sm">
                          {t('dashboard.empty.noSixStarHistory')}
                        </div>
                      ) : (
                        <DistributionAreaChart
                          data={group.stats.pityStats.distribution}
                          isDark={isDark}
                          tooltipStyle={tooltipStyle}
                          variant={group.key === 'weapon' ? 'weapon' : 'character'}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* 总投入 Banner */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 flex items-center justify-between shadow-sm relative overflow-hidden group">
                <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-zinc-50 dark:from-zinc-800 to-transparent"></div>
                <div className="relative z-10">
                  <h3 className="text-xs text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">
                    {totalPullBannerTitle}
                  </h3>
                  <div className="text-4xl font-black font-mono text-slate-800 dark:text-zinc-100 flex items-baseline gap-2">
                    {formatNumber(stats.total)}
                    <span className="text-lg font-medium text-slate-400 dark:text-zinc-600">{pullUnitLabel}</span>
                  </div>
                </div>
                <div className="relative z-10 h-12 w-12 bg-zinc-100 dark:bg-zinc-800 rounded-sm flex items-center justify-center text-slate-400 dark:text-zinc-500 group-hover:bg-slate-200 dark:group-hover:bg-zinc-700 transition-colors">
                  <Layers size={24} />
                </div>
              </div>

              {/* 核心数据网格 */}
              <div
                className={`grid grid-cols-2 ${normalizedPoolType !== 'standard' ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}
              >
                {normalizedPoolType !== 'standard' && (
                  <StatBox
                    title={primarySixStarLabel}
                    value={stats.counts[6]}
                    subValue={(() => {
                      if (isAllPoolsOverview) {
                        return stats.totalSixStar > 0
                          ? t('dashboard.overview.allSixRate', {
                            percent: formatPercentValue((stats.counts[6] / stats.totalSixStar) * 100),
                          })
                          : t('dashboard.empty.noSixStarData');
                      }
                      if (isGroupMode) {
                        return `${t('dashboard.analysis.winRate')} ${stats.winRate}%`;
                      }
                      let bonusCount = 0;
                      if (normalizedPoolType === 'limited') {
                        bonusCount = Math.floor(stats.total / 240);
                      } else if (normalizedPoolType === 'weapon') {
                        if (stats.total >= 180) bonusCount = 1 + Math.floor((stats.total - 180) / 160);
                      }
                      return bonusCount > 0
                        ? (isEnglish ? `Includes ${bonusCount} bonus` : `含赠送 ${bonusCount}`)
                        : t('dashboard.overview.ratio', { percent: formatPercentValue(stats.winRate) });
                    })()}
                    colorClass={normalizedPoolType === 'limited' ? 'rainbow-text' : 'text-slate-700 dark:text-zinc-300'}
                    icon={Star}
                    isAnimated={normalizedPoolType === 'limited' && !isAllPoolsOverview}
                  />
                )}
                <StatBox
                  title={secondarySixStarLabel}
                  value={stats.counts['6_std']}
                  subValue={
                    isAllPoolsOverview
                      ? crossBannerSummary
                      : normalizedPoolType === 'standard' && stats.total >= 300
                        ? (isEnglish ? 'Includes 1 bonus' : '含赠送 1')
                        : offrateShort
                  }
                  colorClass="text-red-600 dark:text-red-400"
                  icon={Star}
                />
                <StatBox
                  title={t('dashboard.overview.fiveStarTotal')}
                  value={stats.counts[5]}
                  subValue={t('dashboard.overview.ratio', {
                    percent: formatPercentValue(stats.total > 0 ? (stats.counts[5] / stats.total) * 100 : 0),
                  })}
                  colorClass="text-amber-600 dark:text-amber-400"
                  icon={Star}
                />
                <StatBox
                  title={t('dashboard.overview.fourStarTotal')}
                  value={stats.counts[4]}
                  subValue={t('dashboard.overview.ratio', {
                    percent: formatPercentValue(stats.total > 0 ? (stats.counts[4] / stats.total) * 100 : 0),
                  })}
                  colorClass="text-purple-600 dark:text-purple-400"
                  icon={Star}
                />
              </div>

              {isGroupMode && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <StatBox
                    title={isAllPoolsOverview ? t('dashboard.overview.targetSixStarRate') : t('dashboard.analysis.winRate')}
                    value={`${stats.winRate}%`}
                    subValue={`${stats.upSixStarCount || 0}/${stats.sixStarCount || 0}`}
                    colorClass="text-green-600 dark:text-green-400"
                    icon={TrendingUp}
                  />
                  <StatBox
                    title={primarySixStarLabel}
                    value={stats.counts[6] ?? 0}
                    subValue={isEnglish ? `Standard 6★ ${stats.counts['6_std'] ?? 0}` : `常驻6星 ${stats.counts['6_std'] ?? 0}`}
                    colorClass={normalizedPoolType === 'weapon' ? 'text-slate-700 dark:text-zinc-300' : 'rainbow-text'}
                    icon={Star}
                    isAnimated={normalizedPoolType !== 'weapon' && !isAllPoolsOverview}
                  />
                </div>
              )}

              {isGroupMode && (
                <AveragePullStatsPanel
                  stats={stats}
                  poolType={normalizedPoolType}
                  isAllPoolsOverview={isAllPoolsOverview}
                />
              )}

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <ResourceSummaryPanel
                  title={resourceSummaryTitle}
                  resources={dashboardResourceSummary}
                  variant={resourceSummaryVariant}
                  stacked={true}
                  className="bg-white dark:bg-zinc-900 shadow-sm"
                />
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                      <PieChartIcon size={16} />
                      {t('dashboard.chart.distribution')}
                    </h3>
                  </div>
                  <div className="h-64 w-full">
                    {stats.total === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-300 dark:text-zinc-700 text-sm">
                        {t('dashboard.empty.noChartData')}
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <RainbowGradientDefs />
                          <Pie
                            data={localizeChartData(stats.chartData, primarySixStarLabel, secondarySixStarLabel)}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="displayValue"
                          >
                            {localizeChartData(stats.chartData, primarySixStarLabel, secondarySixStarLabel).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            formatter={(value, name, props) => [
                              `${props.payload.value} (${((props.payload.value / stats.total) * 100).toFixed(1)}%)`,
                              name,
                            ]}
                            contentStyle={tooltipStyle}
                            itemStyle={{ color: isDark ? '#e4e4e7' : '#27272a' }}
                          />
                          <Legend
                            verticalAlign="bottom"
                            iconSize={8}
                            formatter={(value) => (
                              <span className="text-xs text-slate-500 dark:text-zinc-400 ml-1">{value}</span>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                      <TrendingUp size={16} />
                      {t('dashboard.chart.trend')}
                    </h3>
                  </div>
                  <div className="h-64 w-full">
                    {stats.pityStats.history.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-300 dark:text-zinc-700 text-sm">
                        {t('dashboard.empty.noSixStarHistory')}
                      </div>
                    ) : (
                      <DistributionAreaChart
                        data={stats.pityStats.distribution}
                        isDark={isDark}
                        tooltipStyle={tooltipStyle}
                        variant={getDistributionVariant(normalizedPoolType)}
                      />
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 角色出货列表 (Updated Style) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <User size={18} className="text-slate-400 dark:text-zinc-500" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                {t('dashboard.chart.characterStats')}
              </h3>
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                {/* 视图切换按钮组 */}
                {(characterStats.length > 0 || currentPoolHistory.length > 0) && (
                  <div className="flex border border-zinc-200 dark:border-zinc-700 rounded-sm overflow-hidden">
                    <button
                      onClick={() => setCharViewMode('card')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors ${
                        charViewMode === 'card'
                          ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                          : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <LayoutGrid size={14} />
                      {t('dashboard.view.card')}
                    </button>
                    <button
                      onClick={() => setCharViewMode('waterfall')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors ${
                        charViewMode === 'waterfall'
                          ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                          : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <BarChart3 size={14} />
                      {t('dashboard.view.timeline')}
                    </button>
                  </div>
                )}
                {hasDashboardShareData && (
                  <div className="relative" ref={shareMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowShareMenu((visible) => !visible)}
                      disabled={isShareActionBusy}
                      className={`group px-3.5 py-1.5 text-xs font-bold tracking-wide transition-all rounded-sm flex items-center gap-2 bg-endfield-yellow text-black shadow-sm ${
                        isShareActionBusy
                          ? 'cursor-not-allowed opacity-70'
                          : 'hover:bg-yellow-400 hover:shadow-[0_0_16px_rgba(255,250,0,0.35)] active:scale-95'
                      }`}
                    >
                      {isShareActionBusy ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Share2 size={14} className="group-hover:-rotate-12 transition-transform" />
                      )}
                      {shareTriggerLabel}
                      <ChevronDown size={12} className={`transition-transform ${showShareMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showShareMenu && (
                      <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none shadow-lg z-50">
                        <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                            {t('dashboard.share.theme')}
                          </div>
                          <div className="mt-2 flex border border-zinc-200 dark:border-zinc-700 rounded-sm overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setShareTheme('light')}
                              disabled={isShareActionBusy}
                              className={`flex-1 px-2 py-1 text-[11px] font-medium transition-colors ${
                                shareTheme === 'light'
                                  ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100'
                                  : 'text-zinc-400 dark:text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                              } ${isShareActionBusy ? 'cursor-not-allowed opacity-60' : ''}`}
                            >
                              {t('settings.theme.light')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setShareTheme('dark')}
                              disabled={isShareActionBusy}
                              className={`flex-1 px-2 py-1 text-[11px] font-medium transition-colors ${
                                shareTheme === 'dark'
                                  ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100'
                                  : 'text-zinc-400 dark:text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                              } ${isShareActionBusy ? 'cursor-not-allowed opacity-60' : ''}`}
                            >
                              {t('settings.theme.dark')}
                            </button>
                          </div>
                        </div>
                        {supportsNativeImageShare && (
                          <button
                            type="button"
                            disabled={isShareActionBusy}
                            onClick={() => {
                              setShowShareMenu(false);
                              void handleShareImage();
                            }}
                            className={`w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 transition-colors flex items-center gap-2 ${
                              isShareActionBusy
                                ? 'cursor-not-allowed opacity-60'
                                : 'hover:bg-slate-50 dark:hover:bg-zinc-800'
                            }`}
                          >
                            <Share2 size={14} />
                            <span>{t('dashboard.share.systemImage')}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isShareActionBusy}
                          onClick={() => {
                            setShowShareMenu(false);
                            void handleDownloadShareImage();
                          }}
                          className={`w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 transition-colors flex items-center gap-2 ${
                            supportsNativeImageShare ? 'border-t border-zinc-100 dark:border-zinc-800' : ''
                          } ${isShareActionBusy ? 'cursor-not-allowed opacity-60' : 'hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                        >
                          <Download size={14} />
                          <span>{t('dashboard.share.downloadImage')}</span>
                        </button>
                        {supportsClipboardImageCopy && (
                          <button
                            type="button"
                            disabled={isShareActionBusy}
                            onClick={() => {
                              setShowShareMenu(false);
                              void handleCopyShareImage();
                            }}
                            className={`w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 transition-colors border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2 ${
                              isShareActionBusy
                                ? 'cursor-not-allowed opacity-60'
                                : 'hover:bg-slate-50 dark:hover:bg-zinc-800'
                            }`}
                          >
                            <Copy size={14} />
                            <span>{t('dashboard.share.copyImage')}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isShareActionBusy}
                          onClick={() => {
                            setShowShareMenu(false);
                            void handleCopyShareText();
                          }}
                          className={`w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 transition-colors border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2 ${
                            isShareActionBusy
                              ? 'cursor-not-allowed opacity-60'
                              : 'hover:bg-slate-50 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <Copy size={14} />
                          <span>{t('dashboard.share.copyText')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {shareActionFeedback.phase !== 'idle' && (
                  <ShareActionStatus
                    feedback={shareActionFeedback}
                    compact
                    className="w-full sm:w-auto sm:max-w-[280px]"
                  />
                )}
                {isAllPoolsOverview && (
                  <div className="flex border border-zinc-200 dark:border-zinc-700 rounded-sm overflow-hidden">
                    {allOverviewFilterOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setAllOverviewPoolFilter(option.id)}
                        className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                          allOverviewPoolFilter === option.id
                            ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                            : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
                {visibleTotalCharacterCount > 0 && (
                  <span className="text-xs text-slate-400 dark:text-zinc-500 font-mono">
                    {t('dashboard.totalCharacters', { count: visibleTotalCharacterCount })}
                  </span>
                )}
              </div>
            </div>

            {charViewMode === 'waterfall' ? (
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
                overviewPoolFilter={allOverviewPoolFilter}
                hasMergedAccountView={hasMergedAccountView}
                embedded={true}
              />
            ) : visibleCharacterStats.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-zinc-600 text-sm">{t('dashboard.empty.noHighRarityRecords')}</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {visibleCharacterStats.map((char) => {
                  const isSixStar = char.rarity === 6;
                  const isLimitedChar = isSixStar && !char.isStandard;
                  const isStandardChar = isSixStar && char.isStandard;
                  const localizedCharacterName = localizeEntityName(char.name, {
                    locale,
                    type: normalizedPoolType === 'weapon' ? 'weapon' : 'character'
                  });

                  // 生成出货抽数描述
                  // 格式：68抽(#120), 24抽(#300) - 保底计数(总抽数位置)
                  const pullInfoParts = char.pullIndices.map((idx, i) => {
                    const pity = char.pities[i];
                    const isFree = idx === 'free' || pity === 'free';
                    const isInfoBook = char.infoBookFlags?.[i] === true;

                    if (isFree) {
                      return { type: 'free', text: isEnglish ? 'Free' : '免费' };
                    }

                    if (pity) {
                      // 显示 保底计数(#总抽数位置)
                      return {
                        type: isInfoBook ? 'infoBook' : 'normal',
                        text: isEnglish ? `${pity} pulls (#${idx})` : `${pity}抽(#${idx})`,
                      };
                    } else {
                      // 没有保底数据时只显示总抽数位置
                      return { type: isInfoBook ? 'infoBook' : 'normal', text: `#${idx}` };
                    }
                  });

                  return (
                    <div
                      key={char.name}
                      className={`
                        relative flex flex-col justify-between p-3 border transition-all h-full
                        hover:translate-y-[-1px] hover:shadow-sm
                        ${
                          isLimitedChar
                            ? 'bg-zinc-50 dark:bg-zinc-900/50 border-orange-200 dark:border-orange-900/30'
                            : isStandardChar
                              ? 'bg-white dark:bg-zinc-900 border-red-100 dark:border-red-900/20'
                              : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800'
                        }
                      `}
                    >
                      {/* 左侧颜色条 */}
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-1 ${
                          isLimitedChar ? 'rainbow-bg' : isStandardChar ? 'bg-red-500' : 'bg-amber-400'
                        }`}
                      ></div>

                      {/* 角色头像和信息 */}
                      <div className="ml-2 mb-2 flex items-start gap-2">
                        {/* 角色头像 */}
                        <div
                          className={`
                          w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden
                          ${
                            isLimitedChar
                              ? 'bg-gradient-to-br from-orange-400 to-pink-500 text-white'
                              : isStandardChar
                                ? 'bg-red-200 dark:bg-red-800 text-red-600 dark:text-red-300'
                                : 'bg-amber-200 dark:bg-amber-800 text-amber-600 dark:text-amber-300'
                          }
                        `}
                        >
                          {(() => {
                            const charData = characterCache.searchByName(char.name, false);
                            const avatarUrl = charData?.avatar_url;
                            if (avatarUrl) {
                              return (
                                <img
                                  src={avatarUrl}
                                  alt={localizedCharacterName}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              );
                            }
                            return null;
                          })()}
                          <div
                            className={`w-full h-full items-center justify-center ${
                              characterCache.searchByName(char.name, false)?.avatar_url ? 'hidden' : 'flex'
                            }`}
                          >
                            <User size={18} />
                          </div>
                        </div>

                        {/* 角色名和星星 */}
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-sm font-bold truncate ${
                              isLimitedChar ? 'text-slate-800 dark:text-zinc-200' : 'text-slate-700 dark:text-zinc-400'
                            }`}
                          >
                            {localizedCharacterName}
                          </div>
                          <div className="flex gap-0.5 mt-0.5">
                            {Array.from({ length: char.rarity }).map((_, i) => (
                              <Star
                                key={i}
                                size={8}
                                className={`${isSixStar ? 'text-orange-400' : 'text-amber-400'} fill-current`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* 底部信息栏：抽数详情 + 数量 */}
                      <div className="ml-2 mt-auto">
                        {/* 抽数详情 - 允许换行，但每项作为整体 */}
                        <div className="text-xs font-mono leading-relaxed mb-1">
                          {pullInfoParts.map((part, i) => (
                            <span key={i}>
                              <span className="whitespace-nowrap">
                                {part.type === 'free' ? (
                                  <span className="text-blue-500 font-bold">{part.text}</span>
                                ) : part.type === 'infoBook' ? (
                                  <span className="text-amber-600 dark:text-amber-400 font-bold">
                                    {isEnglish ? `Intel ${part.text}` : `情报书 ${part.text}`}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 dark:text-zinc-600">{part.text}</span>
                                )}
                              </span>
                              {i < pullInfoParts.length - 1 && (
                                <span className="text-slate-400 dark:text-zinc-600">, </span>
                              )}
                            </span>
                          ))}
                        </div>
                        {/* 数量标签 - 右下角 */}
                        <div className="flex justify-end">
                          <div className="flex items-center gap-1.5">
                            {char.infoBookCount > 0 && (
                              <div className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                                {isEnglish ? `Intel×${char.infoBookCount}` : `情报书×${char.infoBookCount}`}
                              </div>
                            )}
                            {char.freeCount > 0 && (
                              <div className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                {isEnglish ? `Free×${char.freeCount}` : `免费×${char.freeCount}`}
                              </div>
                            )}
                            <div
                              className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                                isLimitedChar
                                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                                  : isStandardChar
                                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500'
                              }`}
                            >
                              x{char.count}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
