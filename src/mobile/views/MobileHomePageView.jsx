import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, BarChart3, Bell, Shield, Sparkles, Star, Users } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useNavigate } from 'react-router-dom';
import CountdownTimer from '../../components/home/CountdownTimer';
import HomeAnnouncementContent from '../../components/home/AnnouncementContent';
import CollapsibleContent from '../../components/home/CollapsibleContent';
import HomeFriendlyLinksCard from '../../components/home/FriendlyLinksCard';
import GuideCard from '../../components/home/GuideCard';
import PoolMechanicsCard from '../../components/home/PoolMechanicsCard';
import RoadmapCard from '../../components/home/RoadmapCard';
import HomeRotationScheduleCard from '../../components/home/RotationScheduleCard';
import { ACCOUNT_RECOVERY_QQ_GROUP } from '../../constants/community';
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

function MobileHomePageView() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const announcements = useAppStore((state) => state.announcements);
  const pools = usePoolStore((state) => state.pools);

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
      title: isActive ? `${pool.name} 池结束倒计时` : `${pool.name} 池开启倒计时`,
      subTitle: isActive ? `Current Banner Ending // ${pool.name}` : `Next Banner Starting // ${pool.name}`,
    };
  }, [poolSchedule, now]);

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
    { id: 'dashboard', label: '卡池分析', icon: BarChart3 },
    { id: 'summary', label: '统计总览', icon: Star },
    { id: 'simulator', label: '抽卡模拟', icon: Sparkles }
  ];

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="relative overflow-hidden border-l-4 border-endfield-yellow bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-800 p-5 text-white">
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight">终末地抽卡分析器</h1>
              <p className="mt-2 text-xs text-zinc-300 leading-relaxed">
                记录抽卡历程，查看卡池分析、统计汇总与模拟器数据。
              </p>
              {!user && (
                <p className="mt-2 text-[11px] text-zinc-400 flex items-center gap-1">
                  <ArrowRight size={12} />
                  登录后可同步并长期保存数据
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

      <div className="grid grid-cols-3 gap-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => navigate(getMobilePathForTab(action.id))}
              className="border border-zinc-200 bg-white px-3 py-3 text-left dark:border-zinc-800 dark:bg-zinc-900"
            >
              <Icon size={16} className="text-zinc-500 dark:text-zinc-400" />
              <div className="mt-2 text-xs font-bold text-zinc-800 dark:text-zinc-100">{action.label}</div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50">
          <div className="px-4 py-3 flex items-start gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-500 shrink-0">
              <Shield size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-green-800 dark:text-green-400 mb-1">安全与隐私声明</h3>
              <div className="text-xs text-green-700 dark:text-green-500/80 leading-relaxed space-y-1">
                <p>本站绝不会窃取玩家电脑数据，核心逻辑均运行在浏览器沙盒内。</p>
                <p>若你对站点安全仍有顾虑，获取数据后退出官网登录即可让旧 Token 失效。</p>
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
              <h3 className="text-sm font-bold mb-1">QQ 群协助通道</h3>
              <div className="text-xs text-zinc-300 leading-relaxed space-y-2">
                <p>账号恢复、临时密码领取和使用问题统一在 QQ 群处理。</p>
                <div className="border border-zinc-700 bg-zinc-950/80 px-3 py-2 font-mono text-base tracking-wider text-endfield-yellow">
                  {ACCOUNT_RECOVERY_QQ_GROUP}
                </div>
                <p className="text-zinc-400">若超管已完成核验并设置临时密码，请加入该群获取密码。</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {latestAnnouncement && (
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
                <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-1">站点公告与版本更新</p>
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
      )}

      {countdown && (
        <CountdownTimer
          targetDate={countdown.targetDate}
          title={countdown.title}
          subTitle={countdown.subTitle}
          link={null}
          characterName={countdown.name}
        />
      )}

      <HomeRotationScheduleCard poolSchedule={poolSchedule} now={now} />
      <HomeFriendlyLinksCard />
      <GuideCard isOpen={showGuide} onToggle={handleToggleGuide} />
      <PoolMechanicsCard
        isOpen={showPoolMechanics}
        onToggle={handleTogglePoolMechanics}
        currentUpInfo={currentUpInfo}
      />
      <RoadmapCard isOpen={showRoadmap} onToggle={handleToggleRoadmap} />
    </div>
  );
}

export default MobileHomePageView;
