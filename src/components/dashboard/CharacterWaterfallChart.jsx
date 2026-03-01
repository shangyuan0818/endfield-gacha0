import React, { useState, useMemo } from 'react';
import { User, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { characterCache } from '../../utils/characterUtils';

/**
 * 可折叠分组
 */
const PullGroup = ({ title, titleColor, pulls, maxPity, defaultExpanded = true }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (pulls.length === 0) return null;

  return (
    <div className="border border-zinc-100 dark:border-zinc-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <span className={`text-xs font-bold uppercase tracking-wider ${titleColor}`}>
          {title}
          <span className="ml-2 text-slate-400 dark:text-zinc-500 font-mono font-normal">
            {pulls.length}
          </span>
        </span>
        {expanded ? (
          <ChevronUp size={14} className="text-slate-400 dark:text-zinc-500" />
        ) : (
          <ChevronDown size={14} className="text-slate-400 dark:text-zinc-500" />
        )}
      </button>

      {expanded && (
        <div className="p-3 space-y-1.5">
          {pulls.map((pull, i) => (
            <PullRow key={`${pull.name}-${pull.pullIndex}-${i}`} pull={pull} maxPity={maxPity} />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * 单次出货行
 */
const PullRow = ({ pull, maxPity }) => {
  const isSixStar = pull.rarity === 6;
  const isLimited = isSixStar && !pull.isStandard;
  const isStandard = isSixStar && pull.isStandard;

  const charData = characterCache.searchByName(pull.name, false);
  const avatarUrl = charData?.avatar_url;

  const barClass = isLimited ? 'rainbow-bg' : isStandard ? 'bg-red-500' : 'bg-amber-400';

  const avatarBgClass = isLimited
    ? 'bg-gradient-to-br from-orange-400 to-pink-500 text-white'
    : isStandard
      ? 'bg-red-200 dark:bg-red-800 text-red-600 dark:text-red-300'
      : 'bg-amber-200 dark:bg-amber-800 text-amber-600 dark:text-amber-300';

  if (pull.isFree) {
    return (
      <div className="flex items-center gap-3 h-7">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center overflow-hidden shrink-0 ${avatarBgClass}`}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={pull.name} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <User size={14} />
          )}
        </div>
        <span className={`text-xs font-bold truncate w-20 shrink-0 ${isLimited ? 'text-slate-800 dark:text-zinc-200' : 'text-slate-600 dark:text-zinc-400'}`}>
          {pull.name}
        </span>
        <span className="text-[10px] font-mono font-bold text-blue-500 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          赠送
        </span>
      </div>
    );
  }

  const pityNum = typeof pull.pity === 'number' ? pull.pity : 0;
  const widthPercent = Math.max((pityNum / maxPity) * 100, 2);

  return (
    <div className="flex items-center gap-3 h-7">
      {/* 头像 */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center overflow-hidden shrink-0 ${avatarBgClass}`}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={pull.name} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <User size={14} />
        )}
      </div>
      {/* 角色名 */}
      <span className={`text-xs font-bold truncate w-20 shrink-0 ${isLimited ? 'text-slate-800 dark:text-zinc-200' : 'text-slate-600 dark:text-zinc-400'}`}>
        {pull.name}
      </span>
      {/* 条形图 */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div
          className={`h-6 rounded-sm ${barClass} relative`}
          style={{ width: `${widthPercent}%`, minWidth: '8px' }}
          title={`${pityNum}抽 (#${pull.pullIndex})`}
        >
          {pityNum >= 12 && (
            <span className="absolute inset-0 flex items-center justify-center text-xs font-mono font-bold waterfall-text">
              {pityNum}
            </span>
          )}
        </div>
        {pityNum > 0 && pityNum < 12 && (
          <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-zinc-300 shrink-0">
            {pityNum}
          </span>
        )}
        <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-500 shrink-0">
          #{pull.pullIndex}
        </span>
      </div>
    </div>
  );
};

/**
 * 角色出货瀑布图组件（桌面端）
 * 每次出货独立一行，按 pullIndex 顺序排列
 */
const CharacterWaterfallChart = ({ characterStats }) => {
  // 将 characterStats 展开为逐次出货的扁平列表，按 pullIndex 排序
  const { sixStarPulls, fiveStarPulls, maxPity } = useMemo(() => {
    const six = [];
    const five = [];
    let max = 0;

    // 免费十连在30抽后触发，所有 free 记录统一用 30 作为排序位置
    const FREE_SORT_INDEX = 30;

    characterStats.forEach(char => {
      char.pities.forEach((pity, i) => {
        const pullIndex = char.pullIndices[i];
        const isFree = pity === 'free' || pullIndex === 'free';
        const pityNum = (!isFree && typeof pity === 'number') ? pity : 0;
        if (pityNum > max) max = pityNum;

        const entry = {
          name: char.name,
          rarity: char.rarity,
          isStandard: char.isStandard,
          isLimited: char.isLimited,
          pity,
          pullIndex,
          isFree,
          sortIndex: isFree ? FREE_SORT_INDEX : pullIndex,
        };

        if (char.rarity === 6) {
          six.push(entry);
        } else {
          five.push(entry);
        }
      });
    });

    // 按 sortIndex 降序（最近出货排最前）
    const sortByIndex = (a, b) => b.sortIndex - a.sortIndex;
    six.sort(sortByIndex);
    five.sort(sortByIndex);

    return { sixStarPulls: six, fiveStarPulls: five, maxPity: max || 80 };
  }, [characterStats]);

  if (characterStats.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 dark:text-zinc-600 text-sm">
        暂无5星及以上记录
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PullGroup
        title="6★"
        titleColor="text-orange-600 dark:text-orange-400"
        pulls={sixStarPulls}
        maxPity={maxPity}
        defaultExpanded={true}
      />
      <PullGroup
        title="5★"
        titleColor="text-amber-600 dark:text-amber-400"
        pulls={fiveStarPulls}
        maxPity={maxPity}
        defaultExpanded={false}
      />
    </div>
  );
};

export default CharacterWaterfallChart;
