-- 117: add provider-independent account recovery state metadata.
--
-- AUTH-003 first slice:
-- - keep signed-out recovery responses generic;
-- - record manual fallback / future mail-outbox state on recovery requests;
-- - persist temporary-password expiry and force-change metadata;
-- - expose private password-change-required state for Settings UI.

ALTER TABLE public.account_recovery_requests
  ADD COLUMN IF NOT EXISTS delivery_channel TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS next_step TEXT NOT NULL DEFAULT 'manual_review_pending',
  ADD COLUMN IF NOT EXISTS mail_outbox_id UUID REFERENCES public.mail_outbox(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS temporary_password_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS temporary_password_force_change BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS temporary_password_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS temporary_password_set_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recovery_audit JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_recovery_requests_delivery_channel_check'
      AND conrelid = 'public.account_recovery_requests'::regclass
  ) THEN
    ALTER TABLE public.account_recovery_requests
      ADD CONSTRAINT account_recovery_requests_delivery_channel_check
      CHECK (delivery_channel IN ('manual', 'mail_outbox', 'disabled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_recovery_requests_next_step_check'
      AND conrelid = 'public.account_recovery_requests'::regclass
  ) THEN
    ALTER TABLE public.account_recovery_requests
      ADD CONSTRAINT account_recovery_requests_next_step_check
      CHECK (next_step IN (
        'manual_review_pending',
        'temporary_password_issued_force_change',
        'mail_reset_queued',
        'mail_reset_sent',
        'mail_reset_failed'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_account_recovery_requests_next_step
  ON public.account_recovery_requests(next_step, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_recovery_requests_temp_password_expires
  ON public.account_recovery_requests(temporary_password_expires_at)
  WHERE temporary_password_force_change IS TRUE;

CREATE TABLE IF NOT EXISTS public.account_security_states (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  password_change_required BOOLEAN NOT NULL DEFAULT FALSE,
  password_change_reason TEXT,
  password_change_source TEXT,
  password_change_requested_at TIMESTAMPTZ,
  password_change_expires_at TIMESTAMPTZ,
  password_change_recovery_request_id UUID REFERENCES public.account_recovery_requests(id) ON DELETE SET NULL,
  password_change_set_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_security_states_required
  ON public.account_security_states(password_change_required, password_change_expires_at)
  WHERE password_change_required IS TRUE;

ALTER TABLE public.account_security_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own account security state" ON public.account_security_states;
CREATE POLICY "Users can view own account security state"
  ON public.account_security_states FOR SELECT
  USING (auth.uid() = user_id);

GRANT SELECT ON public.account_security_states TO authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_security_states TO service_role;
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_account_security_states_updated_at ON public.account_security_states;
CREATE TRIGGER update_account_security_states_updated_at
  BEFORE UPDATE ON public.account_security_states
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON COLUMN public.account_recovery_requests.delivery_channel IS
  'Provider-independent recovery delivery path: manual, mail_outbox, or disabled. No raw temporary password is stored.';

COMMENT ON COLUMN public.account_recovery_requests.next_step IS
  'Current applicant-facing next step, kept generic for signed-out users and detailed for super-admin review.';

COMMENT ON COLUMN public.account_recovery_requests.mail_outbox_id IS
  'Future mail_outbox link for self-service reset delivery. Nullable while provider decisions are pending.';

COMMENT ON COLUMN public.account_recovery_requests.recovery_audit IS
  'Redacted structured recovery events. Must not contain plaintext passwords, tokens, raw emails, game_uid, user_id for public output, or secrets.';

COMMENT ON TABLE public.account_security_states IS
  'Private per-user account security state. Unlike profiles, this table is not public-readable.';

COMMENT ON COLUMN public.account_security_states.password_change_required IS
  'True when the user signed in with a temporary/admin-issued password and must change it from Settings.';

COMMENT ON COLUMN public.account_security_states.password_change_recovery_request_id IS
  'Account recovery request that caused the current force-change state, if any.';
