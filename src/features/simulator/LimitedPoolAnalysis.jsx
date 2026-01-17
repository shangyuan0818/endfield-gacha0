import React from 'react';
import { Calculator, Sparkles } from 'lucide-react';
import { getCurrentUpPool } from '../../constants';

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
 * 限定池分析组件
 * 显示保底进度、特殊进度（120抽、240抽、30抽赠送）
 */
const LimitedPoolAnalysis = ({ currentPool, stats, effectivePity, pityInfo }) => {
  const isLimited = currentPool.type === 'limited';
  const isWeapon = currentPool.type === 'weapon';
  const isStandard = currentPool.type === 'standard';

  const maxPity = isWeapon ? 40 : 80;
  const textColor = isLimited ? 'rainbow-text' : isWeapon ? 'text-slate-700 dark:text-zinc-300' : 'text-yellow-600 dark:text-endfield-yellow';
  const progressColor = isLimited ? 'rainbow-progress' : isWeapon ? 'bg-slate-600' : 'bg-yellow-500';

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 relative overflow-hidden transition-all hover:shadow-md">
      <div className={`absolute top-0 left-0 w-2 h-full ${isLimited ? 'rainbow-bg' : isWeapon ? 'bg-slate-700' : 'bg-yellow-500 dark:bg-yellow-600'}`}></div>

      {/* 标题部分 */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-slate-700 dark:text-zinc-300 text-lg font-bold flex items-center gap-2">
            <Calculator size={20} className={textColor} />
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
          {effectivePity?.isInherited && isLimited && (
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
          {effectivePity?.isInherited && isLimited && effectivePity.pity5 > 0 && (
            <div className="text-[10px] text-purple-600 dark:text-purple-400 mt-1 relative z-10 flex items-center gap-1">
              <Sparkles size={10} />
              继承: {effectivePity.pity5} 抽
            </div>
          )}
        </div>
      </div>

      {/* 限定池特殊进度 */}
      {isLimited && (
        <div className="space-y-3">
          {/* 30抽赠送十连进度 - 新增 */}
          {stats.freeTenPulls && (
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-none p-3 border border-blue-200 dark:border-blue-800">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                  30抽赠送十连
                </span>
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  已领 {stats.freeTenPulls.count} 次
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-blue-200 dark:bg-blue-900 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${((stats.total % 30) / 30) * 100}%` }}
                  ></div>
                </div>
                <span className="text-xs font-mono text-blue-600 dark:text-blue-400 min-w-[60px] text-right">
                  {stats.total % 30}/30
                </span>
              </div>
              <div className="text-[10px] text-blue-500 dark:text-blue-400 mt-1">
                距下次赠送: {stats.freeTenPulls.remainingPulls} 抽
              </div>
            </div>
          )}

          {/* 120抽必出限定 */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-none p-3 border border-purple-200 dark:border-purple-800">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-purple-700 dark:text-purple-300">
                120抽必出限定 <span className="text-[10px] text-purple-500 dark:text-purple-400">(仅1次)</span>
              </span>
              {pityInfo?.guaranteedUp?.hasReceived ? (
                <span className="px-2 py-0.5 bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300 rounded text-xs font-bold">
                  已触发
                </span>
              ) : (
                <span className="text-xs text-purple-600 dark:text-purple-400">
                  {pityInfo?.guaranteedUp?.current || 0}/120
                </span>
              )}
            </div>
            {!pityInfo?.guaranteedUp?.hasReceived && (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-purple-200 dark:bg-purple-900 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all duration-500"
                      style={{ width: `${((pityInfo?.guaranteedUp?.current || 0) / 120) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-mono text-purple-600 dark:text-purple-400 min-w-[60px] text-right">
                    {Math.max(0, 120 - (pityInfo?.guaranteedUp?.current || 0))} 抽
                  </span>
                </div>
                <div className="text-[10px] text-purple-500 dark:text-purple-400 mt-1">
                  若未出限定，第120抽必出限定6星
                </div>
              </>
            )}
          </div>

          {/* 240抽赠送限定信物 */}
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-none p-3 border border-orange-200 dark:border-orange-800">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-orange-700 dark:text-orange-300">
                240抽赠送限定信物
              </span>
              <span className="text-xs text-orange-600 dark:text-orange-400">
                已领 {stats.gifts?.count || 0} 次
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-orange-200 dark:bg-orange-900 h-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all duration-500"
                  style={{ width: `${((stats.total % 240) / 240) * 100}%` }}
                ></div>
              </div>
              <span className="text-xs font-mono text-orange-600 dark:text-orange-400 min-w-[60px] text-right">
                {stats.total % 240}/240
              </span>
            </div>
            <div className="text-[10px] text-orange-500 dark:text-orange-400 mt-1">
              距下次赠送: {stats.gifts?.remainingPulls || 240 - (stats.total % 240)} 抽
            </div>
          </div>

          {/* 60抽情报书 */}
          <div className="bg-gradient-to-r from-teal-50 to-green-50 dark:from-teal-900/20 dark:to-green-900/20 rounded-none p-3 border border-teal-200 dark:border-teal-800">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-teal-700 dark:text-teal-300">
                60抽情报书 <span className="text-[10px] text-teal-500 dark:text-teal-400">(仅1次)</span>
              </span>
              {stats.hasReceivedInfoBook ? (
                <span className="px-2 py-0.5 bg-teal-200 dark:bg-teal-800 text-teal-700 dark:text-teal-300 rounded text-xs font-bold">
                  已领取
                </span>
              ) : stats.total >= 60 ? (
                <span className="px-2 py-0.5 bg-green-500 text-white rounded text-xs font-bold animate-pulse">
                  可领取
                </span>
              ) : (
                <span className="text-xs text-teal-600 dark:text-teal-400">
                  {Math.max(0, 60 - stats.total)} 抽
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 武器池进度 */}
      {isWeapon && currentPool.isLimitedWeapon !== false && (
        <div className="space-y-3">
          {/* 武器赠送进度展示 */}
          <div className="bg-gradient-to-r from-slate-50 to-zinc-50 dark:from-slate-900/50 dark:to-zinc-900/50 rounded-none p-3 border border-slate-300 dark:border-zinc-700">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">武器赠送进度</span>
              <span className="text-xs text-slate-600 dark:text-zinc-400">
                已领 {(stats.gifts?.standardCount || 0) + (stats.gifts?.limitedCount || 0)} 次
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-500 space-y-1">
              <div>✓ 100抽: 常驻武库箱 {stats.total >= 100 && '✅'}</div>
              <div>✓ 180抽: 限定武器 {stats.total >= 180 && '✅'}</div>
              <div>✓ 之后每80抽交替赠送</div>
            </div>
          </div>
        </div>
      )}

      {/* 常驻池进度 */}
      {isStandard && (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-none p-3 border border-yellow-200 dark:border-yellow-800">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-yellow-700 dark:text-yellow-300">
              300抽自选6星 <span className="text-[10px] text-yellow-500 dark:text-yellow-400">(仅1次)</span>
            </span>
            {stats.hasReceivedSelectGift ? (
              <span className="px-2 py-0.5 bg-yellow-200 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300 rounded text-xs font-bold">
                已领取
              </span>
            ) : stats.total >= 300 ? (
              <span className="px-2 py-0.5 bg-green-500 text-white rounded text-xs font-bold animate-pulse">
                可领取
              </span>
            ) : (
              <span className="text-xs text-yellow-600 dark:text-yellow-400">
                {Math.max(0, 300 - stats.total)} 抽
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LimitedPoolAnalysis;
