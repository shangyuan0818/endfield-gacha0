-- ============================================
-- 019: 启用 RLS 安全修复
-- 修复 Supabase Linter 检测到的安全问题
-- ============================================

-- ============================================
-- 1. email_whitelist 表 RLS
-- ============================================
ALTER TABLE public.email_whitelist ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "email_whitelist_select_all" ON public.email_whitelist;
DROP POLICY IF EXISTS "email_whitelist_admin_insert" ON public.email_whitelist;
DROP POLICY IF EXISTS "email_whitelist_admin_update" ON public.email_whitelist;
DROP POLICY IF EXISTS "email_whitelist_admin_delete" ON public.email_whitelist;

-- 策略：所有人可以读取（用于 validate_email_domain RPC 函数）
CREATE POLICY "email_whitelist_select_all" ON public.email_whitelist
  FOR SELECT USING (true);

-- 策略：只有超级管理员可以增删改
CREATE POLICY "email_whitelist_admin_insert" ON public.email_whitelist
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "email_whitelist_admin_update" ON public.email_whitelist
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "email_whitelist_admin_delete" ON public.email_whitelist
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ============================================
-- 2. rate_limit_logs 表 RLS
-- ============================================
ALTER TABLE public.rate_limit_logs ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "rate_limit_logs_no_direct_access" ON public.rate_limit_logs;

-- 策略：不允许直接访问（通过 SECURITY DEFINER 函数访问）
-- 这样用户无法直接查询或操作日志，只能通过 RPC 函数
CREATE POLICY "rate_limit_logs_no_direct_access" ON public.rate_limit_logs
  FOR ALL USING (false);

-- 注意：SECURITY DEFINER 函数会以函数创建者的权限执行，
-- 绕过 RLS 策略，所以 RPC 函数仍然可以正常工作

-- ============================================
-- 3. rate_limit_config 表 RLS
-- ============================================
ALTER TABLE public.rate_limit_config ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "rate_limit_config_select_all" ON public.rate_limit_config;
DROP POLICY IF EXISTS "rate_limit_config_admin_insert" ON public.rate_limit_config;
DROP POLICY IF EXISTS "rate_limit_config_admin_update" ON public.rate_limit_config;
DROP POLICY IF EXISTS "rate_limit_config_admin_delete" ON public.rate_limit_config;

-- 策略：所有人可以读取配置（用于 check_rate_limit RPC 函数）
CREATE POLICY "rate_limit_config_select_all" ON public.rate_limit_config
  FOR SELECT USING (true);

-- 策略：只有超级管理员可以修改配置
CREATE POLICY "rate_limit_config_admin_insert" ON public.rate_limit_config
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "rate_limit_config_admin_update" ON public.rate_limit_config
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "rate_limit_config_admin_delete" ON public.rate_limit_config
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ============================================
-- 注释
-- ============================================
COMMENT ON POLICY "email_whitelist_select_all" ON public.email_whitelist 
  IS '允许所有用户读取邮箱白名单，用于注册验证';

COMMENT ON POLICY "rate_limit_logs_no_direct_access" ON public.rate_limit_logs 
  IS '禁止直接访问频率限制日志，只能通过 SECURITY DEFINER 函数访问';

COMMENT ON POLICY "rate_limit_config_select_all" ON public.rate_limit_config 
  IS '允许所有用户读取频率限制配置';

