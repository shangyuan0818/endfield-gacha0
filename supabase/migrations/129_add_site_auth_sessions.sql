-- 129: add private site-managed auth sessions.
--
-- This keeps auth.users as the stable user id anchor, while allowing the
-- application server to own OAuth callback sessions for providers that do not
-- fit Supabase Auth's built-in provider flow.

CREATE TABLE IF NOT EXISTS public.app_auth_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_subject_hash TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  email_hash TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  raw_profile_hash TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  metadata_redacted_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (provider, provider_subject_hash)
);

CREATE INDEX IF NOT EXISTS idx_app_auth_identities_user_provider
  ON public.app_auth_identities(user_id, provider);

CREATE INDEX IF NOT EXISTS idx_app_auth_identities_last_used
  ON public.app_auth_identities(provider, last_used_at DESC)
  WHERE disabled_at IS NULL;

ALTER TABLE public.app_auth_identities ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.app_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT UNIQUE,
  user_agent_hash TEXT,
  ip_prefix_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  absolute_expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_user_created
  ON public.app_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_sessions_active_expiry
  ON public.app_sessions(expires_at, absolute_expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.app_auth_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  provider TEXT,
  outcome TEXT NOT NULL,
  requester_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_auth_audit_events_user_created
  ON public.app_auth_audit_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_auth_audit_events_type_created
  ON public.app_auth_audit_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_auth_audit_events_provider_created
  ON public.app_auth_audit_events(provider, created_at DESC)
  WHERE provider IS NOT NULL;

ALTER TABLE public.app_auth_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.app_auth_identities FROM anon, authenticated;
REVOKE ALL ON public.app_sessions FROM anon, authenticated;
REVOKE ALL ON public.app_auth_audit_events FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_auth_identities TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_sessions TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_auth_audit_events TO service_role;
  END IF;
END $$;

COMMENT ON TABLE public.app_auth_identities IS
  'Private mapping between site users and external OAuth identities. Stores hashed provider subjects and redacted profile summaries only.';

COMMENT ON TABLE public.app_sessions IS
  'Private site-managed HttpOnly session records. Raw session tokens are only stored in browser cookies; the database stores hashes.';

COMMENT ON TABLE public.app_auth_audit_events IS
  'Private site auth audit events. Metadata must not contain raw provider tokens, passwords, API keys, raw IP addresses, emails, game_uid, or history ids.';

COMMENT ON COLUMN public.app_auth_identities.provider_subject_hash IS
  'HMAC hash of provider plus provider subject. Raw external ids are not stored.';

COMMENT ON COLUMN public.app_sessions.session_token_hash IS
  'HMAC hash of the browser session cookie token. Raw tokens are never stored.';

COMMENT ON COLUMN public.app_sessions.refresh_token_hash IS
  'Reserved HMAC hash for future refresh-token rotation. Raw tokens are never stored.';
