// 稀有度配置
export const RARITY_CONFIG = {
  6: { color: '#FF5F00', label: '6星(限定)', value: 6 }, // UP
  '6_std': { color: '#EF4444', label: '6星(常驻)', value: 6 }, // 歪
  5: { color: '#FFB800', label: '5星', value: 5 },
  4: { color: '#A855F7', label: '4星', value: 4 },
};

// 默认显示保底数
export const DEFAULT_DISPLAY_PITY = 80;

// ============================================
// 卡池规则配置 - 基于官方细则
// ============================================

// 限定角色池规则
export const LIMITED_POOL_RULES = {
  // 6星保底
  sixStarPity: 80,                    // 最多80抽必出6星
  sixStarBaseProbability: 0.008,      // 6星基础概率 0.8%
  sixStarSoftPityStart: 65,           // 65抽后开始概率递增
  sixStarSoftPityIncrease: 0.05,      // 每抽增加5%概率
  hasSoftPity: true,                  // 有软保底机制

  // 5星保底
  fiveStarPity: 10,                   // 最多10抽必出5星+
  fiveStarBaseProbability: 0.08,      // 5星基础概率 8%

  // 硬保底（必出限定UP）
  guaranteedLimitedPity: 120,         // 120抽必出限定（仅生效1次）

  // 赠送机制
  giftInterval: 240,                  // 每240抽赠送限定信物

  // 情报书（仅获得1次）
  infoBookThreshold: 60,              // 累计60抽送1本寻访情报书
  infoBookLimit: 1,                   // 仅可获得1次

  // 50/50机制
  upProbability: 0.5,                 // 出6星时50%概率为UP

  // 卡池轮换
  poolDuration: 15,                   // 卡池开放15天

  // 保底继承
  pityInherits: true,                 // 6星和5星保底继承到其他限定池
};

// 限定池轮换计划（基于干员移出规则）
// 莱万汀：3次特许寻访后移出
// 伊冯：4次特许寻访后移出
// 洁尔佩塔：5次特许寻访后移出
export const LIMITED_POOL_SCHEDULE = [
  {
    name: '莱万汀',
    startDate: '2025-11-28',
    duration: 15,
    removesAfter: 3,                  // 3次后移出
  },
  {
    name: '伊冯',
    startDate: '2025-12-13',          // 11-28 + 15天
    duration: 15,
    removesAfter: 4,
  },
  {
    name: '洁尔佩塔',
    startDate: '2025-12-28',          // 12-13 + 15天
    duration: 15,
    removesAfter: 5,
  },
];

// 获取当前UP池信息（卡池在凌晨4点刷新）
export const getCurrentUpPool = () => {
  const now = new Date();
  for (const pool of LIMITED_POOL_SCHEDULE) {
    // 开始时间：当天凌晨4点
    const start = new Date(pool.startDate);
    start.setHours(4, 0, 0, 0);
    // 结束时间：duration天后的凌晨4点
    const end = new Date(start);
    end.setDate(end.getDate() + pool.duration);

    if (now >= start && now < end) {
      const index = LIMITED_POOL_SCHEDULE.indexOf(pool);
      const nextPool = LIMITED_POOL_SCHEDULE[index + 1];
      // 计算剩余时间（毫秒）
      const remainingMs = end - now;
      const remainingDays = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
      const remainingHours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      return {
        ...pool,
        endDate: end,
        nextPool: nextPool?.name || '待公布',
        isActive: true,
        remainingDays,
        remainingHours,
      };
    }
  }

  // 如果当前时间在所有卡池之前，返回第一个
  const firstPool = LIMITED_POOL_SCHEDULE[0];
  const firstStart = new Date(firstPool.startDate);
  firstStart.setHours(4, 0, 0, 0);
  if (now < firstStart) {
    const end = new Date(firstStart);
    end.setDate(end.getDate() + firstPool.duration);
    const startsInMs = firstStart - now;
    return {
      ...firstPool,
      endDate: end,
      nextPool: LIMITED_POOL_SCHEDULE[1]?.name || '待公布',
      isActive: false,
      startsIn: Math.ceil(startsInMs / (1000 * 60 * 60 * 24)),
      startsInHours: Math.floor((startsInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    };
  }

  // 所有卡池都已结束，返回最后一个
  const lastPool = LIMITED_POOL_SCHEDULE[LIMITED_POOL_SCHEDULE.length - 1];
  const lastStart = new Date(lastPool.startDate);
  lastStart.setHours(4, 0, 0, 0);
  const lastEnd = new Date(lastStart);
  lastEnd.setDate(lastEnd.getDate() + lastPool.duration);
  return {
    ...lastPool,
    endDate: lastEnd,
    nextPool: '待公布',
    isActive: false,
    isExpired: true,
  };
};

// 兼容旧代码
export const CURRENT_UP_POOL_INFO = getCurrentUpPool();

// 常驻角色池规则
export const STANDARD_POOL_RULES = {
  sixStarPity: 80,
  sixStarBaseProbability: 0.008,
  sixStarSoftPityStart: 65,           // 65抽后开始概率递增
  sixStarSoftPityIncrease: 0.05,      // 每抽增加5%概率
  hasSoftPity: true,                  // 有软保底机制

  fiveStarPity: 10,
  fiveStarBaseProbability: 0.08,

  // 自选赠送
  selectGiftThreshold: 300,           // 300抽送自选6星
  selectGiftLimit: 1,                 // 仅可获得1次

  pityInherits: false,                // 常驻池保底独立计算
};

// 武器池规则
export const WEAPON_POOL_RULES = {
  // 6星保底 (每十连 = 1次申领)
  sixStarPity: 40,                    // 每4次申领(40抽)必出6星
  sixStarBaseProbability: 0.04,       // 6星基础概率 4%
  hasSoftPity: false,                 // 武器池无软保底机制（概率不递增）

  // 5星保底
  fiveStarPity: 10,                   // 每次申领至少1件5星+
  fiveStarBaseProbability: 0.15,      // 5星基础概率 15%

  // 硬保底（必出限定UP武器）
  guaranteedLimitedPity: 80,          // 80抽首轮必出限定（仅生效1次）

  // 赠送机制
  firstStandardGift: 100,             // 第100抽送补充武库箱(常驻自选)
  firstLimitedGift: 180,              // 第180抽送限定UP武器
  giftAlternateInterval: 80,          // 之后每80抽交替发放

  // UP概率
  upProbability: 0.25,                // UP武器占6星25%概率

  pityInherits: false,                // 武器池保底不继承
};

// 默认卡池ID
// 需求：默认选择卡池为「限定-42-杨颜」，ID 为 pool_1764318026209
export const DEFAULT_POOL_ID = 'pool_1764318026209';

// 卡池类型关键词
export const POOL_TYPE_KEYWORDS = ['限定', '常驻', '武器', 'UP池', '卡池', '角色池', '武器池'];

// 预设卡池列表 - 基于 LIMITED_POOL_SCHEDULE 动态生成
export const PRESET_POOLS = [
  // 通用卡池类型
  { label: '限定角色池', type: 'limited', charName: '' },
  { label: '常驻角色池', type: 'standard', charName: '' },
  { label: '武器池', type: 'weapon', charName: '' },
  // 当前版本限定角色池（按轮换顺序）
  ...LIMITED_POOL_SCHEDULE.map(pool => ({
    label: `限定-${pool.name}`,
    type: 'limited',
    charName: pool.name,
  })),
  // 当前版本限定武器池
  ...LIMITED_POOL_SCHEDULE.map(pool => ({
    label: `武器-${pool.name}`,
    type: 'weapon',
    charName: pool.name,
  })),
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
