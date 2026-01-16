import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, Star, FileText, Sparkles, User, TrendingUp, Layers } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { RARITY_CONFIG, getCurrentUpPool } from '../../constants';
import RainbowGradientDefs from '../charts/RainbowGradientDefs';
import { useHistoryStore, usePoolStore } from '../../stores';

/**
 * 卡池时间信息组件
 */
const PoolTimeInfo = () => {
  const currentUpPool = getCurrentUpPool();
  const now = new Date();
  const startDate = new Date(currentUpPool.startDate);
  startDate.setHours(4, 0, 0, 0);
  const endDate = currentUpPool.endDate instanceof Date ? currentUpPool.endDate : new Date(currentUpPool.endDate);

  const formatDate = (date) => {
    return `${date.getMonth() + 1}/${date.getDate()} 04:00`;
  };

  const isExpired = currentUpPool.isExpired;
  const remainingDays = currentUpPool.remainingDays ?? 0;
  const remainingHours = currentUpPool.remainingHours ?? 0;
  const isEndingSoon = remainingDays <= 3 && !isExpired;
  const isNotStarted = currentUpPool.startsIn > 0;

  return (
    <div className="space-y-2">
      {/* 当前UP池状态 */}
      <div className="flex flex-wrap items-center gap-2 text-slate-500 dark:text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="text-orange-500 font-medium">{currentUpPool.name}</span>
          {isNotStarted ? (
            <span className="text-slate-400">即将开始</span>
          ) : isExpired ? (
            <span className="text-red-400">已结束</span>
          ) : (
            <span>UP中</span>
          )}
        </span>
        <span className="text-slate-300 dark:text-zinc-600">|</span>
        <span>{formatDate(startDate)} - {formatDate(endDate)}</span>
        <span className="text-slate-300 dark:text-zinc-600">|</span>
        {isNotStarted ? (
          <span className="text-blue-500">{currentUpPool.startsIn}天{currentUpPool.startsInHours}小时后开始</span>
        ) : isExpired ? (
          <span className="text-red-500 font-medium">已结束</span>
        ) : isEndingSoon ? (
          <span className="text-amber-500 font-medium animate-pulse">剩余 {remainingDays}天{remainingHours}小时</span>
        ) : (
          <span className="text-green-500">剩余 {remainingDays}天{remainingHours}小时</span>
        )}
      </div>
    </div>
  );
};

/**
 * StatBox 统计卡片组件
 */
const StatBox = ({ title, value, subValue, colorClass, icon: Icon, isAnimated }) => (
  <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 flex items-center gap-4 relative overflow-hidden">
    <div className={`
      p-3 rounded-none ${colorClass} relative shadow-sm
      ${isAnimated ? 'glow-border' : ''}
    `}>
      {isAnimated && <div className="absolute inset-0 shine-effect rounded-none"></div>}
      {Icon && <Icon size={24} className="text-white relative z-10" />}
    </div>
    <div>
      <p className="text-xs text-slate-500 dark:text-zinc-500 uppercase font-bold">{title}</p>
      <p className="text-2xl font-bold text-slate-800 dark:text-zinc-100">{value}</p>
      {subValue && <p className="text-xs text-slate-400 dark:text-zinc-500">{subValue}</p>}
    </div>
  </div>
);

/**
 * 仪表盘视图组件
 * 显示卡池统计分析、保底信息、图表等
 */
const DashboardView = ({ currentPool, stats, effectivePity }) => {
  // 从 store 获取历史数据
  const history = useHistoryStore(state => state.history);
  const currentPoolId = usePoolStore(state => state.currentPoolId);

  // 检测暗色模式 - 响应式监听主题变化
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDark(document.documentElement.classList.contains('dark'));
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  // 计算角色出货统计
  const characterStats = useMemo(() => {
    const currentPoolHistory = history.filter(h => h.poolId === currentPoolId);
    const characters = new Map();

    // 统计每个角色的出货情况
    currentPoolHistory.forEach(item => {
      if (item.rarity >= 5 && item.specialType !== 'gift') {
        const name = item.character_name || item.item_name || item.name;
        if (name) {
          const existing = characters.get(name);
          if (existing) {
            existing.count++;
          } else {
            characters.set(name, {
              name,
              count: 1,
              rarity: item.rarity,
              isStandard: item.isStandard,
              isLimited: !item.isStandard && item.rarity === 6
            });
          }
        }
      }
    });

    // 排序：6星限定UP -> 6星常驻 -> 5星，同级别按数量排
    return Array.from(characters.values())
      .sort((a, b) => {
        // 1. 6星限定UP 优先
        if (a.rarity === 6 && !a.isStandard && (b.rarity !== 6 || b.isStandard)) return -1;
        if (b.rarity === 6 && !b.isStandard && (a.rarity !== 6 || a.isStandard)) return 1;
        // 2. 6星常驻 次之
        if (a.rarity === 6 && a.isStandard && b.rarity !== 6) return -1;
        if (b.rarity === 6 && b.isStandard && a.rarity !== 6) return 1;
        // 3. 同级别按数量排
        if (a.rarity === b.rarity && a.isStandard === b.isStandard) {
          return b.count - a.count;
        }
        // 4. 最后是5星
        return b.rarity - a.rarity;
      });
  }, [history, currentPoolId]);

  // 计算总出货数量
  const totalCharacterCount = useMemo(() => {
    return characterStats.reduce((sum, char) => sum + char.count, 0);
  }, [characterStats]);

  const tooltipStyle = {
    borderRadius: '0px',
    border: isDark ? '1px solid #3f3f46' : '1px solid #e4e4e7',
    boxShadow: isDark ? '0 4px 6px -1px rgb(0 0 0 / 0.3)' : '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    fontSize: '12px',
    backgroundColor: isDark ? '#18181b' : '#ffffff',
    color: isDark ? '#e4e4e7' : '#27272a'
  };

  const isLimited = currentPool.type === 'limited';
  const isWeapon = currentPool.type === 'weapon';
  const isStandard = currentPool.type === 'standard';

  const maxPity = isWeapon ? 40 : 90;
  const textColor = isLimited ? 'rainbow-text' : isWeapon ? 'text-slate-700 dark:text-zinc-300' : 'text-yellow-600 dark:text-endfield-yellow';
  const progressColor = isLimited ? 'rainbow-progress' : isWeapon ? 'bg-slate-600' : 'bg-yellow-500';

  // 武器池首轮80抽必出限定检测
  const sortedHistory = [...(stats.pityStats?.history || [])].sort((a, b) => a.index - b.index);
  const firstLimitedIn80 = isWeapon ? sortedHistory.slice(0, 80).find(i => i.rarity === 6 && !i.isStandard) : null;
  const firstLimitedIndex80 = firstLimitedIn80 ? sortedHistory.indexOf(firstLimitedIn80) + 1 : 0;
  const hasLimitedInFirst80 = firstLimitedIndex80 > 0;

  // 限定池120抽必出检测
  const firstLimitedIn120 = isLimited ? sortedHistory.slice(0, 120).find(i => i.rarity === 6 && !i.isStandard) : null;
  const firstLimitedIndex120 = firstLimitedIn120 ? sortedHistory.indexOf(firstLimitedIn120) + 1 : 0;
  const hasLimitedInFirst120 = firstLimitedIndex120 > 0;

  // 武器池下一档赠送计算
  let nextWeaponGift = 0;
  let nextWeaponGiftType = 'standard';
  if (isWeapon && currentPool.isLimitedWeapon !== false) {
    const giftThresholds = [100, 180, 260, 340, 420, 500];
    for (const threshold of giftThresholds) {
      if (stats.total < threshold) {
        nextWeaponGift = threshold;
        nextWeaponGiftType = threshold === 100 ? 'standard' : (threshold === 180 || threshold === 340 || threshold === 500) ? 'limited' : 'standard';
        break;
      }
    }
    if (nextWeaponGift === 0) {
      const cycle = Math.floor((stats.total - 180) / 160);
      nextWeaponGift = 180 + (cycle + 1) * 160;
      nextWeaponGiftType = nextWeaponGift % 160 === 20 ? 'limited' : 'standard';
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* 左列：保底机制分析 */}
      <div className="md:col-span-1 space-y-6">
        {/* 保底机制分析卡片 */}
        <div className="space-y-4">
    <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 relative overflow-hidden transition-all hover:shadow-md">
      <div className={`absolute top-0 left-0 w-2 h-full ${isLimited ? 'rainbow-bg' : isWeapon ? 'bg-slate-700' : 'bg-yellow-500 dark:bg-yellow-600'}`}></div>

      {/* 标题部分 */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-slate-700 dark:text-zinc-300 text-lg font-bold flex items-center gap-2">
            <Calculator size={20} className={textColor}/>
            {isWeapon ? '武器池分析' : isLimited ? '限定池分析' : '常驻池分析'}
          </h3>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
            当前: <span className={`font-medium ${isLimited ? 'rainbow-text' : isWeapon ? 'text-slate-700 dark:text-zinc-300' : 'text-yellow-600 dark:text-endfield-yellow'}`}>{currentPool.name}</span>
          </p>
          {/* 限定池轮换时间显示 */}
          {isLimited && (
            <div className="mt-2 text-xs">
              <PoolTimeInfo />
            </div>
          )}
        </div>
      </div>

      {/* 保底卡片（6星和5星） */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* 6星保底 */}
        <div className="bg-slate-50 dark:bg-zinc-950 rounded-none p-4 border border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
          <div className="text-xs text-slate-500 dark:text-zinc-500 mb-1 relative z-10 flex items-center gap-2">
            距离6星保底 ({maxPity})
            {/* 概率递增提示 - 仅限定池和常驻池有软保底 */}
            {stats.probabilityInfo?.hasSoftPity && stats.probabilityInfo?.isInSoftPity && (
              <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-[10px] font-bold animate-pulse">
                概率UP {(stats.probabilityInfo.probability * 100).toFixed(1)}%
              </span>
            )}
            {/* 武器池无软保底标识 */}
            {isWeapon && (
              <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 rounded text-[10px]">
                无概率递增
              </span>
            )}
          </div>
          <div className="text-3xl font-bold text-slate-800 dark:text-zinc-100 relative z-10">
            {Math.max(maxPity - stats.currentPity, 0)} <span className="text-sm font-normal text-slate-400 dark:text-zinc-500">抽</span>
          </div>
          <div className="absolute bottom-0 left-0 h-1 bg-slate-200 w-full">
            <div
              className={`h-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${Math.min((stats.currentPity / maxPity) * 100, 100)}%` }}
            ></div>
          </div>
          <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 relative z-10 flex justify-between">
            <span>当前垫刀: {stats.currentPity}</span>
            {/* 65抽软保底提示 - 仅限定池和常驻池 */}
            {stats.probabilityInfo?.hasSoftPity && !stats.probabilityInfo?.isInSoftPity && stats.currentPity > 0 && (
              <span className="text-blue-500">距软保底: {stats.probabilityInfo?.pullsUntilSoftPity}</span>
            )}
          </div>
          {/* 继承保底提示 */}
          {effectivePity.isInherited && isLimited && (
            <div className="text-[10px] text-purple-600 dark:text-purple-400 mt-1 relative z-10 flex items-center gap-1">
              <Sparkles size={10} />
              继承自其他限定池: {effectivePity.pity6} 抽
            </div>
          )}
        </div>

        {/* 5星保底 */}
        <div className="bg-slate-50 dark:bg-zinc-950 rounded-none p-4 border border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
          <div className="text-xs text-slate-500 dark:text-zinc-500 mb-1 relative z-10">距离5星保底 (10)</div>
          <div className="text-3xl font-bold text-slate-800 dark:text-zinc-100 relative z-10">
            {Math.max(10 - stats.currentPity5, 0)} <span className="text-sm font-normal text-slate-400 dark:text-zinc-500">抽</span>
          </div>
          <div className="absolute bottom-0 left-0 h-1 bg-slate-200 w-full">
            <div
              className="h-full bg-amber-500 transition-all duration-500"
              style={{ width: `${Math.min((stats.currentPity5 / 10) * 100, 100)}%` }}
            ></div>
          </div>
          <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 relative z-10">当前垫刀: {stats.currentPity5}</div>
          {/* 继承5星保底提示 */}
          {effectivePity.isInherited && isLimited && effectivePity.pity5 > 0 && (
            <div className="text-[10px] text-purple-600 dark:text-purple-400 mt-1 relative z-10 flex items-center gap-1">
              <Sparkles size={10} />
              继承: {effectivePity.pity5} 抽
            </div>
          )}
        </div>
      </div>

      {/* 限定池特殊进度 */}
      {isLimited && (
        <div className="mb-6 space-y-4">
          {/* 30抽赠送十连 - 新增 */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-bold text-slate-600 dark:text-zinc-400 flex items-center">
                赠送十连 (每30抽)
                {Math.floor(stats.total / 30) > 0 && (
                  <span className="ml-2 flex items-center gap-1 text-blue-600 font-bold bg-blue-50 dark:bg-blue-900/30 px-1.5 rounded text-[10px] border border-blue-100 dark:border-blue-800">
                    已获 x {Math.floor(stats.total / 30)}
                  </span>
                )}
              </span>
              <span className="text-slate-400 dark:text-zinc-500">{stats.total % 30} / 30</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-300 to-blue-500 transition-all duration-500"
                style={{ width: `${((stats.total % 30) / 30) * 100}%` }}
              ></div>
            </div>
            <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
              不计入保底的额外十连抽取机会
            </div>
          </div>

          {/* 120 Spark - One Time Only */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-bold text-slate-600 dark:text-zinc-400 flex items-center">
                必出限定 (120抽)
                {hasLimitedInFirst120 && <span className="ml-2 text-green-600 font-bold bg-green-50 px-1.5 rounded text-[10px] border border-green-100">已达成</span>}
              </span>
              <span className="text-slate-400 dark:text-zinc-500">
                {hasLimitedInFirst120 ? firstLimitedIndex120 : Math.min(stats.total, 120)} / 120
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${hasLimitedInFirst120 ? 'bg-green-500' : 'rainbow-progress'}`}
                style={{ width: `${hasLimitedInFirst120 ? 100 : Math.min((stats.total / 120) * 100, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* 240 Bonus - Recurring */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-bold text-slate-600 dark:text-zinc-400 flex items-center">
                赠送角色 (每240抽)
                {Math.floor(stats.total / 240) > 0 && (
                  <span className="ml-2 flex items-center gap-1 text-purple-600 font-bold bg-purple-50 px-1.5 rounded text-[10px] border border-purple-100">
                    已获 x {Math.floor(stats.total / 240)}
                  </span>
                )}
              </span>
              <span className="text-slate-400 dark:text-zinc-500">{stats.total % 240} / 240</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-300 to-purple-500 transition-all duration-500"
                style={{ width: `${((stats.total % 240) / 240) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* 60抽情报书 - 仅获得1次 */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-bold text-slate-600 dark:text-zinc-400 flex items-center">
                <FileText size={12} className="mr-1 text-cyan-500" />
                寻访情报书 (60抽)
                {stats.hasInfoBook && (
                  <span className="ml-2 flex items-center gap-1 text-green-600 font-bold bg-green-50 dark:bg-green-900/30 px-1.5 rounded text-[10px] border border-green-100 dark:border-green-800">
                    已获得
                  </span>
                )}
              </span>
              <span className="text-slate-400 dark:text-zinc-500">
                {stats.hasInfoBook ? '60 / 60' : `${Math.min(stats.total, 60)} / 60`}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${stats.hasInfoBook ? 'bg-green-500' : 'bg-gradient-to-r from-cyan-300 to-cyan-500'}`}
                style={{ width: `${stats.hasInfoBook ? 100 : Math.min((stats.total / 60) * 100, 100)}%` }}
              ></div>
            </div>
            {!stats.hasInfoBook && (
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                距获得: {stats.pullsUntilInfoBook} 抽
              </div>
            )}
          </div>
        </div>
      )}

      {/* 武器池特殊进度 */}
      {isWeapon && (
        <div className="mb-6 space-y-4">
          {/* 武器池类型标识 */}
          <div className="flex items-center gap-2 text-xs">
            <span className={`px-2 py-1 rounded font-medium ${currentPool.isLimitedWeapon !== false ? 'rainbow-bg rainbow-border text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'}`}>
              {currentPool.isLimitedWeapon !== false ? '限定武器池' : '常驻武器池'}
            </span>
            {currentPool.isLimitedWeapon === false && (
              <span className="text-slate-400 dark:text-zinc-500">无额外获取内容</span>
            )}
          </div>

          {/* 80 Spark - 武器池基础规则 */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-bold text-slate-600 dark:text-zinc-400 flex items-center">
                首轮限定必出 (80抽)
                {hasLimitedInFirst80 && <span className="ml-2 text-green-600 font-bold bg-green-50 px-1.5 rounded text-[10px] border border-green-100">已达成</span>}
              </span>
              <span className="text-slate-400 dark:text-zinc-500">
                {hasLimitedInFirst80 ? firstLimitedIndex80 : Math.min(stats.total, 80)} / 80
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${hasLimitedInFirst80 ? 'bg-green-500' : 'bg-gradient-to-r from-slate-400 to-slate-600'}`}
                style={{ width: `${hasLimitedInFirst80 ? 100 : Math.min((stats.total / 80) * 100, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Weapon Gifts - 仅限定武器池显示 */}
          {currentPool.isLimitedWeapon !== false && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold text-slate-600 dark:text-zinc-400 flex items-center gap-2">
                  下一档赠送
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${nextWeaponGiftType === 'limited' ? 'rainbow-bg text-white' : 'bg-red-100 text-red-600'}`}>
                    {nextWeaponGiftType === 'limited' ? '限定' : '常驻'}武器
                  </span>
                </span>
                <span className="text-slate-400 dark:text-zinc-500">{stats.total} / {nextWeaponGift}</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${nextWeaponGiftType === 'limited' ? 'rainbow-progress' : 'bg-red-400'}`}
                  style={{ width: `${Math.min((stats.total / nextWeaponGift) * 100, 100)}%` }}
                ></div>
              </div>
              <div className="mt-1 text-[10px] text-slate-400 dark:text-zinc-500 flex gap-2">
                <span>已领:</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-red-400 rounded-sm"></span>{Math.floor(stats.counts['6_std'] - stats.pityStats.history.filter(h=>h.isStandard).length)} 常</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rainbow-bg rounded-sm"></span>{Math.floor(stats.counts[6] - stats.pityStats.history.filter(h=>!h.isStandard).length)} 限</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 常驻池特殊进度 */}
      {isStandard && (
        <div className="mb-6">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-bold text-slate-600 dark:text-zinc-400 flex items-center">
                首次赠送自选 (300抽)
                {stats.total >= 300 && <span className="ml-2 text-green-600 font-bold bg-green-50 px-1.5 rounded text-[10px] border border-green-100">已达成</span>}
              </span>
              <span className="text-slate-400 dark:text-zinc-500">
                {Math.min(stats.total, 300)} / 300
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${stats.total >= 300 ? 'bg-green-500' : 'bg-gradient-to-r from-red-300 to-red-500'}`}
                style={{ width: `${Math.min((stats.total / 300) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* 图表和统计 */}
      {stats.pityStats.history.length === 0 ? (
        <div className="bg-slate-50 dark:bg-zinc-950 rounded-none p-6 text-center text-slate-400 dark:text-zinc-500 text-sm border border-dashed border-zinc-200 dark:border-zinc-800">
          <div className="mb-2">⚠️ 数据不足</div>
          暂无6星记录，无法分析本卡池的概率模型。<br/>请继续录入数据。
        </div>
      ) : (
        <div>
          {/* 不歪率或总6星数 */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            {isLimited ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-none border border-blue-100 dark:border-blue-800/50 text-center">
                <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">不歪率</div>
                <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{stats.winRate}%</div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-none border border-zinc-200 dark:border-zinc-800 text-center">
                <div className="text-xs text-slate-500 dark:text-zinc-500 mb-1">总6星数</div>
                <div className="text-lg font-bold text-slate-700 dark:text-zinc-300">{stats.totalSixStar}</div>
              </div>
            )}
          </div>

          {/* 6星分布趋势图 */}
          <div className="h-40 w-full mt-4">
            <p className="text-xs text-slate-500 dark:text-zinc-500 mb-2 font-medium">6星分布趋势</p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.pityStats.distribution} stackOffset="sign">
                <RainbowGradientDefs />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#3f3f46' : '#e4e4e7'} />
                <XAxis dataKey="range" tick={{fontSize: 10, fill: isDark ? '#a1a1aa' : '#71717a'}} interval={0} />
                <YAxis allowDecimals={false} tick={{fontSize: 10, fill: isDark ? '#a1a1aa' : '#71717a'}} />
                <RechartsTooltip
                  cursor={{fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}}
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: isDark ? '#e4e4e7' : '#27272a' }}
                  labelStyle={{ color: isDark ? '#a1a1aa' : '#71717a' }}
                />
                {/* 堆叠柱状图：限定在下，常驻在上 */}
                <Bar dataKey="limited" stackId="a" fill={RARITY_CONFIG[6].color} name="限定UP" radius={[0, 0, 4, 4]} />
                <Bar dataKey="standard" stackId="a" fill={RARITY_CONFIG['6_std'].color} name="常驻歪" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
    </div>

        {/* 平均出货消耗 */}
        <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
          <h3 className="text-slate-700 dark:text-zinc-300 font-bold mb-4">平均出货消耗</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-none border border-indigo-100 dark:border-yellow-800/50">
              <span className="text-yellow-700 dark:text-yellow-300 font-medium">综合6星</span>
              <div className="text-right">
                <span className="text-xl font-bold text-indigo-800 dark:text-yellow-300">{stats.avgPullCost[6]}</span>
                <span className="text-xs text-yellow-600 dark:text-endfield-yellow ml-1">抽/只</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-none border border-amber-100 dark:border-amber-800/50">
              <span className="text-amber-700 dark:text-amber-300 font-medium">5星</span>
              <div className="text-right">
                <span className="text-xl font-bold text-amber-800 dark:text-amber-300">{stats.avgPullCost[5]}</span>
                <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">抽/只</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 右列：图表与详细数据 */}
      <div className="md:col-span-2 space-y-6">
        {/* 总抽数概览 */}
        <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 flex items-center justify-between">
          <div>
            <h3 className="text-slate-500 dark:text-zinc-500 font-bold text-sm uppercase tracking-wider">当前卡池总投入</h3>
            <div className="text-4xl font-black text-slate-800 dark:text-zinc-100 mt-1 flex items-baseline gap-2">
              {stats.total}
              <span className="text-lg font-medium text-slate-400 dark:text-zinc-500">抽</span>
            </div>
          </div>
          <div className="h-12 w-12 bg-yellow-50 dark:bg-yellow-900/20 rounded-sm flex items-center justify-center text-indigo-500">
            <Layers size={24} />
          </div>
        </div>

        {/* 核心数据概览 */}
        <div className={`grid grid-cols-2 ${currentPool.type !== 'standard' ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
          {currentPool.type !== 'standard' && (
            <StatBox
              title="限定6星"
              value={stats.counts[6]}
              subValue={(() => {
                let bonusCount = 0;
                if (currentPool.type === 'limited') {
                  bonusCount = Math.floor(stats.total/240);
                } else if (currentPool.type === 'weapon') {
                  if (stats.total >= 180) {
                    bonusCount++;
                    const extraPulls = stats.total - 180;
                    const extraCycles = Math.floor(extraPulls / 80);
                    bonusCount += Math.floor(extraCycles / 2);
                  }
                }
                return bonusCount > 0 ? `含赠送 ${bonusCount}` : `占6星 ${(stats.winRate)}%`;
              })()}
              colorClass="rainbow-bg"
              icon={Star}
              isAnimated={true}
            />
          )}
          <StatBox
            title="常驻6星"
            value={stats.counts['6_std']}
            subValue={
              currentPool.type !== 'standard'
                ? "歪了"
                : (currentPool.type === 'standard' && stats.total >= 300 ? "含赠送 1" : "总数")
            }
            colorClass="bg-red-500"
            icon={Star}
          />
          <StatBox title="5星总数" value={stats.counts[5]} subValue={`占比 ${(stats.total > 0 ? stats.counts[5]/stats.total*100 : 0).toFixed(2)}%`} colorClass="bg-amber-400" icon={Star} />
          <StatBox title="4星总数" value={stats.counts[4]} subValue={`占比 ${(stats.total > 0 ? stats.counts[4]/stats.total*100 : 0).toFixed(2)}%`} colorClass="bg-purple-500" icon={Star} />
        </div>

        {/* 概率分布概览（饼图） */}
        <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 min-h-[400px] flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-slate-700 dark:text-zinc-300 font-bold">概率分布概览</h3>
            <span className="text-xs text-slate-400 dark:text-zinc-500 bg-slate-50 dark:bg-zinc-950 px-2 py-1 rounded">仅显示当前卡池</span>
          </div>
          <div className="flex-1 w-full h-full relative">
            {stats.total === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                暂无数据
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <RainbowGradientDefs />
                  <Pie
                    data={stats.chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="displayValue"
                  >
                    {stats.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value, name, props) => {
                      const originalValue = props.payload.value;
                      return [
                        `${originalValue}个 (${(originalValue/stats.total*100).toFixed(1)}%)`,
                        name
                      ];
                    }}
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: isDark ? '#e4e4e7' : '#27272a' }}
                    labelStyle={{ color: isDark ? '#a1a1aa' : '#71717a' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    wrapperStyle={{
                      color: isDark ? '#a1a1aa' : '#71717a',
                      fontSize: '12px'
                    }}
                    formatter={(value, entry) => {
                      const item = stats.chartData.find(d => d.name === value);
                      return `${value} (${item?.value || 0})`;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 角色出货统计卡片 */}
        <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-orange-400 to-pink-500"></div>

          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-orange-500" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-zinc-300">角色出货统计</h3>
            {totalCharacterCount > 0 && (
              <span className="text-xs text-slate-400 dark:text-zinc-500 ml-2">
                共 {totalCharacterCount} 个干员/武器
              </span>
            )}
          </div>

          {characterStats.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-zinc-500 text-sm">
              <User size={32} className="mx-auto mb-2 opacity-50" />
              <p>暂无5星及以上角色数据</p>
              <p className="text-xs mt-1">导入数据后此处将显示出货统计</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {characterStats.map((char) => {
                const isSixStar = char.rarity === 6;
                const isLimitedChar = isSixStar && !char.isStandard;
                const isStandardChar = isSixStar && char.isStandard;

                return (
                  <div
                    key={char.name}
                    className={`
                      flex items-center gap-3 p-3 border-2 transition-all
                      ${isLimitedChar
                        ? 'rainbow-bg-light rainbow-border'
                        : isStandardChar
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                      }
                    `}
                  >
                    {/* 头像预留位 */}
                    <div className={`
                      w-12 h-12 rounded-full flex items-center justify-center shrink-0
                      ${isLimitedChar
                        ? 'bg-gradient-to-br from-orange-400 to-pink-500 text-white'
                        : isStandardChar
                          ? 'bg-red-200 dark:bg-red-800 text-red-600 dark:text-red-300'
                          : 'bg-amber-200 dark:bg-amber-800 text-amber-600 dark:text-amber-300'
                      }
                    `}>
                      <User size={20} />
                    </div>

                    {/* 角色信息 */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-bold ${
                        isLimitedChar
                          ? 'text-orange-700 dark:text-orange-300'
                          : isStandardChar
                            ? 'text-red-700 dark:text-red-300'
                            : 'text-amber-700 dark:text-amber-300'
                      }`}>
                        {char.name}
                      </div>
                      <div className="flex items-center gap-0.5 mt-1">
                        {Array.from({ length: char.rarity }).map((_, i) => (
                          <Star
                            key={i}
                            size={10}
                            fill={isSixStar ? (isStandardChar ? '#f87171' : '#fb923c') : '#fbbf24'}
                            className={isSixStar ? (isStandardChar ? 'text-red-400' : 'text-orange-400') : 'text-amber-400'}
                          />
                        ))}
                      </div>
                    </div>

                    {/* 数量标签 */}
                    <div className={`
                      px-3 py-1.5 text-sm font-bold rounded
                      ${isLimitedChar
                        ? 'rainbow-badge text-white'
                        : isStandardChar
                          ? 'bg-red-500 text-white'
                          : 'bg-amber-500 text-white'
                      }
                    `}>
                      ×{char.count}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
