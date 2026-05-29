-- ============================================
-- 084: 新增账号恢复申请表
--
-- 目标:
--   1. 为“忘记密码/账号恢复”提供匿名申请入口
--   2. 将验证信息（账号个数、UID、昵称）交给超管审核
--   3. 不在未登录状态下直接开放改密，仅记录与处理恢复申请
-- ============================================

CREATE TABLE IF NOT EXISTS public.account_recovery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  matched_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('password_reset', 'delete_account')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'verified', 'rejected', 'closed')),
  claimed_account_count INTEGER NOT NULL DEFAULT 1 CHECK (claimed_account_count BETWEEN 1 AND 20),
  verification_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
  note TEXT,
  admin_note TEXT,
  handled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_recovery_requests_email
  ON public.account_recovery_requests(email);

CREATE INDEX IF NOT EXISTS idx_account_recovery_requests_status
  ON public.account_recovery_requests(status);

CREATE INDEX IF NOT EXISTS idx_account_recovery_requests_created_at
  ON public.account_recovery_requests(created_at DESC);

ALTER TABLE public.account_recovery_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view recovery requests" ON public.account_recovery_requests;
CREATE POLICY "Super admins can view recovery requests"
  ON public.account_recovery_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins can update recovery requests" ON public.account_recovery_requests;
CREATE POLICY "Super admins can update recovery requests"
  ON public.account_recovery_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

GRANT SELECT, UPDATE ON public.account_recovery_requests TO authenticated;

DROP TRIGGER IF EXISTS update_account_recovery_requests_updated_at ON public.account_recovery_requests;
CREATE TRIGGER update_account_recovery_requests_updated_at
  BEFORE UPDATE ON public.account_recovery_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.account_recovery_requests IS
  '匿名账号恢复申请：记录忘记密码或申请注销旧账号时提交的人工核验信息。';

COMMENT ON COLUMN public.account_recovery_requests.request_type IS
  '申请类型：password_reset=申请恢复登录，delete_account=申请注销旧账号。';

COMMENT ON COLUMN public.account_recovery_requests.verification_claims IS
  '申请人提交的身份核验信息，格式如 [{gameUid, nickName}]。';
