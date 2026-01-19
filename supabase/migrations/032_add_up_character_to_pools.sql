-- Migration: 032_add_up_character_to_pools
-- Description: 添加 up_character 字段到 pools 表（单个UP角色名称，与 featured_characters 互补）
-- Date: 2026-01-17
-- Fix: FEAT-007 卡池管理界面字段不匹配问题

-- 1. 添加 up_character 字段（单个 UP 角色名称，用于显示）
ALTER TABLE public.pools
  ADD COLUMN IF NOT EXISTS up_character TEXT;

-- 2. 添加字段注释
COMMENT ON COLUMN public.pools.up_character IS '单个UP角色显示名称，用于简化显示（与 featured_characters 互补）';

-- 3. 验证迁移
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pools'
    AND column_name = 'up_character'
  ) THEN
    RAISE NOTICE '✅ Migration 032: pools.up_character 字段添加成功';
  ELSE
    RAISE EXCEPTION '❌ Migration 032: pools.up_character 字段添加失败';
  END IF;
END $$;
