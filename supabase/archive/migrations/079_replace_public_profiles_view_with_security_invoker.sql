-- ============================================
-- 079: 将 public_profiles 改为 security_invoker 视图
--
-- 背景:
--   068 为了公开用户名 / 角色，创建了 public.public_profiles 视图，
--   但它直接读取 public.profiles，在 PostgreSQL 中默认按视图拥有者权限执行，
--   会被 Supabase adviser 标记为 security_definer_view。
--
-- 目标:
--   1. 保持 public.public_profiles 这个对外读取接口不变
--   2. 让视图本身改为 security_invoker = true，消除 adviser 报错
--   3. 通过独立的公开索引表承载对外可见字段，避免直接放宽 profiles 的 RLS
-- ============================================

CREATE TABLE IF NOT EXISTS public.public_profile_cache (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT,
  role TEXT NOT NULL CHECK (role IN ('user', 'admin', 'super_admin')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.public_profile_cache IS
  'public_profiles 的底层公开索引表，仅缓存可对外展示的 id / username / role。';

ALTER TABLE public.public_profile_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_profile_cache_select_all" ON public.public_profile_cache;
CREATE POLICY "public_profile_cache_select_all" ON public.public_profile_cache
  FOR SELECT USING (true);

REVOKE ALL ON public.public_profile_cache FROM anon, authenticated;
GRANT SELECT ON public.public_profile_cache TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_public_profile_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.public_profile_cache
    WHERE id = OLD.id;

    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.id IS DISTINCT FROM OLD.id THEN
    DELETE FROM public.public_profile_cache
    WHERE id = OLD.id;
  END IF;

  INSERT INTO public.public_profile_cache (id, username, role, updated_at)
  VALUES (NEW.id, NEW.username, NEW.role, NOW())
  ON CONFLICT (id) DO UPDATE
  SET
    username = EXCLUDED.username,
    role = EXCLUDED.role,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_public_profile_cache() IS
  '同步 profiles 到 public_profile_cache，供 security_invoker public_profiles 视图读取。';

DROP TRIGGER IF EXISTS sync_public_profile_cache ON public.profiles;
CREATE TRIGGER sync_public_profile_cache
  AFTER INSERT OR UPDATE OF id, username, role OR DELETE
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_public_profile_cache();

INSERT INTO public.public_profile_cache (id, username, role, updated_at)
SELECT
  p.id,
  p.username,
  p.role,
  NOW()
FROM public.profiles AS p
ON CONFLICT (id) DO UPDATE
SET
  username = EXCLUDED.username,
  role = EXCLUDED.role,
  updated_at = NOW();

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT
  id,
  username,
  role
FROM public.public_profile_cache;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

COMMENT ON VIEW public.public_profiles IS
  '对外公开的用户简档视图（security_invoker），仅暴露 id / username / role。';

DO $$
DECLARE
  profile_cache_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO profile_cache_count
  FROM public.public_profile_cache;

  RAISE NOTICE '✅ Migration 079: public_profiles 已切换为 security_invoker 视图';
  RAISE NOTICE '   public_profile_cache rows: %', profile_cache_count;
END $$;
