// 稀有度配置
export const RARITY_CONFIG = {
  6: { color: '#FF5F00', label: '6星(限定)', value: 6 }, // UP
  '6_std': { color: '#EF4444', label: '6星(常驻)', value: 6 }, // 歪
  5: { color: '#FFB800', label: '5星', value: 5 },
  4: { color: '#A855F7', label: '4星', value: 4 },
};

// 默认显示保底数
export const DEFAULT_DISPLAY_PITY = 80;

// 默认卡池ID
export const DEFAULT_POOL_ID = 'default_pool';

// 卡池类型关键词
export const POOL_TYPE_KEYWORDS = ['限定', '常驻', '武器', 'UP池', '卡池', '角色池', '武器池'];

// 预设卡池列表
export const PRESET_POOLS = [
  { label: '限定角色池', type: 'limited', charName: '' },
  { label: '常驻角色池', type: 'standard', charName: '' },
  { label: '限定武器池', type: 'weapon', charName: '' },
  { label: '限定-莱万汀', type: 'limited', charName: '莱万汀' },
  { label: '武器-莱万汀专武', type: 'weapon', charName: '莱万汀专武' },
  { label: '常驻武器池', type: 'standard', charName: '常驻武器' },
];

// 用户角色定义
export const USER_ROLES = {
  GUEST: 'guest',
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
};

// 角色显示名称
export const ROLE_LABELS = {
  guest: '游客',
  user: '用户',
  admin: '管理员',
  super_admin: '超级管理员'
};
