-- 102: add private platform bindings and developer API client infrastructure
--
-- Goals:
--   1. Keep profiles/public_profiles focused on public site identity
--   2. Add private binding tables for Discord / Telegram / QQ
--   3. Add developer API client + key model for approved integrations
--   4. Seed official bot clients without exposing private identifiers publicly

-- ---------- user_platform_bindings ----------

CREATE TABLE IF NOT EXISTS public.user_platform_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('discord', 'telegram', 'qq')),
  platform_user_id TEXT,
  display_handle TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'revoked')),
  verified_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_platform_bindings_provider_platform_verified
  ON public.user_platform_bindings(provider, platform_user_id)
  WHERE platform_user_id IS NOT NULL AND status = 'verified';

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_platform_bindings_user_provider_active
  ON public.user_platform_bindings(user_id, provider)
  WHERE status <> 'revoked';

CREATE INDEX IF NOT EXISTS idx_user_platform_bindings_user_provider
  ON public.user_platform_bindings(user_id, provider);

ALTER TABLE public.user_platform_bindings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_platform_bindings_select_own_or_super" ON public.user_platform_bindings;
CREATE POLICY "user_platform_bindings_select_own_or_super" ON public.user_platform_bindings
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "user_platform_bindings_manage_super" ON public.user_platform_bindings;
CREATE POLICY "user_platform_bindings_manage_super" ON public.user_platform_bindings
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP TRIGGER IF EXISTS update_user_platform_bindings_updated_at ON public.user_platform_bindings;
CREATE TRIGGER update_user_platform_bindings_updated_at
  BEFORE UPDATE ON public.user_platform_bindings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.user_platform_bindings IS
  '用户私密平台绑定关系，仅供本人、超管与受控后端接口读取。';

COMMENT ON COLUMN public.user_platform_bindings.platform_user_id IS
  '平台侧用户标识；不进入 public_profiles 或公开 API。';

-- ---------- platform_binding_challenges ----------

CREATE TABLE IF NOT EXISTS public.platform_binding_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  binding_id UUID REFERENCES public.user_platform_bindings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('discord', 'telegram', 'qq')),
  challenge_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'consumed', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  verified_platform_user_id TEXT,
  verified_display_handle TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_binding_challenges_code
  ON public.platform_binding_challenges(challenge_code);

CREATE INDEX IF NOT EXISTS idx_platform_binding_challenges_user_provider_status
  ON public.platform_binding_challenges(user_id, provider, status, created_at DESC);

ALTER TABLE public.platform_binding_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_binding_challenges_select_own_or_super" ON public.platform_binding_challenges;
CREATE POLICY "platform_binding_challenges_select_own_or_super" ON public.platform_binding_challenges
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "platform_binding_challenges_manage_super" ON public.platform_binding_challenges;
CREATE POLICY "platform_binding_challenges_manage_super" ON public.platform_binding_challenges
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP TRIGGER IF EXISTS update_platform_binding_challenges_updated_at ON public.platform_binding_challenges;
CREATE TRIGGER update_platform_binding_challenges_updated_at
  BEFORE UPDATE ON public.platform_binding_challenges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.platform_binding_challenges IS
  '短期平台绑定验证码挑战，仅供本人查看与受控验证接口消费。';

-- ---------- api_clients ----------

CREATE TABLE IF NOT EXISTS public.api_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_type TEXT NOT NULL CHECK (client_type IN ('developer', 'official_bot')),
  provider TEXT CHECK (provider IN ('discord', 'telegram', 'qq')),
  name TEXT NOT NULL,
  use_case TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'revoked')),
  requested_scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  granted_scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  rate_limit_tier TEXT NOT NULL DEFAULT 'default',
  review_note TEXT,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  verifier_secret_prefix TEXT,
  verifier_secret_hash TEXT,
  verifier_last_used_at TIMESTAMPTZ,
  verifier_rotated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT api_clients_shape_check CHECK (
    (client_type = 'developer' AND owner_user_id IS NOT NULL AND provider IS NULL)
    OR (client_type = 'official_bot' AND provider IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_clients_official_provider
  ON public.api_clients(provider)
  WHERE client_type = 'official_bot';

CREATE INDEX IF NOT EXISTS idx_api_clients_owner_created_at
  ON public.api_clients(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_clients_status_created_at
  ON public.api_clients(status, created_at DESC);

ALTER TABLE public.api_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_clients_manage_super" ON public.api_clients;
CREATE POLICY "api_clients_manage_super" ON public.api_clients
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP TRIGGER IF EXISTS update_api_clients_updated_at ON public.api_clients;
CREATE TRIGGER update_api_clients_updated_at
  BEFORE UPDATE ON public.api_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.api_clients IS
  '开发者接口接入应用与官方 BOT 客户端的审核主表。';

-- ---------- api_client_keys ----------

CREATE TABLE IF NOT EXISTS public.api_client_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.api_clients(id) ON DELETE CASCADE,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  encrypted_secret TEXT,
  secret_revealed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_client_keys_prefix
  ON public.api_client_keys(key_prefix);

CREATE INDEX IF NOT EXISTS idx_api_client_keys_client_created_at
  ON public.api_client_keys(client_id, created_at DESC);

ALTER TABLE public.api_client_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_client_keys_manage_super" ON public.api_client_keys;
CREATE POLICY "api_client_keys_manage_super" ON public.api_client_keys
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

COMMENT ON TABLE public.api_client_keys IS
  'API 客户端密钥，仅保存 hash；encrypted_secret 只用于一次性交付待领取密钥。';

-- ---------- rate limit actions ----------

INSERT INTO public.rate_limit_config (action, max_attempts, window_minutes, lockout_minutes) VALUES
  ('binding_challenge_create', 6, 60, 30),
  ('binding_verify', 20, 60, 30),
  ('dev_api_public', 600, 60, 5),
  ('dev_api_bot_self', 240, 60, 5),
  ('dev_api_application', 10, 60, 15)
ON CONFLICT (action) DO NOTHING;

-- ---------- seed official bot clients ----------

INSERT INTO public.api_clients (
  owner_user_id,
  client_type,
  provider,
  name,
  use_case,
  status,
  requested_scopes,
  granted_scopes,
  rate_limit_tier,
  review_note,
  approved_at
)
VALUES
  (
    NULL,
    'official_bot',
    'discord',
    'Official Discord Bot',
    'Official read-only Discord bot for binding, self summary and public rankings',
    'active',
    '["public.read","bot.self.read"]'::jsonb,
    '["public.read","bot.self.read"]'::jsonb,
    'official_bot',
    'Seeded official bot client',
    NOW()
  ),
  (
    NULL,
    'official_bot',
    'telegram',
    'Official Telegram Bot',
    'Official read-only Telegram bot for binding, self summary and public rankings',
    'active',
    '["public.read","bot.self.read"]'::jsonb,
    '["public.read","bot.self.read"]'::jsonb,
    'official_bot',
    'Seeded official bot client',
    NOW()
  ),
  (
    NULL,
    'official_bot',
    'qq',
    'Official QQ Bot',
    'Official read-only QQ bot for binding, self summary and public rankings',
    'active',
    '["public.read","bot.self.read"]'::jsonb,
    '["public.read","bot.self.read"]'::jsonb,
    'official_bot',
    'Seeded official bot client',
    NOW()
  )
ON CONFLICT (provider) WHERE client_type = 'official_bot' DO NOTHING;
