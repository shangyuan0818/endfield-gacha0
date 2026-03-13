-- ============================================
-- 075: 创建角色 / 卡池 ID alias 映射表
--
-- 背景:
--   现有 characters.id / pools.pool_id 同时承担了“内部主键”和“外部来源 ID”两种职责，
--   导致手工补录 ID、wiki ID、官方导入 ID 之间无法稳定收口。
--
-- 目标:
--   1. 给角色与卡池增加 source_id -> canonical_id 的映射层
--   2. 为后续“统一到官方 ID”的合并脚本提供安全落点
--   3. 先回填当前内部 ID 为 self alias，不在本迁移里直接改主键
-- ============================================

CREATE TABLE IF NOT EXISTS public.character_id_aliases (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL CHECK (
    source IN (
      'internal',
      'wiki',
      'official_api',
      'legacy_manual',
      'manual_placeholder',
      'import_raw',
      'custom'
    )
  ),
  alias_id TEXT NOT NULL,
  character_id TEXT NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT character_id_aliases_source_alias_unique UNIQUE (source, alias_id)
);

CREATE INDEX IF NOT EXISTS idx_character_id_aliases_character_id
  ON public.character_id_aliases(character_id);

CREATE INDEX IF NOT EXISTS idx_character_id_aliases_alias_id
  ON public.character_id_aliases(alias_id);

COMMENT ON TABLE public.character_id_aliases IS
  '角色 ID alias 映射表。把 wiki / 手工 / 导入原始 ID 映射到 canonical characters.id。';
COMMENT ON COLUMN public.character_id_aliases.source IS
  'alias 来源：internal / wiki / official_api / legacy_manual / manual_placeholder / import_raw / custom';
COMMENT ON COLUMN public.character_id_aliases.alias_id IS
  '外部来源或历史系统中的角色 ID';
COMMENT ON COLUMN public.character_id_aliases.character_id IS
  'canonical 角色 ID，关联 public.characters(id)';

ALTER TABLE public.character_id_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "character_id_aliases_select_all" ON public.character_id_aliases;
CREATE POLICY "character_id_aliases_select_all" ON public.character_id_aliases
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "character_id_aliases_manage_super_admin" ON public.character_id_aliases;
CREATE POLICY "character_id_aliases_manage_super_admin" ON public.character_id_aliases
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

DROP TRIGGER IF EXISTS update_character_id_aliases_updated_at ON public.character_id_aliases;
CREATE TRIGGER update_character_id_aliases_updated_at
  BEFORE UPDATE ON public.character_id_aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pool_id_aliases (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL CHECK (
    source IN (
      'internal',
      'official_api',
      'legacy_manual',
      'manual_placeholder',
      'import_raw',
      'custom'
    )
  ),
  alias_id TEXT NOT NULL,
  pool_id TEXT NOT NULL REFERENCES public.pools(pool_id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT pool_id_aliases_source_alias_unique UNIQUE (source, alias_id)
);

CREATE INDEX IF NOT EXISTS idx_pool_id_aliases_pool_id
  ON public.pool_id_aliases(pool_id);

CREATE INDEX IF NOT EXISTS idx_pool_id_aliases_alias_id
  ON public.pool_id_aliases(alias_id);

COMMENT ON TABLE public.pool_id_aliases IS
  '卡池 ID alias 映射表。把历史手工池 / 官方导入池 / 其它来源池 ID 映射到 canonical pools.pool_id。';
COMMENT ON COLUMN public.pool_id_aliases.source IS
  'alias 来源：internal / official_api / legacy_manual / manual_placeholder / import_raw / custom';
COMMENT ON COLUMN public.pool_id_aliases.alias_id IS
  '外部来源或历史系统中的卡池 ID';
COMMENT ON COLUMN public.pool_id_aliases.pool_id IS
  'canonical 卡池 ID，关联 public.pools(pool_id)';

ALTER TABLE public.pool_id_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pool_id_aliases_select_all" ON public.pool_id_aliases;
CREATE POLICY "pool_id_aliases_select_all" ON public.pool_id_aliases
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "pool_id_aliases_manage_super_admin" ON public.pool_id_aliases;
CREATE POLICY "pool_id_aliases_manage_super_admin" ON public.pool_id_aliases
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

DROP TRIGGER IF EXISTS update_pool_id_aliases_updated_at ON public.pool_id_aliases;
CREATE TRIGGER update_pool_id_aliases_updated_at
  BEFORE UPDATE ON public.pool_id_aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
SELECT
  'internal' AS source,
  c.id AS alias_id,
  c.id AS character_id,
  TRUE AS is_primary,
  'Backfill current characters.id as canonical self-alias'
FROM public.characters AS c
ON CONFLICT (source, alias_id) DO UPDATE
SET
  character_id = EXCLUDED.character_id,
  is_primary = TRUE,
  note = EXCLUDED.note,
  updated_at = NOW();

INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
SELECT
  'internal' AS source,
  p.pool_id AS alias_id,
  p.pool_id AS pool_id,
  TRUE AS is_primary,
  'Backfill current pools.pool_id as canonical self-alias'
FROM public.pools AS p
ON CONFLICT (source, alias_id) DO UPDATE
SET
  pool_id = EXCLUDED.pool_id,
  is_primary = TRUE,
  note = EXCLUDED.note,
  updated_at = NOW();

CREATE OR REPLACE FUNCTION public.resolve_character_alias(
  p_alias_id TEXT,
  p_source TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cia.character_id
  FROM public.character_id_aliases AS cia
  WHERE cia.alias_id = p_alias_id
    AND (p_source IS NULL OR cia.source = p_source)
  ORDER BY
    CASE WHEN p_source IS NOT NULL AND cia.source = p_source THEN 0 ELSE 1 END,
    cia.is_primary DESC,
    cia.id ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.resolve_character_alias(TEXT, TEXT) IS
  '通过 alias_id + 可选 source 解析 canonical character_id。';

CREATE OR REPLACE FUNCTION public.resolve_pool_alias(
  p_alias_id TEXT,
  p_source TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pia.pool_id
  FROM public.pool_id_aliases AS pia
  WHERE pia.alias_id = p_alias_id
    AND (p_source IS NULL OR pia.source = p_source)
  ORDER BY
    CASE WHEN p_source IS NOT NULL AND pia.source = p_source THEN 0 ELSE 1 END,
    pia.is_primary DESC,
    pia.id ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.resolve_pool_alias(TEXT, TEXT) IS
  '通过 alias_id + 可选 source 解析 canonical pool_id。';

GRANT EXECUTE ON FUNCTION public.resolve_character_alias(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_pool_alias(TEXT, TEXT) TO anon, authenticated;

DO $$
DECLARE
  character_alias_count BIGINT;
  pool_alias_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO character_alias_count FROM public.character_id_aliases;
  SELECT COUNT(*) INTO pool_alias_count FROM public.pool_id_aliases;

  RAISE NOTICE '✅ Migration 075: alias 映射表创建完成';
  RAISE NOTICE '   character_id_aliases rows: %', character_alias_count;
  RAISE NOTICE '   pool_id_aliases rows: %', pool_alias_count;
END $$;
