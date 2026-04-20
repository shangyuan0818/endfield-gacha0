export const POOL_GROUP_PREFIX = '__group_';

export const GROUP_TYPE_LABELS = {
  all: '卡池',
  extra: '附加寻访',
  limited: '限定角色',
  standard: '常驻',
  weapon_limited: '限定武器',
  weapon_standard: '常驻武器',
  beginner: '新手'
};

export function isPoolGroupId(poolId) {
  return typeof poolId === 'string' && poolId.startsWith(POOL_GROUP_PREFIX);
}

export function getPoolGroupType(poolId) {
  if (!isPoolGroupId(poolId)) return null;
  return poolId.slice(POOL_GROUP_PREFIX.length);
}

export function getPoolsForGroupType(pools, groupType) {
  if (groupType === 'all') {
    return Array.isArray(pools) ? pools : [];
  }

  return (pools || []).filter((pool) => {
    let type = pool.type || 'standard';
    if (type === 'limited_character') type = 'limited';

    switch (groupType) {
      case 'extra':
        return type === 'extra';
      case 'limited':
        return type === 'limited';
      case 'standard':
        return type === 'standard';
      case 'weapon_limited':
        return (type === 'limited_weapon' || type === 'weapon') && pool.isLimitedWeapon !== false;
      case 'weapon_standard':
        return (type === 'limited_weapon' || type === 'weapon') && pool.isLimitedWeapon === false;
      case 'beginner':
        return type === 'beginner';
      default:
        return false;
    }
  });
}

export default {
  POOL_GROUP_PREFIX,
  GROUP_TYPE_LABELS,
  isPoolGroupId,
  getPoolGroupType,
  getPoolsForGroupType
};
