-- 116: add provider-independent mail outbox and anti-abuse controls.
--
-- This migration does not connect to SMTP, Postal, Stalwart, or any other
-- provider. It only creates the private database surface needed for future
-- server-side mail enqueue, budget accounting, suppression, and delivery
-- diagnostics. Browser clients must not write these tables directly.

CREATE TABLE IF NOT EXISTS public.mail_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'register_confirmation',
      'password_reset',
      'ticket_reply',
      'developer_api_review',
      'admin_alert'
    )
  ),
  recipient_email_hash TEXT NOT NULL,
  recipient_domain TEXT NOT NULL,
  template_key TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'zh-CN',
  payload_redacted_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL UNIQUE,
  priority SMALLINT NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 9),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'sending', 'sent', 'failed', 'suppressed', 'cancelled')
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error_code TEXT,
  last_error_redacted_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_key TEXT,
  provider_message_id_hash TEXT,
  guard_decision JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id UUID,
  related_entity_type TEXT,
  related_entity_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mail_outbox_status_next_attempt
  ON public.mail_outbox(status, next_attempt_at, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_mail_outbox_event_created
  ON public.mail_outbox(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mail_outbox_recipient_domain
  ON public.mail_outbox(recipient_domain, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mail_outbox_related_entity
  ON public.mail_outbox(related_entity_type, related_entity_id)
  WHERE related_entity_type IS NOT NULL OR related_entity_id IS NOT NULL;

ALTER TABLE public.mail_outbox ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.mail_suppression (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email_hash TEXT,
  recipient_domain TEXT,
  reason TEXT NOT NULL CHECK (
    reason IN ('hard_bounce', 'complaint', 'invalid_recipient', 'manual', 'domain_pause', 'abuse_budget')
  ),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  source TEXT NOT NULL DEFAULT 'system',
  notes_redacted_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (recipient_email_hash IS NOT NULL OR recipient_domain IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_suppression_active_email
  ON public.mail_suppression(recipient_email_hash)
  WHERE status = 'active' AND recipient_email_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_suppression_active_domain
  ON public.mail_suppression(recipient_domain)
  WHERE status = 'active' AND recipient_domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mail_suppression_status_domain
  ON public.mail_suppression(status, recipient_domain);

ALTER TABLE public.mail_suppression ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.mail_abuse_budget_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('global', 'event', 'recipient', 'domain', 'ip', 'user', 'related')),
  event_type TEXT NOT NULL DEFAULT '*' CHECK (
    event_type IN (
      '*',
      'register_confirmation',
      'password_reset',
      'ticket_reply',
      'developer_api_review',
      'admin_alert'
    )
  ),
  window_seconds INTEGER NOT NULL CHECK (window_seconds > 0),
  max_attempts INTEGER NOT NULL CHECK (max_attempts > 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scope, event_type)
);

ALTER TABLE public.mail_abuse_budget_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.mail_abuse_budget_config (scope, event_type, window_seconds, max_attempts)
VALUES
  ('global', '*', 86400, 500),
  ('event', 'register_confirmation', 86400, 120),
  ('event', 'password_reset', 86400, 100),
  ('event', 'ticket_reply', 86400, 200),
  ('event', 'developer_api_review', 86400, 50),
  ('event', 'admin_alert', 86400, 50),
  ('recipient', 'register_confirmation', 3600, 2),
  ('recipient', 'password_reset', 3600, 3),
  ('recipient', 'ticket_reply', 3600, 10),
  ('recipient', 'developer_api_review', 3600, 5),
  ('recipient', 'admin_alert', 3600, 10),
  ('domain', 'register_confirmation', 86400, 40),
  ('domain', 'password_reset', 86400, 30),
  ('domain', 'ticket_reply', 86400, 80),
  ('domain', 'developer_api_review', 86400, 20),
  ('domain', 'admin_alert', 86400, 20),
  ('ip', 'register_confirmation', 3600, 5),
  ('ip', 'password_reset', 3600, 5),
  ('ip', 'ticket_reply', 3600, 20),
  ('ip', 'developer_api_review', 3600, 10),
  ('ip', 'admin_alert', 3600, 20),
  ('user', 'register_confirmation', 3600, 4),
  ('user', 'password_reset', 3600, 3),
  ('user', 'ticket_reply', 3600, 12),
  ('user', 'developer_api_review', 3600, 6),
  ('user', 'admin_alert', 3600, 20),
  ('related', 'ticket_reply', 3600, 10),
  ('related', 'admin_alert', 3600, 6)
ON CONFLICT (scope, event_type) DO UPDATE SET
  window_seconds = EXCLUDED.window_seconds,
  max_attempts = EXCLUDED.max_attempts,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.mail_abuse_budget_counters (
  bucket_key_hash TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  event_type TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  window_reset_at TIMESTAMPTZ NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  last_idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mail_abuse_budget_counters_reset
  ON public.mail_abuse_budget_counters(window_reset_at);

ALTER TABLE public.mail_abuse_budget_counters ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.mail_delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id UUID REFERENCES public.mail_outbox(id) ON DELETE CASCADE,
  provider_key TEXT,
  provider_message_id_hash TEXT,
  event_type TEXT NOT NULL,
  event_payload_redacted_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mail_delivery_events_outbox
  ON public.mail_delivery_events(outbox_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mail_delivery_events_type_created
  ON public.mail_delivery_events(event_type, created_at DESC);

ALTER TABLE public.mail_delivery_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.mail_outbox FROM anon, authenticated;
REVOKE ALL ON public.mail_suppression FROM anon, authenticated;
REVOKE ALL ON public.mail_abuse_budget_config FROM anon, authenticated;
REVOKE ALL ON public.mail_abuse_budget_counters FROM anon, authenticated;
REVOKE ALL ON public.mail_delivery_events FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_outbox TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_suppression TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_abuse_budget_config TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_abuse_budget_counters TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_delivery_events TO service_role;
  END IF;
END $$;

COMMENT ON TABLE public.mail_outbox IS
  'Private provider-independent transactional mail queue. Stores recipient hashes and redacted payloads only; no raw email, token, password, API key, user_id, game_uid, or raw history id should be stored here.';

COMMENT ON TABLE public.mail_suppression IS
  'Private mail suppression list for hard bounces, complaints, invalid recipients, manual domain pauses, and abuse-budget blocks. Uses hashes or domains; no raw recipient email.';

COMMENT ON TABLE public.mail_abuse_budget_config IS
  'Private configurable mail sending budgets by scope and event type. Service/admin paths may read this before queueing mail.';

COMMENT ON TABLE public.mail_abuse_budget_counters IS
  'Private hashed budget bucket counters used by server-side mail enqueue logic. Bucket keys are HMAC hashes, not raw IP, user id, or email.';

COMMENT ON TABLE public.mail_delivery_events IS
  'Private redacted mail provider delivery diagnostics associated with outbox rows.';
