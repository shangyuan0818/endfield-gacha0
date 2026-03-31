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
import { ACCOUNT_RECOVERY_QQ_GROUP } from '../../constants/community';
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
  const user = useAuthStore((state) => state.user);
  const announcements = useAppStore((state) => state.announcements);
  const gameAnnouncements = useAppStore((state) => state.gameAnnouncements);
  const pools = usePoolStore((state) => state.pools);
  const heroSlogan = useSiteConfigStore(s => s.getConfig('home_hero_slogan', '记录抽卡历程，查看卡池分析、统计汇总与模拟器数据。'));
  const qqGroup = useSiteConfigStore(s => s.getConfig('qq_group_number', ACCOUNT_RECOVERY_QQ_GROUP));

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
      label: '卡池分析',
      description: '查看单池详情、保底、时间线与分享长图。',
      icon: BarChart3,
      accentClass: 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400'
    },
    {
      id: 'summary',
      label: '统计总览',
      description: '查看跨卡池汇总、分布、排行与资源统计。',
      icon: Star,
      accentClass: 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400'
    },
    {
      id: 'simulator',
      label: '抽卡模拟',
      description: '继承账号数据继续模拟，并导出完整分享图。',
      icon: Sparkles,
      accentClass: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-600 dark:border-fuchsia-900 dark:bg-fuchsia-950/30 dark:text-fuchsia-400'
    },
    {
      id: 'about',
      label: '关于项目',
      description: '查看版本、协作单元、链接与使用说明。',
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
              <h1 className="mt-2 text-xl font-bold tracking-tight">终末地抽卡分析器</h1>
              <p className="mt-2 text-xs text-zinc-300 leading-relaxed">
                {heroSlogan}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono text-zinc-400">
                <span>VERSION {APP_VERSION}</span>
                <span>|</span>
                <span>{now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                <span>|</span>
                <span>{user ? '已登录' : '游客模式'}</span>
              </div>
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

      <div className="border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              <CircleDot size={10} className="text-endfield-yellow" />
              当前轮换状态
            </div>
            <div className="mt-2 text-sm font-bold text-zinc-800 dark:text-zinc-100">
              {currentUpInfo?.name || countdown?.name || '等待下一期轮换数据'}
            </div>
            <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              {countdown?.isActive ? '当前卡池进行中，可直接查看详情和时间线。' : '当前没有处于开启状态的限定池，将展示下一期计划。'}
            </div>
          </div>
          <div className="shrink-0 border border-zinc-200 bg-zinc-50 px-3 py-2 text-right dark:border-zinc-700 dark:bg-zinc-950">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">阶段卡池</div>
            <div className="mt-1 text-lg font-black font-mono text-zinc-800 dark:text-zinc-100">{poolSchedule.length}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <MobileSectionHeader
          title="快速入口"
          subtitle="优先保留移动端最常用的分析、统计、模拟与说明入口。"
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
              <h3 className="text-sm font-bold text-green-800 dark:text-green-400 mb-1">安全与隐私声明</h3>
              <div className="text-xs text-green-700 dark:text-green-500/80 leading-relaxed space-y-1">
                <p>本站不会读取本地文件或执行系统级操作。前端主逻辑运行在浏览器内；云同步、公开统计、账号恢复与导入代理等能力会通过 Supabase、`/api/bootstrap` 和可选私有后端完成。</p>
                <p>若你仍对凭证安全有顾虑，获取数据后退出官网登录即可让旧 Token 失效。</p>
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
                  {qqGroup}
                </div>
                <p className="text-zinc-400">若超管已完成核验并设置临时密码，请加入该群获取密码。</p>
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
                title="站点公告"
                subtitle="版本更新、维护说明与功能变更会优先展示在这里。"
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
            </>
          )}

          {gameAnnouncements.length > 0 && (
            <>
              {!latestAnnouncement && (
                <MobileSectionHeader
                  title="游戏公告"
                  subtitle="自动同步终末地官网，LLM 整理摘要。"
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
                        <span className="text-[10px] px-1.5 py-0.5 bg-orange-200 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 font-bold uppercase tracking-wide">游戏公告</span>
                        <h3 className="font-bold text-amber-700 dark:text-amber-400 truncate">来自终末地官网</h3>
                      </div>
                      <p className="text-[11px] text-amber-600/60 dark:text-amber-500/50 mt-0.5">自动抓取 · LLM 整理摘要</p>
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
            title="倒计时"
            subtitle="跟踪当前池结束时间或下一期开启时间。"
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
          title="轮换计划"
          subtitle="按当前 UP 相对位置查看卡池轮换、移出和后续 UP。"
          icon={Star}
        />
        <HomeRotationScheduleCard poolSchedule={poolSchedule} now={now} />
      </div>

      <div className="space-y-3">
        <MobileSectionHeader
          title="常用链接"
          subtitle="聚合地图、工具和相关站点入口。"
          icon={Users}
        />
        <HomeFriendlyLinksCard />
      </div>

      <div className="space-y-3">
        <MobileSectionHeader
          title="使用指南"
          subtitle="新用户优先看这里，快速完成登录、导入和分析。"
          icon={ArrowRight}
        />
        <GuideCard isOpen={showGuide} onToggle={handleToggleGuide} />
      </div>

      <div className="space-y-3">
        <MobileSectionHeader
          title="卡池机制"
          subtitle="查看当前 UP、轮换规则、免费节点与机制说明。"
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
          title="开发路线"
          subtitle="查看近期已完成能力和下一阶段功能计划。"
          icon={Sparkles}
        />
        <RoadmapCard isOpen={showRoadmap} onToggle={handleToggleRoadmap} />
      </div>
    </div>
  );
}

export default MobileHomePageView;
