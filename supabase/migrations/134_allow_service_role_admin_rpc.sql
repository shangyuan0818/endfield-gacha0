-- 134: allow server-side admin RPC calls through service_role.
--
-- The admin API already verifies the caller with the site-session layer before
-- it calls Supabase with the service role key. Some admin RPCs also call
-- public.is_super_admin(), but service_role requests do not have auth.uid(), so
-- those RPCs can reject valid super-admin actions with:
--   only super_admin can manage pools
--
-- Keep browser/user calls unchanged: authenticated users still need a
-- profiles.role = 'super_admin' row. Only service_role gains the helper pass.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.is_super_admin() TO service_role;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.is_super_admin() IS
  '判断当前请求是否具备超管权限；浏览器用户需要 profiles.role = super_admin，服务端代理请求允许 service_role。';
