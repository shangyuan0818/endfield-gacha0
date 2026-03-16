import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, ChevronDown, Star, BarChart3, Gamepad2,
  ArrowRight, Sparkles, Map, Info, Layers, Swords,
  ArrowUpRight, Lightbulb, Github, User, Terminal
} from 'lucide-react';
import confetti from 'canvas-confetti';
import usePoolStore from '../../stores/usePoolStore';
import useAppStore from '../../stores/useAppStore';
import useAuthStore from '../../stores/useAuthStore';
import SimpleMarkdown from '../../components/SimpleMarkdown';
import { APP_VERSION } from '../../constants/appMeta';
import { getMobilePathForTab } from '../../constants/appRoutes';
import usePoolMechanicsData from '../../hooks/home/usePoolMechanicsData';
import { getCurrentUpPoolInfo, getLimitedPoolSchedule } from '../../utils/poolTimeUtils';
import { characterCache } from '../../utils/characterUtils';
import {
  STORAGE_KEYS,
  getHomeCollapseState,
  getStorageItem,
  setHomeCollapseState,
  markAsViewed
} from '../../utils';

function MobileHomeCard({ children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-none ${className}`}>
      {children}
    </div>
  );
}

function MobileHomeSectionHeader({ title, icon }) {
  const IconComponent = icon;

  return (
    <div className="flex items-center gap-2 mb-3 px-1 border-l-2 border-endfield-yellow pl-2">
      {IconComponent && <IconComponent size={14} className="text-zinc-400" />}
      <h2 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest font-mono">
        {title}
      </h2>
    </div>
  );
}

function MobileCharacterTagRow({ label, labelClassName, characters, highlightFirst = false }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`w-7 shrink-0 text-[10px] font-mono font-bold ${labelClassName}`}>{label}</span>
      <div className="flex flex-wrap gap-1">
        {characters.map((character, index) => (
          <span
            key={`${label}-${character}`}
            className={`px-1.5 py-0.5 text-[10px] border ${
              highlightFirst && index === 0
                ? 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-600 dark:bg-fuchsia-950/20 dark:border-fuchsia-900 dark:text-fuchsia-400'
                : 'bg-white border-zinc-200 text-zinc-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400'
            }`}
          >
            {character}
            {highlightFirst && index === 0 ? ' (UP)' : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * 移动端首页视图 - 工业风重构版 (中文)
 */
function MobileHomeView() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { announcements } = useAppStore();
  const pools = usePoolStore(state => state.pools);

  // 时间状态
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 折叠状态
  const initialCollapseState = getHomeCollapseState();
  const [showAnnouncement, setShowAnnouncement] = useState(!initialCollapseState.announcement);
  const [showPoolMechanics, setShowPoolMechanics] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(false);

  // 公告更新检测
  const latestAnnouncement = announcements?.[0];
  const latestAnnouncementUpdatedAt = latestAnnouncement?.updated_at || null;
  const [announcementLastViewed, setAnnouncementLastViewed] = useState(() =>
    getStorageItem(STORAGE_KEYS.ANNOUNCEMENT_LAST_VIEWED, 0)
  );
  const isAnnouncementNew = Boolean(latestAnnouncementUpdatedAt)
    && new Date(latestAnnouncementUpdatedAt).getTime() > new Date(announcementLastViewed || 0).getTime();

  useEffect(() => {
    if (showAnnouncement && isAnnouncementNew) {
      const timer = setTimeout(() => {
        markAsViewed(STORAGE_KEYS.ANNOUNCEMENT_LAST_VIEWED);
        setAnnouncementLastViewed(latestAnnouncementUpdatedAt);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showAnnouncement, isAnnouncementNew, latestAnnouncementUpdatedAt]);

  const poolsArray = Array.isArray(pools) ? pools : Object.values(pools || {});
  const currentUpInfo = useMemo(() => getCurrentUpPoolInfo(poolsArray, now), [poolsArray, now]);
  const poolSchedule = useMemo(() => getLimitedPoolSchedule(poolsArray), [poolsArray]);
  const { limitedCharacters } = usePoolMechanicsData(currentUpInfo);

  // 计算倒计时
  const countdown = useMemo(() => {
    const sortedPools = [...poolSchedule].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    let activeIndex = sortedPools.findIndex(p => now >= new Date(p.startDate) && now < new Date(p.endDate));

    if (activeIndex === -1) {
      activeIndex = sortedPools.findIndex(p => now < new Date(p.startDate));
    }

    if (activeIndex !== -1) {
      const pool = sortedPools[activeIndex];
      const start = new Date(pool.startDate);
      const end = new Date(pool.endDate);
      const isActive = now >= start && now < end;
      const target = isActive ? end : start;
      const diff = target.getTime() - now.getTime();

      if (diff > 0) {
        return {
          name: pool.name,
          isActive,
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
          characterName: pool.name,
        };
      }
    }

    return null;
  }, [poolSchedule, now]);

  // 后续卡池
  const upcomingPools = useMemo(() => {
    const sortedPools = [...poolSchedule].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    const currentIndex = sortedPools.findIndex(p => now >= new Date(p.startDate) && now < new Date(p.endDate));
    if (currentIndex === -1) return [];
    return sortedPools.slice(currentIndex + 1, currentIndex + 3);
  }, [poolSchedule, now]);

  // 庆祝按钮
  const handleCelebration = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FFFA00', '#ffffff', '#000000'] // Endfield theme confetti
    });
  }, []);

  // 快速入口
  const quickActions = [
    { id: 'dashboard', label: '卡池分析', icon: BarChart3, color: 'text-blue-500' },
    { id: 'simulator', label: '抽卡模拟', icon: Gamepad2, color: 'text-purple-500' },
    { id: 'summary', label: '统计总览', icon: Star, color: 'text-endfield-yellow' },
  ];

  // 友情链接
  const friendlyLinks = [
    { title: "攒抽计算器", url: "https://ef.yituliu.cn/tools/gacha-calculator", icon: BarChart3, label: "PLANNER" },
    { title: "终末地地图1", url: "https://opendfieldmap.cn/", icon: Map, label: "MAP_01" },
    { title: "终末地地图2", url: "https://www.zmdmap.com/", icon: Map, label: "MAP_02" },
    { title: "抽卡记录分析", url: "https://endgacha.kwer.top/", icon: BarChart3, label: "HISTORY" },
  ];

  // 路线图
  const roadmapItems = [
    { id: 'gacha-simulator', icon: Gamepad2, title: '抽卡模拟器', status: 'completed' },
    { id: 'game-import', icon: ArrowRight, title: '一键导入', status: 'completed' },
    { id: 'share', icon: ArrowUpRight, title: '分享功能', status: 'completed' },
  ];

  // 格式化日期
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatNum = (num) => String(num).padStart(2, '0');

  return (
    <div className="px-4 py-4 space-y-6">
      {/* 欢迎横幅 / 状态面板 */}
      <div className="relative bg-zinc-900 text-white border-l-4 border-endfield-yellow overflow-hidden shadow-md group">
        {/* 背景装饰网格 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />
        
        <div className="relative z-10 p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Terminal size={16} className="text-endfield-yellow" />
                <span className="text-xs font-mono text-endfield-yellow tracking-widest">SYSTEM ONLINE</span>
              </div>
              <h1 className="text-xl font-bold uppercase tracking-tight italic">
                终末地抽卡分析器
              </h1>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-zinc-500 font-mono">VERSION {APP_VERSION}</div>
              <div className="text-[10px] text-zinc-500 font-mono">{now.toLocaleTimeString('en-US', { hour12: false })}</div>
            </div>
          </div>
          
          <div className="flex items-end justify-between">
            <p className="text-sm text-zinc-400 font-mono max-w-[70%]">
              {user ? `欢迎回来，干员 ${user.user_metadata?.full_name || '管理员'}。` : '请登录以访问数据库。'}
            </p>
            <button
              onClick={handleCelebration}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-endfield-yellow border border-zinc-700 transition-colors rounded-none"
            >
              <Sparkles size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 倒计时面板 */}
      {countdown && (
        <MobileHomeCard className="overflow-hidden">
          {/* 顶部标题条 */}
          <div className="bg-zinc-100 dark:bg-zinc-800/50 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <span className={`w-1.5 h-1.5 ${countdown.isActive ? 'bg-green-500' : 'bg-endfield-yellow'} animate-pulse`} />
              {countdown.isActive ? '当前活动' : '下期预告'}
            </span>
            <span className="text-[10px] font-mono text-zinc-400">倒计时</span>
          </div>

          <div className="p-5">
            <div className="flex items-center gap-4 mb-6">
               {(() => {
                const charData = characterCache.searchByName(countdown.characterName, false);
                const avatarUrl = charData?.avatar_url;
                return (
                  <div className="w-16 h-16 bg-zinc-200 dark:bg-zinc-700 shrink-0 border border-zinc-300 dark:border-zinc-600 relative group overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={countdown.characterName} loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User size={24} className="text-zinc-400" />
                      </div>
                    )}
                    {/* 角标装饰 */}
                    <div className="absolute top-0 right-0 w-3 h-3 bg-endfield-yellow clip-path-polygon" />
                  </div>
                );
              })()}
              
              <div>
                <div className="text-xs font-mono text-zinc-400 mb-1">目标干员</div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white uppercase italic tracking-tighter leading-none">
                  {countdown.name}
                </h2>
              </div>
            </div>

            {/* 倒计时数字 - 工业风格 */}
            <div className="grid grid-cols-4 gap-2 border-t border-b border-zinc-100 dark:border-zinc-800 py-4 mb-4">
              {[
                { val: countdown.days, label: '天' },
                { val: countdown.hours, label: '时' },
                { val: countdown.minutes, label: '分' },
                { val: countdown.seconds, label: '秒' }
              ].map((item, i) => (
                <div key={i} className="text-center relative">
                  <div className="text-2xl font-bold font-mono text-zinc-800 dark:text-zinc-100 tabular-nums tracking-tighter">
                    {formatNum(item.val)}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono mt-1">{item.label}</div>
                  {i < 3 && (
                    <div className="absolute top-1/2 -right-1 -translate-y-1/2 text-zinc-200 dark:text-zinc-700 font-light text-xl">:</div>
                  )}
                </div>
              ))}
            </div>

            {/* 后续卡池列表 */}
            {upcomingPools.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono mb-2 flex items-center gap-2">
                  <ArrowRight size={10} /> 后续日程
                </div>
                {upcomingPools.map((pool) => (
                  <div key={pool.name} className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/30 p-2 border border-zinc-100 dark:border-zinc-800/50">
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">{pool.name}</span>
                    <span className="text-[10px] font-mono text-zinc-400">{formatDate(pool.startDate)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </MobileHomeCard>
      )}

      {/* 公告区域 */}
      {announcements && announcements.length > 0 && (
        <div className="border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
          <button
            onClick={() => {
              setShowAnnouncement(!showAnnouncement);
              setHomeCollapseState('announcement', showAnnouncement);
            }}
            className="w-full px-4 py-3 flex items-center justify-between touch-feedback group"
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-500 rounded-none">
                <Bell size={16} />
              </div>
              <div className="text-left">
                <div className="font-bold text-amber-900 dark:text-amber-400 text-sm line-clamp-1">
                  {announcements[0].title}
                </div>
                <div className="text-[10px] text-amber-700/60 dark:text-amber-500/60 font-mono">
                  最新动态
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isAnnouncementNew && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white animate-pulse rounded-none">
                  NEW
                </span>
              )}
              <ChevronDown
                size={16}
                className={`text-amber-400 transition-transform duration-300 ${showAnnouncement ? 'rotate-180' : ''}`}
              />
            </div>
          </button>
          {showAnnouncement && (
            <div className="px-4 pb-4 animate-fade-in border-t border-amber-100 dark:border-amber-900/30 pt-3">
              <div className="text-sm text-amber-800 dark:text-amber-300/80 max-h-48 overflow-y-auto announcement-scrollbar pr-2">
                <SimpleMarkdown content={announcements[0].content} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 快速入口 - 网格布局 */}
      <div>
        <MobileHomeSectionHeader title="快速入口" icon={Layers} />
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => navigate(getMobilePathForTab(action.id))}
                className="group flex flex-col items-center gap-3 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-endfield-yellow dark:hover:border-endfield-yellow transition-colors touch-feedback relative overflow-hidden"
              >
                {/* 悬停时的背景装饰 */}
                <div className="absolute inset-0 bg-endfield-yellow/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className={`p-0 ${action.color} group-hover:text-zinc-900 dark:group-hover:text-endfield-yellow transition-colors`}>
                  <Icon size={24} strokeWidth={1.5} />
                </div>
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white uppercase tracking-wider relative z-10">
                  {action.label}
                </span>
                
                {/* 底部装饰条 */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-endfield-yellow scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
              </button>
            );
          })}
        </div>
      </div>

      {/* 卡池机制折叠面板 */}
      <MobileHomeCard>
        <button
          onClick={() => {
            setShowPoolMechanics(!showPoolMechanics);
            setHomeCollapseState('poolMechanics', showPoolMechanics);
          }}
            className="w-full px-4 py-3 flex items-center justify-between touch-feedback hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Info size={18} className="text-blue-500" />
            <div className="text-left">
              <span className="font-bold text-zinc-800 dark:text-zinc-100 text-sm uppercase">公测卡池机制速览</span>
              <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                CURRENT UP: {currentUpInfo?.name || countdown?.name || '待公布'}
              </div>
            </div>
          </div>
          <ChevronDown
            size={18}
            className={`text-zinc-400 transition-transform ${showPoolMechanics ? 'rotate-180' : ''}`}
          />
        </button>

        {showPoolMechanics && (
          <div className="px-4 pb-4 space-y-3 animate-fade-in border-t border-zinc-100 dark:border-zinc-800 pt-4">
            <div className="flex items-center justify-between bg-blue-50/60 border border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/50 px-3 py-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-blue-500">Current Pool</span>
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">
                {currentUpInfo?.name || countdown?.name || '待公布'}
              </span>
            </div>

            <div className="grid gap-2">
                {[
                  { title: '限定角色池', icon: Star, color: 'text-fuchsia-500', pity: '80 / 120 / 240', desc: 'Limited Character Pool' },
                  { title: '武器池', icon: Swords, color: 'text-slate-500', pity: '40 / 80 / 180', desc: 'Weapon Supply' },
                  { title: '常驻池', icon: Layers, color: 'text-indigo-500', pity: '80 / 300', desc: 'Standard Search' }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="flex items-center justify-between p-2 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-700/50">
                       <div className="flex items-center gap-2">
                          <Icon size={14} className={item.color} />
                          <div className="flex flex-col">
                             <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">{item.title}</span>
                             <span className="text-[10px] text-zinc-400">{item.desc}</span>
                          </div>
                       </div>
                       <span className="text-xs font-mono font-bold text-zinc-600 dark:text-zinc-400">{item.pity}</span>
                   </div>
                  )
                })}
            </div>

            <div className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-3 space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
                Limited Pool // 限定池内容
              </div>
              <MobileCharacterTagRow
                label="6★"
                labelClassName="text-fuchsia-500"
                characters={limitedCharacters.sixStar}
                highlightFirst
              />
              <MobileCharacterTagRow
                label="5★"
                labelClassName="text-amber-500"
                characters={limitedCharacters.fiveStar}
              />
              <MobileCharacterTagRow
                label="4★"
                labelClassName="text-purple-500"
                characters={limitedCharacters.fourStar}
              />
            </div>
          </div>
        )}
      </MobileHomeCard>

      {/* 友情链接 */}
      <div>
        <MobileHomeSectionHeader title="外部链接" icon={ArrowUpRight} />
        <div className="grid grid-cols-2 gap-3">
          {friendlyLinks.map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors touch-feedback block"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-0.5">{link.label}</span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 text-xs group-hover:text-endfield-yellow transition-colors">{link.title}</span>
                  </div>
                  <Icon size={12} className="text-zinc-300 group-hover:text-zinc-500 transition-colors" />
                </div>
                <div className="h-0.5 w-4 bg-zinc-200 dark:bg-zinc-800 group-hover:w-full group-hover:bg-endfield-yellow transition-all duration-300" />
              </a>
            );
          })}
        </div>
      </div>

      {/* 路线图 */}
      <MobileHomeCard>
        <button
          onClick={() => {
            setShowRoadmap(!showRoadmap);
            setHomeCollapseState('roadmap', showRoadmap);
          }}
          className="w-full px-4 py-3 flex items-center justify-between touch-feedback"
        >
          <div className="flex items-center gap-2">
            <Lightbulb size={18} className="text-violet-500" />
            <span className="font-bold text-zinc-800 dark:text-zinc-100 text-sm uppercase">开发路线图</span>
          </div>
          <ChevronDown
            size={18}
            className={`text-zinc-400 transition-transform ${showRoadmap ? 'rotate-180' : ''}`}
          />
        </button>

        {showRoadmap && (
          <div className="px-4 pb-4 animate-fade-in border-t border-zinc-100 dark:border-zinc-800 pt-4">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {roadmapItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className="flex-shrink-0 w-28 p-3 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-700 text-center group"
                  >
                    <div className="w-8 h-8 mx-auto mb-2 bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 flex items-center justify-center group-hover:border-endfield-yellow transition-colors">
                       <Icon size={16} className="text-zinc-500 dark:text-zinc-300" />
                    </div>
                    <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">{item.title}</p>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 border ${
                      item.status === 'completed'
                        ? 'bg-green-50/50 border-green-200 text-green-600 dark:bg-green-900/10 dark:border-green-800 dark:text-green-500'
                        : 'bg-zinc-100 border-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700'
                    }`}>
                      {item.status === 'completed' ? '已完成' : '计划中'}
                    </span>
                  </div>
                );
              })}
            </div>
            <a
              href="https://github.com/MoguJunn/endfield-gacha/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full mt-3 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
            >
              <Github size={14} />
              <span>提交反馈</span>
            </a>
          </div>
        )}
      </MobileHomeCard>

      {/* 底部留白 */}
      <div className="h-4" />
    </div>
  );
}

export default MobileHomeView;
