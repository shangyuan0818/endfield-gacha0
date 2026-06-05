-- 137: restore history.character_id for official import reconciliation.
--
-- Migration 096 retired history.character_id as a compatibility field after
-- alias-backed references were cleaned up. DATA-NEW-018 now needs this column
-- again as a forward field: official imports can carry stable character/weapon
-- ids directly, and keeping them on history prevents future placeholder drift.
--
-- Do not restore legacy_pool_id. That field remains retired.

ALTER TABLE public.history
  ADD COLUMN IF NOT EXISTS character_id TEXT;

ALTER TABLE public.history
  ALTER COLUMN character_id TYPE TEXT;

CREATE INDEX IF NOT EXISTS idx_history_character_id
  ON public.history(character_id);

COMMENT ON COLUMN public.history.character_id IS
  '官方导入记录携带的角色或武器 ID；用于角色/武器图鉴、手动占位合并与后续官方 ID 回填。';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'history'
      AND column_name = 'character_id'
  ) THEN
    RAISE EXCEPTION 'Migration 137 failed: history.character_id is missing';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
