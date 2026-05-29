-- ============================================
-- 085: 恢复 history 的 V2 导入字段与约束
--
-- 背景:
--   公开仓库的标准迁移链曾默认依赖 manual/legacy/042_v2_schema_upgrade.sql
--   提前补充 history 的官网导入字段；但 baseline / 新库起库时不会执行 manual/legacy。
--   结果是 game_uid / seq_id / pity / is_free 等字段在标准链中被后续迁移引用时可能缺失。
--
-- 目标:
--   1. 将 V2 导入链必须的 history 字段收口到标准迁移链
--   2. 补齐索引与唯一约束，和前端 cloudWriteService 的 upsert 口径保持一致
--   3. 兼容已存在旧字段/旧约束的数据库，保持幂等
-- ============================================

ALTER TABLE public.history
  ADD COLUMN IF NOT EXISTS batch_id TEXT,
  ADD COLUMN IF NOT EXISTS seq_id TEXT,
  ADD COLUMN IF NOT EXISTS pity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS game_uid TEXT;

COMMENT ON COLUMN public.history.batch_id IS '批次 ID（十连分组）';
COMMENT ON COLUMN public.history.seq_id IS '官方序列号（去重用）';
COMMENT ON COLUMN public.history.pity IS '当前保底计数';
COMMENT ON COLUMN public.history.is_new IS '是否首次获得';
COMMENT ON COLUMN public.history.is_free IS '是否免费抽取';
COMMENT ON COLUMN public.history.game_uid IS '关联的游戏账号 UID';

CREATE INDEX IF NOT EXISTS idx_history_batch_id ON public.history(batch_id);
CREATE INDEX IF NOT EXISTS idx_history_seq_id ON public.history(seq_id);
CREATE INDEX IF NOT EXISTS idx_history_game_uid ON public.history(game_uid);
CREATE INDEX IF NOT EXISTS idx_history_user_record_id ON public.history(user_id, record_id);

UPDATE public.history
SET game_uid = 'legacy_' || LEFT(user_id::text, 8)
WHERE game_uid IS NULL AND seq_id IS NOT NULL;

UPDATE public.history
SET pity = 0
WHERE pity IS NULL OR pity < 0;

UPDATE public.history
SET pity = 80
WHERE pity > 80;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.history'::regclass
      AND conname = 'history_user_id_game_uid_seq_id_key'
  ) THEN
    ALTER TABLE public.history DROP CONSTRAINT history_user_id_game_uid_seq_id_key;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.history'::regclass
      AND conname = 'history_user_game_seq_unique'
  ) THEN
    ALTER TABLE public.history DROP CONSTRAINT history_user_game_seq_unique;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.history'::regclass
      AND conname = 'history_user_game_pool_seq_unique'
  ) THEN
    ALTER TABLE public.history
      ADD CONSTRAINT history_user_game_pool_seq_unique
      UNIQUE (user_id, game_uid, pool_id, seq_id);
  END IF;
END $$;

ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_pity_check;
ALTER TABLE public.history
  ADD CONSTRAINT history_pity_check
  CHECK (pity >= 0 AND pity <= 80);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'history'
      AND column_name IN ('batch_id', 'seq_id', 'pity', 'is_new', 'is_free', 'game_uid')
    GROUP BY table_name
    HAVING COUNT(*) = 6
  ) THEN
    RAISE EXCEPTION 'Migration 085 failed: history V2 columns are still incomplete';
  END IF;

  RAISE NOTICE '✅ Migration 085: history V2 columns / indexes / constraints are ready';
END $$;
