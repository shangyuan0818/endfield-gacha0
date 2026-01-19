-- Migration: 033_restore_pools_metadata
-- Description: 恢复 pools 表的元数据字段（被 031 删除，现在需要恢复）
-- Date: 2026-01-17
-- Fix: FEAT-007 数据导入失败 - 缺少 description/banner_url/start_time/end_time 字段

-- ============================================
-- 1. 恢复元数据字段
-- ============================================
ALTER TABLE public.pools
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS featured_characters TEXT[];

-- ============================================
-- 2. 创建索引（加速按时间范围查询）
-- ============================================
CREATE INDEX IF NOT EXISTS idx_pools_time_range ON public.pools(start_time, end_time);

-- ============================================
-- 3. 添加字段注释
-- ============================================
COMMENT ON COLUMN public.pools.description IS '卡池描述信息，用于详情页展示';
COMMENT ON COLUMN public.pools.banner_url IS 'Banner 图片 URL，支持外部图床链接';
COMMENT ON COLUMN public.pools.start_time IS '卡池开始时间（可空）';
COMMENT ON COLUMN public.pools.end_time IS '卡池结束时间（可空）';
COMMENT ON COLUMN public.pools.featured_characters IS 'UP角色ID数组，如 ARRAY[''char_levantin'']';

-- ============================================
-- 4. 验证迁移
-- ============================================
DO $$
DECLARE
  missing_columns TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 检查 description
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pools' AND column_name = 'description'
  ) THEN
    missing_columns := array_append(missing_columns, 'description');
  END IF;

  -- 检查 banner_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pools' AND column_name = 'banner_url'
  ) THEN
    missing_columns := array_append(missing_columns, 'banner_url');
  END IF;

  -- 检查 start_time
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pools' AND column_name = 'start_time'
  ) THEN
    missing_columns := array_append(missing_columns, 'start_time');
  END IF;

  -- 检查 end_time
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pools' AND column_name = 'end_time'
  ) THEN
    missing_columns := array_append(missing_columns, 'end_time');
  END IF;

  -- 检查 featured_characters
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pools' AND column_name = 'featured_characters'
  ) THEN
    missing_columns := array_append(missing_columns, 'featured_characters');
  END IF;

  -- 报告结果
  IF array_length(missing_columns, 1) IS NULL THEN
    RAISE NOTICE '✅ Migration 033: pools 表元数据字段恢复成功';
    RAISE NOTICE '   - description ✓';
    RAISE NOTICE '   - banner_url ✓';
    RAISE NOTICE '   - start_time ✓';
    RAISE NOTICE '   - end_time ✓';
    RAISE NOTICE '   - featured_characters ✓';
  ELSE
    RAISE EXCEPTION '❌ Migration 033: 以下字段添加失败: %', array_to_string(missing_columns, ', ');
  END IF;
END $$;
