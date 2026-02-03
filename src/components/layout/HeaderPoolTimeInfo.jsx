import React, { useState, useEffect } from 'react';
import { getCurrentUpPool } from '../../constants';

/**
 * 顶栏卡池时间信息组件 - 实时更新
 * 使用与 constants/index.js 相同的计算方式，每分钟更新一次
 */
const HeaderPoolTimeInfo = React.memo(() => {
  const [timeInfo, setTimeInfo] = useState(() => getCurrentUpPool());

  useEffect(() => {
    // 每分钟更新一次时间（与首页保持一致的更新频率）
    const timer = setInterval(() => {
      setTimeInfo(getCurrentUpPool());
    }, 60000); // 60秒更新一次

    return () => clearInterval(timer);
  }, []);

  const { name, nextPool, isExpired, remainingDays = 0, remainingHours = 0, startsIn, startsInHours, isActive } = timeInfo;
  const isEndingSoon = remainingDays <= 3 && isActive && !isExpired;
  const isNotStarted = !isActive && !isExpired && (startsIn !== undefined || startsInHours !== undefined);

  return (
    <div className="hidden md:flex items-center gap-3 text-xs font-mono bg-zinc-50 dark:bg-zinc-900 px-4 py-1.5 border-l border-r border-zinc-200 dark:border-zinc-800 h-full">
      <div className="flex items-center gap-2">
        <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase ${isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>
          {isActive ? 'CURRENT' : 'UPCOMING'}
        </span>
        <span className="text-orange-600 dark:text-orange-400 font-bold">{name}</span>
      </div>

      <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-700"></div>

      <div className="text-zinc-500 dark:text-zinc-400">
        {isNotStarted ? (
          <span className="text-blue-500">T-{startsIn}D {startsInHours}H</span>
        ) : isExpired ? (
          <span className="text-red-500">ENDED</span>
        ) : isEndingSoon ? (
          <span className="text-amber-500 font-bold animate-pulse">{remainingDays}D {remainingHours}H LEFT</span>
        ) : (
          <span>{remainingDays}D {remainingHours}H LEFT</span>
        )}
      </div>

      {nextPool && (
        <>
          <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-700"></div>
          <div className="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
            <span className="text-[10px] uppercase">NEXT:</span>
            <span>{nextPool}</span>
          </div>
        </>
      )}
    </div>
  );
});

export default HeaderPoolTimeInfo;
