-- ============================================
-- 077: 原子化同步角色/武器与 alias
--
-- 背景:
--   管理端从 Wiki 同步时，characters 与 character_id_aliases 分两步写入，
--   一旦 alias 写入失败，会留下 canonical 主数据已更新、alias 缺失的半成功状态。
--
-- 目标:
--   1. 提供一个 SECURITY DEFINER RPC，在单个事务中完成角色 upsert + alias upsert
--   2. 仅允许 super_admin 调用
--   3. 角色已存在时只更新同步链路允许覆盖的字段，避免误伤 pool_config / is_limited
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_sync_character_with_aliases(
  p_character_id TEXT,
  p_insert_payload JSONB,
  p_update_payload JSONB DEFAULT '{}'::jsonb,
  p_alias_rows JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'only super_admin can sync characters';
  END IF;

  IF COALESCE(BTRIM(p_character_id), '') = '' THEN
    RAISE EXCEPTION 'p_character_id is required';
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

  INSERT INTO public.characters (
    id,
    name,
    avatar_url,
    rarity,
    type,
    aliases,
    is_limited,
    pool_config
  )
  VALUES (
    BTRIM(p_character_id),
    BTRIM(p_insert_payload->>'name'),
    NULLIF(BTRIM(p_insert_payload->>'avatar_url'), ''),
    NULLIF(BTRIM(p_insert_payload->>'rarity'), '')::INTEGER,
    COALESCE(NULLIF(BTRIM(p_insert_payload->>'type'), ''), 'character'),
    CASE
      WHEN p_insert_payload ? 'aliases'
        AND jsonb_typeof(p_insert_payload->'aliases') = 'array'
      THEN ARRAY(
        SELECT jsonb_array_elements_text(p_insert_payload->'aliases')
      )
      ELSE NULL
    END,
    COALESCE((p_insert_payload->>'is_limited')::BOOLEAN, FALSE),
    CASE
      WHEN p_insert_payload ? 'pool_config'
        AND jsonb_typeof(p_insert_payload->'pool_config') = 'object'
      THEN p_insert_payload->'pool_config'
      ELSE '{}'::jsonb
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = CASE
      WHEN p_update_payload ? 'name'
      THEN COALESCE(NULLIF(BTRIM(p_update_payload->>'name'), ''), public.characters.name)
      ELSE public.characters.name
    END,
    avatar_url = CASE
      WHEN p_update_payload ? 'avatar_url'
      THEN NULLIF(BTRIM(p_update_payload->>'avatar_url'), '')
      ELSE public.characters.avatar_url
    END,
    rarity = CASE
      WHEN p_update_payload ? 'rarity'
      THEN NULLIF(BTRIM(p_update_payload->>'rarity'), '')::INTEGER
      ELSE public.characters.rarity
    END,
    type = CASE
      WHEN p_update_payload ? 'type'
      THEN COALESCE(NULLIF(BTRIM(p_update_payload->>'type'), ''), public.characters.type)
      ELSE public.characters.type
    END;

  INSERT INTO public.character_id_aliases (
    source,
    alias_id,
    character_id,
    is_primary,
    note
  )
  SELECT
    BTRIM(alias_entry.value->>'source'),
    BTRIM(alias_entry.value->>'alias_id'),
    BTRIM(p_character_id),
    COALESCE((alias_entry.value->>'is_primary')::BOOLEAN, FALSE),
    NULLIF(BTRIM(alias_entry.value->>'note'), '')
  FROM jsonb_array_elements(p_alias_rows) AS alias_entry(value)
  WHERE jsonb_typeof(alias_entry.value) = 'object'
    AND COALESCE(BTRIM(alias_entry.value->>'source'), '') <> ''
    AND COALESCE(BTRIM(alias_entry.value->>'alias_id'), '') <> ''
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = EXCLUDED.is_primary,
    note = EXCLUDED.note,
    updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_sync_character_with_aliases(TEXT, JSONB, JSONB, JSONB) TO authenticated;

COMMENT ON FUNCTION public.admin_sync_character_with_aliases(TEXT, JSONB, JSONB, JSONB) IS
  '管理端原子化同步单个角色/武器及其 alias；已存在时仅更新 name/rarity/type/avatar_url。';

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 077: admin_sync_character_with_aliases RPC created';
END $$;
