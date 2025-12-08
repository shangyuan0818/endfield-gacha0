-- ============================================
-- 终末地抽卡分析器 - 完整数据库架构
-- 版本: 2.2.1
-- 更新日期: 2025-12-08
-- 
-- 此文件整合了所有迁移文件，可用于：
-- 1. 全新数据库初始化
-- 2. 数据库架构参考文档
-- 
-- 注意：如果数据库已有数据，请使用增量迁移文件
-- ============================================

-- ============================================
-- 第一部分：核心表
-- ============================================

-- ==================== 1.1 用户资料表 ====================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 所有人可读取
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT USING (true);

-- 用户可更新自己的资料，超管可更新任何人
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 允许插入（注册时）
CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT WITH CHECK (true);

-- 超管可删除其他用户（但不能删自己）
CREATE POLICY "profiles_delete_policy" ON public.profiles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
    AND id != auth.uid()
  );

COMMENT ON TABLE public.profiles IS '用户资料表';

-- ==================== 1.2 卡池表 ====================
CREATE TABLE IF NOT EXISTS public.pools (
  id SERIAL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pool_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('limited', 'standard', 'weapon')),
  locked BOOLEAN DEFAULT FALSE,
  is_limited_weapon BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, pool_id)
);

CREATE INDEX IF NOT EXISTS idx_pools_user_id ON public.pools(user_id);
CREATE INDEX IF NOT EXISTS idx_pools_type ON public.pools(type);

ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;

-- 所有人可读取
CREATE POLICY "pools_select_policy" ON public.pools
  FOR SELECT USING (true);

-- 用户可管理自己的卡池
CREATE POLICY "pools_insert_policy" ON public.pools
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pools_update_policy" ON public.pools
  FOR UPDATE USING (auth.uid() = user_id);

-- 超管或本人可删除
CREATE POLICY "pools_delete_policy" ON public.pools
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

COMMENT ON TABLE public.pools IS '卡池表';

-- ==================== 1.3 抽卡记录表 ====================
CREATE TABLE IF NOT EXISTS public.history (
  id SERIAL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  record_id TEXT NOT NULL,
  pool_id TEXT NOT NULL,
  rarity INTEGER NOT NULL CHECK (rarity BETWEEN 3 AND 6),
  is_standard BOOLEAN DEFAULT FALSE,
  special_type TEXT CHECK (special_type IS NULL OR special_type IN ('gift', 'guaranteed')),
  item_name TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, record_id)
);

CREATE INDEX IF NOT EXISTS idx_history_user_id ON public.history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_pool_id ON public.history(pool_id);
CREATE INDEX IF NOT EXISTS idx_history_rarity ON public.history(rarity);
CREATE INDEX IF NOT EXISTS idx_history_timestamp ON public.history(timestamp);

ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;

-- 所有人可读取
CREATE POLICY "history_select_policy" ON public.history
  FOR SELECT USING (true);

-- 用户可管理自己的记录
CREATE POLICY "history_insert_policy" ON public.history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "history_update_policy" ON public.history
  FOR UPDATE USING (auth.uid() = user_id);

-- 超管或本人可删除
CREATE POLICY "history_delete_policy" ON public.history
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

COMMENT ON TABLE public.history IS '抽卡历史记录表';

-- ==================== 1.4 管理员申请表 ====================
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

CREATE INDEX IF NOT EXISTS idx_admin_applications_user_id ON public.admin_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_applications_status ON public.admin_applications(status);

ALTER TABLE public.admin_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_applications_select_own" ON public.admin_applications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admin_applications_select_super" ON public.admin_applications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "admin_applications_insert_policy" ON public.admin_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admin_applications_update_super" ON public.admin_applications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "admin_applications_delete_super" ON public.admin_applications
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

COMMENT ON TABLE public.admin_applications IS '管理员申请表';

-- ============================================
-- 第二部分：功能表
-- ============================================

-- ==================== 2.1 公告表 ====================
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_select_active" ON public.announcements
  FOR SELECT USING (is_active = true);

CREATE POLICY "announcements_admin_all" ON public.announcements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

COMMENT ON TABLE public.announcements IS '系统公告表';

-- ==================== 2.2 工单表 ====================
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_role TEXT NOT NULL CHECK (target_role IN ('admin', 'super_admin')),
  type TEXT NOT NULL DEFAULT 'question' CHECK (type IN ('bug', 'feature', 'question', 'data_issue', 'other')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'resolved', 'rejected', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON public.tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at DESC);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_select_own" ON public.tickets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "tickets_select_admin" ON public.tickets
  FOR SELECT USING (
    target_role = 'admin' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "tickets_select_super" ON public.tickets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "tickets_insert" ON public.tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tickets_update_own" ON public.tickets
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "tickets_update_admin" ON public.tickets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "tickets_delete_own" ON public.tickets
  FOR DELETE USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "tickets_delete_super" ON public.tickets
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

COMMENT ON TABLE public.tickets IS '工单表';

-- ==================== 2.3 工单回复表 ====================
CREATE TABLE IF NOT EXISTS public.ticket_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket_id ON public.ticket_replies(ticket_id);

ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_replies_select" ON public.ticket_replies
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tickets WHERE id = ticket_id AND user_id = auth.uid()) AND NOT is_internal
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "ticket_replies_insert" ON public.ticket_replies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.ticket_replies IS '工单回复表';

-- ==================== 2.4 黑名单表 ====================
CREATE TABLE IF NOT EXISTS public.email_blacklist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'email' CHECK (type IN ('email', 'domain')),
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_blacklist_email ON public.email_blacklist(email);

ALTER TABLE public.email_blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_blacklist_super_only" ON public.email_blacklist
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

COMMENT ON TABLE public.email_blacklist IS '邮箱黑名单表';

-- ==================== 2.5 邮箱白名单表 ====================
CREATE TABLE IF NOT EXISTS public.email_whitelist (
  id SERIAL PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('mainstream', 'community', 'corporate')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.email_whitelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_whitelist_select_all" ON public.email_whitelist
  FOR SELECT USING (true);

CREATE POLICY "email_whitelist_admin_manage" ON public.email_whitelist
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

COMMENT ON TABLE public.email_whitelist IS '邮箱域名白名单表';

-- 插入默认白名单
INSERT INTO public.email_whitelist (domain, type) VALUES
  ('gmail.com', 'mainstream'), ('outlook.com', 'mainstream'), ('hotmail.com', 'mainstream'),
  ('qq.com', 'mainstream'), ('163.com', 'mainstream'), ('126.com', 'mainstream'),
  ('icloud.com', 'mainstream'), ('yahoo.com', 'mainstream'), ('protonmail.com', 'mainstream'),
  ('foxmail.com', 'mainstream'), ('sina.com', 'mainstream'), ('aliyun.com', 'mainstream'),
  ('linux.do', 'community'), ('github.com', 'community'),
  ('hypergryph.com', 'corporate'), ('mihoyo.com', 'corporate')
ON CONFLICT (domain) DO NOTHING;

-- ==================== 2.6 频率限制表 ====================
CREATE TABLE IF NOT EXISTS public.rate_limit_logs (
  id SERIAL PRIMARY KEY,
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_lookup 
  ON public.rate_limit_logs (identifier, action, created_at DESC);

ALTER TABLE public.rate_limit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limit_logs_no_direct_access" ON public.rate_limit_logs
  FOR ALL USING (false);

CREATE TABLE IF NOT EXISTS public.rate_limit_config (
  action TEXT PRIMARY KEY,
  max_attempts INT NOT NULL,
  window_minutes INT NOT NULL,
  lockout_minutes INT DEFAULT 30
);

ALTER TABLE public.rate_limit_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limit_config_select_all" ON public.rate_limit_config
  FOR SELECT USING (true);

CREATE POLICY "rate_limit_config_admin_manage" ON public.rate_limit_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 插入默认配置
INSERT INTO public.rate_limit_config (action, max_attempts, window_minutes, lockout_minutes) VALUES
  ('login', 5, 15, 30),
  ('register', 3, 60, 60),
  ('password_reset', 3, 60, 60),
  ('email_verify', 3, 60, 60)
ON CONFLICT (action) DO NOTHING;

COMMENT ON TABLE public.rate_limit_logs IS '频率限制日志表';
COMMENT ON TABLE public.rate_limit_config IS '频率限制配置表';

-- ============================================
-- 第三部分：函数
-- ============================================

-- ==================== 3.1 用户注册触发器 ====================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)), 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==================== 3.2 updated_at 触发器 ====================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

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

DROP TRIGGER IF EXISTS update_tickets_updated_at ON public.tickets;
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================== 3.3 邮箱验证函数 ====================
CREATE OR REPLACE FUNCTION public.validate_email_domain(check_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_domain TEXT;
  is_valid BOOLEAN := FALSE;
BEGIN
  IF check_email IS NULL OR check_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('valid', false, 'reason', '邮箱格式不正确');
  END IF;
  
  email_domain := LOWER(SPLIT_PART(check_email, '@', 2));
  
  IF EXISTS (SELECT 1 FROM public.email_blacklist WHERE 
    (type = 'email' AND LOWER(email) = LOWER(check_email)) OR
    (type = 'domain' AND LOWER(email) = email_domain)
  ) THEN
    RETURN jsonb_build_object('valid', false, 'reason', '该邮箱已被禁止注册');
  END IF;
  
  IF EXISTS (SELECT 1 FROM public.email_whitelist WHERE domain = email_domain) THEN
    is_valid := TRUE;
  END IF;
  
  IF is_valid THEN
    RETURN jsonb_build_object('valid', true);
  ELSE
    RETURN jsonb_build_object('valid', false, 'reason', '请使用主流邮箱服务商注册');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_email_blacklisted(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_domain TEXT;
BEGIN
  IF check_email IS NULL THEN RETURN FALSE; END IF;
  email_domain := LOWER(SPLIT_PART(check_email, '@', 2));
  RETURN EXISTS (
    SELECT 1 FROM public.email_blacklist 
    WHERE (type = 'email' AND LOWER(email) = LOWER(check_email))
       OR (type = 'domain' AND LOWER(email) = email_domain)
  );
END;
$$;

-- ==================== 3.4 频率限制函数 ====================
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_identifier TEXT, p_action TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config_row public.rate_limit_config%ROWTYPE;
  attempt_count INT;
  oldest_attempt TIMESTAMPTZ;
  lockout_until TIMESTAMPTZ;
BEGIN
  SELECT * INTO config_row FROM public.rate_limit_config WHERE action = p_action;
  IF config_row IS NULL THEN RETURN jsonb_build_object('allowed', true); END IF;
  
  SELECT COUNT(*), MIN(created_at) INTO attempt_count, oldest_attempt
  FROM public.rate_limit_logs
  WHERE identifier = p_identifier AND action = p_action
    AND created_at > NOW() - (config_row.window_minutes || ' minutes')::INTERVAL;
  
  IF attempt_count >= config_row.max_attempts THEN
    lockout_until := oldest_attempt + (config_row.window_minutes + config_row.lockout_minutes || ' minutes')::INTERVAL;
    IF lockout_until > NOW() THEN
      RETURN jsonb_build_object('allowed', false, 'reason', '操作过于频繁', 
        'retry_after', EXTRACT(EPOCH FROM (lockout_until - NOW()))::INT);
    END IF;
  END IF;
  
  RETURN jsonb_build_object('allowed', true, 'remaining', config_row.max_attempts - attempt_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.log_rate_limit(p_identifier TEXT, p_action TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rate_limit_logs (identifier, action) VALUES (p_identifier, p_action);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_and_log_rate_limit(p_identifier TEXT, p_action TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  check_result JSONB;
BEGIN
  check_result := public.check_rate_limit(p_identifier, p_action);
  IF (check_result->>'allowed')::BOOLEAN THEN
    PERFORM public.log_rate_limit(p_identifier, p_action);
  END IF;
  RETURN check_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limit_logs WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- ==================== 3.5 权限检查函数 ====================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin');
END;
$$;

-- ==================== 3.6 全服统计函数 ====================
CREATE OR REPLACE FUNCTION public.get_global_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  avg_pity NUMERIC;
BEGIN
  WITH ordered_pulls AS (
    SELECT pool_id, user_id, rarity,
      ROW_NUMBER() OVER (PARTITION BY pool_id, user_id ORDER BY record_id) as rn
    FROM public.history WHERE special_type IS DISTINCT FROM 'gift'
  ),
  six_stars_pity AS (
    SELECT rn - COALESCE(LAG(rn, 1) OVER (PARTITION BY pool_id, user_id ORDER BY rn), 0) as pity
    FROM ordered_pulls WHERE rarity = 6
  )
  SELECT COALESCE(AVG(pity), 0) INTO avg_pity FROM six_stars_pity;

  SELECT json_build_object(
    'totalPulls', COALESCE((SELECT COUNT(*) FROM public.history WHERE special_type IS DISTINCT FROM 'gift'), 0),
    'totalUsers', COALESCE((SELECT COUNT(*) FROM public.profiles), 0),
    'sixStarTotal', COALESCE((SELECT COUNT(*) FROM public.history WHERE rarity = 6), 0),
    'avgPity', ROUND(avg_pity, 1)
  ) INTO result;

  RETURN result;
END;
$$;

-- ==================== 3.7 工单统计函数 ====================
CREATE OR REPLACE FUNCTION public.get_ticket_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')) THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  SELECT json_build_object(
    'total', COALESCE((SELECT COUNT(*) FROM public.tickets), 0),
    'pending', COALESCE((SELECT COUNT(*) FROM public.tickets WHERE status = 'pending'), 0),
    'processing', COALESCE((SELECT COUNT(*) FROM public.tickets WHERE status = 'processing'), 0),
    'resolved', COALESCE((SELECT COUNT(*) FROM public.tickets WHERE status = 'resolved'), 0)
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================
-- 第四部分：授权
-- ============================================

GRANT EXECUTE ON FUNCTION public.validate_email_domain(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_email_blacklisted(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_rate_limit(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_log_rate_limit(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_global_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ticket_stats() TO authenticated;

-- ============================================
-- 完成！
-- ============================================

