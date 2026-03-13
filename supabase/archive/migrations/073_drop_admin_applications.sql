-- ============================================
-- 073: 移除已废弃的管理员申请体系
-- 背景:
--   前端运行时已经不再依赖 admin_applications。
--   保留该表只会让新环境继续创建无用结构，并增加文档噪音。
-- ============================================

DROP POLICY IF EXISTS "admin_applications_select_own" ON public.admin_applications;
DROP POLICY IF EXISTS "admin_applications_select_super" ON public.admin_applications;
DROP POLICY IF EXISTS "admin_applications_insert_policy" ON public.admin_applications;
DROP POLICY IF EXISTS "admin_applications_update_super" ON public.admin_applications;
DROP POLICY IF EXISTS "admin_applications_delete_super" ON public.admin_applications;
DROP POLICY IF EXISTS "Enable delete for super_admin on applications" ON public.admin_applications;

DROP TABLE IF EXISTS public.admin_applications CASCADE;

COMMENT ON TABLE public.profiles IS
  '用户资料表；管理员权限变更已改走超管直管流程，不再使用 admin_applications 申请链路。';
