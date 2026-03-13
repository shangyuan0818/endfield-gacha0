-- ============================================
-- 068: 安全加固 - profiles / pool_characters
-- 修复:
--   1. profiles.role 自提权风险
--   2. profiles 私有字段公开暴露
--   3. pool_characters 过宽写权限
-- ============================================

-- ---------- profiles: 公开字段改为受限视图 ----------

DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles AS
SELECT
  id,
  username,
  role
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

COMMENT ON VIEW public.public_profiles IS
  '对外公开的用户简档视图，仅暴露 id / username / role，不暴露 email / last_seen_at 等私有字段';

-- ---------- profiles: 重建策略 ----------

DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for super_admin" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.profiles;

-- 仅自己或超管可读取完整 profiles
CREATE POLICY "profiles_select_self_or_super_admin" ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = auth.uid()
        AND p.role = 'super_admin'
    )
  );

-- 用户只能插入自己的 profile，且角色必须是 user
CREATE POLICY "profiles_insert_self_user_only" ON public.profiles
  FOR INSERT
  WITH CHECK (
    id = auth.uid()
    AND role = 'user'
  );

-- 用户可以更新自己的 profile，但不能借此修改 role / email
CREATE POLICY "profiles_update_self_without_role_change" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role IS NOT DISTINCT FROM (
      SELECT p.role
      FROM public.profiles AS p
      WHERE p.id = auth.uid()
    )
    AND email IS NOT DISTINCT FROM (
      SELECT p.email
      FROM public.profiles AS p
      WHERE p.id = auth.uid()
    )
  );

-- 超管可更新任何 profile（含角色调整）
CREATE POLICY "profiles_update_super_admin" ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = auth.uid()
        AND p.role = 'super_admin'
    )
  )
  WITH CHECK (role IN ('user', 'admin', 'super_admin'));

COMMENT ON POLICY "profiles_select_self_or_super_admin" ON public.profiles IS
  '仅允许本人或超管读取完整 profile；公开展示请改走 public_profiles 视图';

COMMENT ON POLICY "profiles_update_self_without_role_change" ON public.profiles IS
  '允许用户更新自己的 profile，但禁止通过直接 update 修改 role / email';

COMMENT ON POLICY "profiles_update_super_admin" ON public.profiles IS
  '仅超管可以更新任意 profile 并调整角色';

-- ---------- profiles: 角色更新统一走 RPC ----------

CREATE OR REPLACE FUNCTION public.admin_update_profile(
  p_target_user_id UUID,
  p_username TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated public.profiles;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super_admin can update profiles'
      USING ERRCODE = '42501';
  END IF;

  IF p_role IS NOT NULL AND p_role NOT IN ('user', 'admin') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
  SET
    username = COALESCE(NULLIF(BTRIM(p_username), ''), username),
    role = COALESCE(p_role, role),
    updated_at = NOW()
  WHERE id = p_target_user_id
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found: %', p_target_user_id
      USING ERRCODE = 'P0002';
  END IF;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_profile(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.admin_update_profile(UUID, TEXT, TEXT) IS
  '超管更新用户 profile 的受控入口，禁止浏览器直接修改 role';

-- ---------- pool_characters: 收紧写权限 ----------

DROP POLICY IF EXISTS "pool_characters_insert_policy" ON public.pool_characters;
DROP POLICY IF EXISTS "pool_characters_update_policy" ON public.pool_characters;
DROP POLICY IF EXISTS "pool_characters_delete_policy" ON public.pool_characters;

CREATE POLICY "pool_characters_insert_admin_only" ON public.pool_characters
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "pool_characters_update_admin_only" ON public.pool_characters
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "pool_characters_delete_admin_only" ON public.pool_characters
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

COMMENT ON POLICY "pool_characters_insert_admin_only" ON public.pool_characters IS
  '仅管理员和超管可新增池子角色映射';

COMMENT ON POLICY "pool_characters_update_admin_only" ON public.pool_characters IS
  '仅管理员和超管可编辑池子角色映射';

COMMENT ON POLICY "pool_characters_delete_admin_only" ON public.pool_characters IS
  '仅管理员和超管可删除池子角色映射';
