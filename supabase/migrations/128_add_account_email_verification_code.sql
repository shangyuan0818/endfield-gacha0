-- 128: add short-lived account email verification code support.
--
-- Users can still use the email link, but Settings now also accepts a
-- short numeric code so verification can complete in the original browser tab.

ALTER TABLE public.account_security_states
  ADD COLUMN IF NOT EXISTS email_verification_code_hash TEXT,
  ADD COLUMN IF NOT EXISTS email_verification_code_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_security_states_email_verification_code_hash
  ON public.account_security_states(email_verification_code_hash)
  WHERE email_verification_code_hash IS NOT NULL;

COMMENT ON COLUMN public.account_security_states.email_verification_code_hash IS
  'SHA-256 hash of user_id plus the latest short email verification code. Raw codes are only sent by mail and are not stored.';

COMMENT ON COLUMN public.account_security_states.email_verification_code_expires_at IS
  'Expiry time for the latest short email verification code.';
