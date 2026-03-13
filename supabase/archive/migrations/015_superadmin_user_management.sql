-- ============================================
-- 超级管理员用户管理权限配置
-- 允许超级管理员完整管理用户（增删改）
--
-- 执行时间: 2025-12-04
-- 说明: 为超管的用户增删改功能添加必要的权限
-- ============================================

-- 1. 确保 profiles 表有超管删除权限
DROP POLICY IF EXISTS "Enable delete for super_admin" ON public.profiles;

CREATE POLICY "Enable delete for super_admin" ON public.profiles
  FOR DELETE USING (
    -- 超管可以删除任何 profile（但不能删除自己）
    EXISTS (
      SELECT 1 FROM public.profiles as p
      WHERE p.id = auth.uid()
      AND p.role = 'super_admin'
    )
    AND id != auth.uid() -- 防止超管删除自己
  );

-- 2. 确保 profiles 表有超管更新权限
DROP POLICY IF EXISTS "Enable update for super_admin" ON public.profiles;

CREATE POLICY "Enable update for super_admin" ON public.profiles
  FOR UPDATE USING (
    -- 超管可以更新任何 profile
    EXISTS (
      SELECT 1 FROM public.profiles as p
      WHERE p.id = auth.uid()
      AND p.role = 'super_admin'
    )
    OR
    -- 用户可以更新自己的 profile
    id = auth.uid()
  );

-- 3. 确保 profiles 表有插入权限（注册新用户时需要）
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.profiles;

CREATE POLICY "Enable insert for authenticated users" ON public.profiles
  FOR INSERT WITH CHECK (true);

-- 4. 确保 admin_applications 表有超管删除权限
DROP POLICY IF EXISTS "Enable delete for super_admin on applications" ON public.admin_applications;

CREATE POLICY "Enable delete for super_admin on applications" ON public.admin_applications
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- 5. 创建一个函数来检查当前用户是否为超管（方便前端调用）
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
END;
$$;

-- ============================================
-- 重要提示：
--
-- 1. ⚠️ Auth Admin API 限制
--    - supabase.auth.admin.createUser() 需要 service_role key
--    - supabase.auth.admin.deleteUser() 需要 service_role key
--    - 前端无法直接使用这些 API（安全风险）
--
-- 2. 🔒 推荐方案：创建 Supabase Edge Functions
--    - 在服务端使用 service_role key
--    - 前端通过安全的 API 调用这些函数
--    - 参考：https://supabase.com/docs/guides/functions
--
-- 3. 📝 如果必须在前端使用（仅开发环境）：
--    - 需要在 .env 中添加 VITE_SUPABASE_SERVICE_ROLE_KEY
--    - 修改 supabaseClient.js 创建管理员客户端
--    - ⚠️ 切勿在生产环境暴露 service_role key！
--
-- ============================================
