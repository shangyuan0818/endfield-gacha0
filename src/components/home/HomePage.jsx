import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Info, Star, Layers, Swords, Target, Zap, Gift, FileText, RefreshCw,
  ChevronDown, ChevronUp, Users, BookOpen, HelpCircle, ArrowRight,
  BarChart3, Database, Shield, Cloud, Bell, Clock, Rocket,
  Lightbulb, Gamepad2, Import, Globe, Languages, Share2, Accessibility, TestTube, CircleDot,
  Map, Github, Radio, Sparkles, Copy, Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { LIMITED_POOL_SCHEDULE, getCurrentUpPool } from '../../constants';
import SimpleMarkdown from '../SimpleMarkdown';
import {
  STORAGE_KEYS,
  getHomeCollapseState,
  setHomeCollapseState,
  hasNewContent,
  markAsViewed
} from '../../utils';
import {
  getUrgentButtonClicks,
  incrementUrgentButtonClicksBatch,
  subscribeToUrgentButtonClicks
} from '../../services/statsService';

// 倒计时组件 - 终末地风格（移到 HomePage 外部以避免重复渲染）
const CountdownTimer = React.memo(({ targetDate, title, subTitle, link, linkText, secondaryLink, secondaryLinkText, urgentClicks, onUrgentClick, customEndedContent }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: false });
  const hasAutoConfettiFired = useRef(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const difference = target - now;

      if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, ended: true };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
        ended: false
      };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

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

  if (timeLeft.ended) {
    if (customEndedContent) return customEndedContent;
    
    return (
      <div className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-8 flex flex-col gap-6 items-center justify-center relative overflow-hidden">
        {/* 背景装饰网格 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,250,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,250,0,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

        <div className="text-zinc-900 dark:text-endfield-yellow text-xl sm:text-2xl font-bold font-mono tracking-widest uppercase z-10 text-center animate-fade-in">
          Protocol Initiated // Welcome to Talos-II
        </div>

        <button
          onClick={fireConfetti}
          className="z-10 px-8 py-3 bg-endfield-yellow text-black font-bold font-mono tracking-wider rounded-sm hover:bg-yellow-400 hover:shadow-[0_0_20px_rgba(255,250,0,0.4)] active:scale-95 transition-all flex items-center gap-3 group"
        >
          <span className="text-xl group-hover:rotate-12 transition-transform">🎉</span>
          <span>CELEBRATE</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-black relative overflow-hidden border-y-2 border-endfield-yellow/80 sm:border-2 sm:border-endfield-yellow/20">
      {/* 背景装饰网格 */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,250,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,250,0,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

      {/* 装饰性角落标记 - 仅在大屏显示 */}
      <div className="hidden sm:block absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-endfield-yellow"></div>
      <div className="hidden sm:block absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-endfield-yellow"></div>
      <div className="hidden sm:block absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-endfield-yellow"></div>
      <div className="hidden sm:block absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-endfield-yellow"></div>

      {/* "急" 按钮 - 调整位置到中间偏下，改为方形，显示点击统计 */}
      {onUrgentClick && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1">
          <button
            onClick={onUrgentClick}
            disabled={!onUrgentClick}
            className="w-12 h-12 bg-red-600 hover:bg-red-500 text-white font-bold rounded-sm shadow-lg shadow-red-600/30 flex items-center justify-center text-lg transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 enabled:opacity-90 enabled:hover:opacity-100 border border-red-400/50 group/urgent"
            title={urgentClicks !== undefined ? `全球已急 ${urgentClicks.toLocaleString()} 次` : "急急急"}
          >
            急
          </button>
          {urgentClicks !== undefined && urgentClicks > 0 && (
            <div className="bg-white/80 dark:bg-black/80 border border-red-200 dark:border-red-800/50 px-2 py-0.5 rounded-sm backdrop-blur-sm">
              <span className="text-[10px] font-mono text-red-600 dark:text-red-400">
                {urgentClicks.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="relative z-10 flex flex-col md:flex-row items-stretch">
        {/* 左侧：标题区 */}
        <div className="flex-1 p-6 md:p-8 flex flex-col justify-center bg-gradient-to-r from-endfield-yellow/10 to-transparent border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800/50">
          <div className="flex items-center gap-2 mb-3">
             <div className="w-1.5 h-1.5 bg-endfield-yellow animate-pulse shadow-[0_0_8px_rgba(255,250,0,0.8)]"></div>
             <span className="text-zinc-500 dark:text-endfield-yellow/80 font-mono text-[10px] tracking-[0.2em] uppercase">System Countdown</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white uppercase italic tracking-tighter mb-2">
            {title}
          </h2>
          <p className="text-zinc-500 text-xs font-mono tracking-wide uppercase">
            {subTitle}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4">
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

        {/* 右侧：数字区 */}
        <div className="flex-1 p-6 md:p-8 flex items-center justify-center md:justify-end gap-2 sm:gap-4 md:gap-6 bg-zinc-50/50 dark:bg-zinc-900/20 backdrop-blur-sm">
           {/* Days */}
           <div className="flex flex-col items-center group/time">
              <div className="relative">
                 <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-zinc-800 dark:text-white font-mono tracking-tighter leading-none group-hover/time:text-endfield-yellow transition-colors duration-300">
                    {formatNum(timeLeft.days)}
                 </div>
                 <div className="absolute -bottom-2 left-0 w-full h-0.5 bg-zinc-200 dark:bg-zinc-800 group-hover/time:bg-endfield-yellow transition-colors duration-300"></div>
              </div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono uppercase tracking-widest mt-3">Days</span>
           </div>

           <div className="text-2xl sm:text-4xl text-zinc-300 dark:text-zinc-800 font-light pb-6">:</div>

           {/* Hours */}
           <div className="flex flex-col items-center group/time">
              <div className="relative">
                 <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-zinc-800 dark:text-white font-mono tracking-tighter leading-none group-hover/time:text-endfield-yellow transition-colors duration-300">
                    {formatNum(timeLeft.hours)}
                 </div>
                 <div className="absolute -bottom-2 left-0 w-full h-0.5 bg-zinc-200 dark:bg-zinc-800 group-hover/time:bg-endfield-yellow transition-colors duration-300"></div>
              </div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono uppercase tracking-widest mt-3">Hrs</span>
           </div>

           <div className="text-2xl sm:text-4xl text-zinc-300 dark:text-zinc-800 font-light pb-6">:</div>

           {/* Minutes */}
           <div className="flex flex-col items-center group/time">
              <div className="relative">
                 <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-zinc-800 dark:text-white font-mono tracking-tighter leading-none group-hover/time:text-endfield-yellow transition-colors duration-300">
                    {formatNum(timeLeft.minutes)}
                 </div>
                 <div className="absolute -bottom-2 left-0 w-full h-0.5 bg-zinc-200 dark:bg-zinc-800 group-hover/time:bg-endfield-yellow transition-colors duration-300"></div>
              </div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono uppercase tracking-widest mt-3">Min</span>
           </div>

           <div className="text-2xl sm:text-4xl text-zinc-300 dark:text-zinc-800 font-light pb-6">:</div>

           {/* Seconds */}
           <div className="flex flex-col items-center relative group/time">
              <div className="relative p-2 -m-2">
                 {/* 高亮背景 */}
                 <div className="absolute inset-0 bg-endfield-yellow/10 -skew-x-6 border border-endfield-yellow/20 opacity-100 sm:opacity-0 sm:group-hover/time:opacity-100 transition-opacity duration-300"></div>

                 <div className="relative text-4xl sm:text-5xl md:text-6xl font-bold text-amber-500 dark:text-endfield-yellow font-mono tracking-tighter leading-none">
                    {formatNum(timeLeft.seconds)}
                 </div>
              </div>
              <span className="text-[10px] text-amber-500/70 dark:text-endfield-yellow/70 font-mono uppercase tracking-widest mt-3">Sec</span>
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

/**
 * 首页组件
 * 包含使用指南和卡池机制速览
 */
const HomePage = React.memo(({ user, canEdit, announcements = [] }) => {
  // 从 localStorage 读取初始折叠状态
  const initialCollapseState = getHomeCollapseState();

  // 检测公告是否有更新
  const latestAnnouncement = announcements[0];
  const hasAnnouncementUpdate = latestAnnouncement
    ? hasNewContent(STORAGE_KEYS.ANNOUNCEMENT_LAST_VIEWED, latestAnnouncement.updated_at)
    : false;

  // 折叠状态：如果有公告更新，默认展开公告
  const [showPoolMechanics, setShowPoolMechanics] = useState(!initialCollapseState.poolMechanics);
  const [showGuide, setShowGuide] = useState(!initialCollapseState.guide);
  const [showRoadmap, setShowRoadmap] = useState(!initialCollapseState.roadmap);
  const [showAnnouncement, setShowAnnouncement] = useState(
    hasAnnouncementUpdate ? true : !initialCollapseState.announcement
  );

  // 公告是否为"新"（未查看过）
  const [isAnnouncementNew, setIsAnnouncementNew] = useState(hasAnnouncementUpdate);

  // "急"按钮点击统计
  const [urgentClicks, setUrgentClicks] = useState(0);
  const [isClickingUrgent, setIsClickingUrgent] = useState(false);

  // 本地点击计数器和防抖定时器
  const pendingClicksRef = useRef(0); // 待上传的点击次数
  const uploadTimerRef = useRef(null); // 上传定时器
  const UPLOAD_DELAY = 2000; // 停止点击后 2 秒上传

  // 处理折叠状态变化并保存到 localStorage
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

  // 用户主动点击公告区域时标记为已查看（延迟执行，让用户看到 NEW 标签）
  const handleAnnouncementViewed = useCallback(() => {
    if (isAnnouncementNew) {
      // 延迟 2 秒后标记为已查看，让用户有足够时间看到 NEW 标签
      setTimeout(() => {
        markAsViewed(STORAGE_KEYS.ANNOUNCEMENT_LAST_VIEWED);
        setIsAnnouncementNew(false);
      }, 2000);
    }
  }, [isAnnouncementNew]);

  // 公告展开时延迟标记为已查看
  useEffect(() => {
    if (showAnnouncement && isAnnouncementNew) {
      handleAnnouncementViewed();
    }
  }, [showAnnouncement, isAnnouncementNew, handleAnnouncementViewed]);

  // 加载"急"按钮点击统计并订阅实时更新
  useEffect(() => {
    let unsubscribe = null;

    // 获取初始点击次数
    const loadUrgentClicks = async () => {
      const clicks = await getUrgentButtonClicks();
      setUrgentClicks(clicks);
    };

    loadUrgentClicks();

    // 订阅实时更新
    unsubscribe = subscribeToUrgentButtonClicks((newCount) => {
      setUrgentClicks(newCount);
    });

    // 清理：取消订阅，并上传未提交的点击
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }

      // 组件卸载时，如果有待上传的点击，立即上传
      if (pendingClicksRef.current > 0) {
        const pendingCount = pendingClicksRef.current;
        pendingClicksRef.current = 0;
        incrementUrgentButtonClicksBatch(pendingCount).catch(err => {
          console.error('组件卸载时上传点击失败:', err);
        });
      }

      // 清除定时器
      if (uploadTimerRef.current) {
        clearTimeout(uploadTimerRef.current);
      }
    };
  }, []);

  // 批量上传点击次数
  const uploadPendingClicks = useCallback(async () => {
    if (pendingClicksRef.current === 0) return;

    const countToUpload = pendingClicksRef.current;
    pendingClicksRef.current = 0;

    try {
      const newCount = await incrementUrgentButtonClicksBatch(countToUpload);
      // 使用服务器返回的最新值更新本地显示（包含所有用户的点击）
      setUrgentClicks(newCount);
      console.log(`成功上传 ${countToUpload} 次点击，当前总计: ${newCount}`);
    } catch (error) {
      console.error('批量上传点击失败:', error);
      // 失败时，将点击次数加回去
      pendingClicksRef.current += countToUpload;
    }
  }, []);

  // 处理"急"按钮点击
  const handleUrgentClick = useCallback(async () => {
    if (isClickingUrgent) return; // 防止重复点击

    setIsClickingUrgent(true);

    // 1. 立即更新本地显示
    setUrgentClicks(prev => prev + 1);
    pendingClicksRef.current += 1;

    // 2. 清除之前的定时器
    if (uploadTimerRef.current) {
      clearTimeout(uploadTimerRef.current);
    }

    // 3. 设置新的定时器：用户停止点击 2 秒后批量上传
    uploadTimerRef.current = setTimeout(() => {
      uploadPendingClicks();
    }, UPLOAD_DELAY);

    // 4. 短暂延迟后解锁按钮
    setTimeout(() => {
      setIsClickingUrgent(false);
    }, 100);
  }, [isClickingUrgent, uploadPendingClicks, UPLOAD_DELAY]);

  // 折叠动画辅助 - 使用 ref 获取实际高度
  const poolMechanicsRef = useRef(null);
  const guideRef = useRef(null);
  const announcementRef = useRef(null);

  // 折叠动画组件
  const CollapsibleContent = ({ isOpen, children, maxHeightValue = '2000px' }) => (
    <div
      className={`grid transition-all duration-500 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
    >
      <div className="overflow-hidden">
        {children}
      </div>
    </div>
  );

  // 卡池机制说明卡片（从 SummaryView 迁移）
  const PoolMechanicsCard = () => {
    const currentUpPool = getCurrentUpPool();
    const now = new Date();
    const { isActive, isExpired, remainingDays, remainingHours, startsIn, startsInHours } = currentUpPool;
    const isEndingSoon = remainingDays <= 3 && isActive;
    const isUpcoming = !isActive && !isExpired;

    // 所有限定6星角色（按轮换顺序 + 常驻可歪角色）
    const allLimitedSixStar = ['莱万汀', '伊冯', '洁尔佩塔', '余烬', '黎风', '艾尔黛拉', '别礼', '骏卫'];

    // 动态计算当前UP角色排在第一位
    const currentUpName = currentUpPool.name;
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
                CURRENT UP: <span className="text-zinc-700 dark:text-zinc-300 font-bold">{currentUpPool.name}</span>
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

      {/* 展开内容 - 使用 grid 动画 */}
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

            {/* UP池轮换时间线 */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
              <h4 className="font-bold text-zinc-500 dark:text-zinc-400 text-xs mb-4 flex items-center gap-2 uppercase tracking-widest">
                <RefreshCw size={12} />
                Rotation Schedule // 轮换计划
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  // Determine the index of the currently active pool
                  let currentActiveIndex = -1;
                  for (let i = 0; i < LIMITED_POOL_SCHEDULE.length; i++) {
                    const pool = LIMITED_POOL_SCHEDULE[i];
                    const start = new Date(pool.startDate);
                    const end = new Date(pool.endDate);
                    if (now >= start && now < end) {
                      currentActiveIndex = i;
                      break;
                    }
                  }
                  
                  // If no pool is currently active, check if we are past the last one or before first
                  // But the requirement says "Wait until pool starts", so if not started, no special highlights
                  
                  return LIMITED_POOL_SCHEDULE.map((pool, index) => {
                    const poolStart = new Date(pool.startDate);
                    const poolEnd = new Date(pool.endDate);
                    const isCurrent = now >= poolStart && now < poolEnd;
                    const isPast = now >= poolEnd;
                    
                    // Check if this character is currently obtainable in the limited pool
                    // Logic: The character was introduced at `index`. 
                    // It stays for `removesAfter` rotations.
                    
                    // Special Logic for Launch Trio: They are all available starting from Index 0 (Levante's Pool)
                    const launchCharacters = ['莱万汀', '洁尔佩塔', '伊冯'];
                    const isLaunchChar = launchCharacters.includes(pool.name);
                    
                    // Has the character entered the pool system?
                    // Standard: When current index reaches their banner index.
                    // Launch: When current index is >= 0 (Game Launched).
                    const hasEntered = isLaunchChar ? currentActiveIndex >= 0 : index <= currentActiveIndex;
                    
                    // Has the character been removed?
                    const hasNotExpired = currentActiveIndex < (index + (pool.removesAfter || 1));

                    const isInPool = currentActiveIndex !== -1 && hasEntered && hasNotExpired;

                    // 格式化时间显示
                    const formatDateTime = (date) => {
                      const month = date.getMonth() + 1;
                      const day = date.getDate();
                      const hours = date.getHours().toString().padStart(2, '0');
                      const minutes = date.getMinutes().toString().padStart(2, '0');
                      return `${month}/${day} ${hours}:${minutes}`;
                    };

                    let containerClass = "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"; // Default (Future/Unknown)
                    
                    if (isCurrent) {
                       // Current UP
                       containerClass = "bg-endfield-yellow/10 border-endfield-yellow text-amber-600 dark:text-endfield-yellow ring-1 ring-endfield-yellow/50 animate-pulse";
                    } else if (isInPool) {
                       // Not UP, but still in pool
                       containerClass = "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400";
                    } else if (isPast) {
                       // Past and removed
                       containerClass = "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 line-through opacity-70";
                    }

                    return (
                      <React.Fragment key={pool.name}>
                        <div className={`px-3 py-2 rounded-sm text-xs font-mono transition-all border ${containerClass}`}>
                          <div className="font-bold flex items-center gap-1">
                             {pool.name}
                             {isInPool && !isCurrent && <span className="text-[10px] opacity-80">(在卡池中)</span>}
                             {isCurrent && <span className="text-[10px] font-bold">UP</span>}
                          </div>
                          <div className="text-[10px] opacity-70 mt-1">
                            {formatDateTime(poolStart)} - {formatDateTime(poolEnd)}
                          </div>
                        </div>
                        {index < LIMITED_POOL_SCHEDULE.length - 1 && (
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
              <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-2 font-mono pl-1">
                * 莱万汀(3次后移出) / 伊冯(4次后移出) / 洁尔佩塔(5次后移出)
              </p>
            </div>

            {/* 可获取角色列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-zinc-200 dark:border-zinc-800 pt-6">
              {/* 限定池角色 */}
              <div>
                <h4 className="font-bold text-zinc-500 dark:text-zinc-400 text-xs mb-3 flex items-center gap-2 uppercase tracking-widest">
                   Limited Pool // 限定池内容
                </h4>
                <div className="space-y-2 bg-zinc-50 dark:bg-zinc-900/50 p-3 border border-zinc-200 dark:border-zinc-800/50">
                  <div className="flex items-baseline gap-2">
                     <span className="text-[10px] text-fuchsia-500 font-bold font-mono w-8 shrink-0">6★</span>
                     <div className="flex flex-wrap gap-1">
                        {limitedCharacters.sixStar.map((char, i) => (
                           <span key={char} className={`text-xs px-1.5 py-0.5 rounded-sm ${i === 0 ? 'bg-fuchsia-100 dark:bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-200 dark:border-fuchsia-500/30' : 'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-100 dark:border-transparent'}`}>
                              {char}{i === 0 && ' (UP)'}
                           </span>
                        ))}
                     </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                     <span className="text-[10px] text-amber-500 font-bold font-mono w-8 shrink-0">5★</span>
                     <div className="flex flex-wrap gap-1">
                        {limitedCharacters.fiveStar.map(char => (
                           <span key={char} className="text-xs px-1.5 py-0.5 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-500 border border-zinc-100 dark:border-transparent rounded-sm">{char}</span>
                        ))}
                     </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                     <span className="text-[10px] text-purple-500 font-bold font-mono w-8 shrink-0">4★</span>
                     <div className="flex flex-wrap gap-1">
                        {limitedCharacters.fourStar.map(char => (
                           <span key={char} className="text-xs px-1.5 py-0.5 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-600 border border-zinc-100 dark:border-transparent rounded-sm">{char}</span>
                        ))}
                     </div>
                  </div>
                </div>
              </div>

              {/* 常驻池角色 */}
              <div>
                <h4 className="font-bold text-zinc-500 dark:text-zinc-400 text-xs mb-3 flex items-center gap-2 uppercase tracking-widest">
                   Standard Pool // 常驻池内容
                </h4>
                <div className="space-y-2 bg-zinc-50 dark:bg-zinc-900/50 p-3 border border-zinc-200 dark:border-zinc-800/50">
                   <div className="flex items-baseline gap-2">
                     <span className="text-[10px] text-indigo-500 font-bold font-mono w-8 shrink-0">6★</span>
                     <div className="flex flex-wrap gap-1">
                        {standardCharacters.sixStar.map((char) => (
                           <span key={char} className="text-xs px-1.5 py-0.5 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-100 dark:border-transparent rounded-sm">
                              {char}
                           </span>
                        ))}
                     </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                     <span className="text-[10px] text-amber-500 font-bold font-mono w-8 shrink-0">5★</span>
                     <div className="flex flex-wrap gap-1">
                        {standardCharacters.fiveStar.map(char => (
                           <span key={char} className="text-xs px-1.5 py-0.5 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-500 border border-zinc-100 dark:border-transparent rounded-sm">{char}</span>
                        ))}
                     </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                     <span className="text-[10px] text-purple-500 font-bold font-mono w-8 shrink-0">4★</span>
                     <div className="flex flex-wrap gap-1">
                        {standardCharacters.fourStar.map(char => (
                           <span key={char} className="text-xs px-1.5 py-0.5 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-600 border border-zinc-100 dark:border-transparent rounded-sm">{char}</span>
                        ))}
                     </div>
                  </div>
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
              <span className="text-[10px] px-1.5 py-0.5 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 uppercase tracking-wider font-mono">Guide</span>
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
        <div className="px-6 pb-6 space-y-6">
          {/* 功能介绍 */}
          <div>
            <h4 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500"></span>
              Core Modules // 核心模块
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { icon: BarChart3, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'hover:border-indigo-500', title: '数据统计', desc: '全服/个人欧非分析' },
                { icon: Database, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'hover:border-emerald-500', title: '数据录入', desc: '单抽/十连/文本导入' },
                { icon: Cloud, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'hover:border-blue-500', title: '云端同步', desc: '多设备实时数据互通' },
                { icon: Shield, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', border: 'hover:border-red-500', title: '权限管理', desc: '管理员审批制度' },
              ].map((item, idx) => (
                <div key={idx} className={`p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 transition-all duration-300 group ${item.border}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-1.5 ${item.bg} ${item.color}`}>
                      <item.icon size={16} />
                    </div>
                    <h4 className="font-bold text-slate-700 dark:text-zinc-300 text-sm group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{item.title}</h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-500 pl-[38px]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 快速开始步骤 */}
          <div>
            <h4 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500"></span>
              Quick Start // 快速指引
            </h4>
            <div className="relative border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/30 p-5">
              <div className="absolute left-7 top-5 bottom-5 w-px bg-zinc-200 dark:bg-zinc-800"></div>
              <div className="space-y-6">
                {[
                  { title: '登录账号', desc: '点击右上角「登录」按钮注册或登录您的账号', link: !user },
                  { title: '申请权限', desc: '如需录入数据，请点击右上角「申请」按钮成为管理员', link: canEdit },
                  { title: '开始使用', desc: '在「卡池详情」页面录入数据，或查看统计分析', link: true },
                ].map((step, idx) => (
                  <div key={idx} className="relative flex items-start gap-4 group">
                    <div className={`relative z-10 w-5 h-5 flex items-center justify-center text-[10px] font-bold font-mono border transition-colors ${
                      step.link 
                        ? 'bg-amber-500 border-amber-500 text-white' 
                        : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 text-zinc-400'
                    }`}>
                      {idx + 1}
                    </div>
                    <div>
                      <h5 className={`text-sm font-bold transition-colors ${step.link ? 'text-slate-800 dark:text-zinc-200' : 'text-slate-400 dark:text-zinc-600'}`}>
                        {step.title}
                      </h5>
                      <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>


        </div>
      </CollapsibleContent>
    </div>
  );

  // 待增加功能卡片 - 时间轴版 (横向)
  const RoadmapCard = () => {
    // 待办功能列表 - 按优先级排序
    const roadmapItems = [
      // P1 - 高优先级（公测相关）
      {
        id: 'gacha-simulator',
        icon: Gamepad2,
        title: '抽卡模拟器',
        description: '在不消耗资源的情况下模拟抽卡，提前体验出货的感觉',
        status: 'completed',
        priority: 'high',
        tag: '娱乐功能'
      },
      {
        id: 'game-import',
        icon: Import,
        title: '游戏数据一键导入',
        description: '公测更新后，支持一键导入历史抽卡记录（前提是yj还能从网页查询记录）',
        status: 'in_progress',
        priority: 'high',
        tag: '公测更新'
      },
      // P2 - 中优先级
      {
        id: 'share',
        icon: Share2,
        title: '分享功能',
        description: '生成抽卡结果分享图片或链接，向朋友展示你的欧气',
        status: 'planned',
        priority: 'medium',
        tag: '社交传播'
      },
      {
        id: 'i18n',
        icon: Languages,
        title: '国际化支持',
        description: '支持英语、日语等多语言界面，服务更多玩家',
        status: 'planned',
        priority: 'medium',
        tag: '用户扩展'
      },
      // P3 - 低优先级
      {
        id: 'a11y',
        icon: Accessibility,
        title: '无障碍优化',
        description: '完善ARIA标签和键盘导航，提升可访问性',
        status: 'planned',
        priority: 'low',
        tag: '体验优化'
      },
      {
        id: 'virtual-scroll',
        icon: Database,
        title: '虚拟滚动',
        description: '优化长列表性能，支持更大数据量的流畅浏览',
        status: 'planned',
        priority: 'low',
        tag: '性能优化'
      }
    ];

    // 状态样式配置
    const statusConfig = {
      completed: { bg: 'bg-green-500/10 text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800', label: '已完成' },
      in_progress: { bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800', label: '开发中' },
      planned: { bg: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400', border: 'border-zinc-200 dark:border-zinc-800', label: '计划中' }
    };

    // 优先级样式
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
    <div className="space-y-6 animate-fade-in">
      {/* 欢迎横幅 */}
      <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 dark:from-zinc-900 dark:to-black p-6 text-white relative overflow-hidden border-l-4 border-endfield-yellow">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
            <BarChart3 size={28} />
            终末地抽卡分析器
          </h2>
          <p className="text-indigo-100 text-sm">
            记录您的抽卡历程，分析出货规律，为后续规划提供参考
          </p>
          {!user && (
            <p className="text-xs text-indigo-200 mt-2 flex items-center gap-1">
              <ArrowRight size={12} />
              登录后可录入数据并同步到云端
            </p>
          )}
        </div>
        <div className="absolute -right-10 -bottom-10 text-white/10">
          <Star size={200} />
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

          {/* 公告内容 - 使用 grid 动画 */}
          <CollapsibleContent isOpen={showAnnouncement}>
            <div className="px-4 pb-4">
              <div className="pl-12 pr-2">
                <SimpleMarkdown
                  content={announcements[0].content}
                  className="text-sm text-slate-700 dark:text-zinc-300"
                />
              </div>
            </div>
          </CollapsibleContent>
        </div>
      )}

      {/* 倒计时区域 */}
      <div className="flex flex-col gap-4">
        {/* 公测倒计时 - 放大显示 */}
        <CountdownTimer
          targetDate="2026-01-22T11:00:00+08:00"
          title="公测开启倒计时"
          subTitle="Talos-II Awaits // 塔卫二，期待您的到来"
          link="https://www.bilibili.com/video/BV1h5m7BXEf8"
          linkText="观看定档PV"
          urgentClicks={urgentClicks}
          onUrgentClick={handleUrgentClick}
        />

        {/* 公测前瞻回顾 */}
        <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 relative overflow-hidden group">
          {/* Background Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-50 via-zinc-50 to-indigo-50/30 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/30 pointer-events-none"></div>
          <div className="absolute top-0 right-0 p-8 opacity-5">
             <Radio size={120} />
          </div>

          <div className="relative z-10">
             <div className="flex items-center gap-2 mb-4">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                <h3 className="text-zinc-500 dark:text-zinc-400 text-xs font-mono tracking-widest uppercase">Broadcast Archived // 公测前瞻情报汇总</h3>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Codes */}
                <div className="bg-zinc-100/50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 p-4 rounded-sm">
                   <h4 className="text-amber-600 dark:text-endfield-yellow font-bold text-sm mb-3 flex flex-wrap items-center gap-2">
                      <Gift size={14} />
                      <span>兑换码</span>
                      <span className="text-[10px] bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500 dark:text-zinc-400 font-normal">有效期至 01/29 23:59</span>
                   </h4>
                   <div className="flex flex-col gap-2">
                      <CopyCode code="RETURNOFALL" />
                      <CopyCode code="ALLFIELD" />
                   </div>
                   <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                      奖励包含: <span className="text-zinc-700 dark:text-zinc-300">2000嵌金玉 + 12000折金票 + 1个存续的痕迹 + 若干养成材料</span>
                   </p>
                </div>

                {/* Gifts & Info */}
                <div className="space-y-4">
                   <div>
                      <h4 className="text-zinc-800 dark:text-white font-bold text-sm mb-2 flex items-center gap-2">
                         <Sparkles size={14} className="text-pink-500 dark:text-pink-400" />
                         公测福利 (共127抽)
                      </h4>
                      <ul className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1.5 list-disc pl-4">
                         <li>赠送 <span className="text-zinc-700 dark:text-zinc-200">12抽UP池</span> (专享)</li>
                         <li>每个UP池免费 <span className="text-zinc-700 dark:text-zinc-200">5抽</span></li>
                         <li>赠送 <span className="text-zinc-700 dark:text-zinc-200">60抽常驻池+40抽新手池</span></li>
                         <li>4000+2000玉 (等效12抽)</li>
                         <li><span className="text-pink-500 dark:text-pink-400 font-bold">赠送艾尔黛拉（小羊）及其专武</span></li>
                      </ul>
                   </div>
                   
                   <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-2">
                         <Clock size={14} className="text-blue-500 dark:text-blue-400" />
                         <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">预下载开启</span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 pl-6">
                         2026.01.20 10:00 (上午)
                      </p>
                   </div>
                </div>
             </div>
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
