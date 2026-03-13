-- ============================================
-- 053: 移除旧的 record_id 唯一约束
--
-- 问题描述：
--   052 添加了新的 (user_id, game_uid, seq_id) 唯一约束，
--   但旧的 (user_id, record_id) 约束仍然存在。
--   当 upsert 使用新约束时，如果数据同时违反旧约束就会报 409 冲突错误。
--
-- 解决方案：
--   删除旧的 history_user_record_id_unique 约束，
--   只保留新的 history_user_game_seq_unique 约束。
--
-- 执行日期: 2026-02-03
-- ============================================

-- 1. 删除旧的唯一约束（如果存在）
DO $$
BEGIN
  -- 删除 history_user_record_id_unique 约束
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'history_user_record_id_unique'
  ) THEN
    ALTER TABLE history
    DROP CONSTRAINT history_user_record_id_unique;

    RAISE NOTICE 'Dropped constraint: history_user_record_id_unique';
  ELSE
    RAISE NOTICE 'Constraint history_user_record_id_unique does not exist, skipping';
  END IF;

  -- 同时检查并删除可能存在的其他旧约束名称变体
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'history_user_id_record_id_key'
  ) THEN
    ALTER TABLE history
    DROP CONSTRAINT history_user_id_record_id_key;

    RAISE NOTICE 'Dropped constraint: history_user_id_record_id_key';
  END IF;
END $$;

-- 2. 确保新约束存在
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'history_user_game_seq_unique'
  ) THEN
    ALTER TABLE history
    ADD CONSTRAINT history_user_game_seq_unique
    UNIQUE (user_id, game_uid, seq_id);

    RAISE NOTICE 'Added unique constraint: history_user_game_seq_unique';
  ELSE
    RAISE NOTICE 'Constraint history_user_game_seq_unique already exists';
  END IF;
END $$;

-- 3. 保留 record_id 的普通索引（用于查询性能，但不是唯一约束）
CREATE INDEX IF NOT EXISTS idx_history_user_record_id
ON history(user_id, record_id);

-- 4. 输出当前约束状态
DO $$
DECLARE
  constraint_count INT;
BEGIN
  SELECT COUNT(*) INTO constraint_count
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'history' AND c.contype = 'u';

  RAISE NOTICE '======================================';
  RAISE NOTICE 'Migration 053 完成';
  RAISE NOTICE 'history 表当前唯一约束数量: %', constraint_count;
  RAISE NOTICE '======================================';
END $$;
