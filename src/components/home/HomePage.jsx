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
import HomeAnnouncementContent from './AnnouncementContent';
import CollapsibleContent from './CollapsibleContent';
import HomeFriendlyLinksCard from './FriendlyLinksCard';
import GameAnnouncementFeed from './GameAnnouncementFeed';
import GuideCard from './GuideCard';
import PoolMechanicsCard from './PoolMechanicsCard';
import RoadmapCard from './RoadmapCard';
import HomeRotationScheduleCard from './RotationScheduleCard';
import { ACCOUNT_RECOVERY_QQ_GROUP } from '../../constants/community';
import {
  STORAGE_KEYS,
  getHomeCollapseState,
  hasNewContent,
  markAsViewed,
  setHomeCollapseState
} from '../../utils';
import { useAppStore, useAuthStore } from '../../stores';

const HomePage = React.memo(() => {
  const user = useAuthStore((state) => state.user);
  const announcements = useAppStore((state) => state.announcements);
  const gameAnnouncements = useAppStore((state) => state.gameAnnouncements);
  const pools = usePoolStore((state) => state.pools);

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
        title: isActive ? `${pool.name} 池结束倒计时` : `${pool.name} 池开启倒计时`,
        subTitle: isActive ? `Current Banner Ending // ${pool.name}` : `Next Banner Starting // ${pool.name}`,
        isActive
      };
    };

    let main = activeIndex !== -1 ? getPoolData(activeIndex) : null;

    if (!main) {
      main = {
        targetDate: '2026-04-15T12:00:00+08:00',
        title: '下个版本倒计时',
        subTitle: 'Waiting for Next Version'
      };
    }

    return { main };
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
                <span>终末地抽卡分析器</span>
              </div>
            </h2>
            <p className="text-sm text-indigo-100">
              记录您的抽卡历程，分析出货规律，为后续规划提供参考
            </p>
            {!user && (
              <p className="text-xs mt-2 flex items-center gap-1 text-indigo-200">
                <ArrowRight size={12} />
                登录后可录入数据并同步到云端
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 self-end md:self-center animate-fade-in-up">
            <button
              onClick={handleCelebrationClick}
              className="group flex items-center gap-3 px-4 py-2 rounded-full transition-all cursor-pointer border bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/50 text-endfield-yellow"
            >
              <span className="text-sm font-bold font-mono tracking-wide">恭喜终末地公测！</span>
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

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_320px] gap-4">
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 rounded-none overflow-hidden shadow-sm">
          <div className="px-4 py-3 flex items-start gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-500 shrink-0">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-green-800 dark:text-green-400 mb-1">
                安全与隐私声明
              </h3>
              <div className="text-xs text-green-700 dark:text-green-500/80 leading-relaxed space-y-1">
                <p>本站不会读取本地文件或执行系统级操作。前端主逻辑运行在浏览器内；站点配置、云同步、账号恢复与公开统计等能力会通过 Supabase、Edge Functions、`/api/bootstrap` 与可选私有代理配合完成。</p>
                <p>如你仍对凭证安全有顾虑，获取数据后请<strong>退出游戏网页登录</strong>。重新登录会刷新凭证，旧 Token 会随之失效。</p>
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
                欢迎加入 QQ 群 ~
              </h3>
              <div className="text-xs text-zinc-300 leading-relaxed space-y-2">
                <p>账号恢复、临时密码领取和使用问题请都统一在 QQ 群处理~</p>
                <div className="border border-zinc-700 bg-zinc-950/80 px-3 py-2 font-mono text-base tracking-wider text-endfield-yellow">
                  {ACCOUNT_RECOVERY_QQ_GROUP}
                </div>
                <p className="text-zinc-400">欢迎加群吹水，倒卖和提意见喵~ 账号恢复的临时密码请加群后私信群主~</p>
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
                      <h3 className="font-bold text-amber-800 dark:text-amber-300">{latestAnnouncement.title}</h3>
                      {isAnnouncementNew && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded animate-pulse">
                          NEW
                        </span>
                      )}
                    </div>
                    {latestAnnouncement.version && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300 rounded">
                        v{latestAnnouncement.version}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronUp size={20} className={`text-amber-400 transition-transform duration-300 ${showAnnouncement ? '' : 'rotate-180'}`} />
              </button>

              <CollapsibleContent isOpen={showAnnouncement}>
                <HomeAnnouncementContent content={latestAnnouncement.content} />
              </CollapsibleContent>
            </div>
          )}

          <div className="border border-zinc-200 dark:border-zinc-800 rounded-none overflow-hidden bg-white dark:bg-zinc-900">
            <button
              onClick={handleToggleGameAnnouncements}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shrink-0">
                  <Bell size={18} />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-zinc-800 dark:text-zinc-100">游戏公告</h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">来自终末地官网，默认折叠展示</p>
                </div>
              </div>
              <ChevronUp size={20} className={`text-zinc-400 transition-transform duration-300 ${showGameAnnouncements ? '' : 'rotate-180'}`} />
            </button>

            <CollapsibleContent isOpen={showGameAnnouncements}>
              <GameAnnouncementFeed announcements={gameAnnouncements} maxItems={3} />
            </CollapsibleContent>
          </div>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <HomeFriendlyLinksCard />

          <div className="h-full">
            <CountdownTimer
              targetDate="2026-04-15T12:00:00+08:00"
              title="下个版本倒计时"
              subTitle="下个版本发布"
              customEndedContent={<span>版本已上线</span>}
              size="small"
            />
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
