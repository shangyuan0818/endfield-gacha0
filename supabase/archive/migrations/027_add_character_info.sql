-- Migration: 027_add_character_info
-- Description: 为 history 表添加角色信息字段（角色名称、角色ID、头像URL）
-- Date: 2026-01-11
-- FEAT-007: 卡池详情系统重构 - 角色信息支持

-- 1. 新增字段
ALTER TABLE public.history
  ADD COLUMN IF NOT EXISTS character_name VARCHAR(100),    -- 角色/武器显示名称
  ADD COLUMN IF NOT EXISTS character_id VARCHAR(50),       -- 关联characters表的外键
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;                -- 角色头像URL（可空，预留CDN）

-- 2. 创建索引（加速按角色查询）
CREATE INDEX IF NOT EXISTS idx_history_character_id ON public.history(character_id);
CREATE INDEX IF NOT EXISTS idx_history_character_name ON public.history(character_name);

-- 3. 添加字段注释
COMMENT ON COLUMN public.history.character_name IS '角色/武器显示名称，用于界面展示';
COMMENT ON COLUMN public.history.character_id IS '关联characters表的ID，用于查询角色详细信息';
COMMENT ON COLUMN public.history.avatar_url IS '角色头像URL，可为空，优先使用此字段，否则从characters表获取';

-- 4. 验证迁移
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'history'
    AND column_name = 'character_name'
  ) THEN
    RAISE NOTICE '✅ Migration 027: character_name 字段添加成功';
  ELSE
    RAISE EXCEPTION '❌ Migration 027: character_name 字段添加失败';
  END IF;
END $$;
