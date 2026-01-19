import React, { useMemo } from 'react';
import { TrendingUp, User, Star } from 'lucide-react';

/**
 * 角色出货统计组件
 * 显示5星及以上角色的出货情况
 */
const CharacterStats = ({ pullHistory, poolType }) => {
  // 计算角色出货统计
  const characterStats = useMemo(() => {
    const characters = new Map();

    // 统计每个角色的出货情况
    pullHistory.forEach(item => {
      if (item.rarity >= 5) {
        const name = item.characterName || `${item.rarity}星角色`;
        if (name) {
          const existing = characters.get(name);
          if (existing) {
            existing.count++;
          } else {
            characters.set(name, {
              name,
              count: 1,
              rarity: item.rarity,
              isStandard: !item.isUp && item.rarity === 6,
              isLimited: item.isUp && item.rarity === 6
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
  }, [pullHistory]);

  // 计算总出货数量
  const totalCharacterCount = useMemo(() => {
    return characterStats.reduce((sum, char) => sum + char.count, 0);
  }, [characterStats]);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 relative overflow-hidden transition-all hover:shadow-md flex flex-col max-h-[240px]">
      <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-orange-400 to-pink-500"></div>

      <div className="flex items-center gap-2 px-4 py-3 shrink-0">
        <TrendingUp size={16} className="text-orange-500" />
        <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300">角色出货</h3>
        {totalCharacterCount > 0 && (
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 ml-auto">
            共 {totalCharacterCount} 个
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-3 min-h-0 scrollbar-thin">{characterStats.length === 0 ? (
        <div className="text-center py-4 text-slate-400 dark:text-zinc-500 text-sm">
          <User size={20} className="mx-auto mb-1 opacity-50" />
          <p className="text-[10px]">暂无数据</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {characterStats.map((char) => {
            const isSixStar = char.rarity === 6;
            const isLimitedChar = isSixStar && !char.isStandard;
            const isStandardChar = isSixStar && char.isStandard;

            return (
              <div
                key={char.name}
                className={`
                  flex items-center gap-2 p-2 border transition-all
                  ${isLimitedChar
                    ? 'rainbow-bg-light rainbow-border'
                    : isStandardChar
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                      : 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                  }
                `}
              >
                {/* 头像预留位 - 缩小 */}
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center shrink-0
                  ${isLimitedChar
                    ? 'bg-gradient-to-br from-orange-400 to-pink-500 text-white'
                    : isStandardChar
                      ? 'bg-red-200 dark:bg-red-800 text-red-600 dark:text-red-300'
                      : 'bg-amber-200 dark:bg-amber-800 text-amber-600 dark:text-amber-300'
                  }
                `}>
                  <User size={14} />
                </div>

                {/* 角色信息 - 缩小字体 */}
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-bold truncate ${
                    isLimitedChar
                      ? 'text-orange-700 dark:text-orange-300'
                      : isStandardChar
                        ? 'text-red-700 dark:text-red-300'
                        : 'text-amber-700 dark:text-amber-300'
                  }`}>
                    {char.name}
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: char.rarity }).map((_, i) => (
                      <Star
                        key={i}
                        size={8}
                        fill={isSixStar ? (isStandardChar ? '#f87171' : '#fb923c') : '#fbbf24'}
                        className={isSixStar ? (isStandardChar ? 'text-red-400' : 'text-orange-400') : 'text-amber-400'}
                      />
                    ))}
                  </div>
                </div>

                {/* 数量标签 - 缩小 */}
                <div className={`
                  px-2 py-0.5 text-xs font-bold rounded
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

      <style jsx>{`
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: #d4d4d8;
        }
        .dark .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: #52525b;
        }
      `}</style>
    </div>
  );
};

export default CharacterStats;
