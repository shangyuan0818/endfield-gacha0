-- ============================================
-- 096: 退役 history.character_id 与 legacy_pool_id 兼容字段
--
-- 背景:
--   canonical id / alias 主链已经落地，公开仓库运行时也已支持
--   history.character_id / history.legacy_pool_id / pools.legacy_pool_id 缺列降级。
--   真实库审计确认 alias-backed / unresolved 引用均为 0。
--
-- 目标:
--   1. 让标准迁移链与真实库现状一致，不再继续携带已退役兼容字段
--   2. 同步清理 legacy_pool_id 索引与历史迁移辅助函数
--   3. 为 baseline 生成提供明确的最终 schema 信号
-- ============================================

DROP INDEX IF EXISTS public.idx_history_character_id;
DROP INDEX IF EXISTS public.idx_pools_legacy_id;
DROP INDEX IF EXISTS public.idx_history_legacy_pool_id;

ALTER TABLE public.history
  DROP COLUMN IF EXISTS character_id,
  DROP COLUMN IF EXISTS legacy_pool_id;

ALTER TABLE public.pools
  DROP COLUMN IF EXISTS legacy_pool_id;

DROP FUNCTION IF EXISTS public.migrate_pool_id(TEXT, TEXT, UUID);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'history'
      AND column_name = 'character_id'
  ) THEN
    RAISE EXCEPTION 'Migration 096 failed: history.character_id is still present';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'history'
      AND column_name = 'legacy_pool_id'
  ) THEN
    RAISE EXCEPTION 'Migration 096 failed: history.legacy_pool_id is still present';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pools'
      AND column_name = 'legacy_pool_id'
  ) THEN
    RAISE EXCEPTION 'Migration 096 failed: pools.legacy_pool_id is still present';
  END IF;

  RAISE NOTICE '✅ Migration 096: retired history.character_id and legacy_pool_id compatibility fields';
END $$;
