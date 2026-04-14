import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Bell, Calendar, ChevronRight, Clock3, Globe, Info, Layers, Radio, Shield, Sparkles, Star, Swords, Users, BarChart3, Map, BarChart2 } from 'lucide-react';
import AnnouncementContent from '../../components/home/AnnouncementContent';
import GameAnnouncementFeed from '../../components/home/GameAnnouncementFeed';
import { APP_VERSION } from '../../constants/appMeta';
import { ACCOUNT_RECOVERY_QQ_GROUP, ENGLISH_COMMUNITY_DISCORD_URL } from '../../constants/community';
import { useAppStore, useAuthStore } from '../../stores';
import usePoolStore from '../../stores/usePoolStore';
import useSiteConfigStore, { useJsonConfig } from '../../stores/useSiteConfigStore';
import { useI18n } from '../../i18n/index.js';
import { getLimitedPoolCountdownState, getLimitedPoolSchedule } from '../../utils/poolTimeUtils';
import SpringPreviewCard from '../../components/home/SpringPreviewCard';
import { localizeEntityName, localizePoolName } from '../../utils/gameDataI18n.js';

const DEFAULT_LINKS = [
  { id: 'yituliu-calculator', title: '一图流攒抽计算器', url: 'https://ef.yituliu.cn/tools/gacha-calculator', icon: 'bar-chart-2' }, 
  { id: 'opendfield-map', title: '地图（国际服可用）', url: 'https://opendfieldmap.cn/', icon: 'map' },
  { id: 'zmdmap', title: '终末地地图（笋干）', url: 'https://www.zmdmap.com/', icon: 'map' },
  { id: 'endgacha', title: '同样优秀的抽卡记录分析（还有舟本体的）', url: 'https://endgacha.kwer.top/', icon: 'bar-chart-2' },       
  { id: 'story-search', title: '剧情检索 (AI精准查询与梗概生成)', url: 'https://endfield.prts.chat/', icon: 'globe' },
  { id: 'pull-planner', title: '抽卡规划器', url: 'https://endfield.203.io/', icon: 'bar-chart-2' },
];

const DEFAULT_ROADMAP = [
  { id: 'sim-inherit', status: 'completed' },
  { id: 'puzzle-captcha', status: 'completed' },
  { id: 'global-support', status: 'completed' },
  { id: 'currency-calc', status: 'completed' },
  { id: 'sim-currency', status: 'completed' },
  { id: 'share', status: 'completed' },
  { id: 'i18n', status: 'in_progress' },
  { id: 'a11y', status: 'planned' },
  { id: 'virtual-scroll', status: 'planned' },
];

const ROADMAP_STATUS_OVERRIDES = {
  i18n: 'in_progress',
};

const FRIENDLY_LINK_ID_BY_HOST = {
  'ef.yituliu.cn': 'yituliu-calculator',
  'opendfieldmap.cn': 'opendfield-map',
  'www.zmdmap.com': 'zmdmap',
  'zmdmap.com': 'zmdmap',
  'endgacha.kwer.top': 'endgacha',
  'endfield.prts.chat': 'story-search',
  'endfield.203.io': 'pull-planner',
};

function resolveFriendlyLinkId(item, fallbackIndex = 0) {
  if (item?.id) {
    return item.id;
  }

  try {
    const host = new URL(item?.url || '').hostname;
    if (FRIENDLY_LINK_ID_BY_HOST[host]) {
      return FRIENDLY_LINK_ID_BY_HOST[host];
    }
  } catch {
    // Fall back to default list when URL parsing fails.
  }

  return DEFAULT_LINKS[fallbackIndex]?.id || null;
}

function normalizeRoadmapStatus(status) {
  const normalized = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/gu, '_');

  if (['completed', 'done', 'shipped', 'finished'].includes(normalized)) {
    return 'completed';
  }

  if (['in_progress', 'inprogress', 'progress', 'ongoing', 'active', 'working'].includes(normalized)) {
    return 'in_progress';
  }

  return 'planned';
}

function BackButton({ label, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="touch-feedback inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 transition-colors">
      <ArrowLeft size={16} />
    </button>
  );
}

export default function MobileHomeHubView() {
  const { t, isEnglish, locale, formatDateTime } = useI18n();
  const user = useAuthStore((state) => state.user);
  const announcements = useAppStore((state) => state.announcements);
  const gameAnnouncements = useAppStore((state) => state.gameAnnouncements);
  const pools = usePoolStore((state) => state.pools);
  const getConfig = useSiteConfigStore((state) => state.getConfig);
  const links = useJsonConfig('home_friendly_links', DEFAULT_LINKS);
  const roadmap = useJsonConfig('home_roadmap_items', DEFAULT_ROADMAP);
  const [now, setNow] = useState(new Date());
  const [activeView, setActiveView] = useState('home');
  const heroSlogan = (() => {
    const fallback = '记录抽卡历程，查看卡池分析、统计汇总与模拟器数据。';
    const raw = getConfig('home_hero_slogan', fallback);
    return raw === fallback ? t('home.heroSubtitle') : raw;
  })();
  const qqGroup = getConfig('qq_group_number', ACCOUNT_RECOVERY_QQ_GROUP);
  const communityLabel = ENGLISH_COMMUNITY_DISCORD_URL.replace(/^https?:\/\//u, '');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const schedule = useMemo(() => getLimitedPoolSchedule(Array.isArray(pools) ? pools : []), [pools]);
  const latestAnnouncement = announcements?.[0] || null;
  
  const translatedLinks = useMemo(() => (Array.isArray(links) ? links : []).map((item, index) => ({
    ...item,
    id: resolveFriendlyLinkId(item, index),
    icon: DEFAULT_LINKS[index]?.icon || 'globe',
    title: resolveFriendlyLinkId(item, index) ? t(`home.friendlyLinks.item.${resolveFriendlyLinkId(item, index)}.title`, {}, item.title) : item.title,
    hostname: (() => {
      try {
        return new URL(item.url).hostname;
      } catch {
        return item.url;
      }
    })(),
  })), [links, locale, t]);

  const translatedRoadmap = useMemo(() => (Array.isArray(roadmap) ? roadmap : []).map((item) => ({
    ...item,
    status: ROADMAP_STATUS_OVERRIDES[item.id] || normalizeRoadmapStatus(item.status),
    title: item.id ? t(`home.roadmap.item.${item.id}.title`, {}, item.title) : item.title,
    description: item.id ? t(`home.roadmap.item.${item.id}.description`, {}, item.description) : item.description,
  })), [locale, roadmap, t]);

  const roadmapCounts = useMemo(() => ({
    completed: translatedRoadmap.filter((item) => item.status === 'completed').length,
    inProgress: translatedRoadmap.filter((item) => item.status === 'in_progress').length,
    planned: translatedRoadmap.filter((item) => item.status === 'planned').length,
  }), [translatedRoadmap]);

  const countdown = useMemo(() => {
    return getLimitedPoolCountdownState(schedule, now);
  }, [now, schedule]);
  const localizedCountdownName = useMemo(() => (
    localizeEntityName(countdown?.name, {
      locale,
      type: countdown?.poolData?.type === 'weapon' ? 'weapon' : 'character'
    }) || countdown?.name || t('common.unknown')
  ), [countdown?.name, countdown?.poolData?.type, locale, t]);

    const rotationPreview = useMemo(() => {
    const sorted = [...schedule].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    if (!sorted.length) return [];
    let index = sorted.findIndex((pool) => now >= new Date(pool.startDate) && now < new Date(pool.endDate));
    if (index === -1) index = sorted.findIndex((pool) => now < new Date(pool.startDate));
    if (index === -1) index = Math.max(sorted.length - 1, 0);
    return sorted.slice(Math.max(0, index - 1), index + 3).map((pool) => {
      const active = now >= new Date(pool.startDate) && now < new Date(pool.endDate);
      const ended = now >= new Date(pool.endDate);
      const localizedCharacterName = localizeEntityName(pool.name, {
        locale,
        type: pool?.poolData?.type === 'weapon' ? 'weapon' : 'character'
      });
      const localizedPoolName = localizePoolName(pool.poolData || pool, { locale });

      return {
        ...pool,
        displayName: localizedCharacterName
          || localizedPoolName
          || pool.name,
        active,
        ended,
        label: active ? (isEnglish ? 'Live' : '进行中') : ended ? (isEnglish ? 'Ended' : '已结束') : (isEnglish ? 'Queued' : '待开启'),
      };
    });
  }, [isEnglish, locale, now, schedule]);

  if (activeView === 'announcements') {
    return (
      <div className="flex-1 h-full overflow-y-auto overflow-x-hidden px-4 pb-20 slide-up-enter scroll-smooth w-full">
         <div className="py-4 flex items-center gap-3 sticky top-0 bg-white/90 dark:bg-ef-dark/90 backdrop-blur-md z-20 border-b border-zinc-200 dark:border-zinc-800/50 -mx-4 px-4 mb-4">
            <BackButton onClick={() => setActiveView('home')} />
            <h1 className="text-xl font-black tracking-widest text-slate-900 dark:text-white">{t('home.siteAnnouncement')}</h1>
         </div>
         {latestAnnouncement ? (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-gradient-to-r from-amber-50 dark:from-amber-950/20 to-transparent p-4 mb-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="px-2 py-0.5 rounded-sm bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 text-[10px] font-bold">{t('home.siteAnnouncement')}</span>
              {latestAnnouncement.version ? <span className="px-2 py-0.5 rounded-sm bg-zinc-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-[10px] font-bold font-mono">v{latestAnnouncement.version}</span> : null}
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white mb-2">{latestAnnouncement.title}</div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-500 mb-4">{formatDateTime(latestAnnouncement.updated_at || latestAnnouncement.created_at, { includeYear: false }, t('common.timeUnknown'))}</div>
            <div className="pt-4 border-t border-amber-200 dark:border-amber-800/30 text-sm text-slate-700 dark:text-zinc-300 prose prose-invert max-w-none">
              <AnnouncementContent content={latestAnnouncement.content} />
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-400 dark:text-zinc-500 text-center py-10">{t('announcement.empty')}</div>
        )}
        <div className="rounded-xl border border-orange-200 dark:border-orange-800/30 bg-gradient-to-r from-orange-50 dark:from-orange-950/20 to-transparent p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-0.5 rounded-sm bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 text-[10px] font-bold">{t('home.gameAnnouncement')}</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-500">{t('home.fromOfficialSite')}</span>
          </div>
          <div className="border-t border-orange-200 dark:border-orange-800/30 pt-4">
             <GameAnnouncementFeed announcements={gameAnnouncements} maxItems={12} />
          </div>
        </div>
      </div>
    );
  }

  if (activeView === 'mechanics') {
    return (
      <div className="flex-1 h-full overflow-y-auto overflow-x-hidden px-4 pb-20 slide-up-enter scroll-smooth w-full">
         <div className="py-4 flex items-center gap-3 sticky top-0 bg-white/90 dark:bg-ef-dark/90 backdrop-blur-md z-20 border-b border-zinc-200 dark:border-zinc-800/50 -mx-4 px-4 mb-4">
            <BackButton onClick={() => setActiveView('home')} />
            <h1 className="text-xl font-black tracking-widest text-slate-900 dark:text-white">{isEnglish ? 'Mechanics' : '卡池机制'}</h1>
         </div>
         {/* Simple display for mechanics */}
         <div className="text-sm text-slate-500 dark:text-zinc-400 p-4 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg text-center">
            [Mechanics view ported from demo]
         </div>
      </div>
    );
  }

  if (activeView === 'roadmap') {
     return (
      <div className="flex-1 h-full overflow-y-auto overflow-x-hidden px-4 pb-20 slide-up-enter scroll-smooth w-full">
         <div className="py-4 flex items-center gap-3 sticky top-0 bg-white/90 dark:bg-ef-dark/90 backdrop-blur-md z-20 border-b border-zinc-200 dark:border-zinc-800/50 -mx-4 px-4 mb-4">
            <BackButton onClick={() => setActiveView('home')} />
            <h1 className="text-xl font-black tracking-widest text-slate-900 dark:text-white">{isEnglish ? 'Roadmap' : '开发路线图'}</h1>
         </div>
         {/* Simple display for roadmap */}
         <div className="text-sm text-slate-500 dark:text-zinc-400 p-4 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg text-center">
            [Roadmap view ported from demo]
         </div>
      </div>
     )
  }

  return (
    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden px-4 pb-20 slide-up-enter scroll-smooth w-full">
      {/* Header */}
      <div className="py-6 flex justify-between items-center sticky top-0 bg-white/90 dark:bg-ef-dark/90 backdrop-blur-md z-20 border-b border-zinc-200 dark:border-zinc-800/50 -mx-4 px-4 mb-4">
          <h1 className="text-2xl font-black tracking-widest text-slate-900 dark:text-white">{isEnglish ? 'Endfield Analyzer' : t('app.brand')}</h1>
          <button onClick={() => setActiveView('announcements')} className="w-9 h-9 rounded-full bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200 dark:border-white/5 shadow-sm flex items-center justify-center text-slate-700 dark:text-zinc-300 hover:text-amber-600 dark:text-ef-yellow transition-colors">
              <Bell size={16} />
              {latestAnnouncement && <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>}
          </button>
      </div>

      {/* Spring Preview Card */}
      <div className="mb-6 mx-[-0.5rem]">
          <SpringPreviewCard />
      </div>

      {/* Hero Banner */}
      <div className="rounded-xl p-5 mb-4 border-l-4 border-amber-500 dark:border-ef-yellow bg-gradient-to-r from-zinc-100 dark:from-zinc-800 to-white dark:to-zinc-950 relative overflow-hidden shadow-lg">
          <div className="relative z-10">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                  <BarChart3 size={20} className="text-amber-600 dark:text-ef-yellow" />
                  {isEnglish ? 'Endfield Gacha Analyzer' : t('app.brand')}
              </h2>
              <p className="text-[11px] text-slate-600 dark:text-zinc-400 mb-3 leading-relaxed">{heroSlogan}</p>
              <p className="text-[10px] text-blue-700 dark:text-blue-300 flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded inline-flex"><ArrowUpRight size={10} /> {user ? t('home.mobile.loggedIn') : t('home.loginHint')}</p>
          </div>
          <Star size={120} className="absolute -right-6 -bottom-6 text-slate-900 dark:text-white opacity-[0.03]" />
      </div>

      {/* Security & Community */}
      <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/30 p-3 flex gap-3">
              <div className="text-green-500 shrink-0"><Shield size={16}/></div>
              <div>
                  <h3 className="text-[10px] font-bold text-green-700 dark:text-green-400 mb-1">{t('home.securityTitle')}</h3>
                  <p className="text-[8px] text-green-600/80 leading-tight">{t('home.securityCopy1')}</p>
              </div>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 p-3 flex gap-3">
              <div className="text-amber-600 dark:text-ef-yellow shrink-0"><Users size={16}/></div>
              <div className="min-w-0">
                  <h3 className="text-[10px] font-bold text-slate-900 dark:text-white mb-1 truncate">{t('home.communityTitle')}</h3>
                  {isEnglish ? (
                    <a href={ENGLISH_COMMUNITY_DISCORD_URL} target="_blank" rel="noopener noreferrer" className="mt-1 block rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-black px-1 py-0.5 text-center font-mono text-[10px] text-amber-600 dark:text-ef-yellow shadow-inner truncate">{communityLabel}</a>
                  ) : (
                    <div className="mt-1 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-black px-1 py-0.5 text-center font-mono text-[10px] text-amber-600 dark:text-ef-yellow shadow-inner truncate">{qqGroup}</div>
                  )}
              </div>
          </div>
      </div>

      {/* Announcements */}
      <div className="mb-6 space-y-2">
          <div onClick={() => setActiveView('announcements')} className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-gradient-to-r from-amber-100 dark:from-amber-950/40 to-transparent flex items-center justify-between p-3 cursor-pointer">
              <div className="flex items-center gap-2 w-full pr-2">
                  <div className="relative">
                      <Bell size={16} className="text-amber-500 shrink-0" />
                      {latestAnnouncement && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>}
                  </div>
                  <span className="text-[9px] bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100 px-1 py-0.5 rounded font-bold shrink-0">{t('home.siteAnnouncement')}</span>
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-100 truncate flex-1">{latestAnnouncement?.title || t('announcement.empty')}</span>
              </div>
              <ChevronRight size={14} className="text-amber-500/50 shrink-0" />
          </div>
          <div onClick={() => setActiveView('announcements')} className="rounded-xl border border-orange-200 dark:border-orange-800/30 bg-gradient-to-r from-orange-100 dark:from-orange-950/20 to-transparent flex items-center justify-between p-3 cursor-pointer">
              <div className="flex items-center gap-2 w-full pr-2">
                  <Radio size={16} className="text-orange-500 shrink-0" />
                  <span className="text-[9px] bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 px-1 py-0.5 rounded font-bold shrink-0">{t('home.gameAnnouncement')}</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 truncate flex-1">{gameAnnouncements?.[0]?.title || t('announcement.empty')}</span>
              </div>
              <ChevronRight size={14} className="text-slate-400 dark:text-zinc-600 shrink-0" />
          </div>
      </div>

      {/* System Countdown */}
      {countdown ? (
        <div className="rounded-xl border border-amber-500/20 dark:border-ef-yellow/20 bg-zinc-100 dark:bg-black p-4 mb-6 relative overflow-hidden shadow-sm dark:shadow-[0_0_20px_rgba(255,250,0,0.05)]">
            {countdown.backgroundImage ? (
              <div className="absolute inset-y-0 right-0 w-[46%] pointer-events-none opacity-30 dark:opacity-40">
                <img src={countdown.backgroundImage} alt="" className="h-full w-full object-cover object-right" />
                <div className="absolute inset-0 bg-gradient-to-l from-transparent via-zinc-100/45 to-zinc-100 dark:via-black/25 dark:to-black" />
              </div>
            ) : null}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,250,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,250,0,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="text-[9px] font-bold tracking-[0.2em] text-amber-600 dark:text-ef-yellow mb-1 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-amber-400 dark:bg-ef-yellow animate-pulse"></span>{t('countdown.system')}</div>
              <h3 className="max-w-[75%] text-xl font-black text-slate-900 dark:text-white italic tracking-tighter mb-1 uppercase">{countdown.active ? t('home.poolEndingCountdown', { name: localizedCountdownName }) : t('home.poolStartingCountdown', { name: localizedCountdownName })}</h3>
              <p className="text-[9px] text-slate-500 dark:text-zinc-500 font-mono mb-4 tracking-widest">{countdown.active ? 'ENDING COUNTDOWN' : 'STARTING COUNTDOWN'}</p>
              <div className="flex items-baseline gap-1 font-mono font-bold text-4xl tracking-tighter">
                  <span className="text-slate-900 dark:text-white">{String(countdown.days).padStart(2, '0')}</span><span className="text-slate-400 dark:text-zinc-600 text-sm relative top-[-6px] ml-0.5 mr-2 font-sans font-bold">{isEnglish ? 'D' : '天'}</span>
                  <span className="text-slate-900 dark:text-white">{String(countdown.hours).padStart(2, '0')}</span><span className="text-slate-400 dark:text-zinc-600 text-sm relative top-[-6px] ml-0.5 mr-2 font-sans font-bold">{isEnglish ? 'H' : '时'}</span>
                  <span className="text-slate-900 dark:text-white">{String(countdown.minutes).padStart(2, '0')}</span><span className="text-slate-400 dark:text-zinc-600 text-sm relative top-[-6px] ml-0.5 font-sans font-bold">{isEnglish ? 'M' : '分'}</span>
              </div>
            </div>
        </div>
      ) : null}

      {/* Pool Schedule Placeholder */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-ef-card p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold tracking-widest text-slate-900 dark:text-white flex items-center gap-2"><Calendar size={14}/> {t('home.rotation.title')}</h3>
              <ChevronRight size={14} className="text-slate-400 dark:text-zinc-600"/>
          </div>
          <div className="space-y-3">
            {rotationPreview.length > 0 ? rotationPreview.map((pool) => (
              <div key={pool.name + pool.startDate} className="flex items-center gap-3 text-xs bg-zinc-100 dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800/50">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${pool.active ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]' : (pool.ended ? 'bg-zinc-500' : 'bg-blue-500')}`}></span>
                  <span className="w-10 text-[10px] text-slate-500 dark:text-zinc-500 font-mono shrink-0">{formatDateTime(pool.startDate, { month: 'numeric', day: 'numeric', includeYear: false }, t('common.timeUnknown'))}</span>
                  <span className="flex-1 text-slate-900 dark:text-white font-bold truncate">{pool.displayName || pool.name}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${pool.active ? 'bg-green-500/20 text-green-700 dark:text-green-400' : (pool.ended ? 'bg-zinc-200 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500' : 'bg-blue-500/20 text-blue-700 dark:text-blue-300')}`}>{pool.label}</span>
              </div>
            )) : (
              <div className="text-xs text-zinc-500">{t('home.mobile.rotationEmpty', {}, isEnglish ? 'No scheduled rotation data yet.' : '暂无可展示的轮换计划。')}</div>
            )}
          </div>
      </div>

      {/* Next Version Countdown */}
      <div onClick={() => setActiveView('roadmap')} className="cursor-pointer rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-ef-card p-4 mb-8 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="text-[9px] font-bold tracking-[0.2em] text-slate-500 dark:text-zinc-500 mb-1 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-zinc-600"></span>{isEnglish ? 'SYSTEM UPGRADE' : '功能升级'}</div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white italic tracking-tighter mb-3 uppercase">{t('home.roadmap.title')}</h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-[10px] font-bold uppercase tracking-widest border border-blue-200 dark:border-blue-800/50">
               <Sparkles size={12} /> {roadmapCounts.inProgress} {t('home.roadmap.status.inProgress', {}, '进行中')}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 rounded text-[10px] font-bold uppercase tracking-widest border border-zinc-200 dark:border-zinc-800">
               {roadmapCounts.planned} {t('home.roadmap.status.planned', {}, '计划中')}
            </div>
          </div>
      </div>

      {/* Friendly Links */}
      <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 text-[10px] font-bold tracking-[0.1em] text-blue-700 dark:text-blue-400 uppercase">
              <div className="w-1.5 h-1.5 bg-blue-500"></div> FRIENDLY LINKS // {t('home.friendlyLinks.title', {}, '友情链接')}
          </div>
          <div className="grid grid-cols-2 gap-2">
              {translatedLinks.slice(0, 6).map((link, i) => (
                  <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200 dark:border-white/5 shadow-sm p-3 rounded-lg flex flex-col justify-between h-20 group relative overflow-hidden">
                      <div className="absolute right-2 top-2 opacity-5 text-slate-400 dark:text-zinc-600 group-hover:scale-110 transition-transform">
                          {link.icon === 'map' ? <Map size={40} /> : (link.icon === 'globe' ? <Globe size={40} /> : <BarChart2 size={40} />)}
                      </div>
                      <div className="relative z-10">
                          <div className="text-[8px] text-slate-500 dark:text-zinc-500 uppercase tracking-widest font-mono mb-1 truncate">{link.icon === 'map' ? 'MAP WIKI' : (link.icon === 'globe' ? 'WIKI' : 'TOOL')}</div>
                          <div className="text-[11px] font-bold text-slate-900 dark:text-white leading-tight line-clamp-2">{link.title}</div>
                      </div>
                      <div className="flex justify-between items-center text-[8px] text-slate-500 dark:text-zinc-500 font-mono mt-1 relative z-10">
                          <span className="truncate">{link.hostname}</span>
                          <ArrowUpRight size={10} className="shrink-0 group-hover:text-slate-900 dark:text-white" />
                      </div>
                  </a>
              ))}
          </div>
      </div>
    </div>
  );
}
