-- 119: add private auth security audit events.
--
-- AUTH-002 finish:
-- - record server-side risk buckets for login/register/recovery preflight;
-- - keep CAPTCHA verification summaries without raw tokens;
-- - store only hashed requester/email identifiers and redacted metadata.

CREATE TABLE IF NOT EXISTS public.auth_security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL,
  risk_bucket TEXT NOT NULL DEFAULT 'unknown',
  risk_reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  requester_hash TEXT NOT NULL,
  requester_origin_hash TEXT,
  requester_user_agent_hash TEXT,
  email_hash TEXT,
  email_domain_hash TEXT,
  email_redacted TEXT,
  captcha JSONB NOT NULL DEFAULT '{}'::jsonb,
  rate_limit JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_security_events_action_created
  ON public.auth_security_events(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_security_events_outcome_created
  ON public.auth_security_events(outcome, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_security_events_risk_created
  ON public.auth_security_events(risk_bucket, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_security_events_requester
  ON public.auth_security_events(requester_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_security_events_email
  ON public.auth_security_events(email_hash, created_at DESC)
  WHERE email_hash IS NOT NULL;

ALTER TABLE public.auth_security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view auth security events" ON public.auth_security_events;
CREATE POLICY "Super admins can view auth security events"
  ON public.auth_security_events FOR SELECT
  USING (public.is_super_admin());

REVOKE ALL ON public.auth_security_events FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, DELETE ON public.auth_security_events TO service_role;
  END IF;
END $$;

INSERT INTO public.rate_limit_config (action, max_attempts, window_minutes, lockout_minutes) VALUES
  ('account_recovery', 4, 60, 60)
ON CONFLICT (action) DO UPDATE SET
  max_attempts = EXCLUDED.max_attempts,
  window_minutes = EXCLUDED.window_minutes,
  lockout_minutes = EXCLUDED.lockout_minutes;

COMMENT ON TABLE public.auth_security_events IS
  'Private auth security audit log for server-side risk buckets. Stores hashed identifiers and redacted metadata only.';

COMMENT ON COLUMN public.auth_security_events.requester_hash IS
  'HMAC hash of requester IP; never store the raw IP address here.';

COMMENT ON COLUMN public.auth_security_events.email_hash IS
  'HMAC hash of normalized email. Raw email stays out of this audit table.';

COMMENT ON COLUMN public.auth_security_events.captcha IS
  'CAPTCHA verification summary. Must not contain raw CAPTCHA tokens or provider secrets.';

COMMENT ON COLUMN public.auth_security_events.metadata IS
  'Sanitized event metadata. Must not contain passwords, tokens, raw emails, game_uid, user_id, platform IDs, API keys, or raw history ids.';
