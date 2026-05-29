-- ============================================
-- 080: 退役无用的页面管理能力
--
-- 背景:
--   page_content 仅剩超管后台维护链路在读取，
--   首页、公告、导航、权限判断与 bootstrap 数据链已不再依赖它。
--
-- 目标:
--   1. 移除 page_content 表及其触发器 / 策略残留
--   2. 为前端后台入口退役提供对应的数据库收口
-- ============================================

DROP TABLE IF EXISTS public.page_content CASCADE;

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 080: page_content 已退役';
END $$;
