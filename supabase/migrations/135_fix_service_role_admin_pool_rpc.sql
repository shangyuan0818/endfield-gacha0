-- 135: fix service-role admin RPC checks and pool ownership.
--
-- Admin routes verify the real caller in the site-session layer, then call
-- Supabase with the service role key. In self-hosted PostgREST, service-role
-- requests expose the role through auth.role() / request.jwt.claims, not through
-- request.jwt.claim.role. This repairs public.is_super_admin() and makes pool
-- upserts accept the verified actor id from the API.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.is_super_admin() TO service_role;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.is_super_admin() IS
  '判断当前请求是否具备超管权限；浏览器用户需要 profiles.role = super_admin，服务端代理请求允许 service_role。';

DROP FUNCTION IF EXISTS public.admin_upsert_pool_with_aliases(TEXT, JSONB, JSONB, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.admin_upsert_pool_with_aliases(TEXT, JSONB, JSONB, JSONB, JSONB, UUID);

CREATE OR REPLACE FUNCTION public.admin_upsert_pool_with_aliases(
  p_pool_id TEXT,
  p_insert_payload JSONB,
  p_update_payload JSONB DEFAULT '{}'::jsonb,
  p_alias_rows JSONB DEFAULT '[]'::jsonb,
  p_pool_character_rows JSONB DEFAULT '[]'::jsonb,
  p_actor_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'only super_admin can manage pools';
  END IF;

  IF COALESCE(BTRIM(p_pool_id), '') = '' THEN
    RAISE EXCEPTION 'p_pool_id is required';
  END IF;

  IF p_insert_payload IS NULL OR jsonb_typeof(p_insert_payload) <> 'object' THEN
    RAISE EXCEPTION 'p_insert_payload must be a JSON object';
  END IF;

  IF p_update_payload IS NULL THEN
    p_update_payload := '{}'::jsonb;
  END IF;

  IF jsonb_typeof(p_update_payload) <> 'object' THEN
    RAISE EXCEPTION 'p_update_payload must be a JSON object';
  END IF;

  IF p_alias_rows IS NULL THEN
    p_alias_rows := '[]'::jsonb;
  END IF;

  IF jsonb_typeof(p_alias_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_alias_rows must be a JSON array';
  END IF;

  IF p_pool_character_rows IS NULL THEN
    p_pool_character_rows := '[]'::jsonb;
  END IF;

  IF jsonb_typeof(p_pool_character_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_pool_character_rows must be a JSON array';
  END IF;

  v_actor_user_id := COALESCE(
    p_actor_user_id,
    CASE
      WHEN COALESCE(BTRIM(p_insert_payload->>'user_id'), '') <> ''
      THEN BTRIM(p_insert_payload->>'user_id')::UUID
      ELSE NULL
    END,
    auth.uid()
  );

  IF v_actor_user_id IS NULL AND auth.role() = 'service_role' THEN
    SELECT id
      INTO v_actor_user_id
      FROM public.profiles
     WHERE role = 'super_admin'
     ORDER BY created_at ASC NULLS LAST, id ASC
     LIMIT 1;
  END IF;

  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'pool owner is required';
  END IF;

  INSERT INTO public.pools (
    user_id,
    pool_id,
    name,
    name_en,
    type,
    locked,
    is_limited_weapon,
    description,
    start_time,
    end_time,
    banner_url,
    featured_characters,
    up_character
  )
  VALUES (
    v_actor_user_id,
    BTRIM(p_pool_id),
    BTRIM(p_insert_payload->>'name'),
    NULLIF(BTRIM(p_insert_payload->>'name_en'), ''),
    COALESCE(NULLIF(BTRIM(p_insert_payload->>'type'), ''), 'limited'),
    COALESCE((p_insert_payload->>'locked')::BOOLEAN, FALSE),
    CASE
      WHEN p_insert_payload ? 'is_limited_weapon'
        AND jsonb_typeof(p_insert_payload->'is_limited_weapon') = 'boolean'
      THEN (p_insert_payload->>'is_limited_weapon')::BOOLEAN
      ELSE NULL
    END,
    NULLIF(BTRIM(p_insert_payload->>'description'), ''),
    NULLIF(BTRIM(p_insert_payload->>'start_time'), '')::TIMESTAMPTZ,
    NULLIF(BTRIM(p_insert_payload->>'end_time'), '')::TIMESTAMPTZ,
    NULLIF(BTRIM(p_insert_payload->>'banner_url'), ''),
    CASE
      WHEN p_insert_payload ? 'featured_characters'
        AND jsonb_typeof(p_insert_payload->'featured_characters') = 'array'
      THEN ARRAY(
        SELECT jsonb_array_elements_text(p_insert_payload->'featured_characters')
      )
      ELSE NULL
    END,
    NULLIF(BTRIM(p_insert_payload->>'up_character'), '')
  )
  ON CONFLICT (pool_id) DO UPDATE
  SET
    name = CASE
      WHEN p_update_payload ? 'name'
      THEN COALESCE(NULLIF(BTRIM(p_update_payload->>'name'), ''), public.pools.name)
      ELSE public.pools.name
    END,
    name_en = CASE
      WHEN p_update_payload ? 'name_en'
      THEN NULLIF(BTRIM(p_update_payload->>'name_en'), '')
      ELSE public.pools.name_en
    END,
    type = CASE
      WHEN p_update_payload ? 'type'
      THEN COALESCE(NULLIF(BTRIM(p_update_payload->>'type'), ''), public.pools.type)
      ELSE public.pools.type
    END,
    locked = CASE
      WHEN p_update_payload ? 'locked'
        AND jsonb_typeof(p_update_payload->'locked') = 'boolean'
      THEN (p_update_payload->>'locked')::BOOLEAN
      ELSE public.pools.locked
    END,
    is_limited_weapon = CASE
      WHEN p_update_payload ? 'is_limited_weapon'
        AND jsonb_typeof(p_update_payload->'is_limited_weapon') = 'boolean'
      THEN (p_update_payload->>'is_limited_weapon')::BOOLEAN
      WHEN p_update_payload ? 'is_limited_weapon'
        AND jsonb_typeof(p_update_payload->'is_limited_weapon') = 'null'
      THEN NULL
      ELSE public.pools.is_limited_weapon
    END,
    description = CASE
      WHEN p_update_payload ? 'description'
      THEN NULLIF(BTRIM(p_update_payload->>'description'), '')
      ELSE public.pools.description
    END,
    start_time = CASE
      WHEN p_update_payload ? 'start_time'
      THEN NULLIF(BTRIM(p_update_payload->>'start_time'), '')::TIMESTAMPTZ
      ELSE public.pools.start_time
    END,
    end_time = CASE
      WHEN p_update_payload ? 'end_time'
      THEN NULLIF(BTRIM(p_update_payload->>'end_time'), '')::TIMESTAMPTZ
      ELSE public.pools.end_time
    END,
    banner_url = CASE
      WHEN p_update_payload ? 'banner_url'
      THEN NULLIF(BTRIM(p_update_payload->>'banner_url'), '')
      ELSE public.pools.banner_url
    END,
    featured_characters = CASE
      WHEN p_update_payload ? 'featured_characters'
        AND jsonb_typeof(p_update_payload->'featured_characters') = 'array'
      THEN ARRAY(
        SELECT jsonb_array_elements_text(p_update_payload->'featured_characters')
      )
      WHEN p_update_payload ? 'featured_characters'
        AND jsonb_typeof(p_update_payload->'featured_characters') = 'null'
      THEN NULL
      ELSE public.pools.featured_characters
    END,
    up_character = CASE
      WHEN p_update_payload ? 'up_character'
      THEN NULLIF(BTRIM(p_update_payload->>'up_character'), '')
      ELSE public.pools.up_character
    END;

  INSERT INTO public.pool_id_aliases (
    source,
    alias_id,
    pool_id,
    is_primary,
    note
  )
  SELECT
    BTRIM(alias_entry.value->>'source'),
    BTRIM(alias_entry.value->>'alias_id'),
    BTRIM(p_pool_id),
    COALESCE((alias_entry.value->>'is_primary')::BOOLEAN, FALSE),
    NULLIF(BTRIM(alias_entry.value->>'note'), '')
  FROM jsonb_array_elements(p_alias_rows) AS alias_entry(value)
  WHERE
    jsonb_typeof(alias_entry.value) = 'object'
    AND COALESCE(BTRIM(alias_entry.value->>'source'), '') <> ''
    AND COALESCE(BTRIM(alias_entry.value->>'alias_id'), '') <> ''
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = EXCLUDED.is_primary,
    note = EXCLUDED.note,
    updated_at = NOW();

  IF jsonb_array_length(p_pool_character_rows) > 0 THEN
    DELETE FROM public.pool_characters
    WHERE pool_id = BTRIM(p_pool_id);

    INSERT INTO public.pool_characters (
      pool_id,
      character_id,
      is_up
    )
    SELECT
      BTRIM(p_pool_id),
      BTRIM(character_entry.value->>'character_id'),
      COALESCE((character_entry.value->>'is_up')::BOOLEAN, FALSE)
    FROM jsonb_array_elements(p_pool_character_rows) AS character_entry(value)
    WHERE
      jsonb_typeof(character_entry.value) = 'object'
      AND COALESCE(BTRIM(character_entry.value->>'character_id'), '') <> ''
    ON CONFLICT (pool_id, character_id) DO UPDATE
    SET is_up = EXCLUDED.is_up;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_pool_with_aliases(TEXT, JSONB, JSONB, JSONB, JSONB, UUID) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.admin_upsert_pool_with_aliases(TEXT, JSONB, JSONB, JSONB, JSONB, UUID) TO service_role;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.admin_upsert_pool_with_aliases(TEXT, JSONB, JSONB, JSONB, JSONB, UUID) IS
  '管理端原子化写入单个卡池、alias 与 pool_characters；服务端代理调用应传入已验证的 actor user id。';

CREATE OR REPLACE FUNCTION public.admin_upsert_pool_with_aliases(
  p_pool_id TEXT,
  p_name TEXT,
  p_type TEXT DEFAULT 'limited',
  p_description TEXT DEFAULT NULL,
  p_start_time TIMESTAMPTZ DEFAULT NULL,
  p_end_time TIMESTAMPTZ DEFAULT NULL,
  p_up_character TEXT DEFAULT NULL,
  p_featured_characters TEXT[] DEFAULT NULL,
  p_banner_url TEXT DEFAULT NULL,
  p_alias_rows JSONB DEFAULT '[]'::jsonb,
  p_pool_character_rows JSONB DEFAULT '[]'::jsonb,
  p_actor_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload JSONB;
BEGIN
  v_payload := jsonb_build_object(
    'name', p_name,
    'type', p_type,
    'description', p_description,
    'start_time', p_start_time,
    'end_time', p_end_time,
    'up_character', p_up_character,
    'featured_characters', p_featured_characters,
    'banner_url', p_banner_url
  );

  PERFORM public.admin_upsert_pool_with_aliases(
    p_pool_id,
    v_payload,
    v_payload,
    p_alias_rows,
    p_pool_character_rows,
    p_actor_user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_pool_with_aliases(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT[], TEXT, JSONB, JSONB, UUID) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.admin_upsert_pool_with_aliases(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT[], TEXT, JSONB, JSONB, UUID) TO service_role;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.admin_upsert_pool_with_aliases(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT[], TEXT, JSONB, JSONB, UUID) IS
  '兼容旧参数形式的卡池写入 RPC；内部委托给 JSON payload 版本。';

DROP FUNCTION IF EXISTS public.__debug_request_context_once();

NOTIFY pgrst, 'reload schema';
