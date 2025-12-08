-- ============================================
-- 001: 终末地抽卡分析器 - 数据库初始化
-- 创建基础表: profiles, pools, history, admin_applications
-- ============================================

-- ============================================
-- 1. 用户资料表 (profiles)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS 策略：所有人可读取（用于显示创建者用户名等）
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT USING (true);

-- RLS 策略：用户只能更新自己的资料
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- RLS 策略：用户可以插入自己的资料
CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 创建触发器函数：自动创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 绑定触发器到 auth.users 表
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. 卡池表 (pools)
-- ============================================
CREATE TABLE IF NOT EXISTS public.pools (
  id SERIAL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pool_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('limited', 'standard', 'weapon')),
  locked BOOLEAN DEFAULT FALSE,
  is_limited_weapon BOOLEAN DEFAULT TRUE,  -- 武器池类型：限定/常驻
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, pool_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_pools_user_id ON public.pools(user_id);
CREATE INDEX IF NOT EXISTS idx_pools_type ON public.pools(type);

-- 启用 RLS
ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;

-- RLS 策略：所有人可读取卡池（公开查看）
CREATE POLICY "pools_select_policy" ON public.pools
  FOR SELECT USING (true);

-- RLS 策略：用户可以管理自己的卡池
CREATE POLICY "pools_insert_policy" ON public.pools
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pools_update_policy" ON public.pools
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "pools_delete_policy" ON public.pools
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 3. 抽卡记录表 (history)
-- ============================================
CREATE TABLE IF NOT EXISTS public.history (
  id SERIAL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  record_id TEXT NOT NULL,
  pool_id TEXT NOT NULL,
  rarity INTEGER NOT NULL CHECK (rarity BETWEEN 3 AND 6),
  is_standard BOOLEAN DEFAULT FALSE,
  special_type TEXT CHECK (special_type IS NULL OR special_type IN ('gift', 'guaranteed')),
  item_name TEXT,  -- 可选：物品名称
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, record_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_history_user_id ON public.history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_pool_id ON public.history(pool_id);
CREATE INDEX IF NOT EXISTS idx_history_rarity ON public.history(rarity);
CREATE INDEX IF NOT EXISTS idx_history_timestamp ON public.history(timestamp);

-- 启用 RLS
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;

-- RLS 策略：所有人可读取历史记录（公开查看）
CREATE POLICY "history_select_policy" ON public.history
  FOR SELECT USING (true);

-- RLS 策略：用户可以管理自己的记录
CREATE POLICY "history_insert_policy" ON public.history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "history_update_policy" ON public.history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "history_delete_policy" ON public.history
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 4. 管理员申请表 (admin_applications)
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_admin_applications_user_id ON public.admin_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_applications_status ON public.admin_applications(status);

-- 启用 RLS
ALTER TABLE public.admin_applications ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户可以查看自己的申请
CREATE POLICY "admin_applications_select_own" ON public.admin_applications
  FOR SELECT USING (auth.uid() = user_id);

-- RLS 策略：超管可以查看所有申请
CREATE POLICY "admin_applications_select_super" ON public.admin_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- RLS 策略：用户可以创建申请
CREATE POLICY "admin_applications_insert_policy" ON public.admin_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS 策略：超管可以更新申请状态
CREATE POLICY "admin_applications_update_super" ON public.admin_applications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ============================================
-- 5. 辅助函数
-- ============================================

-- 更新 updated_at 时间戳的触发器函数
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 为各表添加 updated_at 触发器
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_pools_updated_at ON public.pools;
CREATE TRIGGER update_pools_updated_at
  BEFORE UPDATE ON public.pools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_history_updated_at ON public.history;
CREATE TRIGGER update_history_updated_at
  BEFORE UPDATE ON public.history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_admin_applications_updated_at ON public.admin_applications;
CREATE TRIGGER update_admin_applications_updated_at
  BEFORE UPDATE ON public.admin_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 注释
-- ============================================
COMMENT ON TABLE public.profiles IS '用户资料表，存储用户名和角色信息';
COMMENT ON TABLE public.pools IS '卡池表，存储用户创建的抽卡卡池';
COMMENT ON TABLE public.history IS '抽卡历史记录表，存储所有抽卡结果';
COMMENT ON TABLE public.admin_applications IS '管理员申请表，用户申请成为管理员的记录';

