export const ImportStatus = {
  IDLE: 'idle',
  AUTHENTICATING: 'authenticating',
  ACCOUNT_SELECTION: 'account_selection',
  FETCHING: 'fetching',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  ERROR: 'error'
};

export function getPoolName(poolType) {
  const nameMap = {
    limited_character: '限定角色',
    standard: '常驻',
    beginner: '新手',
    limited_weapon: '武器',
    unknown: '未知'
  };

  return nameMap[poolType] || poolType;
}
