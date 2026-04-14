import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bell,
  ChevronUp,
  Shield,
  Sparkles,
  Star,
  Users
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { getCurrentUpPoolInfo, getLimitedPoolSchedule } from '../../utils/poolTimeUtils';
import usePoolStore from '../../stores/usePoolStore';
import CountdownTimer from './CountdownTimer';
import SpringPreviewCard from './SpringPreviewCard';
import HomeAnnouncementContent from './AnnouncementContent';
import CollapsibleContent from './CollapsibleContent';
import HomeFriendlyLinksCard from './FriendlyLinksCard';
import GameAnnouncementFeed from './GameAnnouncementFeed';
import GuideCard from './GuideCard';
import PoolMechanicsCard from './PoolMechanicsCard';
import RoadmapCard from './RoadmapCard';
import HomeRotationScheduleCard from './RotationScheduleCard';
import { ACCOUNT_RECOVERY_QQ_GROUP, ENGLISH_COMMUNITY_DISCORD_URL } from '../../constants/community';
import {
  STORAGE_KEYS,
  getHomeCollapseState,
  hasNewContent,
  markAsViewed,
  setHomeCollapseState
} from '../../utils';
import { useAppStore, useAuthStore } from '../../stores';
import { useI18n } from '../../i18n/index.js';

const HomePage = React.memo(() => {
  const { t, isEnglish } = useI18n();
  const user = useAuthStore((state) => state.user);
  const announcements = useAppStore((state) => state.announcements);
  const gameAnnouncements = useAppStore((state) => state.gameAnnouncements);
  const pools = usePoolStore((state) => state.pools);
  const communityLinkLabel = ENGLISH_COMMUNITY_DISCORD_URL.replace(/^https?:\/\//u, '');

  const poolsArray = useMemo(() => (Array.isArray(pools) ? pools : []), [pools]);

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const poolSchedule = useMemo(() => getLimitedPoolSchedule(poolsArray), [poolsArray]);
  const currentUpInfo = useMemo(() => getCurrentUpPoolInfo(poolsArray, now), [poolsArray, now]);

  const countdowns = useMemo(() => {
    const sortedPools = [...poolSchedule].sort((left, right) => new Date(left.startDate) - new Date(right.startDate));

    let activeIndex = sortedPools.findIndex((pool) => now >= new Date(pool.startDate) && now < new Date(pool.endDate));
    if (activeIndex === -1) {
      activeIndex = sortedPools.findIndex((pool) => now < new Date(pool.startDate));
    }

    const getPoolData = (index) => {
      if (index < 0 || index >= sortedPools.length) return null;

      const pool = sortedPools[index];
      const start = new Date(pool.startDate);
      const end = new Date(pool.endDate);
      const isActive = now >= start && now < end;

        return {
          ...pool,
          targetDate: isActive ? pool.endDate : pool.startDate,
          title: isActive
            ? t('home.poolEndingCountdown', { name: pool.name })
            : t('home.poolStartingCountdown', { name: pool.name }),
          subTitle: isActive
            ? t('home.poolEndingSubtitle', { name: pool.name })
            : t('home.poolStartingSubtitle', { name: pool.name }),
          isActive
        };
      };

    let main = activeIndex !== -1 ? getPoolData(activeIndex) : null;

      if (!main) {
        main = {
          targetDate: '2026-04-15T12:00:00+08:00',
          title: t('home.nextVersionCountdown'),
          subTitle: t('home.nextVersionWaiting')
        };
      }

    return { main };
  }, [poolSchedule, now, t]);

  const initialCollapseState = getHomeCollapseState();
  const latestAnnouncement = announcements[0];
  const hasAnnouncementUpdate = latestAnnouncement
    ? hasNewContent(STORAGE_KEYS.ANNOUNCEMENT_LAST_VIEWED, latestAnnouncement.updated_at)
    : false;

  const [showPoolMechanics, setShowPoolMechanics] = useState(!initialCollapseState.poolMechanics);
  const [showGuide, setShowGuide] = useState(!initialCollapseState.guide);
  const [showRoadmap, setShowRoadmap] = useState(!initialCollapseState.roadmap);
  const [showAnnouncement, setShowAnnouncement] = useState(
    hasAnnouncementUpdate ? true : !initialCollapseState.announcement
  );
  const [showGameAnnouncements, setShowGameAnnouncements] = useState(!initialCollapseState.gameAnnouncements);
  const [isAnnouncementNew, setIsAnnouncementNew] = useState(hasAnnouncementUpdate);

  const handleTogglePoolMechanics = useCallback(() => {
    setShowPoolMechanics((prev) => {
      const next = !prev;
      setHomeCollapseState('poolMechanics', !next);
      return next;
    });
  }, []);

  const handleToggleGuide = useCallback(() => {
    setShowGuide((prev) => {
      const next = !prev;
      setHomeCollapseState('guide', !next);
      return next;
    });
  }, []);

  const handleToggleRoadmap = useCallback(() => {
    setShowRoadmap((prev) => {
      const next = !prev;
      setHomeCollapseState('roadmap', !next);
      return next;
    });
  }, []);

  const handleToggleAnnouncement = useCallback(() => {
    setShowAnnouncement((prev) => {
      const next = !prev;
      setHomeCollapseState('announcement', !next);
      return next;
    });
  }, []);

  const handleToggleGameAnnouncements = useCallback(() => {
    setShowGameAnnouncements((prev) => {
      const next = !prev;
      setHomeCollapseState('gameAnnouncements', !next);
      return next;
    });
  }, []);

  const handleAnnouncementViewed = useCallback(() => {
    if (!isAnnouncementNew) {
      return;
    }

    setTimeout(() => {
      markAsViewed(STORAGE_KEYS.ANNOUNCEMENT_LAST_VIEWED);
      setIsAnnouncementNew(false);
    }, 2000);
  }, [isAnnouncementNew]);

  useEffect(() => {
    if (showAnnouncement && isAnnouncementNew) {
      handleAnnouncementViewed();
    }
  }, [showAnnouncement, isAnnouncementNew, handleAnnouncementViewed]);

  const handleCelebrationClick = useCallback((event) => {
    event.preventDefault();
    const x = event.clientX / window.innerWidth;
    const y = event.clientY / window.innerHeight;

    confetti({
      particleCount: 150,
      spread: 80,
      origin: { x, y }
    });
  }, []);

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="relative overflow-hidden border-l-4 transition-all duration-500 bg-gradient-to-r from-zinc-800 to-zinc-900 dark:from-zinc-900 dark:to-black border-endfield-yellow p-6 text-white">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-3">
                <BarChart3 size={28} />
                <span>{t('app.brand')}</span>
              </div>
            </h2>
            <p className="text-sm text-indigo-100">
              {t('home.heroSubtitle')}
            </p>
            {!user && (
              <p className="text-xs mt-2 flex items-center gap-1 text-indigo-200">
                <ArrowRight size={12} />
                {t('home.loginHint')}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 self-end md:self-center animate-fade-in-up">
            <button
              onClick={handleCelebrationClick}
              className="group flex items-center gap-3 px-4 py-2 rounded-full transition-all cursor-pointer border bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/50 text-endfield-yellow"
            >
              <span className="text-sm font-bold font-mono tracking-wide">{t('home.celebration')}</span>
              <div className="p-1.5 rounded-full transition-colors bg-yellow-500/20 group-hover:bg-yellow-500 group-hover:text-black text-yellow-500">
                <Sparkles size={16} className="animate-pulse" />
              </div>
            </button>
          </div>
        </div>

        <div className="absolute -right-10 -bottom-10 pointer-events-none text-white/10">
          <Star size={200} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 rounded-none overflow-hidden shadow-sm">
          <div className="px-4 py-3 flex items-start gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-500 shrink-0">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-green-800 dark:text-green-400 mb-1">
                {t('home.securityTitle')}
              </h3>
              <div className="text-xs text-green-700 dark:text-green-500/80 leading-relaxed space-y-1">
                <p>{t('home.securityCopy1')}</p>
                <p>{t('home.securityCopy2')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 dark:bg-black border border-zinc-800 rounded-none overflow-hidden shadow-sm text-white">
          <div className="px-4 py-3 flex items-start gap-3">
            <div className="p-2 bg-endfield-yellow/15 text-endfield-yellow border border-endfield-yellow/30 shrink-0">
              <Users size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white mb-1">
                {t('home.communityTitle')}
              </h3>
              <div className="text-xs text-zinc-300 leading-relaxed space-y-2">
                <p>{t('home.communityCopy1')}</p>
                {isEnglish ? (
                  <a
                    href={ENGLISH_COMMUNITY_DISCORD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('home.communityOpenLink')}
                    className="block border border-zinc-700 bg-zinc-950/80 px-3 py-2 font-mono text-sm tracking-wide text-endfield-yellow break-all transition-colors hover:border-endfield-yellow/50 hover:text-white"
                  >
                    {communityLinkLabel}
                  </a>
                ) : (
                  <div className="border border-zinc-700 bg-zinc-950/80 px-3 py-2 font-mono text-base tracking-wider text-endfield-yellow">
                    {ACCOUNT_RECOVERY_QQ_GROUP}
                  </div>
                )}
                <p className="text-zinc-400">{t('home.communityCopy2')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(latestAnnouncement || gameAnnouncements.length > 0) && (
        <div className="space-y-3">
          {latestAnnouncement && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-none overflow-hidden">
              <button
                onClick={handleToggleAnnouncement}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-none text-amber-600 dark:text-amber-400 shrink-0 relative">
                    <Bell size={20} />
                    {isAnnouncementNew && (
                      <span className="absolute -top-1 -right-1 px-1 py-0.5 text-[8px] font-bold bg-red-500 text-white rounded animate-pulse">
                        NEW
                      </span>
                    )}
                  </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300 font-bold uppercase tracking-wide">{t('home.siteAnnouncement')}</span>
                      <h3 className="font-bold text-amber-800 dark:text-amber-300">{latestAnnouncement.title}</h3>
                      {isAnnouncementNew && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded animate-pulse">
                          NEW
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronUp size={20} className={`text-amber-400 transition-transform duration-300 ${showAnnouncement ? '' : 'rotate-180'}`} />
              </button>

              <CollapsibleContent isOpen={showAnnouncement}>
                <HomeAnnouncementContent content={latestAnnouncement.content} />
              </CollapsibleContent>
            </div>
          )}

          {gameAnnouncements.length > 0 && (
            <div className="bg-gradient-to-r from-amber-50/60 to-orange-50/60 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/70 dark:border-amber-800/50 rounded-none overflow-hidden">
              <button
                onClick={handleToggleGameAnnouncements}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-amber-100/30 dark:hover:bg-amber-900/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100/70 dark:bg-amber-900/20 text-amber-500 dark:text-amber-500 shrink-0">
                    <Bell size={18} />
                  </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 bg-orange-200 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 font-bold uppercase tracking-wide">{t('home.gameAnnouncement')}</span>
                      <h3 className="font-bold text-amber-700 dark:text-amber-400">{t('home.fromOfficialSite')}</h3>
                    </div>
                    <p className="text-[11px] text-amber-600/60 dark:text-amber-500/50 mt-0.5">{t('home.autoSummary')}</p>
                  </div>
                </div>
                <ChevronUp size={20} className={`text-amber-400 transition-transform duration-300 ${showGameAnnouncements ? '' : 'rotate-180'}`} />
              </button>

              <CollapsibleContent isOpen={showGameAnnouncements}>
                <GameAnnouncementFeed announcements={gameAnnouncements} maxItems={5} />
              </CollapsibleContent>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="relative">
          {countdowns.main && (
            <CountdownTimer
              targetDate={countdowns.main.targetDate}
              title={countdowns.main.title}
              subTitle={countdowns.main.subTitle}
              link={null}
              characterName={countdowns.main.name}
            />
          )}
        </div>

        <HomeRotationScheduleCard poolSchedule={poolSchedule} now={now} />

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.3fr] gap-6">
          <HomeFriendlyLinksCard />

          <div className="flex flex-col gap-6">
            <SpringPreviewCard />
            <div className="shrink-0 min-h-32">
              <CountdownTimer
                targetDate="2026-04-15T12:00:00+08:00"
                title={t('home.nextVersionCountdown')}
                subTitle={t('home.nextVersionRelease')}
                customEndedContent={<span>{t('home.versionLaunched')}</span>}
                size="small"
              />
            </div>
          </div>
        </div>
      </div>

      <GuideCard isOpen={showGuide} onToggle={handleToggleGuide} />
      <PoolMechanicsCard
        isOpen={showPoolMechanics}
        onToggle={handleTogglePoolMechanics}
        currentUpInfo={currentUpInfo}
      />
      <RoadmapCard isOpen={showRoadmap} onToggle={handleToggleRoadmap} />
    </div>
  );
});

HomePage.displayName = 'HomePage';

export default HomePage;
