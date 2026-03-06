-- Migration: 048_refactor_multi_account_support
-- Description: 重构多账号支持 - 卡池全局共享，账号通过历史记录区分
-- Date: 2026-01-29
-- Feature:
--   1. 移除pools表的game_uid和nick_name字段（卡池全服通用）
--   2. 修改pools表主键为全局唯一的pool_id
--   3. 添加beginner类型支持

-- ============================================
-- 警告：此迁移会修改主键，请先备份数据库！
-- ============================================

-- ============================================
-- 1. 备份现有数据（可选，建议在执行前手动备份）
-- ============================================
-- 如果需要回滚，可以从备份恢复

-- ============================================
-- 2. 处理重复的pool_id（如果存在）
-- ============================================
-- 由于要将主键从 (user_id, pool_id) 改为 (pool_id)
-- 需要确保pool_id全局唯一

DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  -- 检查是否存在重复的pool_id（不同user_id但相同pool_id）
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT pool_id, COUNT(DISTINCT user_id) as user_count
    FROM public.pools
    GROUP BY pool_id
    HAVING COUNT(DISTINCT user_id) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE NOTICE '⚠️  发现 % 个重复的pool_id，将保留最早创建的记录', duplicate_count;

    -- 删除重复的pool_id，只保留最早创建的那条
    DELETE FROM public.pools
    WHERE id IN (
      SELECT p2.id
      FROM public.pools p1
      JOIN public.pools p2 ON p1.pool_id = p2.pool_id AND p1.id < p2.id
    );

    RAISE NOTICE '✅ 已清理重复的pool_id';
  ELSE
    RAISE NOTICE '✅ 没有发现重复的pool_id';
  END IF;
END $$;

-- ============================================
-- 3. 移除多账号字段
-- ============================================
DO $$
BEGIN
  ALTER TABLE public.pools DROP COLUMN IF EXISTS game_uid;
  ALTER TABLE public.pools DROP COLUMN IF EXISTS nick_name;
  DROP INDEX IF EXISTS idx_pools_game_uid;

  RAISE NOTICE '✅ 已移除 game_uid 和 nick_name 字段';
END $$;

-- ============================================
-- 4. 修改主键
-- ============================================
DO $$
BEGIN
  -- 删除旧的复合主键
  ALTER TABLE public.pools DROP CONSTRAINT IF EXISTS pools_pkey;

  -- 添加新的主键（pool_id全局唯一）
  ALTER TABLE public.pools ADD PRIMARY KEY (pool_id);

  -- 为user_id创建索引（用于查询用户创建的卡池）
  CREATE INDEX IF NOT EXISTS idx_pools_user_id ON public.pools(user_id);

  RAISE NOTICE '✅ 主键已修改为 pool_id';
END $$;

-- ============================================
-- 5. 添加beginner类型支持
-- ============================================
DO $$
BEGIN
  -- 删除旧的CHECK约束
  ALTER TABLE public.pools DROP CONSTRAINT IF EXISTS pools_type_check;

  -- 添加新的CHECK约束，包含beginner类型
  ALTER TABLE public.pools ADD CONSTRAINT pools_type_check
    CHECK (type IN ('limited', 'standard', 'weapon', 'beginner'));

  RAISE NOTICE '✅ 已添加 beginner 类型支持';
END $$;

-- ============================================
-- 6. 验证迁移
-- ============================================
DO $$
DECLARE
  pool_count INTEGER;
  has_beginner_constraint BOOLEAN;
BEGIN
  -- 检查主键
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'pools'
      AND constraint_type = 'PRIMARY KEY'
      AND constraint_name = 'pools_pkey'
  ) THEN
    RAISE EXCEPTION '❌ 主键验证失败';
  END IF;

  -- 检查game_uid字段是否已删除
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pools' AND column_name = 'game_uid'
  ) THEN
    RAISE EXCEPTION '❌ game_uid 字段仍然存在';
  END IF;

  -- 检查nick_name字段是否已删除
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pools' AND column_name = 'nick_name'
  ) THEN
    RAISE EXCEPTION '❌ nick_name 字段仍然存在';
  END IF;

  -- 检查beginner类型约束
  SELECT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_schema = 'public'
      AND constraint_name = 'pools_type_check'
      AND check_clause LIKE '%beginner%'
  ) INTO has_beginner_constraint;

  IF NOT has_beginner_constraint THEN
    RAISE EXCEPTION '❌ beginner 类型约束验证失败';
  END IF;

  -- 统计卡池数量
  SELECT COUNT(*) INTO pool_count FROM public.pools;

  -- 报告结果
  RAISE NOTICE '✅ Migration 048: 多账号支持重构完成';
  RAISE NOTICE '   - 主键已改为 pool_id ✓';
  RAISE NOTICE '   - game_uid 字段已删除 ✓';
  RAISE NOTICE '   - nick_name 字段已删除 ✓';
  RAISE NOTICE '   - beginner 类型已添加 ✓';
  RAISE NOTICE '   - 当前卡池数量: %', pool_count;
END $$;
