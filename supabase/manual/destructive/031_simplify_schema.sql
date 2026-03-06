-- ============================================================================
-- FEAT-007 数据库重建脚本
-- 创建时间: 2026-01-13
-- 目的: 简化表结构，支持新的导入系统
-- 警告: 此脚本将清空现有数据，请先备份！
-- ============================================================================

-- ============================================================================
-- 第一部分：清空现有数据（谨慎执行！）
-- ============================================================================

-- 清空历史记录表
TRUNCATE TABLE public.history CASCADE;

-- 清空卡池表
TRUNCATE TABLE public.pools CASCADE;

-- 注意：保留 characters 表的数据

-- ============================================================================
-- 第二部分：删除旧的约束和索引（如果存在）
-- ============================================================================

-- 删除 history 表上可能存在的旧索引
DROP INDEX IF EXISTS public.idx_history_character_id;
DROP INDEX IF EXISTS public.idx_history_legacy_pool_id;

-- 删除 pools 表上可能存在的旧索引
DROP INDEX IF EXISTS public.idx_pools_legacy_id;
DROP INDEX IF EXISTS public.idx_pools_time_range;

-- ============================================================================
-- 第三部分：重建 pools 表结构
-- ============================================================================

-- 删除旧列（如果存在）
ALTER TABLE public.pools
  DROP COLUMN IF EXISTS legacy_pool_id,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS start_time,
  DROP COLUMN IF EXISTS end_time,
  DROP COLUMN IF EXISTS banner_url,
  DROP COLUMN IF EXISTS featured_characters;

-- 添加新列（如果不存在）
DO $$
BEGIN
  -- up_character 列：UP角色名称
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pools' AND column_name = 'up_character')
  THEN
    ALTER TABLE public.pools ADD COLUMN up_character TEXT;
  END IF;
END $$;

-- 确保必要的列存在
COMMENT ON COLUMN public.pools.pool_id IS '语义化卡池ID，格式: userId_type_charSlug_index';
COMMENT ON COLUMN public.pools.up_character IS 'UP角色名称';

-- ============================================================================
-- 第四部分：重建 history 表结构
-- ============================================================================

-- 删除旧列（如果存在）
ALTER TABLE public.history
  DROP COLUMN IF EXISTS legacy_pool_id,
  DROP COLUMN IF EXISTS character_id,
  DROP COLUMN IF EXISTS avatar_url;

-- 确保 character_name 列存在
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'character_name')
  THEN
    ALTER TABLE public.history ADD COLUMN character_name TEXT;
  END IF;

  -- 确保 item_name 列存在（用于角色/武器名称）
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'item_name')
  THEN
    ALTER TABLE public.history ADD COLUMN item_name TEXT;
  END IF;

  -- 确保 batch_id 列存在
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'batch_id')
  THEN
    ALTER TABLE public.history ADD COLUMN batch_id TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.history.character_name IS '角色/武器名称（导入时自动填充）';
COMMENT ON COLUMN public.history.item_name IS '物品名称';
COMMENT ON COLUMN public.history.batch_id IS '批次ID，用于十连分组';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_history_batch_id ON public.history(batch_id);
CREATE INDEX IF NOT EXISTS idx_history_character_name ON public.history(character_name);

-- ============================================================================
-- 第五部分：更新 RLS 策略
-- ============================================================================

-- pools 表 RLS（保持现有策略，确保存在）
DO $$
BEGIN
  -- 检查并创建 SELECT 策略
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pools' AND policyname = 'pools_select_all') THEN
    CREATE POLICY pools_select_all ON public.pools FOR SELECT USING (true);
  END IF;

  -- 检查并创建 INSERT 策略
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pools' AND policyname = 'pools_insert_own') THEN
    CREATE POLICY pools_insert_own ON public.pools FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  -- 检查并创建 UPDATE 策略
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pools' AND policyname = 'pools_update_own') THEN
    CREATE POLICY pools_update_own ON public.pools FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  -- 检查并创建 DELETE 策略
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pools' AND policyname = 'pools_delete_own') THEN
    CREATE POLICY pools_delete_own ON public.pools FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- history 表 RLS（保持现有策略，确保存在）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'history' AND policyname = 'history_select_all') THEN
    CREATE POLICY history_select_all ON public.history FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'history' AND policyname = 'history_insert_own') THEN
    CREATE POLICY history_insert_own ON public.history FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'history' AND policyname = 'history_update_own') THEN
    CREATE POLICY history_update_own ON public.history FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'history' AND policyname = 'history_delete_own') THEN
    CREATE POLICY history_delete_own ON public.history FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- 第六部分：验证表结构
-- ============================================================================

-- 输出当前表结构（用于验证）
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('pools', 'history')
ORDER BY table_name, ordinal_position;

-- ============================================================================
-- 完成
-- ============================================================================

-- 提示信息
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FEAT-007 数据库重建完成！';
  RAISE NOTICE '- pools 表已清空并重建';
  RAISE NOTICE '- history 表已清空并重建';
  RAISE NOTICE '- characters 表数据已保留';
  RAISE NOTICE '- RLS 策略已更新';
  RAISE NOTICE '========================================';
END $$;
