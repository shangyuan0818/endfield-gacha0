-- ============================================
-- 076: 自动维护 internal self alias
--
-- 背景:
--   075 迁移只回填了当时已有的主数据。后续无论是谁新增 characters / pools，
--   都必须自动拥有一条 internal self alias，否则 alias 解析层会逐步失真。
--
-- 目标:
--   1. 在 characters / pools 新增或变更主键时，自动回填 internal self alias
--   2. 不依赖前端/后端调用方手工写 alias
-- ============================================

CREATE OR REPLACE FUNCTION public.sync_character_internal_self_alias()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', NEW.id, NEW.id, TRUE, 'Auto-maintained canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_character_internal_self_alias() IS
  '自动维护 character_id_aliases 中的 internal self alias。';

DROP TRIGGER IF EXISTS sync_character_internal_self_alias ON public.characters;
CREATE TRIGGER sync_character_internal_self_alias
  AFTER INSERT OR UPDATE OF id
  ON public.characters
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_character_internal_self_alias();

CREATE OR REPLACE FUNCTION public.sync_pool_internal_self_alias()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('internal', NEW.pool_id, NEW.pool_id, TRUE, 'Auto-maintained canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_pool_internal_self_alias() IS
  '自动维护 pool_id_aliases 中的 internal self alias。';

DROP TRIGGER IF EXISTS sync_pool_internal_self_alias ON public.pools;
CREATE TRIGGER sync_pool_internal_self_alias
  AFTER INSERT OR UPDATE OF pool_id
  ON public.pools
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_pool_internal_self_alias();

INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
SELECT
  'internal',
  c.id,
  c.id,
  TRUE,
  'Auto-backfill canonical self alias'
FROM public.characters AS c
ON CONFLICT (source, alias_id) DO UPDATE
SET
  character_id = EXCLUDED.character_id,
  is_primary = TRUE,
  note = EXCLUDED.note,
  updated_at = NOW();

INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
SELECT
  'internal',
  p.pool_id,
  p.pool_id,
  TRUE,
  'Auto-backfill canonical self alias'
FROM public.pools AS p
ON CONFLICT (source, alias_id) DO UPDATE
SET
  pool_id = EXCLUDED.pool_id,
  is_primary = TRUE,
  note = EXCLUDED.note,
  updated_at = NOW();

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 076: internal self alias auto-maintenance enabled';
END $$;
