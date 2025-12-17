-- ============================================
-- 024: 用户管理增强
-- 添加 email 和 last_seen_at 字段到 profiles 表
-- 修复 AdminPanel 无法显示用户邮箱的问题
-- ============================================

-- 1. 添加 email 字段（用于在管理面板显示用户邮箱）
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. 添加 last_seen_at 字段（记录用户最后在线时间）
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- 3. 为现有用户填充 email（从 auth.users 获取）
-- 注意：这需要 SECURITY DEFINER 权限来访问 auth.users
CREATE OR REPLACE FUNCTION public.sync_existing_emails()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  UPDATE public.profiles p
  SET email = u.email
  FROM auth.users u
  WHERE p.id = u.id AND p.email IS NULL;
END;
$$;

-- 执行同步
SELECT public.sync_existing_emails();

-- 删除临时函数
DROP FUNCTION IF EXISTS public.sync_existing_emails();

-- 4. 修改 handle_new_user 触发器函数，保存 email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    'user'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 5. 创建更新 last_seen_at 的函数（前端登录时调用）
CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET last_seen_at = NOW()
  WHERE id = auth.uid();
END;
$$;

-- 6. 为 email 和 last_seen_at 创建索引（提升查询性能）
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles(last_seen_at);

-- 7. 添加注释
COMMENT ON COLUMN public.profiles.email IS '用户邮箱（从 auth.users 同步）';
COMMENT ON COLUMN public.profiles.last_seen_at IS '用户最后在线时间';
COMMENT ON FUNCTION public.update_last_seen() IS '更新当前用户的最后在线时间';
