-- ============================================
-- Endfield Gacha Analyzer - 完整数据库架构
-- 请在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. 创建 profiles 表（用户信息）
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

-- 2. 创建 pools 表（卡池）
CREATE TABLE IF NOT EXISTS public.pools (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pool_id TEXT NOT NULL,  -- 本地卡池ID，如 "pool_1764318026209"
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('limited', 'weapon', 'standard')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT pools_pkey PRIMARY KEY (id),
  CONSTRAINT pools_user_pool_id_unique UNIQUE (user_id, pool_id)
);

-- 3. 创建 history 表（抽卡记录）
CREATE TABLE IF NOT EXISTS public.history (
  id BIGSERIAL NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_id DOUBLE PRECISION NOT NULL,  -- 本地记录ID
  pool_id TEXT NOT NULL,  -- 本地卡池ID
  rarity INTEGER NOT NULL CHECK (rarity >= 4 AND rarity <= 6),
  is_standard BOOLEAN DEFAULT FALSE,
  special_type TEXT CHECK (special_type IN ('guaranteed', 'gift', NULL)),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT history_pkey PRIMARY KEY (id),
  CONSTRAINT history_user_record_id_unique UNIQUE (user_id, record_id)
);

-- 4. 创建 admin_applications 表（管理员申请）
CREATE TABLE IF NOT EXISTS public.admin_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT admin_applications_pkey PRIMARY KEY (id)
);

-- 5. 创建 announcements 表（公告，可选）
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT announcements_pkey PRIMARY KEY (id)
);

-- ============================================
-- 触发器：新用户注册时自动创建 profile
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    CASE
      WHEN NEW.email = 'leevident@endmin.ark' THEN 'super_admin'
      ELSE 'user'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 创建新触发器
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Row Level Security (RLS) 策略
-- ============================================

-- 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- profiles 策略
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- pools 策略
CREATE POLICY "Users can view own pools" ON public.pools
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pools" ON public.pools
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pools" ON public.pools
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pools" ON public.pools
  FOR DELETE USING (auth.uid() = user_id);

-- history 策略
CREATE POLICY "Users can view own history" ON public.history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history" ON public.history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own history" ON public.history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own history" ON public.history
  FOR DELETE USING (auth.uid() = user_id);

-- admin_applications 策略
CREATE POLICY "Users can view own applications" ON public.admin_applications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own applications" ON public.admin_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins can view all applications" ON public.admin_applications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Super admins can update applications" ON public.admin_applications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- announcements 策略
CREATE POLICY "Anyone can view active announcements" ON public.announcements
  FOR SELECT USING (is_active = true);

-- ============================================
-- 索引（提升查询性能）
-- ============================================
CREATE INDEX IF NOT EXISTS idx_pools_user_id ON public.pools(user_id);
CREATE INDEX IF NOT EXISTS idx_history_user_id ON public.history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_pool_id ON public.history(pool_id);
CREATE INDEX IF NOT EXISTS idx_admin_applications_user_id ON public.admin_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_applications_status ON public.admin_applications(status);

-- ============================================
-- 完成！
--
-- 使用说明：
-- 1. 在 Supabase SQL Editor 中执行此脚本
-- 2. 用 leevident@endmin.ark 注册账号
-- 3. 该账号会自动成为超级管理员
-- ============================================
