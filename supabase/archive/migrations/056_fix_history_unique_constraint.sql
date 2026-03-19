-- =====================================================
-- 迁移文件: 056_fix_history_unique_constraint.sql
-- 描述: 修复 history 表的唯一约束，添加 pool_id
-- =====================================================
--
-- 问题原因：
-- seqId 是每个卡池独立的序列号，不同卡池可能有相同的 seqId
-- 例如：限定池 seqId=1 和 常驻池 seqId=1 是不同的记录
--
-- 原约束 (user_id, game_uid, seq_id) 会导致：
-- 1. 去重逻辑误判不同卡池的记录为重复
-- 2. upsert 时覆盖错误的记录
--
-- 修复方案：
-- 将约束改为 (user_id, game_uid, pool_id, seq_id)
--
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'game_uid'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'seq_id'
  ) THEN
    -- 1. 删除旧的唯一约束
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'history_user_id_game_uid_seq_id_key'
      AND conrelid = 'history'::regclass
    ) THEN
      ALTER TABLE history DROP CONSTRAINT history_user_id_game_uid_seq_id_key;
      RAISE NOTICE '✅ 已删除旧约束 history_user_id_game_uid_seq_id_key';
    ELSE
      RAISE NOTICE 'ℹ️ 约束 history_user_id_game_uid_seq_id_key 不存在';
    END IF;

    -- 检查其他可能的命名
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'history_user_game_seq_unique'
      AND conrelid = 'history'::regclass
    ) THEN
      ALTER TABLE history DROP CONSTRAINT history_user_game_seq_unique;
      RAISE NOTICE '✅ 已删除旧约束 history_user_game_seq_unique';
    END IF;

    -- 2. 创建新的唯一约束（包含 pool_id）
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'history_user_game_pool_seq_unique'
      AND conrelid = 'history'::regclass
    ) THEN
      ALTER TABLE history
      ADD CONSTRAINT history_user_game_pool_seq_unique
      UNIQUE (user_id, game_uid, pool_id, seq_id);
      RAISE NOTICE '✅ 已创建新约束 history_user_game_pool_seq_unique';
    ELSE
      RAISE NOTICE 'ℹ️ 约束 history_user_game_pool_seq_unique 已存在';
    END IF;
  ELSE
    RAISE NOTICE 'ℹ️ 跳过 history pool 级唯一约束修复，因为 history.game_uid / history.seq_id 不存在';
  END IF;
END $$;

-- 3. 列出当前 history 表的唯一约束（供验证）
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  RAISE NOTICE '📋 当前 history 表的唯一约束:';
  FOR constraint_record IN
    SELECT c.conname,
           array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum)) as columns
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'history'::regclass
    AND c.contype = 'u'  -- 只看 UNIQUE 约束
    GROUP BY c.conname
  LOOP
    RAISE NOTICE '   - %: columns=%', constraint_record.conname, constraint_record.columns;
  END LOOP;
END $$;

-- 验证完成
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration 056: history 唯一约束修复完成';
  RAISE NOTICE '   新约束: (user_id, game_uid, pool_id, seq_id)';
  RAISE NOTICE '   这确保了不同卡池的相同 seqId 被正确区分';
END $$;
