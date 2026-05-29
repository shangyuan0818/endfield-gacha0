-- ============================================
-- 081: 移除无用黑名单功能
--
-- 背景:
--   黑名单 / 邮箱黑白名单验证链当前已无运行时调用，
--   仅剩超管后台与历史 schema 残留。
--
-- 目标:
--   1. 删除 blacklist 表与旧邮箱黑白名单表
--   2. 删除 is_email_blacklisted / validate_email_domain 等旧函数
--   3. 收口无效的防刷旧链，避免继续误导维护者
-- ============================================

DROP FUNCTION IF EXISTS public.is_email_blacklisted(TEXT);
DROP FUNCTION IF EXISTS public.validate_email_domain(TEXT);

DROP TABLE IF EXISTS public.blacklist CASCADE;
DROP TABLE IF EXISTS public.email_blacklist CASCADE;
DROP TABLE IF EXISTS public.email_whitelist CASCADE;

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 081: 黑名单与邮箱黑白名单旧链已移除';
END $$;
