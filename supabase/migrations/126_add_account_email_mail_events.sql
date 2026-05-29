-- 126: add account email verification/change mail events.
--
-- Settings email actions now use the same transactional mail control surface as
-- registration, password reset, tickets, and developer API review mail.

ALTER TABLE public.mail_outbox
  DROP CONSTRAINT IF EXISTS mail_outbox_event_type_check;

ALTER TABLE public.mail_outbox
  ADD CONSTRAINT mail_outbox_event_type_check
  CHECK (
    event_type IN (
      'register_confirmation',
      'email_login',
      'email_verification',
      'email_change',
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
      'email_verification',
      'email_change',
      'password_reset',
      'ticket_reply',
      'developer_api_review',
      'admin_alert'
    )
  );

INSERT INTO public.mail_abuse_budget_config (scope, event_type, window_seconds, max_attempts)
VALUES
  ('event', 'email_verification', 86400, 120),
  ('recipient', 'email_verification', 3600, 3),
  ('domain', 'email_verification', 86400, 40),
  ('ip', 'email_verification', 3600, 5),
  ('user', 'email_verification', 3600, 3),
  ('event', 'email_change', 86400, 80),
  ('recipient', 'email_change', 3600, 3),
  ('domain', 'email_change', 86400, 30),
  ('ip', 'email_change', 3600, 5),
  ('user', 'email_change', 3600, 3)
ON CONFLICT (scope, event_type) DO UPDATE SET
  window_seconds = EXCLUDED.window_seconds,
  max_attempts = EXCLUDED.max_attempts,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

CREATE OR REPLACE FUNCTION public.sync_profile_email_from_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles
    SET
      email = NEW.email,
      updated_at = NOW()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_email_from_auth_user();

COMMENT ON CONSTRAINT mail_outbox_event_type_check ON public.mail_outbox IS
  'Allowed transactional mail event types, including account email verification and email change.';

COMMENT ON CONSTRAINT mail_abuse_budget_config_event_type_check ON public.mail_abuse_budget_config IS
  'Allowed mail budget event types, including account email verification and email change.';

COMMENT ON FUNCTION public.sync_profile_email_from_auth_user() IS
  'Keeps public.profiles.email aligned after a confirmed auth.users email change.';

ALTER TABLE public.account_security_states
  ADD COLUMN IF NOT EXISTS email_verification_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verification_reason TEXT,
  ADD COLUMN IF NOT EXISTS email_verification_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verification_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS email_verification_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_account_security_states_email_verification_required
  ON public.account_security_states(email_verification_required, email_verification_requested_at)
  WHERE email_verification_required IS TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_security_states_email_verification_token_hash
  ON public.account_security_states(email_verification_token_hash)
  WHERE email_verification_token_hash IS NOT NULL;

INSERT INTO public.account_security_states (
  user_id,
  email_verification_required,
  email_verification_reason,
  email_verification_requested_at,
  created_at,
  updated_at
)
SELECT
  auth_user.id,
  TRUE,
  'mail_verification_rollout_2026_05',
  NOW(),
  NOW(),
  NOW()
FROM auth.users AS auth_user
LEFT JOIN public.profiles AS profile ON profile.id = auth_user.id
WHERE COALESCE(profile.role, 'user') <> 'super_admin'
ON CONFLICT (user_id) DO UPDATE SET
  email_verification_required = CASE
    WHEN public.account_security_states.email_verification_verified_at IS NULL THEN TRUE
    ELSE public.account_security_states.email_verification_required
  END,
  email_verification_reason = CASE
    WHEN public.account_security_states.email_verification_verified_at IS NULL THEN EXCLUDED.email_verification_reason
    ELSE public.account_security_states.email_verification_reason
  END,
  email_verification_requested_at = CASE
    WHEN public.account_security_states.email_verification_verified_at IS NULL THEN COALESCE(
      public.account_security_states.email_verification_requested_at,
      EXCLUDED.email_verification_requested_at
    )
    ELSE public.account_security_states.email_verification_requested_at
  END,
  updated_at = CASE
    WHEN public.account_security_states.email_verification_verified_at IS NULL THEN NOW()
    ELSE public.account_security_states.updated_at
  END;

UPDATE public.account_security_states AS state
SET
  email_verification_required = FALSE,
  email_verification_reason = NULL,
  email_verification_requested_at = NULL,
  email_verification_token_hash = NULL,
  email_verification_token_expires_at = NULL,
  updated_at = NOW()
FROM public.profiles AS profile
WHERE profile.id = state.user_id
  AND profile.role = 'super_admin';

COMMENT ON COLUMN public.account_security_states.email_verification_required IS
  'True when the account must verify its current email address after the mail system rollout. Super admins are excluded.';

COMMENT ON COLUMN public.account_security_states.email_verification_token_hash IS
  'SHA-256 hash of the latest one-time account email verification token. Raw tokens are only sent by mail and are not stored.';
