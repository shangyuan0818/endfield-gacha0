-- Migration: 030_migrate_pool_ids
-- Description: 为卡池ID迁移准备兼容字段，保留旧ID用于平滑过渡
-- Date: 2026-01-11
-- FEAT-007: 卡池详情系统重构 - ID迁移准备

-- 1. 为 pools 表添加旧ID兼容字段
ALTER TABLE public.pools
  ADD COLUMN IF NOT EXISTS legacy_pool_id TEXT;

-- 2. 为 history 表添加旧ID兼容字段
ALTER TABLE public.history
  ADD COLUMN IF NOT EXISTS legacy_pool_id TEXT;

-- 3. 创建索引（加速旧ID查询，兼容期间需要）
CREATE INDEX IF NOT EXISTS idx_pools_legacy_id ON public.pools(legacy_pool_id);
CREATE INDEX IF NOT EXISTS idx_history_legacy_pool_id ON public.history(legacy_pool_id);

-- 4. 添加字段注释
COMMENT ON COLUMN public.pools.legacy_pool_id IS '迁移前的旧ID（时间戳格式），用于兼容旧数据，保留6个月后可删除';
COMMENT ON COLUMN public.history.legacy_pool_id IS '关联的旧卡池ID，用于ID迁移期间的数据查询兼容';

-- 5. 创建ID迁移辅助函数（可选）
-- 用于在应用层迁移时，批量更新 pool_id 并保留 legacy_pool_id

CREATE OR REPLACE FUNCTION migrate_pool_id(
  old_id TEXT,
  new_id TEXT,
  user_uuid UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  -- 1. 更新 pools 表
  UPDATE public.pools
  SET
    pool_id = new_id,
    legacy_pool_id = old_id,
    updated_at = NOW()
  WHERE user_id = user_uuid AND pool_id = old_id;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  -- 2. 更新 history 表中的关联
  UPDATE public.history
  SET
    pool_id = new_id,
    legacy_pool_id = old_id,
    updated_at = NOW()
  WHERE user_id = user_uuid AND pool_id = old_id;

  -- 3. 返回是否成功
  IF affected_rows > 0 THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;

COMMENT ON FUNCTION migrate_pool_id IS 'ID迁移辅助函数：批量更新卡池ID并保留旧ID，供前端调用';

-- 6. 验证迁移
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pools'
    AND column_name = 'legacy_pool_id'
  ) THEN
    RAISE NOTICE '✅ Migration 030: 旧ID兼容字段添加成功';
  ELSE
    RAISE EXCEPTION '❌ Migration 030: 旧ID兼容字段添加失败';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'migrate_pool_id'
  ) THEN
    RAISE NOTICE '✅ Migration 030: ID迁移辅助函数创建成功';
  END IF;
END $$;
