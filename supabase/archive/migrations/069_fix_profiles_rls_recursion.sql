-- ============================================
-- 069: 修复 profiles RLS 递归
--
-- 问题:
--   068 在 profiles 自身策略里再次 SELECT public.profiles，
--   导致 PostgreSQL 检测到 policy recursion：
--   infinite recursion detected in policy for relation "profiles"
--
-- 影响:
--   1. profiles 自身查询 500
--   2. 任何在 RLS 中依赖 profiles 进行角色判断的表也会连带 500
--      包括 characters / announcements / site_config / history / tickets 等
--
-- 修复:
--   将策略里的角色/邮箱读取改为 SECURITY DEFINER helper functions，
--   避免在 profiles policy 内部再次触发 profiles 的 RLS 计算。
-- ============================================

-- ---------- helper functions ----------

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_profile_email()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT email
  FROM public.profiles
  WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_email() TO anon, authenticated;

COMMENT ON FUNCTION public.is_super_admin() IS
  '安全判断当前登录用户是否为 super_admin，供 RLS 使用，避免 profiles 策略递归';

COMMENT ON FUNCTION public.current_profile_role() IS
  '安全读取当前登录用户在 profiles 中的角色，供 RLS 使用，避免 profiles 策略递归';

COMMENT ON FUNCTION public.current_profile_email() IS
  '安全读取当前登录用户在 profiles 中的邮箱，供 RLS 使用，避免 profiles 策略递归';

-- ---------- rebuild profiles policies ----------

DROP POLICY IF EXISTS "profiles_select_self_or_super_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self_without_role_change" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_super_admin" ON public.profiles;

CREATE POLICY "profiles_select_self_or_super_admin" ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR public.is_super_admin()
  );

CREATE POLICY "profiles_update_self_without_role_change" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role IS NOT DISTINCT FROM public.current_profile_role()
    AND email IS NOT DISTINCT FROM public.current_profile_email()
  );

CREATE POLICY "profiles_update_super_admin" ON public.profiles
  FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (role IN ('user', 'admin', 'super_admin'));

COMMENT ON POLICY "profiles_select_self_or_super_admin" ON public.profiles IS
  '仅允许本人或超管读取完整 profile；通过 helper function 避免 RLS 递归';

COMMENT ON POLICY "profiles_update_self_without_role_change" ON public.profiles IS
  '允许用户更新自己的 profile，但禁止通过直接 update 修改 role / email；通过 helper function 避免 RLS 递归';

COMMENT ON POLICY "profiles_update_super_admin" ON public.profiles IS
  '仅超管可以更新任意 profile 并调整角色；通过 helper function 避免 RLS 递归';
