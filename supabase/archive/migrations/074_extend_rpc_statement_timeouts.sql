-- ============================================
-- 074: 放宽关键 RPC 的 statement_timeout
--
-- 背景:
--   国内访问 Supabase 时，跨境链路抖动会放大统计/卡池 RPC 的耗时。
--   仅拉长前端超时不够，数据库函数本身也需要更宽松的执行窗口。
--
-- 目标:
--   1. 给重查询统计 RPC 更多执行时间，减少过早 57014
--   2. 给卡池可见性 RPC 留出适度余量，避免偶发超时直接判空
-- ============================================

ALTER FUNCTION public.get_global_stats()
  SET statement_timeout = '90s';

ALTER FUNCTION public.get_character_ranking_stats()
  SET statement_timeout = '75s';

ALTER FUNCTION public.get_user_ranking_stats(uuid)
  SET statement_timeout = '60s';

ALTER FUNCTION public.get_app_visible_pools()
  SET statement_timeout = '30s';
