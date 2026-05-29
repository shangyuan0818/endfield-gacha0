export const DEFAULT_HOME_ROADMAP_ITEMS = [
  {
    id: 'public-cache',
    icon: 'Globe',
    title: '公共数据缓存',
    description: '首屏公共数据已统一走同源 API，并支持公共缓存版本刷新。',
    status: 'completed',
    priority: 'high',
  },
  {
    id: 'ops-automation',
    icon: 'RefreshCw',
    title: '运营自动化二期',
    description: '自动化任务已具备 job graph、partial 状态、重跑和审计详情。',
    status: 'completed',
    priority: 'high',
  },
  {
    id: 'admin-data',
    icon: 'Database',
    title: '卡池角色管理',
    description: '卡池、角色与武器管理已完成重写，支持更安全的编辑流程。',
    status: 'completed',
    priority: 'high',
  },
  {
    id: 'performance-docs',
    icon: 'Rocket',
    title: '项目瘦身与文档',
    description: 'README、架构文档、截图与入口拆包已完成本轮整理。',
    status: 'completed',
    priority: 'medium',
  },
  {
    id: 'heirlooms-preview',
    icon: 'Map',
    title: '寻遗散记前瞻',
    description: '首页已同步寻遗散记前瞻摘要、PV 与动态入口。',
    status: 'completed',
    priority: 'high',
  },
  {
    id: 'official-id-backfill',
    icon: 'Shield',
    title: '官方 ID 回填',
    description: '后续将收口手动主键、官方 ID、别名和历史导出的兼容迁移。',
    status: 'planned',
    priority: 'high',
  },
  {
    id: 'public-api-metrics',
    icon: 'Calculator',
    title: '公共 API 指标',
    description: '卡池分析将补齐预聚合指标、趋势点、分布桶和口径说明。',
    status: 'planned',
    priority: 'high',
  },
  {
    id: 'account-notify',
    icon: 'Languages',
    title: '账号与通知闭环',
    description: '邮箱验证、密码重置、邮件登录、工单通知和后台邮件状态已接入；持久通知中心继续排期。',
    status: 'in_progress',
    priority: 'high',
  },
];

export const DEFAULT_HOME_ROADMAP_SUMMARY = DEFAULT_HOME_ROADMAP_ITEMS.map(({ id, status }) => ({
  id,
  status,
}));

const LEGACY_ROADMAP_IDS = new Set([
  'sim-inherit',
  'puzzle-captcha',
  'global-support',
  'currency-calc',
  'sim-currency',
  'share',
  'i18n',
  'a11y',
  'virtual-scroll',
]);

export function normalizeHomeRoadmapItems(items, fallbackItems = DEFAULT_HOME_ROADMAP_ITEMS) {
  if (!Array.isArray(items) || items.length === 0) {
    return fallbackItems;
  }

  const itemIds = items.map((item) => item?.id).filter(Boolean);
  const containsLegacyVirtualScroll = itemIds.includes('virtual-scroll');
  const looksLikeLegacyDefault = itemIds.length > 0 && itemIds.every((id) => LEGACY_ROADMAP_IDS.has(id));

  if (containsLegacyVirtualScroll || looksLikeLegacyDefault) {
    return fallbackItems;
  }

  return items;
}
