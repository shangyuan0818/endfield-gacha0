-- ============================================
-- 052: 修复 B服/官服 record_id 冲突问题
--
-- 问题描述：
--   官服和 B服 的 seqId 是各自独立递增的，但 record_id 计算时
--   没有区分 game_uid，导致相同 seqId 产生相同 record_id，
--   触发 upsert 覆盖而非插入，造成 B服增量数据丢失。
--
-- 解决方案：
--   1. 添加 (user_id, game_uid, seq_id) 唯一约束
--   2. 前端 upsert 改用新约束
--   3. 现有数据无需重新导入
--
-- 执行日期: 2026-02-03
-- ============================================

-- 0. 补齐 V2 历史导入链依赖的字段（旧库可能从未执行过 manual/legacy/042）
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

-- 1~6. 仅在 seq_id / game_uid 已存在时执行去重和约束修复
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'seq_id'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'game_uid'
  ) THEN
    -- 1. 为没有 game_uid 的历史记录补充默认值（避免唯一约束冲突）
    UPDATE public.history
    SET game_uid = 'legacy_' || LEFT(user_id::text, 8)
    WHERE game_uid IS NULL AND seq_id IS NOT NULL;

    -- 2. 清理可能存在的重复数据（保留 id 更大的，即更新的记录）
    DELETE FROM public.history
    WHERE id IN (
      SELECT id
      FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY user_id, game_uid, seq_id
          ORDER BY updated_at DESC NULLS LAST, id DESC
        ) AS rn
        FROM public.history
        WHERE seq_id IS NOT NULL AND game_uid IS NOT NULL
      ) duplicates
      WHERE duplicates.rn > 1
    );

    -- 3. 添加新的唯一约束（基于 user_id + game_uid + seq_id）
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'history_user_game_seq_unique'
    ) THEN
      ALTER TABLE public.history
      ADD CONSTRAINT history_user_game_seq_unique
      UNIQUE (user_id, game_uid, seq_id);

      RAISE NOTICE 'Added unique constraint: history_user_game_seq_unique';
    ELSE
      RAISE NOTICE 'Constraint history_user_game_seq_unique already exists';
    END IF;
  ELSE
    RAISE NOTICE 'Migration 052 skipped data cleanup because history.game_uid / history.seq_id are unavailable';
  END IF;
END $$;

-- 4. 创建复合索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_history_user_game_seq
ON public.history(user_id, game_uid, seq_id);

-- 5. 添加约束说明注释
COMMENT ON CONSTRAINT history_user_game_seq_unique ON public.history IS
'确保同一用户、同一游戏账号（官服/B服）、同一 seq_id 不重复';

-- 6. 输出修复统计信息
DO $$
DECLARE
  legacy_count INT;
  total_records INT;
  unique_game_uids INT;
BEGIN
  SELECT COUNT(*) INTO legacy_count FROM history WHERE game_uid LIKE 'legacy_%';
  SELECT COUNT(*) INTO total_records FROM history;
  SELECT COUNT(DISTINCT game_uid) INTO unique_game_uids FROM history WHERE game_uid IS NOT NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 052 完成';
  RAISE NOTICE '总记录数: %', total_records;
  RAISE NOTICE '补充默认 game_uid 的记录数: %', legacy_count;
  RAISE NOTICE '不同 game_uid 数量: %', unique_game_uids;
  RAISE NOTICE '========================================';
END $$;
