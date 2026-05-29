-- 125: Refresh homepage roadmap after the preview card and mail rollout landed.

UPDATE public.site_config
SET
  value = '[
    {
      "id": "public-cache",
      "icon": "Globe",
      "title": "公共数据缓存",
      "description": "首屏公共数据已统一走同源 API，并支持公共缓存版本刷新。",
      "status": "completed",
      "priority": "high"
    },
    {
      "id": "ops-automation",
      "icon": "RefreshCw",
      "title": "运营自动化二期",
      "description": "自动化任务已具备 job graph、partial 状态、重跑和审计详情。",
      "status": "completed",
      "priority": "high"
    },
    {
      "id": "admin-data",
      "icon": "Database",
      "title": "卡池角色管理",
      "description": "卡池、角色与武器管理已完成重写，支持更安全的编辑流程。",
      "status": "completed",
      "priority": "high"
    },
    {
      "id": "performance-docs",
      "icon": "Rocket",
      "title": "项目瘦身与文档",
      "description": "README、架构文档、截图与入口拆包已完成本轮整理。",
      "status": "completed",
      "priority": "medium"
    },
    {
      "id": "heirlooms-preview",
      "icon": "Map",
      "title": "寻遗散记前瞻",
      "description": "首页已同步寻遗散记前瞻摘要、PV 与动态入口。",
      "status": "completed",
      "priority": "high"
    },
    {
      "id": "official-id-backfill",
      "icon": "Shield",
      "title": "官方 ID 回填",
      "description": "后续将收口手动主键、官方 ID、别名和历史导出的兼容迁移。",
      "status": "planned",
      "priority": "high"
    },
    {
      "id": "public-api-metrics",
      "icon": "Calculator",
      "title": "公共 API 指标",
      "description": "卡池分析将补齐预聚合指标、趋势点、分布桶和口径说明。",
      "status": "planned",
      "priority": "high"
    },
    {
      "id": "account-notify",
      "icon": "Languages",
      "title": "账号与通知闭环",
      "description": "邮箱验证、密码重置、邮件登录、工单通知和后台邮件状态已接入；持久通知中心继续排期。",
      "status": "in_progress",
      "priority": "high"
    }
  ]',
  label = COALESCE(label, '首页路线图'),
  category = COALESCE(category, 'home'),
  updated_at = now()
WHERE key = 'home_roadmap_items';

INSERT INTO public.site_config (key, value, label, category, updated_at)
SELECT
  'home_roadmap_items',
  '[
    {
      "id": "public-cache",
      "icon": "Globe",
      "title": "公共数据缓存",
      "description": "首屏公共数据已统一走同源 API，并支持公共缓存版本刷新。",
      "status": "completed",
      "priority": "high"
    },
    {
      "id": "ops-automation",
      "icon": "RefreshCw",
      "title": "运营自动化二期",
      "description": "自动化任务已具备 job graph、partial 状态、重跑和审计详情。",
      "status": "completed",
      "priority": "high"
    },
    {
      "id": "admin-data",
      "icon": "Database",
      "title": "卡池角色管理",
      "description": "卡池、角色与武器管理已完成重写，支持更安全的编辑流程。",
      "status": "completed",
      "priority": "high"
    },
    {
      "id": "performance-docs",
      "icon": "Rocket",
      "title": "项目瘦身与文档",
      "description": "README、架构文档、截图与入口拆包已完成本轮整理。",
      "status": "completed",
      "priority": "medium"
    },
    {
      "id": "heirlooms-preview",
      "icon": "Map",
      "title": "寻遗散记前瞻",
      "description": "首页已同步寻遗散记前瞻摘要、PV 与动态入口。",
      "status": "completed",
      "priority": "high"
    },
    {
      "id": "official-id-backfill",
      "icon": "Shield",
      "title": "官方 ID 回填",
      "description": "后续将收口手动主键、官方 ID、别名和历史导出的兼容迁移。",
      "status": "planned",
      "priority": "high"
    },
    {
      "id": "public-api-metrics",
      "icon": "Calculator",
      "title": "公共 API 指标",
      "description": "卡池分析将补齐预聚合指标、趋势点、分布桶和口径说明。",
      "status": "planned",
      "priority": "high"
    },
    {
      "id": "account-notify",
      "icon": "Languages",
      "title": "账号与通知闭环",
      "description": "邮箱验证、密码重置、邮件登录、工单通知和后台邮件状态已接入；持久通知中心继续排期。",
      "status": "in_progress",
      "priority": "high"
    }
  ]',
  '首页路线图',
  'home',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.site_config WHERE key = 'home_roadmap_items'
);

UPDATE public.site_config
SET value = jsonb_build_object(
  'version', ((extract(epoch from now()) * 1000)::bigint)::text,
  'scope', 'site-config',
  'reason', 'migration:125_refresh_home_roadmap_after_mail_rollout',
  'updatedAt', now()
)::text,
updated_at = now()
WHERE key = 'public_cache_epoch';
