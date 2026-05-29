-- ============================================
-- 083: 加固 admin-delete-user 的 auth.users 外键删除策略
--
-- 背景:
--   announcements.created_by / site_config.updated_by 仍直接引用 auth.users(id)，
--   默认行为会在超管删除管理员账号时阻塞 auth.admin.deleteUser()。
--
-- 目标:
--   1. 将仍保留的元数据外键改为 ON DELETE SET NULL
--   2. 保持公告 / 站点配置内容可保留，删除账号后仅清空“最后操作者”
-- ============================================

ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_created_by_fkey;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

ALTER TABLE public.site_config
  DROP CONSTRAINT IF EXISTS site_config_updated_by_fkey;

ALTER TABLE public.site_config
  ADD CONSTRAINT site_config_updated_by_fkey
  FOREIGN KEY (updated_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 083: admin-delete-user 外键策略已改为 ON DELETE SET NULL';
END $$;
