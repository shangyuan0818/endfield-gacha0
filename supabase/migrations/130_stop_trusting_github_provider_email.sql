-- 130: stop treating GitHub provider email as a verified site email.
--
-- GitHub is kept as a login identity only. Site email and site password must be
-- bound inside this application so account recovery and password login have one
-- consistent owner.

UPDATE public.app_auth_identities
SET
  email_hash = NULL,
  email_verified = FALSE,
  metadata_redacted_json = COALESCE(metadata_redacted_json, '{}'::jsonb)
    || jsonb_build_object('providerEmailIgnoredForSiteAuth', TRUE)
WHERE provider = 'github'
  AND disabled_at IS NULL;

UPDATE public.profiles AS profile
SET
  email = NULL,
  updated_at = NOW()
FROM public.app_auth_identities AS identity
JOIN auth.users AS auth_user
  ON auth_user.id = identity.user_id
LEFT JOIN public.account_security_states AS state
  ON state.user_id = identity.user_id
WHERE profile.id = identity.user_id
  AND identity.provider = 'github'
  AND identity.disabled_at IS NULL
  AND profile.role <> 'super_admin'
  AND profile.email IS NOT NULL
  AND (
    state.user_id IS NULL
    OR state.email_verification_verified_at IS NULL
  )
  AND COALESCE(auth_user.raw_user_meta_data, '{}'::jsonb)->>'site_password_set' IS DISTINCT FROM 'true'
  AND COALESCE(auth_user.raw_user_meta_data, '{}'::jsonb)->>'email_bound_from_profile' IS DISTINCT FROM 'true';

INSERT INTO public.account_security_states (
  user_id,
  email_verification_required,
  email_verification_reason,
  email_verification_requested_at,
  password_change_required,
  password_change_reason,
  password_change_source,
  password_change_requested_at,
  created_at,
  updated_at
)
SELECT
  auth_user.id,
  TRUE,
  'oauth_email_setup_required_existing',
  NOW(),
  TRUE,
  'oauth_password_setup_required_existing',
  'oauth',
  NOW(),
  NOW(),
  NOW()
FROM auth.users AS auth_user
JOIN public.app_auth_identities AS identity
  ON identity.user_id = auth_user.id
LEFT JOIN public.profiles AS profile
  ON profile.id = auth_user.id
LEFT JOIN public.account_security_states AS state
  ON state.user_id = auth_user.id
WHERE identity.provider = 'github'
  AND identity.disabled_at IS NULL
  AND COALESCE(profile.role, 'user') <> 'super_admin'
  AND (
    auth_user.email ILIKE 'github.%@oauth.local.invalid'
    OR COALESCE(auth_user.raw_user_meta_data, '{}'::jsonb)->>'synthetic_oauth_email' = 'true'
  )
  AND COALESCE(profile.email, '') = ''
  AND COALESCE(state.email_verification_verified_at, NULL) IS NULL
  AND COALESCE(auth_user.raw_user_meta_data, '{}'::jsonb)->>'site_password_set' IS DISTINCT FROM 'true'
  AND COALESCE(auth_user.raw_user_meta_data, '{}'::jsonb)->>'email_bound_from_profile' IS DISTINCT FROM 'true'
ON CONFLICT (user_id) DO UPDATE SET
  email_verification_required = CASE
    WHEN public.account_security_states.email_verification_verified_at IS NULL THEN TRUE
    ELSE public.account_security_states.email_verification_required
  END,
  email_verification_reason = CASE
    WHEN public.account_security_states.email_verification_verified_at IS NULL THEN 'oauth_email_setup_required_existing'
    ELSE public.account_security_states.email_verification_reason
  END,
  email_verification_requested_at = CASE
    WHEN public.account_security_states.email_verification_verified_at IS NULL THEN COALESCE(
      public.account_security_states.email_verification_requested_at,
      EXCLUDED.email_verification_requested_at
    )
    ELSE public.account_security_states.email_verification_requested_at
  END,
  password_change_required = CASE
    WHEN public.account_security_states.password_change_required IS NOT TRUE THEN TRUE
    ELSE public.account_security_states.password_change_required
  END,
  password_change_reason = CASE
    WHEN public.account_security_states.password_change_required IS NOT TRUE THEN 'oauth_password_setup_required_existing'
    ELSE public.account_security_states.password_change_reason
  END,
  password_change_source = CASE
    WHEN public.account_security_states.password_change_required IS NOT TRUE THEN 'oauth'
    ELSE public.account_security_states.password_change_source
  END,
  password_change_requested_at = CASE
    WHEN public.account_security_states.password_change_required IS NOT TRUE THEN COALESCE(
      public.account_security_states.password_change_requested_at,
      EXCLUDED.password_change_requested_at
    )
    ELSE public.account_security_states.password_change_requested_at
  END,
  updated_at = NOW();
