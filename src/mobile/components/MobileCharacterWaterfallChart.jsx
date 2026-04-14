import React, { useState, useMemo } from 'react';
import { User, ChevronDown, ChevronUp } from 'lucide-react';
import { characterCache } from '../../utils/characterUtils';
import { useI18n } from '../../i18n/index.js';
import { localizeEntityName } from '../../utils/gameDataI18n.js';

/**
 * 移动端可折叠分组
 */
const MobilePullGroup = ({ title, titleColor, pulls, maxPity, defaultExpanded = true }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (pulls.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-[1rem] border border-white/8 bg-white/[0.03]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between bg-white/[0.03] px-3 py-2.5 transition-colors hover:bg-white/[0.05]"
      >
        <span className={`text-[10px] font-bold uppercase tracking-wider ${titleColor}`}>
          {title}
          <span className="ml-1.5 font-mono font-normal text-zinc-500">
            {pulls.length}
          </span>
        </span>
        {expanded ? (
          <ChevronUp size={12} className="text-zinc-500" />
        ) : (
          <ChevronDown size={12} className="text-zinc-500" />
        )}
      </button>

      {expanded && (
        <div className="space-y-1 border-t border-white/8 p-2.5">
          {pulls.map((pull, i) => (
            <MobilePullRow key={`${pull.name}-${pull.pullIndex}-${i}`} pull={pull} maxPity={maxPity} />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * 移动端单次出货行
 */
const MobilePullRow = ({ pull, maxPity }) => {
  const { isEnglish, locale } = useI18n();
  const tt = (zh, en) => (isEnglish ? en : zh);
  const isSixStar = pull.rarity === 6;
  const isLimited = isSixStar && !pull.isStandard;
  const isStandard = isSixStar && pull.isStandard;

  const charData = characterCache.searchByName(pull.name, false);
  const avatarUrl = charData?.avatar_url;
  const localizedName = pull.localizedName || localizeEntityName(pull.name, { locale, type: 'character' }) || pull.name;

  const barClass = isLimited ? 'rainbow-bg' : isStandard ? 'bg-red-500' : 'bg-amber-400';

  const badgeClass = isLimited
    ? 'border border-orange-500/30 bg-orange-500/12 text-orange-300'
    : isStandard
      ? 'border border-red-500/30 bg-red-500/12 text-red-300'
      : 'border border-amber-500/30 bg-amber-500/12 text-amber-300';

  const avatarBgClass = isLimited
    ? 'bg-gradient-to-br from-orange-400 to-pink-500 text-white'
    : isStandard
      ? 'bg-red-500/20 text-red-300'
      : 'bg-amber-500/20 text-amber-300';

  if (pull.isFree) {
    return (
      <div className="flex h-6 items-center gap-2">
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full ${avatarBgClass}`}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={localizedName} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <User size={12} />
          )}
        </div>
        <span className={`w-16 shrink-0 truncate text-[11px] font-bold ${isLimited ? 'text-zinc-100' : 'text-zinc-300'}`}>
          {localizedName}
        </span>
        <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-1.5 py-0.5 text-[11px] font-mono font-bold text-blue-300">
          {tt('赠送', 'Gift')}
        </span>
      </div>
    );
  }

  const pityNum = typeof pull.pity === 'number' ? pull.pity : 0;
  const widthPercent = Math.max((pityNum / maxPity) * 100, 3);

  return (
    <div className="flex h-6 items-center gap-2">
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full ${avatarBgClass}`}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={localizedName} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <User size={12} />
        )}
      </div>
      <span className={`w-16 shrink-0 truncate text-[11px] font-bold ${isLimited ? 'text-zinc-100' : 'text-zinc-300'}`}>
        {localizedName}
      </span>
      <div className="flex-1 flex items-center gap-1.5 min-w-0">
        <div
          className={`h-5 rounded-sm ${barClass} relative`}
          style={{ width: `${widthPercent}%`, minWidth: '6px' }}
        >
          {pityNum >= 12 && (
            <span className="absolute inset-0 flex items-center justify-center text-xs font-mono font-bold waterfall-text">
              {pityNum}
            </span>
          )}
        </div>
        {pityNum > 0 && pityNum < 12 && (
          <span className={`text-[10px] font-mono font-bold px-1 py-0.5 rounded shrink-0 ${badgeClass}`}>
            {pityNum}
          </span>
        )}
        {pull.isInfoBook && (
          <span className="shrink-0 border border-amber-500/30 bg-amber-500/12 px-1 py-0.5 text-[10px] font-mono font-bold text-amber-300">
            {tt('情报书', 'Intel')}
          </span>
        )}
        <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-500 shrink-0">
          #{pull.pullIndex}
        </span>
      </div>
    </div>
  );
};

/**
 * 角色出货瀑布图组件（移动端）
 * 每次出货独立一行，按 pullIndex 顺序排列
 */
const MobileCharacterWaterfallChart = ({ characterStats }) => {
  const { isEnglish, locale } = useI18n();
  const tt = (zh, en) => (isEnglish ? en : zh);
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
        const isInfoBook = char.infoBookFlags?.[i] === true;
        const pityNum = (!isFree && typeof pity === 'number') ? pity : 0;
        if (pityNum > max) max = pityNum;

        const entry = {
          name: char.name,
          localizedName: localizeEntityName(char.name, { locale, type: 'character' }) || char.name,
          rarity: char.rarity,
          isStandard: char.isStandard,
          isLimited: char.isLimited,
          pity,
          pullIndex,
          isFree,
          isInfoBook,
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
  }, [characterStats, locale]);

  if (characterStats.length === 0) {
    return (
      <p className="text-xs text-zinc-400 font-mono text-center py-4 uppercase tracking-widest">{tt('暂无记录', 'No records')}</p>
    );
  }

  return (
    <div className="space-y-2 pt-2">
      <MobilePullGroup
        title="6★"
        titleColor="text-orange-300"
        pulls={sixStarPulls}
        maxPity={maxPity}
        defaultExpanded={true}
      />
      <MobilePullGroup
        title="5★"
        titleColor="text-amber-300"
        pulls={fiveStarPulls}
        maxPity={maxPity}
        defaultExpanded={false}
      />
    </div>
  );
};

export default MobileCharacterWaterfallChart;
