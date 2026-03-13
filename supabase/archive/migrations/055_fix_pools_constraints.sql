-- =====================================================
-- 迁移文件: 055_fix_pools_constraints.sql
-- 描述: 清理 pools 表上的残留唯一约束
-- =====================================================
--
-- 问题原因：
-- 迁移 048 将 pools 表主键从 (user_id, pool_id) 改为 (pool_id)
-- 但可能遗留了旧的 UNIQUE 约束 pools_user_pool_id_unique
-- 导致不同用户导入相同卡池时触发约束冲突
--
-- =====================================================

-- 1. 检查并删除残留的唯一约束
DO $$
BEGIN
  -- 删除 pools_user_pool_id_unique 约束（如果存在）
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pools_user_pool_id_unique'
    AND conrelid = 'pools'::regclass
  ) THEN
    ALTER TABLE pools DROP CONSTRAINT pools_user_pool_id_unique;
    RAISE NOTICE '✅ 已删除约束 pools_user_pool_id_unique';
  ELSE
    RAISE NOTICE 'ℹ️ 约束 pools_user_pool_id_unique 不存在，无需删除';
  END IF;

  -- 同时检查并删除其他可能的残留约束
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pools_user_id_pool_id_key'
    AND conrelid = 'pools'::regclass
  ) THEN
    ALTER TABLE pools DROP CONSTRAINT pools_user_id_pool_id_key;
    RAISE NOTICE '✅ 已删除约束 pools_user_id_pool_id_key';
  END IF;
END $$;

-- 2. 确保 pool_id 是唯一的主键
DO $$
BEGIN
  -- 检查当前主键
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'p'
    AND c.conrelid = 'pools'::regclass
    AND a.attname = 'pool_id'
    AND array_length(c.conkey, 1) = 1  -- 只有一个列
  ) THEN
    RAISE NOTICE '⚠️ 警告：pool_id 不是单列主键，请检查 pools 表结构';
  ELSE
    RAISE NOTICE '✅ pool_id 是正确的单列主键';
  END IF;
END $$;

-- 3. 列出当前 pools 表的所有约束（供验证）
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  RAISE NOTICE '📋 当前 pools 表的约束列表:';
  FOR constraint_record IN
    SELECT c.conname, c.contype,
           array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum)) as columns
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'pools'::regclass
    GROUP BY c.conname, c.contype
  LOOP
    RAISE NOTICE '   - %: type=%, columns=%',
      constraint_record.conname,
      constraint_record.contype,
      constraint_record.columns;
  END LOOP;
END $$;

-- 验证完成
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration 055: pools 表约束清理完成';
  RAISE NOTICE '   请在 Supabase SQL Editor 中执行此迁移';
END $$;
