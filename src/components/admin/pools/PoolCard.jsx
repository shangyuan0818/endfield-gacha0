import React from 'react';
import { Edit2, Trash2, Calendar, Star, Layers, Swords, RotateCw, Users } from 'lucide-react';
import { getLimitedCharacterPoolStatus } from '../../../utils/characterUtils';

/**
 * 获取类型图标
 */
const getTypeIcon = (type) => {
  switch (type) {
    case 'limited':
    case 'limited_character':
      return <Star size={14} className="text-orange-500" />;
    case 'weapon':
    case 'limited_weapon':
      return <Swords size={14} className="text-slate-500 dark:text-zinc-400" />;
    default:
      return <Layers size={14} className="text-yellow-600 dark:text-endfield-yellow" />;
  }
};

/**
 * 获取类型标签
 */
const getTypeLabel = (type) => {
  switch (type) {
    case 'limited':
    case 'limited_character':
      return '限定角色';
    case 'weapon':
    case 'limited_weapon':
      return '限定武器';
    default:
      return '常驻';
  }
};

/**
 * 获取类型颜色
 */
const getTypeColor = (type) => {
  switch (type) {
    case 'limited':
    case 'limited_character':
      return 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400';
    case 'weapon':
    case 'limited_weapon':
      return 'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400';
    default:
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-endfield-yellow';
  }
};

/**
 * 卡池角色一览组件
 */
const PoolCharacterList = ({ pool, poolCharacters, characters }) => {
  const poolCharIds = (poolCharacters[pool.pool_id] || []).map(pc => pc.character_id);
  const poolChars = characters.filter(c => poolCharIds.includes(c.id));

  const sixStars = poolChars.filter(c => c.rarity === 6).sort((a, b) => {
    const aIsUp = a.name === pool.up_character;
    const bIsUp = b.name === pool.up_character;
    if (aIsUp && !bIsUp) return -1;
    if (!aIsUp && bIsUp) return 1;
    const aIsLimited = a.is_limited;
    const bIsLimited = b.is_limited;
    if (aIsLimited && !bIsLimited) return -1;
    if (!aIsLimited && bIsLimited) return 1;
    return a.name.localeCompare(b.name, 'zh-CN');
  });

  const fiveStars = poolChars.filter(c => c.rarity === 5);
  const fourStars = poolChars.filter(c => c.rarity === 4);

  return (
    <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-600 dark:text-zinc-400 flex items-center gap-1">
          <Users size={12} />
          卡池角色一览
        </span>
      </div>
      <div className="space-y-1.5">
        {sixStars.length > 0 && (
          <div className="flex items-start gap-1">
            <span className="text-xs text-orange-500 font-medium shrink-0 w-8">6★</span>
            <div className="flex flex-wrap gap-1">
              {sixStars.slice(0, 6).map(char => {
                const isUp = char.name === pool.up_character;
                const isLimited = char.is_limited;
                return (
                  <span
                    key={char.id}
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      isUp
                        ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300 font-bold ring-1 ring-orange-400'
                        : isLimited
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                          : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                    }`}
                    title={`${char.name}${isUp ? ' [当期UP]' : isLimited ? ' [限定]' : ' [常驻]'}`}
                  >
                    {isUp && '★'}{char.name.length > 4 ? char.name.slice(0, 4) + '...' : char.name}
                  </span>
                );
              })}
              {sixStars.length > 6 && (
                <span className="text-xs text-slate-400">+{sixStars.length - 6}</span>
              )}
            </div>
          </div>
        )}
        {fiveStars.length > 0 && (
          <div className="flex items-start gap-1">
            <span className="text-xs text-purple-500 font-medium shrink-0 w-8">5★</span>
            <div className="flex flex-wrap gap-1">
              {fiveStars.slice(0, 4).map(char => (
                <span
                  key={char.id}
                  className="text-xs px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
                >
                  {char.name.length > 4 ? char.name.slice(0, 4) + '...' : char.name}
                </span>
              ))}
              {fiveStars.length > 4 && (
                <span className="text-xs text-slate-400">+{fiveStars.length - 4}</span>
              )}
            </div>
          </div>
        )}
        {fourStars.length > 0 && (
          <div className="flex items-start gap-1">
            <span className="text-xs text-blue-500 font-medium shrink-0 w-8">4★</span>
            <span className="text-xs text-slate-400 dark:text-zinc-500">
              共 {fourStars.length} 个
            </span>
          </div>
        )}
        {poolChars.length === 0 && (
          <p className="text-xs text-slate-400 dark:text-zinc-500 italic">
            暂无角色配置，点击编辑来添加
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * 轮换状态组件
 */
const RotationStatus = ({ pool, limitedSixStarCharacters }) => {
  if (pool.type !== 'limited' && pool.type !== 'limited_character') return null;

  const poolContext = {
    start_time: pool.start_time,
    rotation_position: pool.rotationPosition,
  };

  return (
    <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-600 dark:text-zinc-400 flex items-center gap-1">
          <RotateCw size={12} />
          6★ 计划状态
          <span className="text-slate-400 dark:text-zinc-500 font-normal">（按该池时间位次派生）</span>
        </span>
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {limitedSixStarCharacters
          .slice(0, 6)
          .map(char => {
            const rotationStatus = getLimitedCharacterPoolStatus(char, poolContext);
            const removesAfter = rotationStatus.removesAfter;
            const isRemoved = !rotationStatus.isIntroduced || rotationStatus.isRemoved;
            const isCurrentUp = char.name === pool.up_character;
            const stateText = !rotationStatus.isIntroduced
              ? '未引入'
              : `${rotationStatus.effectiveRotationPosition}/${removesAfter ?? '∞'}`;

            return (
              <span
                key={char.id}
                title={`${char.name}: ${stateText}${isRemoved ? ' (当前池不在计划内)' : ''}${isCurrentUp ? ' [当前UP]' : ''}`}
                className={`text-xs px-1.5 py-0.5 rounded ${
                  isRemoved
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 line-through'
                    : isCurrentUp
                      ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-bold'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                }`}
              >
                {isCurrentUp && '★'}{char.name.length > 4 ? char.name.slice(0, 4) + '...' : char.name}
                <span className="opacity-70 ml-0.5">{stateText}</span>
              </span>
            );
          })}
        {limitedSixStarCharacters.length > 6 && (
          <span className="text-xs text-slate-400 dark:text-zinc-500">
            +{limitedSixStarCharacters.length - 6}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * 卡池卡片组件
 */
const PoolCard = ({
  pool,
  poolCharacters,
  characters,
  limitedSixStarCharacters,
  actionLoading,
  onEdit,
  onDelete
}) => {
  const isLimitedPool = pool.type === 'limited' || pool.type === 'limited_character';

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
      {/* Banner 图片 */}
      {pool.banner_url && (
        <div className="relative w-full h-24 overflow-hidden">
          <img
            src={pool.banner_url}
            alt={pool.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
        </div>
      )}

      {/* 卡池信息 */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {getTypeIcon(pool.type)}
              <h4 className="font-bold text-slate-700 dark:text-zinc-300 truncate">
                {pool.name}
              </h4>
              {pool.locked && (
                <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded">
                  已锁定
                </span>
              )}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${getTypeColor(pool.type)}`}>
              {getTypeLabel(pool.type)}
            </span>
          </div>
        </div>

        {/* UP 角色 */}
        {pool.up_character && (
          <div className="flex items-center gap-2 mt-2 text-sm text-slate-600 dark:text-zinc-400">
            <Star size={12} className="text-orange-500" />
            UP: {pool.up_character}
          </div>
        )}

        {/* 描述 */}
        {pool.description && (
          <p className="text-xs text-slate-500 dark:text-zinc-500 mt-2 line-clamp-2">
            {pool.description}
          </p>
        )}

        {/* 时间范围 */}
        {(pool.start_time || pool.end_time) && (
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400 dark:text-zinc-600">
            <Calendar size={12} />
            {pool.start_time && new Date(pool.start_time).toLocaleDateString()}
            {pool.start_time && pool.end_time && ' - '}
            {pool.end_time && new Date(pool.end_time).toLocaleDateString()}
          </div>
        )}

        {/* 卡池角色一览 */}
        <PoolCharacterList
          pool={pool}
          poolCharacters={poolCharacters}
          characters={characters}
        />

        {/* 轮换状态 */}
        <RotationStatus
          pool={pool}
          limitedSixStarCharacters={limitedSixStarCharacters}
        />

        {/* 操作按钮 */}
        <div className={`flex items-center gap-2 ${!isLimitedPool ? 'mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800' : ''}`}>
          {isLimitedPool && (
            <span className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 rounded-none">
              <RotateCw size={12} />
              按时间计划派生
            </span>
          )}
          <button
            onClick={() => onEdit(pool)}
            disabled={actionLoading === pool.pool_id}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-none transition-colors disabled:opacity-50"
          >
            <Edit2 size={12} />
            编辑
          </button>
          <button
            onClick={() => onDelete(pool)}
            disabled={actionLoading === pool.pool_id || pool.locked}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-none transition-colors disabled:opacity-50"
          >
            <Trash2 size={12} />
            {actionLoading === pool.pool_id ? '删除中...' : '删除'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PoolCard;
