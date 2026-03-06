import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Info, Star, Layers, Swords, Target, Zap, Gift, FileText, RefreshCw,
  ChevronDown, ChevronUp, Users, BookOpen, HelpCircle, ArrowRight,
  BarChart3, Database, Shield, Cloud, Bell, Clock, Rocket,
  Lightbulb, Gamepad2, Import, Globe, Languages, Share2, Accessibility, TestTube, CircleDot,
  Map, Github, Radio, Sparkles, Copy, Check, ExternalLink, User, ArrowUpRight, Calculator
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { getLimitedPoolSchedule, getCurrentUpPoolInfo } from '../../utils/poolTimeUtils';
import usePoolStore from '../../stores/usePoolStore';
import SimpleMarkdown from '../SimpleMarkdown';
import {
  STORAGE_KEYS,
  getHomeCollapseState,
  setHomeCollapseState,
  hasNewContent,
  markAsViewed
} from '../../utils';
import { characterCache } from '../../utils/characterUtils';

// 倒计时组件 - 终末地风格（支持 small 模式）
const CountdownTimer = React.memo(({ targetDate, title, subTitle, link, linkText, secondaryLink, secondaryLinkText, customEndedContent, size = 'normal', characterName = null }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: false });
  const hasAutoConfettiFired = useRef(false);

  // 辅助函数：计算并格式化时间差
  const calculateAndFormat = useCallback((target) => {
    const now = new Date().getTime();
    const tgt = new Date(target).getTime();
    const diff = tgt - now;

    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, ended: true };
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diff % (1000 * 60)) / 1000),
      ended: false
    };
  }, []);

  useEffect(() => {
    const updateTimers = () => {
      const newMainTime = calculateAndFormat(targetDate);

      // 避免不必要的重渲染：只有当秒数变化时才更新状态
      setTimeLeft(prev => {
        if (prev.seconds === newMainTime.seconds && prev.ended === newMainTime.ended) return prev;
        return newMainTime;
      });
    };

    updateTimers(); // 立即执行一次
    const timer = setInterval(updateTimers, 1000);

    return () => clearInterval(timer);
  }, [targetDate, calculateAndFormat]);

  // 自动撒花
  useEffect(() => {
    if (timeLeft.ended && !hasAutoConfettiFired.current && !customEndedContent) {
      hasAutoConfettiFired.current = true;
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
        // 使用默认彩色
      });
    }
  }, [timeLeft.ended, customEndedContent]);

  const fireConfetti = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.7 }
      // 使用默认彩色
    });
  }, []);

  const formatNum = (num) => String(num).padStart(2, '0');
  const isSmall = size === 'small';

  if (timeLeft.ended) {
    if (customEndedContent) return customEndedContent;
    
    return (
      <div className={`w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 ${isSmall ? 'p-4' : 'p-8'} flex flex-col gap-4 items-center justify-center relative overflow-hidden`}>
        {/* 背景装饰网格 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,250,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,250,0,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

        <div className={`text-zinc-900 dark:text-endfield-yellow font-bold font-mono tracking-widest uppercase z-10 text-center animate-fade-in ${isSmall ? 'text-lg' : 'text-xl sm:text-2xl'}`}>
          协议已启动 // 欢迎来到塔罗斯II
        </div>

        <button
          onClick={fireConfetti}
          className={`z-10 bg-endfield-yellow text-black font-bold font-mono tracking-wider rounded-sm hover:bg-yellow-400 hover:shadow-[0_0_20px_rgba(255,250,0,0.4)] active:scale-95 transition-all flex items-center gap-3 group ${isSmall ? 'px-4 py-2 text-xs' : 'px-8 py-3'}`}
        >
          <span className="text-xl group-hover:rotate-12 transition-transform">🎉</span>
          <span>庆祝时刻</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`w-full bg-white dark:bg-black relative overflow-hidden border-y-2 border-endfield-yellow/80 sm:border-2 sm:border-endfield-yellow/20 ${isSmall ? 'rounded-none sm:rounded-sm h-full flex flex-col' : ''}`}>
      {/* 背景装饰网格 */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,250,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,250,0,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

      {/* 装饰性角落标记 - 仅在大屏显示且非small模式 */}
      {!isSmall && (
        <>
          <div className="hidden sm:block absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-endfield-yellow"></div>
          <div className="hidden sm:block absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-endfield-yellow"></div>
          <div className="hidden sm:block absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-endfield-yellow"></div>
          <div className="hidden sm:block absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-endfield-yellow"></div>
        </>
      )}

      <div className={`relative z-10 flex ${isSmall ? 'flex-col gap-3 p-4 flex-1' : 'flex-col md:flex-row items-stretch'}`}>
        {/* 左侧：标题区 & 后续卡池信息 */}
        <div className={`${isSmall ? 'border-b border-zinc-100 dark:border-zinc-800 pb-3' : 'flex-1 p-6 md:p-8 flex flex-col justify-between bg-gradient-to-r from-endfield-yellow/10 to-transparent border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800/50'}`}>
          <div>
            {!isSmall && (
              <div className="flex items-center gap-2 mb-3">
                 <div className="w-1.5 h-1.5 bg-endfield-yellow animate-pulse shadow-[0_0_8px_rgba(255,250,0,0.8)]"></div>
                 <span className="text-zinc-500 dark:text-endfield-yellow/80 font-mono text-[10px] tracking-[0.2em] uppercase">系统倒计时</span>
              </div>
            )}
            <div className="flex items-center gap-4">
              {/* 当前UP角色头像 */}
              {characterName && !isSmall && (() => {
                const charData = characterCache.searchByName(characterName, false);
                const avatarUrl = charData?.avatar_url;
                return (
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-gradient-to-br from-orange-400 to-pink-500 ring-2 ring-endfield-yellow shadow-[0_0_20px_rgba(255,250,0,0.3)]">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={characterName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-full items-center justify-center text-white/80 ${avatarUrl ? 'hidden' : 'flex'}`}>
                      <User size={32} />
                    </div>
                  </div>
                );
              })()}
              <div>
                <h2 className={`${isSmall ? 'text-lg leading-tight' : 'text-3xl md:text-4xl'} font-bold text-zinc-900 dark:text-white uppercase italic tracking-tighter mb-1`}>
                  {title}
                </h2>
                <p className="text-zinc-500 text-xs font-mono tracking-wide uppercase truncate">
                  {subTitle}
                </p>
              </div>
            </div>

            <div className={`${isSmall ? 'mt-3' : 'mt-6'} flex flex-wrap items-center gap-4`}>
              {link && (
                 <a
                   href={link}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="inline-flex items-center gap-2 self-start text-xs font-mono text-zinc-500 dark:text-zinc-400 hover:text-endfield-yellow transition-colors group/link"
                 >
                    <span className="border-b border-zinc-400 dark:border-zinc-600 group-hover/link:border-endfield-yellow pb-0.5">{linkText}</span>
                    <ArrowRight size={12} className="group-hover/link:translate-x-1 transition-transform" />
                 </a>
              )}
              {secondaryLink && (
                 <a
                   href={secondaryLink}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="inline-flex items-center gap-2 self-start text-xs font-mono text-zinc-500 dark:text-zinc-400 hover:text-pink-400 transition-colors group/link2"
                 >
                    <span className="border-b border-zinc-400 dark:border-zinc-600 group-hover/link2:border-pink-400 pb-0.5">{secondaryLinkText}</span>
                    <ArrowRight size={12} className="group-hover/link2:translate-x-1 transition-transform" />
                 </a>
              )}
            </div>
          </div>
        </div>

        {/* 右侧：数字区 */}
        <div className={`${isSmall ? 'flex justify-center gap-3 sm:gap-4 items-center flex-1 py-2' : 'flex-1 p-6 md:p-8 flex items-center justify-center md:justify-end gap-2 sm:gap-4 md:gap-6 bg-zinc-50/50 dark:bg-zinc-900/20 backdrop-blur-sm'}`}>
           {/* Days */}
           <div className="flex flex-col items-center group/time">
              <div className="relative">
                 <div className={`${isSmall ? 'text-5xl sm:text-6xl' : 'text-4xl sm:text-5xl md:text-6xl'} font-bold text-zinc-800 dark:text-white font-mono tracking-tighter leading-none group-hover/time:text-endfield-yellow transition-colors duration-300`}>
                    {formatNum(timeLeft.days)}
                 </div>
                 <div className="absolute -bottom-2 left-0 w-full h-0.5 bg-zinc-200 dark:bg-zinc-800 group-hover/time:bg-endfield-yellow transition-colors duration-300"></div>
              </div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono uppercase tracking-widest mt-2">天</span>
           </div>

           <div className={`${isSmall ? 'text-3xl sm:text-4xl pb-3' : 'text-2xl sm:text-4xl pb-6'} text-zinc-300 dark:text-zinc-800 font-light`}>:</div>

           {/* Hours */}
           <div className="flex flex-col items-center group/time">
              <div className="relative">
                 <div className={`${isSmall ? 'text-5xl sm:text-6xl' : 'text-4xl sm:text-5xl md:text-6xl'} font-bold text-zinc-800 dark:text-white font-mono tracking-tighter leading-none group-hover/time:text-endfield-yellow transition-colors duration-300`}>
                    {formatNum(timeLeft.hours)}
                 </div>
                 <div className="absolute -bottom-2 left-0 w-full h-0.5 bg-zinc-200 dark:bg-zinc-800 group-hover/time:bg-endfield-yellow transition-colors duration-300"></div>
              </div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono uppercase tracking-widest mt-2">时</span>
           </div>

           <div className={`${isSmall ? 'text-3xl sm:text-4xl pb-3' : 'text-2xl sm:text-4xl pb-6'} text-zinc-300 dark:text-zinc-800 font-light`}>:</div>

           {/* Minutes */}
           <div className="flex flex-col items-center group/time">
              <div className="relative">
                 <div className={`${isSmall ? 'text-5xl sm:text-6xl' : 'text-4xl sm:text-5xl md:text-6xl'} font-bold text-zinc-800 dark:text-white font-mono tracking-tighter leading-none group-hover/time:text-endfield-yellow transition-colors duration-300`}>
                    {formatNum(timeLeft.minutes)}
                 </div>
                 <div className="absolute -bottom-2 left-0 w-full h-0.5 bg-zinc-200 dark:bg-zinc-800 group-hover/time:bg-endfield-yellow transition-colors duration-300"></div>
              </div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono uppercase tracking-widest mt-2">分</span>
           </div>

           <div className={`${isSmall ? 'text-3xl sm:text-4xl pb-3' : 'text-2xl sm:text-4xl pb-6'} text-zinc-300 dark:text-zinc-800 font-light`}>:</div>

           {/* Seconds */}
           <div className="flex flex-col items-center relative group/time">
              <div className="relative p-1 -m-1">
                 {/* 高亮背景 */}
                 <div className="absolute inset-0 bg-endfield-yellow/10 -skew-x-6 border border-endfield-yellow/20 opacity-100 sm:opacity-0 sm:group-hover/time:opacity-100 transition-opacity duration-300"></div>

                 <div className={`relative ${isSmall ? 'text-5xl sm:text-6xl' : 'text-4xl sm:text-5xl md:text-6xl'} font-bold text-amber-500 dark:text-endfield-yellow font-mono tracking-tighter leading-none`}>
                    {formatNum(timeLeft.seconds)}
                 </div>
              </div>
              <span className="text-[10px] text-amber-500/70 dark:text-endfield-yellow/70 font-mono uppercase tracking-widest mt-2">秒</span>
           </div>
        </div>
      </div>
    </div>
  );
});

CountdownTimer.displayName = 'CountdownTimer';

const CopyCode = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-800/50 px-3 py-2 rounded border border-zinc-200 dark:border-zinc-700/50 group/code hover:bg-white dark:hover:bg-zinc-800 transition-colors cursor-pointer" 
      onClick={handleCopy}
      title="点击复制"
    >
       <code className="text-zinc-800 dark:text-white font-mono font-bold tracking-wide select-all">{code}</code>
       <button
         className="text-zinc-400 dark:text-zinc-500 group-hover/code:text-zinc-600 dark:group-hover/code:text-white transition-colors"
       >
         {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
       </button>
    </div>
  );
};

// 灯笼组件 - SVG
const Lantern = ({ className, style, onClick }) => (
  <div 
    className={`absolute z-50 cursor-pointer hover:brightness-110 transition-all origin-top animate-lantern-swing ${className}`} 
    style={style} 
    onClick={onClick}
  >
    <svg width="60" height="100" viewBox="0 0 60 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_4px_6px_rgba(220,38,38,0.4)]">
      {/* 挂绳 */}
      <line x1="30" y1="0" x2="30" y2="15" stroke="#FCD34D" strokeWidth="2" />
      {/* 灯笼主体 */}
      <path d="M10 20 C5 35, 5 65, 10 80 H50 C55 65, 55 35, 50 20 Z" fill="#DC2626" stroke="#B91C1C" strokeWidth="1" />
      {/* 顶部和底部装饰 */}
      <rect x="15" y="15" width="30" height="5" fill="#FCD34D" rx="1" />
      <rect x="15" y="80" width="30" height="5" fill="#FCD34D" rx="1" />
      {/* 竖线纹理 */}
      <path d="M20 20 Q15 50 20 80" stroke="#B91C1C" strokeWidth="1" opacity="0.5" />
      <path d="M30 20 V80" stroke="#B91C1C" strokeWidth="1" opacity="0.5" />
      <path d="M40 20 Q45 50 40 80" stroke="#B91C1C" strokeWidth="1" opacity="0.5" />
      {/* 穗子 */}
      <path d="M30 85 V95" stroke="#FCD34D" strokeWidth="2" />
      <circle cx="30" cy="85" r="2" fill="#FCD34D" />
      <path d="M25 95 Q30 90 35 95" stroke="#FCD34D" strokeWidth="1" />
      {/* "福"字 (简化) */}
      <rect x="24" y="40" width="12" height="12" fill="#FCD34D" transform="rotate(45 30 46)" />
    </svg>
  </div>
);

/**
 * 首页组件
 * 包含使用指南和卡池机制速览
 */
const HomePage = React.memo(({ user, canEdit: _canEdit, announcements = [] }) => {
  // 从 store 获取卡池列表
  const pools = usePoolStore(state => state.pools);

  // 确保 pools 始终是数组
  const poolsArray = Array.isArray(pools) ? pools : [];
  
  // 新年模式状态已移除

  // 时间状态，用于驱动倒计时轮换（每分钟更新）
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 使用数据库卡池数据，fallback 到硬编码
  const poolSchedule = useMemo(() => getLimitedPoolSchedule(poolsArray), [poolsArray]);

  // 获取当前 UP 池信息（用于卡池机制速览）
  const currentUpInfo = useMemo(() => getCurrentUpPoolInfo(poolsArray), [poolsArray, now]);

  // 计算倒计时目标（主卡池）
  const countdowns = useMemo(() => {
    // 确保按开始时间排序
    const sortedPools = [...poolSchedule].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    // 找到当前正在进行的池子
    let activeIndex = sortedPools.findIndex(p => now >= new Date(p.startDate) && now < new Date(p.endDate));

    // 如果没有正在进行的，找到下一个开始的池子
    if (activeIndex === -1) {
       activeIndex = sortedPools.findIndex(p => now < new Date(p.startDate));
    }

    // 辅助函数：格式化池子数据
    const getPoolData = (index) => {
        if (index < 0 || index >= sortedPools.length) return null;
        const p = sortedPools[index];
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        const isActive = now >= start && now < end;
        return {
            ...p,
            targetDate: isActive ? p.endDate : p.startDate,
            title: isActive ? `${p.name} 池结束倒计时` : `${p.name} 池开启倒计时`,
            subTitle: isActive ? `Current Banner Ending // ${p.name}` : `Next Banner Starting // ${p.name}`,
            isActive
        };
    };

    let main = null;

    if (activeIndex !== -1) {
       main = getPoolData(activeIndex);
    }

    // 如果没有找到有效的主池子，使用默认值
    if (!main) {
       main = {
          targetDate: "2026-03-12T11:00:00+08:00",
          title: "下个版本倒计时",
          subTitle: "Waiting for Next Version"
       };
    }

    return { main };
  }, [poolSchedule, now]);

  // 从 localStorage 读取初始折叠状态
  const initialCollapseState = getHomeCollapseState();

  // 检测公告是否有更新
  const latestAnnouncement = announcements[0];
  const hasAnnouncementUpdate = latestAnnouncement
    ? hasNewContent(STORAGE_KEYS.ANNOUNCEMENT_LAST_VIEWED, latestAnnouncement.updated_at)
    : false;

  // 折叠状态
  const [showPoolMechanics, setShowPoolMechanics] = useState(!initialCollapseState.poolMechanics);
  const [showGuide, setShowGuide] = useState(!initialCollapseState.guide);
  const [showRoadmap, setShowRoadmap] = useState(!initialCollapseState.roadmap);
  const [showAnnouncement, setShowAnnouncement] = useState(
    hasAnnouncementUpdate ? true : !initialCollapseState.announcement
  );

  // 公告是否为"新"
  const [isAnnouncementNew, setIsAnnouncementNew] = useState(hasAnnouncementUpdate);

  // 处理折叠状态变化
  const handleTogglePoolMechanics = useCallback(() => {
    setShowPoolMechanics(prev => {
      const newState = !prev;
      setHomeCollapseState('poolMechanics', !newState);
      return newState;
    });
  }, []);

  const handleToggleGuide = useCallback(() => {
    setShowGuide(prev => {
      const newState = !prev;
      setHomeCollapseState('guide', !newState);
      return newState;
    });
  }, []);

  const handleToggleRoadmap = useCallback(() => {
    setShowRoadmap(prev => {
      const newState = !prev;
      setHomeCollapseState('roadmap', !newState);
      return newState;
    });
  }, []);

  const handleToggleAnnouncement = useCallback(() => {
    setShowAnnouncement(prev => {
      const newState = !prev;
      setHomeCollapseState('announcement', !newState);
      return newState;
    });
  }, []);

  // 公告查看逻辑
  const handleAnnouncementViewed = useCallback(() => {
    if (isAnnouncementNew) {
      setTimeout(() => {
        markAsViewed(STORAGE_KEYS.ANNOUNCEMENT_LAST_VIEWED);
        setIsAnnouncementNew(false);
      }, 2000);
    }
  }, [isAnnouncementNew]);

  useEffect(() => {
    if (showAnnouncement && isAnnouncementNew) {
      handleAnnouncementViewed();
    }
  }, [showAnnouncement, isAnnouncementNew, handleAnnouncementViewed]);

  // 庆祝按钮逻辑
  const handleCelebrationClick = useCallback((e) => {
    e.preventDefault();
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { x, y }
    });
  }, []);
  
  // 公告内容组件 - 带滚动检测
  const AnnouncementContent = ({ content }) => {
    const scrollRef = useRef(null);
    const [showScrollHint, setShowScrollHint] = useState(true);
    const [canScroll, setCanScroll] = useState(false);

    // 检测是否需要滚动（内容超出容器）
    useEffect(() => {
      const el = scrollRef.current;
      if (el) {
        const checkScrollable = () => {
          setCanScroll(el.scrollHeight > el.clientHeight);
        };
        checkScrollable();
        // 内容变化时重新检测
        const observer = new ResizeObserver(checkScrollable);
        observer.observe(el);
        return () => observer.disconnect();
      }
    }, [content]);

    // 滚动事件处理
    const handleScroll = useCallback((e) => {
      const el = e.target;
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
      setShowScrollHint(!isAtBottom);
    }, []);

    return (
      <div className="px-4 pb-4">
        <div className="relative">
          {/* 滚动容器 */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="pl-12 pr-4 max-h-[400px] overflow-y-auto announcement-scrollbar"
            style={{
              scrollbarWidth: 'auto',
              scrollbarColor: 'rgb(251 191 36) transparent'
            }}
          >
            <SimpleMarkdown
              content={content}
              className="text-sm text-slate-700 dark:text-zinc-300"
            />
            {/* 底部占位，确保渐变不遮挡内容 */}
            <div className="h-8"></div>
          </div>
          {/* 底部渐变遮罩 + 滚动提示 - 仅在可滚动且未到底部时显示 */}
          {canScroll && (
            <div
              className={`absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-amber-50 dark:from-amber-900/40 to-transparent pointer-events-none flex items-end justify-center pb-1 transition-opacity duration-300 ${showScrollHint ? 'opacity-100' : 'opacity-0'}`}
            >
              <div className="flex items-center gap-1 text-amber-500 dark:text-amber-400 text-xs animate-bounce">
                <ChevronDown size={14} />
                <span className="font-medium">向下滚动查看更多</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 折叠动画组件
  const CollapsibleContent = ({ isOpen, children }) => (
    <div
      className={`grid transition-all duration-500 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
    >
      <div className="overflow-hidden">
        {children}
      </div>
    </div>
  );

  // 卡池机制说明卡片
  const PoolMechanicsCard = () => {
    const { isActive, isExpired, remainingDays = 0, remainingHours = 0, startsIn, startsInHours } = currentUpInfo;
    const isEndingSoon = remainingDays <= 3 && isActive;
    const isUpcoming = !isActive && !isExpired;

    // 所有限定6星角色（按轮换顺序 + 常驻可歪角色）
    const allLimitedSixStar = ['莱万汀', '伊冯', '洁尔佩塔', '余烬', '黎风', '艾尔黛拉', '别礼', '骏卫'];

    // 动态计算当前UP角色排在第一位
    const currentUpName = currentUpInfo.name;
    const limitedSixStarSorted = [
      currentUpName,
      ...allLimitedSixStar.filter(name => name !== currentUpName)
    ];

    // 当前可获取的角色列表
    const limitedCharacters = {
      sixStar: limitedSixStarSorted,
      fiveStar: ['佩丽卡', '弧光', '艾维文娜', '大潘', '陈千语', '狼卫', '赛希', '昼雪', '阿列什'],
      fourStar: ['秋栗', '卡契尔', '埃特拉', '萤石', '安塔尔']
    };

    const standardCharacters = {
      sixStar: ['艾尔黛拉', '骏卫', '别礼', '余烬', '黎风'],
      fiveStar: ['佩丽卡', '弧光', '艾维文娜', '大潘', '陈千语', '狼卫', '赛希', '昼雪', '阿列什'],
      fourStar: ['秋栗', '卡契尔', '埃特拉', '萤石', '安塔尔']
    };

    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden relative group/card shadow-sm dark:shadow-none">
        {/* Header Style - Endfield Tech */}
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50 group-hover:bg-blue-500 transition-colors"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"></div>

        {/* 标题栏 - 可点击展开/收起 */}
        <button
          onClick={handleTogglePoolMechanics}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors relative z-10 border-b border-zinc-100 dark:border-zinc-800"
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 rounded-sm">
              <Info size={18} />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2 text-sm tracking-wide">
                公测卡池机制速览
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400 uppercase tracking-wider font-mono">System Info</span>
              </h3>
              <p className="text-xs text-zinc-500 mt-1 font-mono">
                CURRENT UP: <span className="text-zinc-700 dark:text-zinc-300 font-bold">{currentUpName}</span>
                {isActive && (
                  <span className={`ml-2 ${isEndingSoon ? 'text-amber-500' : 'text-green-600 dark:text-green-500'}`}>
                    // 剩余 {remainingDays}天{remainingHours}小时
                  </span>
                )}
                {isUpcoming && (
                  <span className="ml-2 text-blue-500">
                    // {startsIn}天{startsInHours}小时后开始
                  </span>
                )}
                {isExpired && <span className="ml-2 text-red-500">// 已结束</span>}
              </p>
            </div>
          </div>
          <ChevronUp size={20} className={`text-zinc-400 dark:text-zinc-500 transition-transform duration-300 ${showPoolMechanics ? '' : 'rotate-180'}`} />
        </button>

      {/* 展开内容 */}
        <CollapsibleContent isOpen={showPoolMechanics}>
          <div className="p-6 space-y-6 bg-zinc-50/50 dark:bg-black/20">
            {/* 三种卡池对比 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 限定角色池 */}
              <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700/50 p-4 relative group/pool hover:border-fuchsia-400 dark:hover:border-fuchsia-500/50 transition-colors shadow-sm dark:shadow-none">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <Star size={14} className="text-fuchsia-500" />
                  <h4 className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">限定角色池</h4>
                </div>
                <div className="space-y-3 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">6星保底</span>
                    <span className="text-zinc-700 dark:text-zinc-300 text-right">80抽必出<br/><span className="text-[10px] text-zinc-400 dark:text-zinc-600">65抽起概率+5%</span></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">硬保底</span>
                    <span className="text-zinc-700 dark:text-zinc-300">120抽必出限定(仅1次)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">赠送</span>
                    <span className="text-zinc-700 dark:text-zinc-300">240抽送信物</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">继承</span>
                    <span className="text-green-600 dark:text-green-500">继承到下期限定</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">新增加急招募机制</span>
                    <span className="text-zinc-700 dark:text-zinc-300">累计30抽后，赠送1发不计入保底的十连</span>
                  </div>
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/50 flex flex-col gap-1 text-[10px]">
                     <div className="flex justify-between text-zinc-500"><span>6★基础概率</span><span className="text-zinc-700 dark:text-zinc-300">0.8%（UP角色占其中50%）</span></div>
                     <div className="flex justify-between text-zinc-500"><span>5★基础概率</span><span className="text-zinc-700 dark:text-zinc-300">8.0%</span></div>
                  </div>
                </div>
              </div>

              {/* 武器池 */}
              <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700/50 p-4 relative group/pool hover:border-slate-400 dark:hover:border-slate-500/50 transition-colors shadow-sm dark:shadow-none">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <Swords size={14} className="text-slate-400" />
                  <h4 className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">武器池</h4>
                </div>
                <div className="space-y-3 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">6星保底</span>
                    <span className="text-zinc-700 dark:text-zinc-300 text-right">40抽(4次申领)必出<br/><span className="text-[10px] text-zinc-400 dark:text-zinc-600">无概率递增</span></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">硬保底</span>
                    <span className="text-zinc-700 dark:text-zinc-300">80抽必出限定(仅1次)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">赠送</span>
                    <span className="text-zinc-700 dark:text-zinc-300 text-right">100抽送武库箱<br/>180抽送限定</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">继承</span>
                    <span className="text-red-500">不继承</span>
                  </div>
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/50 flex flex-col gap-1 text-[10px]">
                     <div className="flex justify-between text-zinc-500"><span>6★基础概率</span><span className="text-zinc-700 dark:text-zinc-300">4.0%</span></div>
                     <div className="flex justify-between text-zinc-500"><span>5★基础概率</span><span className="text-zinc-700 dark:text-zinc-300">15.0%</span></div>
                  </div>
                </div>
              </div>

              {/* 常驻池 */}
              <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700/50 p-4 relative group/pool hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-colors shadow-sm dark:shadow-none">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <Layers size={14} className="text-indigo-400" />
                  <h4 className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">常驻角色池</h4>
                </div>
                <div className="space-y-3 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                   <div className="flex justify-between">
                    <span className="text-zinc-500">6星保底</span>
                    <span className="text-zinc-700 dark:text-zinc-300 text-right">80抽必出<br/><span className="text-[10px] text-zinc-400 dark:text-zinc-600">65抽起概率+5%</span></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">赠送</span>
                    <span className="text-zinc-700 dark:text-zinc-300 text-right">300抽自选6星<br/><span className="text-[10px] text-zinc-400 dark:text-zinc-600">(仅1次)</span></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">继承</span>
                    <span className="text-red-500">独立计算</span>
                  </div>
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/50 flex flex-col gap-1 text-[10px]">
                     <div className="flex justify-between text-zinc-500"><span>6★基础概率</span><span className="text-zinc-700 dark:text-zinc-300">0.8%</span></div>
                     <div className="flex justify-between text-zinc-500"><span>5★基础概率</span><span className="text-zinc-700 dark:text-zinc-300">8.0%</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* 可获取角色列表 */}
            {/* ... (reused code from above) ... */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-zinc-200 dark:border-zinc-800 pt-6">
              {/* Limited */}
              <div>
                <h4 className="font-bold text-zinc-500 dark:text-zinc-400 text-xs mb-3 flex items-center gap-2 uppercase tracking-widest">Limited Pool // 限定池内容</h4>
                <div className="space-y-2 bg-zinc-50 dark:bg-zinc-900/50 p-3 border border-zinc-200 dark:border-zinc-800/50">
                  {/* ... same content ... */}
                  <div className="flex items-baseline gap-2"><span className="text-[10px] text-fuchsia-500 font-bold font-mono w-8 shrink-0">6★</span><div className="flex flex-wrap gap-1">{limitedCharacters.sixStar.map((char,i)=><span key={char} className={`text-xs px-1.5 py-0.5 rounded-sm ${i===0?'bg-fuchsia-100 dark:bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-200 dark:border-fuchsia-500/30':'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-100 dark:border-transparent'}`}>{char}{i===0&&' (UP)'}</span>)}</div></div>
                  <div className="flex items-baseline gap-2"><span className="text-[10px] text-amber-500 font-bold font-mono w-8 shrink-0">5★</span><div className="flex flex-wrap gap-1">{limitedCharacters.fiveStar.map(char=><span key={char} className="text-xs px-1.5 py-0.5 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-500 border border-zinc-100 dark:border-transparent rounded-sm">{char}</span>)}</div></div>
                  <div className="flex items-baseline gap-2"><span className="text-[10px] text-purple-500 font-bold font-mono w-8 shrink-0">4★</span><div className="flex flex-wrap gap-1">{limitedCharacters.fourStar.map(char=><span key={char} className="text-xs px-1.5 py-0.5 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-600 border border-zinc-100 dark:border-transparent rounded-sm">{char}</span>)}</div></div>
                </div>
              </div>
              {/* Standard */}
              <div>
                <h4 className="font-bold text-zinc-500 dark:text-zinc-400 text-xs mb-3 flex items-center gap-2 uppercase tracking-widest">Standard Pool // 常驻池内容</h4>
                <div className="space-y-2 bg-zinc-50 dark:bg-zinc-900/50 p-3 border border-zinc-200 dark:border-zinc-800/50">
                   <div className="flex items-baseline gap-2"><span className="text-[10px] text-indigo-500 font-bold font-mono w-8 shrink-0">6★</span><div className="flex flex-wrap gap-1">{standardCharacters.sixStar.map(char=><span key={char} className="text-xs px-1.5 py-0.5 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-100 dark:border-transparent rounded-sm">{char}</span>)}</div></div>
                   <div className="flex items-baseline gap-2"><span className="text-[10px] text-amber-500 font-bold font-mono w-8 shrink-0">5★</span><div className="flex flex-wrap gap-1">{standardCharacters.fiveStar.map(char=><span key={char} className="text-xs px-1.5 py-0.5 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-500 border border-zinc-100 dark:border-transparent rounded-sm">{char}</span>)}</div></div>
                   <div className="flex items-baseline gap-2"><span className="text-[10px] text-purple-500 font-bold font-mono w-8 shrink-0">4★</span><div className="flex flex-wrap gap-1">{standardCharacters.fourStar.map(char=><span key={char} className="text-xs px-1.5 py-0.5 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-600 border border-zinc-100 dark:border-transparent rounded-sm">{char}</span>)}</div></div>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    );
  };

  // 使用指南卡片
  const GuideCard = () => (
    <div className="border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden relative group/card">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500 origin-left scale-x-0 group-hover/card:scale-x-100 transition-transform duration-500"></div>
      
      {/* 标题栏 - 可点击展开/收起 */}
      <button
        onClick={handleToggleGuide}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors relative z-10"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
            <BookOpen size={20} />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
              使用指南
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">
              系统操作手册与功能索引
            </p>
          </div>
        </div>
        <div className={`transition-transform duration-300 ${showGuide ? '' : 'rotate-180'}`}>
          <ChevronUp size={20} className="text-zinc-400" />
        </div>
      </button>

      {/* 展开内容 - 使用 grid 动画 */}
      <CollapsibleContent isOpen={showGuide}>
        <div className="px-6 pb-6 bg-zinc-50/50 dark:bg-black/20">
          <div className="border border-zinc-200 dark:border-zinc-700 bg-zinc-100/50 dark:bg-zinc-900/50">
             <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800">
                
                {/* Step 1: 导入数据 */}
                <div className="p-6 flex flex-col gap-3">
                   <div className="flex items-center gap-2 mb-2">
                      <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono text-[10px] px-1.5 py-0.5 rounded-sm font-bold">STEP 01</span>
                      <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-sm">数据录入流程</h4>
                   </div>
                   <div className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed space-y-2">
                      <p>
                         <span className="text-zinc-400 dark:text-zinc-600 font-bold mr-1">01.</span>
                         点击右上角 <span className="font-bold text-slate-700 dark:text-zinc-300">登录/注册</span> 账号，确保数据可云端保存。
                      </p>
                      <p>
                         <span className="text-zinc-400 dark:text-zinc-600 font-bold mr-1">02.</span>
                         点击顶部的 <span className="font-bold text-slate-700 dark:text-zinc-300">「导入数据」</span> 按钮，打开导入面板。
                      </p>
                      <p>
                         <span className="text-zinc-400 dark:text-zinc-600 font-bold mr-1">03.</span>
                         按照指引登录鹰角网络通行证（支持官服/B服），复制显示的<span className="font-bold text-slate-700 dark:text-zinc-300">数据内容</span>。
                      </p>
                      <p>
                         <span className="text-zinc-400 dark:text-zinc-600 font-bold mr-1">04.</span>
                         将复制的内容粘贴至输入框，系统将自动获取您的历史抽卡记录。
                      </p>
                   </div>
                   <div className="mt-auto pt-3 border-t border-zinc-200/50 dark:border-zinc-700/50">
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono uppercase">
                         <Import size={12} />
                         <span>Token Import System</span>
                      </div>
                   </div>
                </div>

                {/* Step 2: 统计分析 */}
                <div className="p-6 flex flex-col gap-3">
                   <div className="flex items-center gap-2 mb-2">
                      <span className="bg-endfield-yellow/20 text-amber-700 dark:text-endfield-yellow font-mono text-[10px] px-1.5 py-0.5 rounded-sm font-bold">STEP 02</span>
                      <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-sm">深度数据分析</h4>
                   </div>
                   <div className="text-xs text-slate-500 dark:text-zinc-400 space-y-3 leading-relaxed">
                      <div>
                         <strong className="block text-slate-700 dark:text-zinc-300 mb-1">📊 卡池详情页</strong>
                         <ul className="list-disc pl-4 space-y-1">
                            <li>查看当前卡池的<span className="text-amber-600 dark:text-amber-500">水位垫刀</span>与保底进度。</li>
                            <li>分析 6 星出货的<span className="text-blue-600 dark:text-blue-400">平均消耗</span>与不歪率。</li>
                            <li>追踪 120 抽硬保底与 240 抽赠送进度。</li>
                         </ul>
                      </div>
                      <div>
                         <strong className="block text-slate-700 dark:text-zinc-300 mb-1">📈 统计汇总页</strong>
                         <p>全账号生涯数据总览，包含欧非评价（基于全服数据对比）、各稀有度分布占比及历史出货曲线。</p>
                      </div>
                   </div>
                   <div className="mt-auto pt-3 border-t border-zinc-200/50 dark:border-zinc-700/50">
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono uppercase">
                         <BarChart3 size={12} />
                         <span>Visual Analytics</span>
                      </div>
                   </div>
                </div>

                {/* Step 3: 更多功能 */}
                <div className="p-6 flex flex-col gap-3">
                   <div className="flex items-center gap-2 mb-2">
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-mono text-[10px] px-1.5 py-0.5 rounded-sm font-bold">STEP 03</span>
                      <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-sm">实用工具与服务</h4>
                   </div>
                   <div className="text-xs text-slate-500 dark:text-zinc-400 space-y-3 leading-relaxed">
                      <div>
                         <strong className="block text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1"><Gamepad2 size={12}/> 抽卡模拟器</strong>
                         <p>真实还原游戏内概率模型（含 65 抽软保底机制），支持无限十连，用于测试手气或规划资源。</p>
                      </div>
                      <div>
                         <strong className="block text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1"><Cloud size={12}/> 云端同步服务</strong>
                         <p>登录后您的所有数据将加密存储于云端数据库，支持在 PC、手机等不同设备间无缝切换，数据永不丢失。</p>
                      </div>
                   </div>
                   <div className="mt-auto pt-3 border-t border-zinc-200/50 dark:border-zinc-700/50">
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono uppercase">
                         <Zap size={12} />
                         <span>Tools & Cloud Sync</span>
                      </div>
                   </div>
                </div>

             </div>
          </div>
        </div>
      </CollapsibleContent>
    </div>
  );

  // 待增加功能卡片 - 时间轴版 (横向)
  const RoadmapCard = () => {
    // ... (reused items) ...
    const roadmapItems = [
      { id: 'sim-inherit', icon: RefreshCw, title: '模拟器状态继承', description: '卡池模拟器支持继承游戏内的真实抽卡与保底状态', status: 'planned', priority: 'high', tag: '功能增强' },
      { id: 'puzzle-captcha', icon: Shield, title: '拼图验证码', description: '主站验证码更换为简单拼图玩法，同时保留现有方式', status: 'planned', priority: 'high', tag: '安全验证' },
      { id: 'global-support', icon: Globe, title: '国际服支持', description: '支持国际服抽卡记录的解析与导入', status: 'planned', priority: 'high', tag: '数据扩展' },
      { id: 'currency-calc', icon: Calculator, title: '资源消耗换算', description: '支持换算已消耗合成玉、源石数量及已获得武库配额数量', status: 'planned', priority: 'medium', tag: '统计分析' },
      { id: 'sim-currency', icon: Database, title: '模拟器资源机制', description: '模拟器添加合成玉和源石的使用和获取机制', status: 'planned', priority: 'medium', tag: '玩法扩展' },
      { id: 'share', icon: Share2, title: '分享功能', description: '生成抽卡结果分享图片或链接，向朋友展示你的欧气', status: 'planned', priority: 'medium', tag: '社交传播' },
      { id: 'i18n', icon: Languages, title: '国际化支持', description: '支持英语、日语等多语言界面，服务更多玩家', status: 'planned', priority: 'low', tag: '用户扩展' },
      { id: 'a11y', icon: Accessibility, title: '无障碍优化', description: '完善ARIA标签和键盘导航，提升可访问性', status: 'planned', priority: 'low', tag: '体验优化' },
      { id: 'virtual-scroll', icon: Database, title: '虚拟滚动', description: '优化长列表性能，支持更大数据量的流畅浏览', status: 'planned', priority: 'low', tag: '性能优化' }
    ];

    const statusConfig = {
      completed: { bg: 'bg-green-500/10 text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800', label: '已完成' },
      in_progress: { bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800', label: '开发中' },
      planned: { bg: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400', border: 'border-zinc-200 dark:border-zinc-800', label: '计划中' }
    };

    const priorityConfig = {
      high: { color: 'text-amber-500', bg: 'bg-amber-500', border: 'border-amber-500', ring: 'ring-amber-500/30' },
      medium: { color: 'text-blue-500', bg: 'bg-blue-500', border: 'border-blue-500', ring: 'ring-blue-500/30' },
      low: { color: 'text-zinc-400', bg: 'bg-zinc-400', border: 'border-zinc-400', ring: 'ring-zinc-500/30' }
    };

    return (
      <div className="group relative overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-all duration-300 rounded-none sm:rounded-lg">
        {/* 背景装饰 */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
        <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
             <Map size={240} />
        </div>

        {/* 标题栏 */}
        <button 
          onClick={handleToggleRoadmap}
          className="w-full relative px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-zinc-800/80 transition-colors text-left"
        >
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30 rounded-lg">
                <Lightbulb size={20} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-zinc-100 tracking-tight">
                  功能路线图
                  <span className="ml-2 text-xs font-normal text-zinc-400 px-2 py-0.5 border border-zinc-200 dark:border-zinc-700 rounded-full font-mono">Roadmap</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">
                  持续进化的功能迭代计划
                </p>
              </div>
            </div>
            <div className={`sm:hidden transition-transform duration-300 ${showRoadmap ? '' : 'rotate-180'}`}>
              <ChevronUp size={20} className="text-zinc-400" />
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-xs">
             <div className="hidden sm:flex items-center gap-1.5" title="高优先级功能">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span className="text-zinc-600 dark:text-zinc-400 font-medium">High Priority</span>
             </div>
             <a 
                href="https://github.com/MoguJunn/endfield-gacha/issues" 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-md transition-colors"
             >
                <Github size={14} />
                <span>反馈建议</span>
             </a>
             <div className={`hidden sm:block transition-transform duration-300 ${showRoadmap ? '' : 'rotate-180'}`}>
                <ChevronUp size={20} className="text-zinc-400" />
             </div>
          </div>
        </button>

        {/* 横向时间轴布局 - 紧凑版 */}
        <CollapsibleContent isOpen={showRoadmap}>
          <div className="relative px-6 py-6 overflow-x-auto scrollbar-hide">
             <div className="min-w-max">
               {/* 装饰线条 - 横向贯穿 */}
               <div className="absolute top-[38px] left-6 right-6 h-0.5 bg-zinc-100 dark:bg-zinc-800"></div>

               <div className="flex gap-4">
                 {roadmapItems.map((item, index) => {
                    const status = statusConfig[item.status];
                    const priority = priorityConfig[item.priority];
                    const Icon = item.icon;
                    
                    return (
                      <div 
                        key={item.id}
                        className="relative w-40 flex-shrink-0 group/item animate-fade-in-up pt-3"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                         {/* 时间轴节点 - 居中显示 */}
                         <div className={`absolute top-0 left-1/2 -translate-x-1/2 p-1 rounded-full bg-white dark:bg-zinc-900 border-2 ${priority.border} ring-2 ${priority.ring} z-10 transition-transform duration-300 group-hover/item:scale-125`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${priority.bg}`}></div>
                         </div>

                         {/* 内容卡片 */}
                         <div className="mt-5 relative bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 hover:border-violet-300 dark:hover:border-violet-700/50 hover:shadow-md transition-all duration-300 h-full flex flex-col">
                            {/* 顶部装饰条 */}
                            <div className={`absolute top-0 left-3 right-3 h-0.5 rounded-b ${priority.bg}`}></div>
                            
                            <div className="flex flex-col gap-2 mb-3 mt-1 text-center">
                               <div className="mx-auto p-2 rounded-md bg-white dark:bg-zinc-800 shadow-sm inline-flex">
                                  <Icon size={20} className="text-zinc-500 dark:text-zinc-400 group-hover/item:text-violet-500 transition-colors" />
                               </div>
                               <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-sm leading-snug">{item.title}</h4>
                            </div>
                            
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-3 flex-1 text-center">
                              {item.description}
                            </p>

                            <div className="flex items-center justify-center gap-2 mt-auto pt-3 border-t border-zinc-100 dark:border-zinc-800/50">
                                <span className={`px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase border rounded ${status.bg} ${status.border}`}>
                                  {status.label}
                                </span>
                             </div>
                         </div>
                      </div>
                    );
                 })}
               </div>
             </div>
          </div>
          
          {/* 移动端底部按钮 */}
          <div className="sm:hidden px-6 pb-6 pt-2 border-t border-zinc-100 dark:border-zinc-800">
               <a 
                  href="https://github.com/MoguJunn/endfield-gacha/issues" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium text-sm rounded-lg transition-colors mt-4"
               >
                  <Github size={16} />
                  <span>在 GitHub 上反馈建议</span>
               </a>
          </div>
        </CollapsibleContent>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* 欢迎横幅 - 默认模式 */}
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
          
          {/* 庆祝按钮 */}
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
        
        {/* 背景星星装饰 - 仅在非新年模式或作为底层装饰 */}
        <div className="absolute -right-10 -bottom-10 pointer-events-none text-white/10">
          <Star size={200} />
        </div>
      </div>

      {/* 安全声明卡片 */}
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
              <p>本站<strong>绝对不会</strong>存在窃取玩家电脑数据的恶意脚本。核心代码均已开源接受严格监督，一切纯净运行于浏览器沙盒内，无任何系统后门或越权操作。</p>
              <p>如果各位对本站不放心，请在获取数据之后<strong>退出游戏网页登录</strong>。反复登录获取到的凭证是不同的，退出登录可使之前获取的 Token 失效，确保您的账号安全。</p>
            </div>
          </div>
        </div>
      </div>

      {/* 公告区域 - 可折叠 */}
      {announcements.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-none overflow-hidden">
          {/* 公告标题栏 - 可点击折叠 */}
          <button
            onClick={handleToggleAnnouncement}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-none text-amber-600 dark:text-amber-400 shrink-0 relative">
                <Bell size={20} />
                {/* NEW 标签 - 公告有更新时显示 */}
                {isAnnouncementNew && (
                  <span className="absolute -top-1 -right-1 px-1 py-0.5 text-[8px] font-bold bg-red-500 text-white rounded animate-pulse">
                    NEW
                  </span>
                )}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-amber-800 dark:text-amber-300">{announcements[0].title}</h3>
                  {/* NEW 标签（另一个位置） */}
                  {isAnnouncementNew && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded animate-pulse">
                      NEW
                    </span>
                  )}
                </div>
                {announcements[0].version && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300 rounded">
                    v{announcements[0].version}
                  </span>
                )}
              </div>
            </div>
            <ChevronUp size={20} className={`text-amber-400 transition-transform duration-300 ${showAnnouncement ? '' : 'rotate-180'}`} />
          </button>

          {/* 公告内容 - 使用 grid 动画，限制最大高度 */}
          <CollapsibleContent isOpen={showAnnouncement}>
            <AnnouncementContent content={announcements[0].content} />
          </CollapsibleContent>
        </div>
      )}

      {/* 倒计时区域 */}
      <div className="flex flex-col gap-4">
        {/* 动态倒计时 - 主卡池 (Large) */}
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

        {/* 移除原来的 Small 倒计时 Grid */}

        {/* UP池轮换计划 - 独立卡片 */}
        {poolSchedule.length > 0 && (
          <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden relative">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"></div>
            <div className="relative z-10 px-6 py-4">
              <h4 className="font-bold text-zinc-500 dark:text-zinc-400 text-xs mb-4 flex items-center gap-2 uppercase tracking-widest">
                <RefreshCw size={12} />
                Rotation Schedule // 轮换计划
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  let currentActiveIndex = -1;
                  for (let i = 0; i < poolSchedule.length; i++) {
                    const pool = poolSchedule[i];
                    const start = new Date(pool.startDate);
                    const end = new Date(pool.endDate);
                    if (now >= start && now < end) {
                      currentActiveIndex = i;
                      break;
                    }
                  }

                  return poolSchedule.map((pool, index) => {
                    const poolStart = new Date(pool.startDate);
                    const poolEnd = new Date(pool.endDate);
                    const isCurrent = now >= poolStart && now < poolEnd;
                    const isPast = now >= poolEnd;

                    const launchCharacters = ['莱万汀', '洁尔佩塔', '伊冯'];
                    const isLaunchChar = launchCharacters.includes(pool.name);
                    const hasEntered = isLaunchChar ? currentActiveIndex >= 0 : index <= currentActiveIndex;
                    const hasNotExpired = currentActiveIndex < (index + (pool.removesAfter || 1));
                    const isInPool = currentActiveIndex !== -1 && hasEntered && hasNotExpired;

                    // 计算状态描述
                    let statusLabel = null;
                    if (isCurrent) {
                      statusLabel = '当前UP角色';
                    } else if (isInPool && pool.removesAfter) {
                      const remainingRotations = (index + pool.removesAfter) - currentActiveIndex - 1;
                      if (remainingRotations <= 1) {
                        statusLabel = '下一次卡池轮换后移出';
                      } else {
                        statusLabel = `第2次卡池轮换后移出`;
                      }
                    } else if (!isPast && currentActiveIndex !== -1 && index > currentActiveIndex) {
                      const diff = index - currentActiveIndex;
                      if (diff === 1) statusLabel = '下一卡池UP';
                      else if (diff === 2) statusLabel = '下下次卡池UP';
                    }

                    const charData = characterCache.searchByName(pool.name, false);
                    const avatarUrl = charData?.avatar_url;

                    const formatDateTime = (date) => {
                      const month = date.getMonth() + 1;
                      const day = date.getDate();
                      const hours = date.getHours().toString().padStart(2, '0');
                      const minutes = date.getMinutes().toString().padStart(2, '0');
                      return `${month}/${day} ${hours}:${minutes}`;
                    };

                    let containerClass = "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400";
                    if (isCurrent) {
                      containerClass = "bg-endfield-yellow/10 border-endfield-yellow text-amber-600 dark:text-endfield-yellow ring-1 ring-endfield-yellow/50 animate-pulse";
                    } else if (isInPool) {
                      containerClass = "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400";
                    } else if (isPast) {
                      containerClass = "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 line-through opacity-70";
                    }

                    return (
                      <React.Fragment key={pool.name}>
                        <div className={`px-3 py-2 rounded-sm text-xs font-mono transition-all border ${containerClass}`}>
                          <div className="font-bold flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
                              isCurrent
                                ? 'bg-gradient-to-br from-orange-400 to-pink-500 ring-1 ring-endfield-yellow'
                                : isInPool
                                  ? 'bg-blue-200 dark:bg-blue-800'
                                  : 'bg-zinc-200 dark:bg-zinc-700'
                            }`}>
                              {avatarUrl ? (
                                <img src={avatarUrl} alt={pool.name} className="w-full h-full object-cover"
                                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                              ) : null}
                              <div className={`w-full h-full items-center justify-center text-white/80 ${avatarUrl ? 'hidden' : 'flex'}`}>
                                <User size={12} />
                              </div>
                            </div>
                            <span>{pool.name}</span>
                            {isCurrent && <span className="text-[10px] font-bold">UP</span>}
                            {isInPool && !isCurrent && <span className="text-[10px] opacity-80">(在卡池中)</span>}
                          </div>
                          <div className="text-[10px] opacity-70 mt-1 ml-8">
                            {formatDateTime(poolStart)} - {formatDateTime(poolEnd)}
                          </div>
                          {statusLabel && (
                            <div className={`text-[10px] mt-1 ml-8 font-bold ${
                              isCurrent ? 'text-amber-600 dark:text-endfield-yellow' :
                              isInPool ? 'text-blue-500 dark:text-blue-400' :
                              'text-zinc-400 dark:text-zinc-500'
                            }`}>
                              {statusLabel}
                            </div>
                          )}
                        </div>
                        {index < poolSchedule.length - 1 && (
                          <div className="w-4 h-px bg-zinc-200 dark:bg-zinc-800"></div>
                        )}
                      </React.Fragment>
                    );
                  });
                })()}
                <div className="w-4 h-px bg-zinc-200 dark:bg-zinc-800"></div>
                <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 rounded-sm text-xs font-mono">
                  待公布...
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 公测兑换码汇总 & 下版本倒计时 - 分离的两个卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Friendly Links - Enhanced Design */}
          <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 relative overflow-hidden group h-full flex flex-col">
             {/* Background Pattern */}
             <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
             
             <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center gap-2 mb-6">
                   <div className="w-1.5 h-1.5 bg-blue-500 rounded-sm animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                   <h3 className="text-zinc-500 dark:text-zinc-400 text-xs font-mono tracking-[0.2em] uppercase">Friendly Links // 友情链接</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                   {[
                     { title: "一图流攒抽计算器", url: "https://ef.yituliu.cn/tools/gacha-calculator", icon: BarChart3, label: "RESOURCE PLANNER" },
                     { title: "终末地地图（1）", url: "https://opendfieldmap.cn/", icon: Map, label: "OPEN WORLD MAP" },
                     { title: "终末地地图（笋干）", url: "https://www.zmdmap.com/", icon: Map, label: "GAME MAP WIKI" },
                     { title: "同样优秀的抽卡记录分析（还有舟本体的）", url: "https://endgacha.kwer.top/", icon: BarChart3, label: "GACHA ANALYZER" },
                   ].map((link) => (
                     <a 
                       key={link.url}
                       href={link.url}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="group/card relative flex flex-col justify-between p-4 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-endfield-yellow hover:bg-white dark:hover:bg-zinc-900 transition-all duration-300 overflow-hidden"
                     >
                        {/* Hover Accent Bar */}
                        <div className="absolute top-0 left-0 w-0 h-0.5 bg-amber-500 dark:bg-endfield-yellow group-hover/card:w-full transition-all duration-500 ease-out"></div>
                        
                        <div className="flex items-start justify-between mb-3">
                           <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-mono text-zinc-400 group-hover/card:text-amber-600 dark:group-hover/card:text-endfield-yellow/90 transition-colors uppercase tracking-wider">{link.label}</span>
                              <span className="font-bold text-zinc-800 dark:text-zinc-200 group-hover/card:text-black dark:group-hover/card:text-white transition-colors">{link.title}</span>
                           </div>
                           <div className="p-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 group-hover/card:border-amber-200 dark:group-hover/card:border-endfield-yellow/50 group-hover/card:bg-amber-50 dark:group-hover/card:bg-endfield-yellow/10 transition-colors rounded-sm text-zinc-400 group-hover/card:text-amber-600 dark:group-hover/card:text-endfield-yellow">
                              <link.icon size={16} />
                           </div>
                        </div>
                        
                        <div className="flex items-center gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800 group-hover/card:border-zinc-100 dark:group-hover/card:border-zinc-800/50 transition-colors">
                           <div className="w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-700 group-hover/card:bg-amber-500 dark:group-hover/card:bg-endfield-yellow rounded-full transition-colors"></div>
                           <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[120px]">
                              {new URL(link.url).hostname}
                           </span>
                           <ArrowUpRight size={12} className="ml-auto text-zinc-300 group-hover/card:text-amber-600 dark:group-hover/card:text-endfield-yellow group-hover/card:-translate-y-0.5 group-hover/card:translate-x-0.5 transition-all" />
                        </div>
                     </a>
                   ))}
                </div>
             </div>
          </div>

          {/* Next Version Countdown Card - 使用 small 模式直接展示 */}
          <div className="h-full">
             <CountdownTimer 
               targetDate="2026-03-12T11:00:00+08:00" 
               title="下个版本倒计时"
               subTitle="下个版本发布"
               customEndedContent={<span>版本已上线</span>}
               size="small"
             />
          </div>
        </div>
      </div>

      {/* 使用指南 */}
      <GuideCard />

      {/* 卡池机制速览 */}
      <PoolMechanicsCard />

      {/* 待增加功能 */}
      <RoadmapCard />
    </div>
  );
});

HomePage.displayName = 'HomePage';

export default HomePage;
