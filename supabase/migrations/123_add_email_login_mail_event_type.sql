-- 123: allow email-login transactional mail events.
--
-- AUTH-003 / MAIL-ABUSE-001 finish slice:
-- - keep mail_outbox provider-independent and service-role only;
-- - add email_login to the event_type allowlist used by the queue and budgets;
-- - seed the same low-volume anti-abuse budgets as password_reset.

ALTER TABLE public.mail_outbox
  DROP CONSTRAINT IF EXISTS mail_outbox_event_type_check;

ALTER TABLE public.mail_outbox
  ADD CONSTRAINT mail_outbox_event_type_check
  CHECK (
    event_type IN (
      'register_confirmation',
      'email_login',
      'password_reset',
      'ticket_reply',
      'developer_api_review',
      'admin_alert'
    )
  );

ALTER TABLE public.mail_abuse_budget_config
  DROP CONSTRAINT IF EXISTS mail_abuse_budget_config_event_type_check;

ALTER TABLE public.mail_abuse_budget_config
  ADD CONSTRAINT mail_abuse_budget_config_event_type_check
  CHECK (
    event_type IN (
      '*',
      'register_confirmation',
      'email_login',
      'password_reset',
      'ticket_reply',
      'developer_api_review',
      'admin_alert'
    )
  );

INSERT INTO public.mail_abuse_budget_config (scope, event_type, window_seconds, max_attempts)
VALUES
  ('event', 'email_login', 86400, 100),
  ('recipient', 'email_login', 3600, 3),
  ('domain', 'email_login', 86400, 30),
  ('ip', 'email_login', 3600, 5),
  ('user', 'email_login', 3600, 3)
ON CONFLICT (scope, event_type) DO UPDATE SET
  window_seconds = EXCLUDED.window_seconds,
  max_attempts = EXCLUDED.max_attempts,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

COMMENT ON CONSTRAINT mail_outbox_event_type_check ON public.mail_outbox IS
  'Allowed transactional mail event types, including passwordless email-login links.';

COMMENT ON CONSTRAINT mail_abuse_budget_config_event_type_check ON public.mail_abuse_budget_config IS
  'Allowed mail budget event types, including passwordless email-login links.';
