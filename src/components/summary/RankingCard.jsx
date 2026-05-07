import React from 'react';
import { RefreshCw, User, Star, Trophy } from 'lucide-react';
import { useI18n } from '../../i18n/index.js';
import { characterCache } from '../../utils/characterUtils';
import { localizeEntityName } from '../../utils/gameDataI18n.js';

/**
 * 排名卡片组件
 * 显示角色出货排名，支持领奖台样式布局
 * FEAT-010 增强：支持 UP/歪出分类、常驻池 TOP5
 */
const RankingCard = ({ ranking, loading, poolType, title, visibleSections, flatLayout = false, denseFlatLayout = false, singleColumn = false }) => {
  const { t, locale } = useI18n();
  const tt = (key, fallback, params = {}) => t(key, params, fallback);

  // 根据 poolType 获取对应的排名数据
  const getRankingData = () => {
    if (!ranking) return { sixStarUp: [], sixStarOff: [], sixStar: [], fiveStar: [] };
    if (poolType === 'limited') {
      const limited = ranking.limited || {};
      return {
        sixStarUp: limited.sixStarUp || limited.sixStar || [],
        sixStarOff: limited.sixStarOff || [],
        sixStar: limited.sixStar || [],
        fiveStar: limited.fiveStar || []
      };
    }
    if (poolType === 'standard') {
      return {
        sixStar: ranking.standard?.sixStar || [],
        fiveStar: ranking.standard?.fiveStar || []
      };
    }
    if (poolType === 'weapon') {
      const weapon = ranking.weapon || {};
      return {
        sixStarUp: weapon.sixStarUp || weapon.sixStar || [],
        sixStarOff: weapon.sixStarOff || [],
        sixStar: weapon.sixStar || [],
        fiveStar: weapon.fiveStar || []
      };
    }
    // all: 合并限定池和常驻池
    return {
      sixStarUp: ranking.limited?.sixStarUp || ranking.limited?.sixStar || [],
      sixStarOff: ranking.limited?.sixStarOff || [],
      sixStar: [...(ranking.limited?.sixStar || []), ...(ranking.standard?.sixStar || [])].sort((a, b) => b.count - a.count).slice(0, 5),
      fiveStar: [...(ranking.limited?.fiveStar || []), ...(ranking.standard?.fiveStar || [])].sort((a, b) => b.count - a.count).slice(0, 5)
    };
  };

  const rankData = getRankingData();
  const hasSixStarUp = rankData.sixStarUp?.length > 0;
  const hasSixStarOff = rankData.sixStarOff?.length > 0;
  const hasSixStar = rankData.sixStar?.length > 0;
  const hasFiveStar = rankData.fiveStar?.length > 0;

  // 辅助函数：判断分段是否可见
  const isSectionVisible = (sectionKey) => {
    if (!visibleSections) return true;
    return visibleSections.includes(sectionKey);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 text-xs">
        <RefreshCw size={14} className="animate-spin mr-2" />
        {tt('summary.loading.ranking', '加载排名...')}
      </div>
    );
  }

  // 如果没有数据，或者所有可见的部分都没有数据
  const hasVisibleData = () => {
    if (!ranking) return false;
    if (!visibleSections) return hasSixStarUp || hasSixStarOff || hasSixStar || hasFiveStar;

    if (visibleSections.includes('limitedUp') && hasSixStarUp) return true;
    if (visibleSections.includes('limitedOff') && hasSixStarOff) return true;
    if (visibleSections.includes('standard') && hasSixStar) return true;
    if (visibleSections.includes('fiveStar') && hasFiveStar) return true; // 'fiveStar' covers both limited/standard 5*
    if (visibleSections.includes('limitedFive') && ranking.limited?.fiveStar?.length > 0) return true;
    if (visibleSections.includes('standardFive') && ranking.standard?.fiveStar?.length > 0) return true;

    return false;
  };

  if (!hasVisibleData()) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 text-xs italic">
        {tt('summary.ranking.empty', '暂无排名数据')}
      </div>
    );
  }

  const renderRankingRow = (items, rarity, label, pTypeForColor, maxItems = 3) => {
    if (!items || items.length === 0) return null;

    const top = items.slice(0, maxItems);

    // 平铺布局：按顺序横向排列
    if (flatLayout) {
      return (
        <div className="h-full">
          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider pl-1 border-l-2 border-zinc-300 dark:border-zinc-700 mb-3">{label}</div>
          <div className="flex flex-wrap gap-3 justify-start">
            {top.map((char, idx) => {
              const rank = idx + 1;
              const charData = characterCache.searchByName(char.name, false);
              const avatarUrl = charData?.avatar_url;
              const localizedName = localizeEntityName(char.name, { locale, type: poolType === 'weapon' ? 'weapon' : 'character' });
              const isFirst = rank === 1;
              const isSecond = rank === 2;
              const isThird = rank === 3;

              const badgeBg = isFirst ? 'bg-amber-500' : isSecond ? 'bg-zinc-400' : isThird ? 'bg-orange-700' : 'bg-zinc-500';
              const borderColor = isFirst ? 'border-amber-400' : isSecond ? 'border-zinc-400' : isThird ? 'border-orange-700' : 'border-zinc-300';

              return (
                <div
                  key={char.name}
                  className={`flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-sm min-w-0 ${
                    denseFlatLayout ? 'px-2 py-1 flex-1 min-w-[140px]' : 'px-2 py-1.5 w-full sm:w-auto'
                  }`}
                >
                  <span className={`${badgeBg} text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm shrink-0`}>#{rank}</span>
                  <div className={`rounded-sm bg-zinc-100 dark:bg-zinc-800 border ${borderColor} overflow-hidden flex-shrink-0 ${denseFlatLayout ? 'w-6 h-6' : 'w-7 h-7'}`}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={localizedName} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User size={14} className="text-zinc-400" />
                      </div>
                    )}
                  </div>
                  <span className={`font-medium text-slate-700 dark:text-zinc-300 truncate min-w-0 flex-1 ${denseFlatLayout ? 'text-[11px] leading-tight' : 'text-xs'}`} title={localizedName}>{localizedName}</span>
                  <span className={`font-mono text-zinc-400 shrink-0 ${denseFlatLayout ? 'text-[9px] leading-none' : 'text-[10px]'}`}>×{char.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // 领奖台排序: 2nd, 1st, 3rd (仅前3名)
    let podium = [];
    if (top.length === 1) podium = [top[0]];
    else if (top.length === 2) podium = [top[1], top[0]];
    else podium = [top[1], top[0], top[2]];

    const remaining = top.slice(3); // 第4、5名

    return (
      <div className="h-full">
        <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider pl-1 border-l-2 border-zinc-300 dark:border-zinc-700 mb-3">{label}</div>
        {/* 领奖台 TOP3 */}
        <div className="flex items-end justify-center gap-2">
          {podium.map((char) => {
            const rank = top.indexOf(char); // 0=1st, 1=2nd, 2=3rd
            const isFirst = rank === 0;
            const isSecond = rank === 1;
            const charData = characterCache.searchByName(char.name, false);
            const avatarUrl = charData?.avatar_url;
            const localizedName = localizeEntityName(char.name, { locale, type: poolType === 'weapon' ? 'weapon' : 'character' });

            // 样式配置
            const sizeClass = isFirst ? 'w-14 h-14' : 'w-11 h-11';
            const rankBorder = isFirst ? 'border-amber-400 dark:border-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.3)]' : isSecond ? 'border-zinc-400 dark:border-zinc-500' : 'border-orange-700 dark:border-orange-800';
            const badgeBg = isFirst ? 'bg-amber-500' : isSecond ? 'bg-zinc-400' : 'bg-orange-700';
            const zIndex = isFirst ? 'z-10' : 'z-0';

            return (
              <div key={char.name} className={`flex flex-col items-center group ${zIndex} ${isFirst ? '-mb-1' : ''}`}>
                <div className="relative">
                  {/* 头像框 */}
                    <div className={`relative ${sizeClass} bg-zinc-100 dark:bg-zinc-800 border-2 ${rankBorder} transition-transform duration-300 group-hover:-translate-y-1`}>
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={localizedName} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User size={isFirst ? 20 : 16} className="text-zinc-300" />
                      </div>
                    )}
                    {/* 皇冠图标 (仅第一名) */}
                    {isFirst && (
                      <div className="absolute -top-3 -right-2 text-amber-500 transform rotate-12 drop-shadow-sm">
                        <Star size={14} fill="currentColor" />
                      </div>
                    )}
                  </div>

                  {/* 排名标签 */}
                  <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 ${badgeBg} text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm border border-white dark:border-zinc-900 shadow-sm`}>
                    #{rank + 1}
                  </div>
                </div>

                {/* 文本信息 */}
                <div className="text-center mt-3">
                  <div className="text-[10px] font-bold text-slate-700 dark:text-zinc-300 truncate max-w-[4rem]">{localizedName}</div>
                  <div className="text-[9px] font-mono text-zinc-400">×{char.count}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 第4、5名（如果有）*/}
        {remaining.length > 0 && (
          <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap justify-center gap-x-2 gap-y-2">
            {remaining.map((char, idx) => {
              const actualRank = idx + 4; // 第4、5名
              const charData = characterCache.searchByName(char.name, false);
              const avatarUrl = charData?.avatar_url;
              const localizedName = localizeEntityName(char.name, { locale, type: poolType === 'weapon' ? 'weapon' : 'character' });

              return (
                <div key={char.name} className="flex min-w-0 basis-[calc(50%-0.375rem)] items-center gap-2 text-xs">
                  <span className="text-zinc-400 font-mono">#{actualRank}</span>
                  <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex-shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={localizedName} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User size={12} className="text-zinc-400" />
                      </div>
                    )}
                  </div>
                  <span className="min-w-0 flex-1 text-zinc-600 dark:text-zinc-400 truncate">{localizedName}</span>
                  <span className="shrink-0 text-zinc-400 font-mono">×{char.count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold mb-2 shrink-0">
        <Trophy size={12} />
        <span>{title || tt('summary.ranking.title', '出货排名')}</span>
      </div>

      <div className={`grid ${singleColumn ? 'grid-cols-1' : 'grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]'} content-start ${denseFlatLayout ? 'gap-3' : 'gap-x-6 gap-y-8'} pr-1 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800`}>
        {poolType === 'all' ? (
          <>
            {/* 限定池：UP六星 */}
            {isSectionVisible('limitedUp') && renderRankingRow(ranking.limited?.sixStarUp || ranking.limited?.sixStar, 6, tt('summary.ranking.limitedUpSix', '限定池 UP 6★'), 'limited', 5)}
            {/* 限定池：歪出六星 */}
            {isSectionVisible('limitedOff') && renderRankingRow(ranking.limited?.sixStarOff, 6, tt('summary.ranking.limitedOffSix', '限定池 歪出 6★'), 'limited', 5)}
            {/* 常驻池六星 - TOP5 */}
            {isSectionVisible('standard') && renderRankingRow(ranking.standard?.sixStar, 6, tt('summary.ranking.standardSix', '常驻池 6★'), 'standard', 5)}
            {/* 限定池5星 */}
            {isSectionVisible('limitedFive') && renderRankingRow(ranking.limited?.fiveStar, 5, tt('summary.ranking.limitedFive', '限定池 5★'), 'limited', 5)}
            {/* 常驻池5星 */}
            {isSectionVisible('standardFive') && renderRankingRow(ranking.standard?.fiveStar, 5, tt('summary.ranking.standardFive', '常驻池 5★'), 'standard', 5)}
          </>
        ) : poolType === 'limited' ? (
          <>
            {isSectionVisible('limitedUp') && renderRankingRow(rankData.sixStarUp, 6, tt('summary.ranking.limitedUpSix', '限定池 UP 6★'), poolType, 5)}
            {isSectionVisible('limitedOff') && renderRankingRow(rankData.sixStarOff, 6, tt('summary.ranking.limitedOffSix', '限定池 歪出 6★'), poolType, 5)}
            {isSectionVisible('fiveStar') && renderRankingRow(rankData.fiveStar, 5, tt('summary.ranking.limitedFive', '限定池 5★'), poolType)}
          </>
        ) : poolType === 'standard' ? (
          <>
            {isSectionVisible('standard') && renderRankingRow(rankData.sixStar, 6, tt('summary.ranking.standardSix', '常驻池 6★'), poolType, 5)}
            {isSectionVisible('fiveStar') && renderRankingRow(rankData.fiveStar, 5, tt('summary.ranking.standardFive', '常驻池 5★'), poolType)}
          </>
        ) : poolType === 'weapon' ? (
          <>
            {isSectionVisible('limitedUp') && renderRankingRow(rankData.sixStarUp, 6, tt('summary.ranking.weaponUpSix', '武器池 UP 6★'), poolType)}
            {isSectionVisible('limitedOff') && renderRankingRow(rankData.sixStarOff, 6, tt('summary.ranking.weaponOffSix', '武器池 歪出 6★'), poolType)}
            {isSectionVisible('fiveStar') && renderRankingRow(rankData.fiveStar, 5, tt('summary.ranking.weaponFive', '武器池 5★'), poolType)}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default RankingCard;
