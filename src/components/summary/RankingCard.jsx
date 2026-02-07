import React from 'react';
import { RefreshCw, User, Star, Trophy } from 'lucide-react';
import { characterCache } from '../../utils/characterUtils';

/**
 * 排名卡片组件
 * 显示角色出货排名 TOP3，支持领奖台样式布局
 */
const RankingCard = ({ ranking, loading, poolType, title }) => {
  // 根据 poolType 获取对应的排名数据
  const getRankingData = () => {
    if (!ranking) return { sixStar: [], fiveStar: [] };
    if (poolType === 'limited') return ranking.limited || { sixStar: [], fiveStar: [] };
    if (poolType === 'standard') return ranking.standard || { sixStar: [], fiveStar: [] };
    if (poolType === 'weapon') return ranking.weapon || { sixStar: [], fiveStar: [] };
    // all: 合并限定池和常驻池
    return {
      sixStar: [...(ranking.limited?.sixStar || []), ...(ranking.standard?.sixStar || [])].sort((a, b) => b.count - a.count).slice(0, 3),
      fiveStar: [...(ranking.limited?.fiveStar || []), ...(ranking.standard?.fiveStar || [])].sort((a, b) => b.count - a.count).slice(0, 3)
    };
  };

  const rankData = getRankingData();
  const hasSixStar = rankData.sixStar?.length > 0;
  const hasFiveStar = rankData.fiveStar?.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 text-xs">
        <RefreshCw size={14} className="animate-spin mr-2" />
        加载排名...
      </div>
    );
  }

  if (!ranking || (!hasSixStar && !hasFiveStar)) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 text-xs italic">
        暂无排名数据
      </div>
    );
  }

  const renderRankingRow = (items, rarity, label, pTypeForColor) => {
    if (!items || items.length === 0) return null;

    const top3 = items.slice(0, 3);
    // 领奖台排序: 2nd, 1st, 3rd
    let podium = [];
    if (top3.length === 1) podium = [top3[0]];
    else if (top3.length === 2) podium = [top3[1], top3[0]];
    else podium = [top3[1], top3[0], top3[2]];

    return (
      <div className="h-full">
        <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider pl-1 border-l-2 border-zinc-300 dark:border-zinc-700 mb-3">{label}</div>
        <div className="flex items-end justify-center gap-3">
          {podium.map((char) => {
            const rank = top3.indexOf(char); // 0=1st, 1=2nd, 2=3rd
            const isFirst = rank === 0;
            const isSecond = rank === 1;
            const charData = characterCache.searchByName(char.name, false);
            const avatarUrl = charData?.avatar_url;

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
                      <img src={avatarUrl} alt={char.name} className="w-full h-full object-cover" />
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
                  <div className="text-[10px] font-bold text-slate-700 dark:text-zinc-300 truncate max-w-[4rem]">{char.name}</div>
                  <div className="text-[9px] font-mono text-zinc-400">×{char.count}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2 h-full flex flex-col">
      <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold mb-2 shrink-0">
        <Trophy size={12} />
        <span>{title || '出货排名 TOP3'}</span>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-8 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800 content-start">
        {poolType === 'all' ? (
          <>
            {renderRankingRow(ranking.limited?.sixStar, 6, '限定池 6★', 'limited')}
            {renderRankingRow(ranking.limited?.fiveStar, 5, '限定池 5★', 'limited')}
            {renderRankingRow(ranking.standard?.sixStar, 6, '常驻池 6★', 'standard')}
            {renderRankingRow(ranking.standard?.fiveStar, 5, '常驻池 5★', 'standard')}
          </>
        ) : (
          <>
            {renderRankingRow(rankData.sixStar, 6, `${poolType === 'limited' ? '限定池' : poolType === 'standard' ? '常驻池' : '武器池'} 6★`, poolType)}
            {renderRankingRow(rankData.fiveStar, 5, `${poolType === 'limited' ? '限定池' : poolType === 'standard' ? '常驻池' : '武器池'} 5★`, poolType)}
          </>
        )}
      </div>
    </div>
  );
};

export default RankingCard;
