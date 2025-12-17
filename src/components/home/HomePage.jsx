import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Info, Star, Layers, Swords, Target, Zap, Gift, FileText, RefreshCw,
  ChevronDown, ChevronUp, Users, BookOpen, HelpCircle, ArrowRight,
  BarChart3, Database, Shield, Cloud, Bell, Clock, Rocket
} from 'lucide-react';
import { LIMITED_POOL_SCHEDULE, getCurrentUpPool } from '../../constants';
import SimpleMarkdown from '../SimpleMarkdown';
import {
  STORAGE_KEYS,
  getHomeCollapseState,
  setHomeCollapseState,
  hasNewContent,
  markAsViewed
} from '../../utils';

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
  const [showAnnouncement, setShowAnnouncement] = useState(
    hasAnnouncementUpdate ? true : !initialCollapseState.announcement
  );

  // 公告是否为"新"（未查看过）
  const [isAnnouncementNew, setIsAnnouncementNew] = useState(hasAnnouncementUpdate);

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

  // 倒计时组件
  const CountdownTimer = ({ targetDate, title, icon: Icon, theme = 'amber', endedText, link, linkText, description }) => {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: false });

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

    // 主题样式配置
    const styles = {
      amber: {
        border: 'border-amber-200 dark:border-amber-800/50',
        bg: 'bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-zinc-900 dark:to-zinc-900',
        icon: 'text-amber-600 dark:text-amber-500',
        title: 'text-amber-900 dark:text-amber-100',
        numberBg: 'bg-white dark:bg-zinc-800 border border-amber-100 dark:border-amber-900/30',
        numberText: 'text-amber-600 dark:text-amber-400',
        desc: 'text-amber-800/70 dark:text-amber-200/70',
        button: 'text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/20 border-amber-200 dark:border-amber-800/50'
      },
      green: {
        border: 'border-emerald-200 dark:border-emerald-800/50',
        bg: 'bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-zinc-900 dark:to-zinc-900',
        icon: 'text-emerald-600 dark:text-emerald-500',
        title: 'text-emerald-900 dark:text-emerald-100',
        numberBg: 'bg-white dark:bg-zinc-800 border border-emerald-100 dark:border-emerald-900/30',
        numberText: 'text-emerald-600 dark:text-emerald-400',
        desc: 'text-emerald-800/70 dark:text-emerald-200/70',
        button: 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50'
      }
    }[theme] || styles.amber;

    const TimeBlock = ({ value, label }) => (
      <div className="flex flex-col items-center">
        <div className={`w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center ${styles.numberBg} ${styles.numberText} rounded-none font-mono text-xl sm:text-3xl font-bold shadow-sm mb-1`}>
          {String(value).padStart(2, '0')}
        </div>
        <span className={`text-[10px] sm:text-xs uppercase tracking-wider ${styles.desc} font-medium`}>{label}</span>
      </div>
    );

    return (
      <div className={`flex-1 ${styles.bg} border ${styles.border} p-5 sm:p-6 relative overflow-hidden group`}>
        {/* 装饰背景字 */}
        <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none select-none">
          <Icon size={120} />
        </div>

        <div className="relative z-10">
          {/* 标题栏 */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={18} className={styles.icon} />
                <h4 className={`font-bold text-base sm:text-lg ${styles.title} tracking-tight`}>{title}</h4>
              </div>
              {description && (
                <p className={`text-xs ${styles.desc} max-w-[200px] leading-relaxed`}>{description}</p>
              )}
            </div>
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1 text-xs px-2 py-1 border rounded-none transition-all ${styles.button}`}
              >
                {linkText}
                <ArrowRight size={10} />
              </a>
            )}
          </div>

          {/* 倒计时主体 */}
          {timeLeft.ended ? (
            <div className={`text-center py-4 text-xl font-bold ${styles.icon} flex items-center justify-center gap-2 bg-white/50 dark:bg-black/20 border border-dashed ${styles.border}`}>
              <RefreshCw size={20} />
              {endedText}
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <TimeBlock value={timeLeft.days} label="DAYS" />
              <span className={`text-xl sm:text-3xl font-bold ${styles.numberText} mt-[-24px] opacity-50`}>:</span>
              <TimeBlock value={timeLeft.hours} label="HRS" />
              <span className={`text-xl sm:text-3xl font-bold ${styles.numberText} mt-[-24px] opacity-50`}>:</span>
              <TimeBlock value={timeLeft.minutes} label="MIN" />
              <span className={`text-xl sm:text-3xl font-bold ${styles.numberText} mt-[-24px] opacity-50`}>:</span>
              <TimeBlock value={timeLeft.seconds} label="SEC" />
            </div>
          )}
        </div>
      </div>
    );
  };

  // 卡池机制说明卡片（从 SummaryView 迁移）
  const PoolMechanicsCard = () => {
    const currentUpPool = getCurrentUpPool();
    const now = new Date();
    const isExpired = currentUpPool.isExpired;
    const remainingDays = currentUpPool.remainingDays ?? 0;
    const remainingHours = currentUpPool.remainingHours ?? 0;
    const isEndingSoon = remainingDays <= 3 && !isExpired;

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
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-800 border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        {/* 标题栏 - 可点击展开/收起 */}
        <button
          onClick={handleTogglePoolMechanics}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/50 dark:hover:bg-zinc-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rainbow-bg-light rounded-lg">
              <Info size={20} className="rainbow-text" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-slate-800 dark:text-zinc-100">卡池机制速览</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-500">
                当前UP: <span className="rainbow-text font-medium">{currentUpPool.name}</span>
                {!isExpired && (
                  <span className={`ml-2 ${isEndingSoon ? 'text-amber-500' : 'text-green-600 dark:text-green-400'}`}>
                    剩余 {remainingDays}天{remainingHours}小时
                  </span>
                )}
                {isExpired && <span className="ml-2 text-red-500">已结束</span>}
              </p>
            </div>
          </div>
          <ChevronUp size={20} className={`text-zinc-400 transition-transform duration-300 ${showPoolMechanics ? '' : 'rotate-180'}`} />
        </button>

      {/* 展开内容 - 使用 grid 动画 */}
        <CollapsibleContent isOpen={showPoolMechanics}>
          <div className="px-6 pb-6 space-y-6">
            {/* 三种卡池对比 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 限定角色池 */}
              <div className="bg-white dark:bg-zinc-900 border border-fuchsia-200 dark:border-fuchsia-800/50 p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 rainbow-bg"></div>
                <div className="flex items-center gap-2 mb-3">
                  <Star size={16} className="rainbow-text" />
                  <h4 className="font-bold rainbow-text">限定角色池</h4>
                </div>
                <div className="space-y-2 text-xs text-slate-600 dark:text-zinc-400">
                  <div className="flex items-start gap-2">
                    <Target size={12} className="rainbow-text mt-0.5 shrink-0" />
                    <span><strong className="text-slate-800 dark:text-zinc-200">6星保底:</strong> 80抽必出，65抽后概率递增(+5%/抽)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Zap size={12} className="text-green-500 mt-0.5 shrink-0" />
                    <span><strong className="text-slate-800 dark:text-zinc-200">硬保底:</strong> 120抽必出限定UP (仅1次)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Gift size={12} className="text-purple-500 mt-0.5 shrink-0" />
                    <span><strong className="text-slate-800 dark:text-zinc-200">赠送:</strong> 每240抽送限定角色信物</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <FileText size={12} className="text-cyan-500 mt-0.5 shrink-0" />
                    <span><strong className="text-slate-800 dark:text-zinc-200">情报书:</strong> 60抽送寻访情报书 (仅1次)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <RefreshCw size={12} className="text-blue-500 mt-0.5 shrink-0" />
                    <span><strong className="text-slate-800 dark:text-zinc-200">继承:</strong> 保底继承到其他限定池</span>
                  </div>
                </div>
              </div>

              {/* 武器池 */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-500 to-slate-700"></div>
                <div className="flex items-center gap-2 mb-3">
                  <Swords size={16} className="text-slate-600 dark:text-zinc-400" />
                  <h4 className="font-bold text-slate-700 dark:text-zinc-300">武器池</h4>
                </div>
                <div className="space-y-2 text-xs text-slate-600 dark:text-zinc-400">
                  <div className="flex items-start gap-2">
                    <Target size={12} className="text-slate-400 mt-0.5 shrink-0" />
                    <span><strong className="text-slate-800 dark:text-zinc-200">6星保底:</strong> 40抽(4次申领)必出，无概率递增</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Zap size={12} className="text-green-500 mt-0.5 shrink-0" />
                    <span><strong className="text-slate-800 dark:text-zinc-200">硬保底:</strong> 80抽必出限定UP武器 (仅1次)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Gift size={12} className="text-purple-500 mt-0.5 shrink-0" />
                    <span><strong className="text-slate-800 dark:text-zinc-200">赠送:</strong> 100抽送武库箱，180抽送限定</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <RefreshCw size={12} className="text-red-400 mt-0.5 shrink-0" />
                    <span><strong className="text-slate-800 dark:text-zinc-200">继承:</strong> 保底不继承到其他武器池</span>
                  </div>
                </div>
              </div>

              {/* 常驻池 */}
              <div className="bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800/50 p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-indigo-600"></div>
                <div className="flex items-center gap-2 mb-3">
                  <Layers size={16} className="text-indigo-500" />
                  <h4 className="font-bold text-indigo-600 dark:text-indigo-400">常驻角色池</h4>
                </div>
                <div className="space-y-2 text-xs text-slate-600 dark:text-zinc-400">
                  <div className="flex items-start gap-2">
                    <Target size={12} className="text-indigo-400 mt-0.5 shrink-0" />
                    <span><strong className="text-slate-800 dark:text-zinc-200">6星保底:</strong> 80抽必出，65抽后概率递增(+5%/抽)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Gift size={12} className="text-purple-500 mt-0.5 shrink-0" />
                    <span><strong className="text-slate-800 dark:text-zinc-200">自选赠送:</strong> 300抽送自选6星角色 (仅1次)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <RefreshCw size={12} className="text-red-400 mt-0.5 shrink-0" />
                    <span><strong className="text-slate-800 dark:text-zinc-200">继承:</strong> 保底独立，不与其他池互通</span>
                  </div>
                </div>
              </div>
            </div>

            {/* UP池轮换时间线 */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-4">
              <h4 className="font-bold text-slate-700 dark:text-zinc-300 text-sm mb-3 flex items-center gap-2">
                <RefreshCw size={14} className="text-blue-500" />
                限定池轮换计划
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                {LIMITED_POOL_SCHEDULE.map((pool, index) => {
                  const poolStart = new Date(pool.startDate);
                  poolStart.setHours(4, 0, 0, 0);
                  const poolEnd = new Date(poolStart.getTime() + pool.duration * 24 * 60 * 60 * 1000);
                  const isCurrent = now >= poolStart && now < poolEnd;
                  const isPast = now >= poolEnd;

                  return (
                    <React.Fragment key={pool.name}>
                      <div className={`px-3 py-2 rounded text-xs font-medium transition-all ${
                        isCurrent
                          ? 'rainbow-bg-light rainbow-border'
                          : isPast
                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 line-through'
                            : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      }`}>
                        <div className={`font-bold ${isCurrent ? 'rainbow-text' : ''}`}>{pool.name}</div>
                        <div className={`text-[10px] ${isCurrent ? 'text-fuchsia-400' : 'opacity-70'}`}>
                          {poolStart.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} 04:00
                          {' - '}
                          {poolEnd.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} 04:00
                        </div>
                        {isCurrent && <div className="text-[10px] rainbow-text font-bold mt-0.5">当前UP</div>}
                      </div>
                      {index < LIMITED_POOL_SCHEDULE.length - 1 && (
                        <span className="text-zinc-300 dark:text-zinc-600">→</span>
                      )}
                    </React.Fragment>
                  );
                })}
                <span className="text-zinc-300 dark:text-zinc-600">→</span>
                <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 rounded text-xs">
                  待公布...
                </div>
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-2">
                * 卡池于凌晨04:00刷新 | 莱万汀将于3次特许寻访后移出，伊冯4次后移出，洁尔佩塔5次后移出
              </p>
            </div>

            {/* 可获取角色/武器列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 限定池角色 */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-4">
                <h4 className="font-bold text-slate-700 dark:text-zinc-300 text-sm mb-3 flex items-center gap-2">
                  <Users size={14} className="rainbow-text" />
                  限定池可获取角色
                </h4>
                <div className="space-y-2">
                  <div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] rainbow-text font-bold w-10 shrink-0">6星:</span>
                      {limitedCharacters.sixStar.map((char, i) => (
                        i === 0 ? (
                          <span key={char} className="text-xs px-1.5 py-0.5 rounded rainbow-bg-light rainbow-border font-bold">
                            <span className="rainbow-text">{char} (UP)</span>
                          </span>
                        ) : (
                          <span key={char} className="text-xs px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                            {char}
                          </span>
                        )
                      ))}
                    </div>
                    <div className="text-[10px] text-zinc-400 ml-10 mt-0.5">(基础概率 0.8%，UP占50%)</div>
                  </div>
                  <div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] text-amber-500 font-bold w-10 shrink-0">5星:</span>
                      {limitedCharacters.fiveStar.map(char => (
                        <span key={char} className="text-xs px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded">{char}</span>
                      ))}
                    </div>
                    <div className="text-[10px] text-zinc-400 ml-10 mt-0.5">(基础概率 8%)</div>
                  </div>
                  <div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] text-purple-500 font-bold w-10 shrink-0">4星:</span>
                      {limitedCharacters.fourStar.map(char => (
                        <span key={char} className="text-xs px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded">{char}</span>
                      ))}
                    </div>
                    <div className="text-[10px] text-zinc-400 ml-10 mt-0.5">(基础概率 91.2%)</div>
                  </div>
                </div>
              </div>

              {/* 常驻池角色 */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-4">
                <h4 className="font-bold text-slate-700 dark:text-zinc-300 text-sm mb-3 flex items-center gap-2">
                  <Users size={14} className="text-indigo-500" />
                  常驻池可获取角色
                </h4>
                <div className="space-y-2">
                  <div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] text-red-500 font-bold w-10 shrink-0">6星:</span>
                      {standardCharacters.sixStar.map(char => (
                        <span key={char} className="text-xs px-1.5 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded">{char}</span>
                      ))}
                    </div>
                    <div className="text-[10px] text-zinc-400 ml-10 mt-0.5">(基础概率 0.8%)</div>
                  </div>
                  <div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] text-amber-500 font-bold w-10 shrink-0">5星:</span>
                      {standardCharacters.fiveStar.map(char => (
                        <span key={char} className="text-xs px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded">{char}</span>
                      ))}
                    </div>
                    <div className="text-[10px] text-zinc-400 ml-10 mt-0.5">(基础概率 8%)</div>
                  </div>
                  <div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] text-purple-500 font-bold w-10 shrink-0">4星:</span>
                      {standardCharacters.fourStar.map(char => (
                        <span key={char} className="text-xs px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded">{char}</span>
                      ))}
                    </div>
                    <div className="text-[10px] text-zinc-400 ml-10 mt-0.5">(基础概率 91.2%)</div>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-2">
                  * 自选赠送可选: 余烬、黎风、艾尔黛拉、别礼、骏卫
                </p>
              </div>
            </div>

            {/* 武器池概率说明 */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Swords size={14} className="text-slate-500" />
                <span className="font-bold text-sm text-slate-700 dark:text-zinc-300">武器池概率</span>
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                <div><span className="text-red-500 font-medium">6星武器:</span> 基础概率 4%，UP武器占25%</div>
                <div><span className="text-amber-500 font-medium">5星武器:</span> 基础概率 15%</div>
                <div><span className="text-purple-500 font-medium">4星武器:</span> 基础概率 81%</div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    );
  };

  // 使用指南卡片
  const GuideCard = () => (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-zinc-900 dark:to-zinc-800 border border-amber-200 dark:border-zinc-700 overflow-hidden">
      {/* 标题栏 - 可点击展开/收起 */}
      <button
        onClick={handleToggleGuide}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <BookOpen size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-slate-800 dark:text-zinc-100">使用指南</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-500">
              快速了解如何使用本工具
            </p>
          </div>
        </div>
        <ChevronUp size={20} className={`text-zinc-400 transition-transform duration-300 ${showGuide ? '' : 'rotate-180'}`} />
      </button>

      {/* 展开内容 - 使用 grid 动画 */}
      <CollapsibleContent isOpen={showGuide}>
        <div className="px-6 pb-6 space-y-4">
          {/* 功能介绍 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={16} className="text-indigo-500" />
                <h4 className="font-bold text-slate-700 dark:text-zinc-300 text-sm">数据统计</h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-500">
                查看全服抽卡统计、个人数据分析、欧非程度评估
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Database size={16} className="text-green-500" />
                <h4 className="font-bold text-slate-700 dark:text-zinc-300 text-sm">数据录入</h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-500">
                支持单抽、十连、文本录入多种方式
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Cloud size={16} className="text-blue-500" />
                <h4 className="font-bold text-slate-700 dark:text-zinc-300 text-sm">云端同步</h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-500">
                数据自动同步到云端，多设备访问无忧
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={16} className="text-red-500" />
                <h4 className="font-bold text-slate-700 dark:text-zinc-300 text-sm">权限管理</h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-500">
                管理员审批制度，确保数据准确可靠
              </p>
            </div>
          </div>

          {/* 快速开始步骤 */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-4">
            <h4 className="font-bold text-slate-700 dark:text-zinc-300 text-sm mb-3 flex items-center gap-2">
              <HelpCircle size={14} className="text-amber-500" />
              快速开始
            </h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                    {user ? '查看统计数据' : '登录账号'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-500">
                    {user ? '点击顶部「统计」查看全服数据和个人分析' : '点击右上角「登录」按钮注册或登录您的账号'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                    {canEdit ? '选择或创建卡池' : '申请管理员权限'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-500">
                    {canEdit ? '点击顶部卡池切换器选择现有卡池或创建新卡池' : '如需录入数据，请点击右上角「申请」按钮'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                    {canEdit ? '录入抽卡数据' : '查看卡池详情'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-500">
                    {canEdit ? '在「卡池详情」页面使用单抽、十连或文本录入数据' : '点击「卡池详情」查看各卡池的保底进度和统计'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 录入格式说明（仅管理员可见） */}
          {canEdit && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
              <h4 className="font-bold text-amber-700 dark:text-amber-300 text-sm mb-2 flex items-center gap-2">
                <FileText size={14} />
                文本录入格式
              </h4>
              <div className="text-xs text-amber-600 dark:text-amber-400 space-y-1">
                <p>连续输入数字代表星级，无需空格分隔：</p>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li><code className="bg-amber-100 dark:bg-amber-800/30 px-1 rounded">4</code> - 4星</li>
                  <li><code className="bg-amber-100 dark:bg-amber-800/30 px-1 rounded">5</code> - 5星</li>
                  <li><code className="bg-amber-100 dark:bg-amber-800/30 px-1 rounded">6</code> - 6星限定</li>
                  <li><code className="bg-amber-100 dark:bg-amber-800/30 px-1 rounded">6s</code> 或 <code className="bg-amber-100 dark:bg-amber-800/30 px-1 rounded">6歪</code> - 6星常驻(歪)</li>
                </ul>
                <p className="mt-2">用逗号、分号或斜杠分隔多组十连</p>
                <p>示例: <code className="bg-amber-100 dark:bg-amber-800/30 px-1 rounded">4454464444,4445444454</code></p>
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </div>
  );

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
      <div className="flex flex-col md:flex-row gap-4">
        <CountdownTimer
          targetDate="2025-12-29T14:00:00+08:00"
          title="三测结束倒计时"
          icon={Clock}
          theme="amber"
          endedText="三测已结束"
          link="https://endfield.hypergryph.com/news/0443"
          linkText="关闭公告"
          description="数据即将清除，请及时备份"
        />
        <CountdownTimer
          targetDate="2026-01-22T09:00:00+08:00"
          title="公测开启倒计时"
          icon={Rocket}
          theme="green"
          endedText="公测已开启！"
          link="https://www.bilibili.com/video/BV1h5m7BXEf8"
          linkText="定档PV"
          description="塔卫二，期待您的到来"
        />
      </div>

      {/* 使用指南 */}
      <GuideCard />

      {/* 卡池机制速览 */}
      <PoolMechanicsCard />
    </div>
  );
});

HomePage.displayName = 'HomePage';

export default HomePage;
