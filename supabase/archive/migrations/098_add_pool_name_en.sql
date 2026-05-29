-- 098: pool English name support
-- Purpose:
--   1. Add explicit English pool title storage to public.pools
--   2. Expose name_en through get_app_visible_pools
--   3. Allow admin_upsert_pool_with_aliases to write name_en

ALTER TABLE public.pools
  ADD COLUMN IF NOT EXISTS name_en TEXT;

COMMENT ON COLUMN public.pools.name_en IS
  '卡池英文译名；英文界面优先使用该字段，留空则回退到自动推导。';

DROP FUNCTION IF EXISTS public.get_app_visible_pools();

CREATE OR REPLACE FUNCTION public.get_app_visible_pools()
RETURNS TABLE (
  pool_id TEXT,
  name TEXT,
  name_en TEXT,
  type TEXT,
  locked BOOLEAN,
  is_limited_weapon BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  user_id UUID,
  creator_username TEXT,
  creator_role TEXT,
  up_character TEXT,
  description TEXT,
  banner_url TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  featured_characters TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visible_pools AS (
    SELECT p.*
    FROM public.pools AS p
    WHERE
      p.pool_id IN ('standard', 'beginner')
      OR split_part(p.pool_id, '_', 1) IN ('special', 'weponbox', 'weaponbox')
      OR p.user_id IS NULL
      OR p.user_id = auth.uid()
      OR p.locked = true
      OR EXISTS (
        SELECT 1
        FROM public.profiles AS owner_profile
        WHERE owner_profile.id = p.user_id
          AND owner_profile.role IN ('admin', 'super_admin')
      )
  ),
  ranked_pools AS (
    SELECT
      p.pool_id,
      p.name,
      p.name_en,
      p.type,
      p.locked,
      p.is_limited_weapon,
      p.created_at,
      p.updated_at,
      p.user_id,
      prof.username AS creator_username,
      prof.role AS creator_role,
      p.up_character,
      p.description,
      p.banner_url,
      p.start_time,
      p.end_time,
      p.featured_characters,
      ROW_NUMBER() OVER (
        PARTITION BY p.pool_id
        ORDER BY
          CASE
            WHEN prof.role = 'super_admin' THEN 3
            WHEN prof.role = 'admin' THEN 2
            ELSE 1
          END DESC,
          (
            CASE WHEN NULLIF(BTRIM(COALESCE(p.up_character, '')), '') IS NOT NULL THEN 4 ELSE 0 END +
            CASE WHEN p.start_time IS NOT NULL THEN 2 ELSE 0 END +
            CASE WHEN p.end_time IS NOT NULL THEN 2 ELSE 0 END +
            CASE WHEN COALESCE(array_length(p.featured_characters, 1), 0) > 0 THEN 1 ELSE 0 END +
            CASE WHEN NULLIF(BTRIM(COALESCE(p.banner_url, '')), '') IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN NULLIF(BTRIM(COALESCE(p.description, '')), '') IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN NULLIF(BTRIM(COALESCE(p.name_en, '')), '') IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN p.locked THEN 1 ELSE 0 END
          ) DESC,
          CASE WHEN p.user_id = auth.uid() THEN 1 ELSE 0 END DESC,
          COALESCE(p.start_time, p.updated_at, p.created_at, to_timestamp(0)) DESC,
          COALESCE(p.updated_at, p.created_at, to_timestamp(0)) DESC
      ) AS row_rank
    FROM visible_pools AS p
    LEFT JOIN public.profiles AS prof
      ON prof.id = p.user_id
  )
  SELECT
    pool_id,
    name,
    name_en,
    type,
    locked,
    is_limited_weapon,
    created_at,
    updated_at,
    user_id,
    creator_username,
    creator_role,
    up_character,
    description,
    banner_url,
    start_time,
    end_time,
    featured_characters
  FROM ranked_pools
  WHERE row_rank = 1
  ORDER BY COALESCE(start_time, created_at, updated_at, to_timestamp(0)) DESC, pool_id ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_app_visible_pools() TO anon, authenticated;

COMMENT ON FUNCTION public.get_app_visible_pools() IS
  '返回 app 端可见的卡池集合：公开共享卡池 + 当前用户自有卡池，并在服务端完成 pool_id 级别去重与共享池优先级排序。';

CREATE OR REPLACE FUNCTION public.admin_upsert_pool_with_aliases(
  p_pool_id TEXT,
  p_insert_payload JSONB,
  p_update_payload JSONB DEFAULT '{}'::jsonb,
  p_alias_rows JSONB DEFAULT '[]'::jsonb,
  p_pool_character_rows JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    auth.uid(),
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

GRANT EXECUTE ON FUNCTION public.admin_upsert_pool_with_aliases(TEXT, JSONB, JSONB, JSONB, JSONB) TO authenticated;
