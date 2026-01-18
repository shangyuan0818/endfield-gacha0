import React from 'react';
import { Calculator, Sparkles, FileText } from 'lucide-react';

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
          {/* 显示当前卡池的UP角色（只在限定池显示） */}
          {isLimited && currentPool.up_character && (
            <p className="text-xs text-orange-500 dark:text-orange-400 mt-1 flex items-center gap-1">
              <span>UP:</span>
              <span className="font-bold">{currentPool.up_character}</span>
            </p>
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
        <div className="mb-6 space-y-4">
          {/* 30抽赠送十连 */}
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
                {pityInfo?.guaranteedUp?.hasReceived && <span className="ml-2 text-green-600 font-bold bg-green-50 px-1.5 rounded text-[10px] border border-green-100">已达成</span>}
              </span>
              <span className="text-slate-400 dark:text-zinc-500">
                {pityInfo?.guaranteedUp?.hasReceived ? '120 / 120' : `${Math.min(stats.total, 120)} / 120`}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${pityInfo?.guaranteedUp?.hasReceived ? 'bg-green-500' : 'rainbow-progress'}`}
                style={{ width: `${pityInfo?.guaranteedUp?.hasReceived ? 100 : Math.min((stats.total / 120) * 100, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* 240 Bonus - Recurring */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-bold text-slate-600 dark:text-zinc-400 flex items-center">
                赠送角色潜能（每240抽）
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
              </span>
              <span className="text-slate-400 dark:text-zinc-500">
                {Math.min(stats.total, 80)} / 80
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-slate-400 to-slate-600 transition-all duration-500"
                style={{ width: `${Math.min((stats.total / 80) * 100, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Weapon Gifts - 仅限定武器池显示 */}
          {currentPool.isLimitedWeapon !== false && (() => {
            // 计算下一档赠送
            const giftThresholds = [100, 180, 260, 340, 420, 500];
            let nextWeaponGift = 0;
            let nextWeaponGiftType = 'standard';

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

            return (
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
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-red-400 rounded-sm"></span>{stats.gifts?.standardCount || 0} 常</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rainbow-bg rounded-sm"></span>{stats.gifts?.limitedCount || 0} 限</span>
                </div>
              </div>
            );
          })()}
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
    </div>
  );
};

export default LimitedPoolAnalysis;
