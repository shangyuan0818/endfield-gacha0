-- 黑名单表
-- 用于阻止特定邮箱或域名注册

CREATE TABLE IF NOT EXISTS public.blacklist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,  -- 邮箱地址或域名
  type TEXT NOT NULL DEFAULT 'email' CHECK (type IN ('email', 'domain')),  -- 类型：email=邮箱地址, domain=域名
  reason TEXT,  -- 拉黑原因
  created_by UUID REFERENCES auth.users(id),  -- 操作者
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_blacklist_email ON public.blacklist(email);
CREATE INDEX IF NOT EXISTS idx_blacklist_type ON public.blacklist(type);

-- RLS 策略
ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;

-- 只有超级管理员可以查看和管理黑名单
CREATE POLICY "超管可查看黑名单" ON public.blacklist
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "超管可添加黑名单" ON public.blacklist
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "超管可删除黑名单" ON public.blacklist
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- 创建函数：检查邮箱是否在黑名单中
CREATE OR REPLACE FUNCTION public.is_email_blacklisted(check_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  email_domain TEXT;
BEGIN
  -- 提取域名
  email_domain := split_part(check_email, '@', 2);
  
  -- 检查完整邮箱或域名是否在黑名单中
  RETURN EXISTS (
    SELECT 1 FROM public.blacklist
    WHERE 
      (type = 'email' AND LOWER(email) = LOWER(check_email))
      OR 
      (type = 'domain' AND LOWER(email) = LOWER(email_domain))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授权
GRANT EXECUTE ON FUNCTION public.is_email_blacklisted(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_email_blacklisted(TEXT) TO anon;

COMMENT ON TABLE public.blacklist IS '邮箱/域名黑名单表，用于阻止刷号行为';
COMMENT ON COLUMN public.blacklist.type IS '类型：email=完整邮箱地址, domain=邮箱域名';

