-- 136: allow same-origin admin profile updates through service-role RPC calls.
--
-- The admin users route verifies the real caller in the site-session layer and
-- then calls Supabase with the service role key. In that request context
-- auth.uid() is empty, so the old admin_update_profile() check rejected valid
-- super-admin edits. Require the API to pass the verified actor id instead.

DROP FUNCTION IF EXISTS public.admin_update_profile(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_update_profile(UUID, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.admin_update_profile(
  p_target_user_id UUID,
  p_username TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID;
  v_updated public.profiles;
BEGIN
  v_actor_user_id := COALESCE(p_actor_user_id, auth.uid());

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_actor_user_id
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

GRANT EXECUTE ON FUNCTION public.admin_update_profile(UUID, TEXT, TEXT, UUID) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.admin_update_profile(UUID, TEXT, TEXT, UUID) TO service_role;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.admin_update_profile(UUID, TEXT, TEXT, UUID) IS
  '超管更新用户 profile 的受控入口；同源后台代理调用必须传入已验证的 actor user id。';

NOTIFY pgrst, 'reload schema';
