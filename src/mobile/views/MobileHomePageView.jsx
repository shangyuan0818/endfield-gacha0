import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, BarChart3, Bell, CircleDot, Info, Shield, Sparkles, Star, Terminal, Users } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useNavigate } from 'react-router-dom';
import CountdownTimer from '../../components/home/CountdownTimer';
import HomeAnnouncementContent from '../../components/home/AnnouncementContent';
import CollapsibleContent from '../../components/home/CollapsibleContent';
import HomeFriendlyLinksCard from '../../components/home/FriendlyLinksCard';
import GameAnnouncementFeed from '../../components/home/GameAnnouncementFeed';
import GuideCard from '../../components/home/GuideCard';
import PoolMechanicsCard from '../../components/home/PoolMechanicsCard';
import RoadmapCard from '../../components/home/RoadmapCard';
import HomeRotationScheduleCard from '../../components/home/RotationScheduleCard';
import { APP_VERSION } from '../../constants/appMeta';
import { ACCOUNT_RECOVERY_QQ_GROUP, ENGLISH_COMMUNITY_DISCORD_URL } from '../../constants/community';
import useSiteConfigStore from '../../stores/useSiteConfigStore';
import { getMobilePathForTab } from '../../constants/appRoutes';
import {
  STORAGE_KEYS,
  getHomeCollapseState,
  hasNewContent,
  markAsViewed,
  setHomeCollapseState
} from '../../utils';
import { getCurrentUpPoolInfo, getLimitedPoolSchedule } from '../../utils/poolTimeUtils';
import { useAppStore, useAuthStore } from '../../stores';
import usePoolStore from '../../stores/usePoolStore';
import { useI18n } from '../../i18n/index.js';

function MobileSectionHeader({ title, subtitle, icon: Icon }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2 min-w-0">
        {Icon ? <Icon size={14} className="mt-0.5 text-zinc-400 dark:text-zinc-500 shrink-0" /> : null}
        <div className="min-w-0">
          <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">{subtitle}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({ action, onClick }) {
  const Icon = action.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-zinc-200 bg-white px-4 py-4 text-left dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className={`inline-flex border p-2 ${action.accentClass}`}>
        <Icon size={16} />
      </div>
      <div className="mt-3 text-sm font-bold text-zinc-800 dark:text-zinc-100">{action.label}</div>
      <div className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">{action.description}</div>
    </button>
  );
}

function MobileHomePageView() {
  const navigate = useNavigate();
  const { t, isEnglish, locale } = useI18n();
  const user = useAuthStore((state) => state.user);
  const announcements = useAppStore((state) => state.announcements);
  const gameAnnouncements = useAppStore((state) => state.gameAnnouncements);
  const pools = usePoolStore((state) => state.pools);
  const defaultHeroSloganZh = '记录抽卡历程，查看卡池分析、统计汇总与模拟器数据。';
  const rawHeroSlogan = useSiteConfigStore(s => s.getConfig('home_hero_slogan', defaultHeroSloganZh));
  const heroSlogan = rawHeroSlogan === defaultHeroSloganZh ? t('home.heroSubtitle') : rawHeroSlogan;
  const qqGroup = useSiteConfigStore(s => s.getConfig('qq_group_number', ACCOUNT_RECOVERY_QQ_GROUP));
  const communityLinkLabel = ENGLISH_COMMUNITY_DISCORD_URL.replace(/^https?:\/\//u, '');

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const poolsArray = useMemo(() => (Array.isArray(pools) ? pools : []), [pools]);
  const poolSchedule = useMemo(() => getLimitedPoolSchedule(poolsArray), [poolsArray]);
  const currentUpInfo = useMemo(() => getCurrentUpPoolInfo(poolsArray, now), [poolsArray, now]);

  const countdown = useMemo(() => {
    const sortedPools = [...poolSchedule].sort((left, right) => new Date(left.startDate) - new Date(right.startDate));
    let activeIndex = sortedPools.findIndex((pool) => now >= new Date(pool.startDate) && now < new Date(pool.endDate));

    if (activeIndex === -1) {
      activeIndex = sortedPools.findIndex((pool) => now < new Date(pool.startDate));
    }

    if (activeIndex === -1) {
      return null;
    }

    const pool = sortedPools[activeIndex];
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
    };
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

  useEffect(() => {
    if (!showAnnouncement || !isAnnouncementNew) {
      return;
    }

    const timer = setTimeout(() => {
      markAsViewed(STORAGE_KEYS.ANNOUNCEMENT_LAST_VIEWED);
      setIsAnnouncementNew(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [showAnnouncement, isAnnouncementNew]);

  const handleCelebrationClick = useCallback(() => {
    confetti({
      particleCount: 120,
      spread: 75,
      origin: { y: 0.65 }
    });
  }, []);

  const quickActions = [
    {
      id: 'dashboard',
      label: t('nav.dashboard'),
      description: t('home.mobile.quickAction.dashboardDesc'),
      icon: BarChart3,
      accentClass: 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400'
    },
    {
      id: 'summary',
      label: t('summary.viewTitle'),
      description: t('home.mobile.quickAction.summaryDesc'),
      icon: Star,
      accentClass: 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400'
    },
    {
      id: 'simulator',
      label: t('nav.simulator'),
      description: t('home.mobile.quickAction.simulatorDesc'),
      icon: Sparkles,
      accentClass: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-600 dark:border-fuchsia-900 dark:bg-fuchsia-950/30 dark:text-fuchsia-400'
    },
    {
      id: 'about',
      label: t('nav.about'),
      description: t('home.mobile.quickAction.aboutDesc'),
      icon: Info,
      accentClass: 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300'
    }
  ];

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="relative overflow-hidden border-l-4 border-endfield-yellow bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-800 p-5 text-white">
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-endfield-yellow">
                <Terminal size={12} />
                SYSTEM ONLINE
              </div>
              <h1 className="mt-2 text-xl font-bold tracking-tight">{t('app.brand')}</h1>
              <p className="mt-2 text-xs text-zinc-300 leading-relaxed">
                {heroSlogan}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono text-zinc-400">
                <span>VERSION {APP_VERSION}</span>
                <span>|</span>
                <span>{new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(now)}</span>
                <span>|</span>
                <span>{user ? t('home.mobile.loggedIn') : t('home.mobile.guestMode')}</span>
              </div>
              {!user && (
                <p className="mt-2 text-[11px] text-zinc-400 flex items-center gap-1">
                  <ArrowRight size={12} />
                  {t('home.loginHint')}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleCelebrationClick}
              className="shrink-0 border border-endfield-yellow/40 bg-endfield-yellow/10 p-2 text-endfield-yellow"
            >
              <Sparkles size={16} />
            </button>
          </div>
        </div>
        <div className="absolute -right-6 -bottom-8 text-white/5">
          <Star size={120} />
        </div>
      </div>

      <div className="border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              <CircleDot size={10} className="text-endfield-yellow" />
              {t('home.mobile.currentRotation')}
            </div>
            <div className="mt-2 text-sm font-bold text-zinc-800 dark:text-zinc-100">
              {currentUpInfo?.name || countdown?.name || t('home.mobile.waitingNextRotation')}
            </div>
            <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              {countdown?.isActive ? t('home.mobile.currentBannerHint') : t('home.mobile.noActiveLimitedHint')}
            </div>
          </div>
          <div className="shrink-0 border border-zinc-200 bg-zinc-50 px-3 py-2 text-right dark:border-zinc-700 dark:bg-zinc-950">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">{t('home.mobile.phasePools')}</div>
            <div className="mt-1 text-lg font-black font-mono text-zinc-800 dark:text-zinc-100">{poolSchedule.length}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <MobileSectionHeader
          title={t('home.mobile.quickActionsTitle')}
          subtitle={t('home.mobile.quickActionsSubtitle')}
          icon={BarChart3}
        />
        <div className="grid grid-cols-2 gap-3">
        {quickActions.map((action) => {
          return (
            <QuickActionCard
              key={action.id}
              action={action}
              onClick={() => navigate(getMobilePathForTab(action.id))}
            />
          );
        })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50">
          <div className="px-4 py-3 flex items-start gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-500 shrink-0">
              <Shield size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-green-800 dark:text-green-400 mb-1">{t('home.securityTitle')}</h3>
              <div className="text-xs text-green-700 dark:text-green-500/80 leading-relaxed space-y-1">
                <p>{t('home.securityCopy1')}</p>
                <p>{t('home.securityCopy2')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 dark:bg-black border border-zinc-800 text-white">
          <div className="px-4 py-3 flex items-start gap-3">
            <div className="p-2 bg-endfield-yellow/15 text-endfield-yellow border border-endfield-yellow/30 shrink-0">
              <Users size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold mb-1">{t('home.communityTitle')}</h3>
              <div className="text-xs text-zinc-300 leading-relaxed space-y-2">
                <p>{t('home.communityCopy1')}</p>
                {isEnglish ? (
                  <a
                    href={ENGLISH_COMMUNITY_DISCORD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('home.communityOpenLink')}
                    className="block border border-zinc-700 bg-zinc-950/80 px-3 py-2 font-mono text-sm tracking-wide text-endfield-yellow break-all"
                  >
                    {communityLinkLabel}
                  </a>
                ) : (
                  <div className="border border-zinc-700 bg-zinc-950/80 px-3 py-2 font-mono text-base tracking-wider text-endfield-yellow">
                    {qqGroup}
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
            <>
              <MobileSectionHeader
                title={t('home.siteAnnouncement')}
                subtitle={t('home.mobile.siteAnnouncementSubtitle')}
                icon={Bell}
              />
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 overflow-hidden">
                <button
                  type="button"
                  onClick={handleToggleAnnouncement}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shrink-0 relative">
                      <Bell size={18} />
                      {isAnnouncementNew && (
                        <span className="absolute -top-1 -right-1 px-1 py-0.5 text-[8px] font-bold bg-red-500 text-white rounded animate-pulse">
                          NEW
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-amber-800 dark:text-amber-300 truncate">{latestAnnouncement.title}</h3>
                        {latestAnnouncement.version && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300 rounded">
                            v{latestAnnouncement.version}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-1">{t('home.mobile.siteAnnouncementHint')}</p>
                    </div>
                  </div>
                  <ArrowRight
                    size={16}
                    className={`shrink-0 text-amber-500 transition-transform ${showAnnouncement ? 'rotate-90' : ''}`}
                  />
                </button>

                <CollapsibleContent isOpen={showAnnouncement}>
                  <HomeAnnouncementContent content={latestAnnouncement.content} />
                </CollapsibleContent>
              </div>
            </>
          )}

          {gameAnnouncements.length > 0 && (
            <>
              {!latestAnnouncement && (
                <MobileSectionHeader
                  title={t('home.gameAnnouncement')}
                  subtitle={t('home.mobile.gameAnnouncementSubtitle')}
                  icon={Bell}
                />
              )}
              <div className="bg-gradient-to-r from-amber-50/60 to-orange-50/60 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/70 dark:border-amber-800/50 overflow-hidden">
                <button
                  type="button"
                  onClick={handleToggleGameAnnouncements}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-amber-100/70 dark:bg-amber-900/20 text-amber-500 dark:text-amber-500 shrink-0">
                      <Bell size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 bg-orange-200 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 font-bold uppercase tracking-wide">{t('home.gameAnnouncement')}</span>
                        <h3 className="font-bold text-amber-700 dark:text-amber-400 truncate">{t('home.fromOfficialSite')}</h3>
                      </div>
                      <p className="text-[11px] text-amber-600/60 dark:text-amber-500/50 mt-0.5">{t('home.autoSummary')}</p>
                    </div>
                  </div>
                  <ArrowRight
                    size={16}
                    className={`shrink-0 text-amber-400 transition-transform ${showGameAnnouncements ? 'rotate-90' : ''}`}
                  />
                </button>

                <CollapsibleContent isOpen={showGameAnnouncements}>
                  <GameAnnouncementFeed announcements={gameAnnouncements} maxItems={5} />
                </CollapsibleContent>
              </div>
            </>
          )}
        </div>
      )}

      {countdown && (
        <div className="space-y-3">
          <MobileSectionHeader
            title={t('home.mobile.countdownTitle')}
            subtitle={t('home.mobile.countdownSubtitle')}
            icon={Sparkles}
          />
          <CountdownTimer
            targetDate={countdown.targetDate}
            title={countdown.title}
            subTitle={countdown.subTitle}
            link={null}
            characterName={countdown.name}
          />
        </div>
      )}

      <div className="space-y-3">
        <MobileSectionHeader
          title={t('home.rotation.title')}
          subtitle={t('home.mobile.rotationSubtitle')}
          icon={Star}
        />
        <HomeRotationScheduleCard poolSchedule={poolSchedule} now={now} />
      </div>

      <div className="space-y-3">
        <MobileSectionHeader
          title={t('home.friendlyLinks.title')}
          subtitle={t('home.mobile.friendlyLinksSubtitle')}
          icon={Users}
        />
        <HomeFriendlyLinksCard />
      </div>

      <div className="space-y-3">
        <MobileSectionHeader
          title={t('home.guide.title')}
          subtitle={t('home.mobile.guideSubtitle')}
          icon={ArrowRight}
        />
        <GuideCard isOpen={showGuide} onToggle={handleToggleGuide} />
      </div>

      <div className="space-y-3">
        <MobileSectionHeader
          title={t('home.poolMechanics.title')}
          subtitle={t('home.mobile.poolMechanicsSubtitle')}
          icon={Info}
        />
        <PoolMechanicsCard
          isOpen={showPoolMechanics}
          onToggle={handleTogglePoolMechanics}
          currentUpInfo={currentUpInfo}
        />
      </div>

      <div className="space-y-3">
        <MobileSectionHeader
          title={t('home.roadmap.title')}
          subtitle={t('home.mobile.roadmapSubtitle')}
          icon={Sparkles}
        />
        <RoadmapCard isOpen={showRoadmap} onToggle={handleToggleRoadmap} />
      </div>
    </div>
  );
}

export default MobileHomePageView;
