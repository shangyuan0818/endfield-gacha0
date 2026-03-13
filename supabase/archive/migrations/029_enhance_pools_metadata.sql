-- Migration: 029_enhance_pools_metadata
-- Description: 扩展 pools 表，添加卡池元数据字段（描述、时间、Banner图等）
-- Date: 2026-01-11
-- FEAT-007: 卡池详情系统重构 - 卡池元数据增强

-- 1. 新增字段
ALTER TABLE public.pools
  ADD COLUMN IF NOT EXISTS description TEXT,                -- 卡池描述，如"杨颜UP池 - 三测第一期"
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,          -- 卡池开始时间
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,            -- 卡池结束时间
  ADD COLUMN IF NOT EXISTS banner_url TEXT,                 -- 卡池Banner图片URL（预留）
  ADD COLUMN IF NOT EXISTS featured_characters TEXT[];      -- UP角色ID数组，关联characters表

-- 2. 创建索引（加速按时间范围查询当前UP池）
CREATE INDEX IF NOT EXISTS idx_pools_time_range ON public.pools(start_time, end_time);

-- 3. 添加字段注释
COMMENT ON COLUMN public.pools.description IS '卡池描述信息，用于详情页展示';
COMMENT ON COLUMN public.pools.start_time IS '卡池开始时间（可空，手动录入池可不填）';
COMMENT ON COLUMN public.pools.end_time IS '卡池结束时间（可空）';
COMMENT ON COLUMN public.pools.banner_url IS 'Banner图片URL，预留给公测后的官方图片';
COMMENT ON COLUMN public.pools.featured_characters IS 'UP角色ID列表，如 [''char_levantin'', ''char_yangyan'']，关联characters表';

-- 4. 验证迁移
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pools'
    AND column_name = 'featured_characters'
  ) THEN
    RAISE NOTICE '✅ Migration 029: pools 表元数据字段添加成功';
  ELSE
    RAISE EXCEPTION '❌ Migration 029: pools 表元数据字段添加失败';
  END IF;
END $$;
