-- ============================================
-- 092: 扩展 pool_id_aliases.source 枚举
-- ============================================
-- 增加 'official_notice' 来源，用于自动化从官方公告解析出的卡池 ID

ALTER TABLE public.pool_id_aliases
  DROP CONSTRAINT IF EXISTS pool_id_aliases_source_check;

ALTER TABLE public.pool_id_aliases
  ADD CONSTRAINT pool_id_aliases_source_check CHECK (
    source IN (
      'internal',
      'official_api',
      'official_notice',
      'legacy_manual',
      'manual_placeholder',
      'import_raw',
      'custom'
    )
  );

COMMENT ON COLUMN public.pool_id_aliases.source IS
  'alias 来源：internal / official_api / official_notice / legacy_manual / manual_placeholder / import_raw / custom';
