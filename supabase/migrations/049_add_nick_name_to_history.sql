-- Migration: 049_add_nick_name_to_history
-- Description: 添加 nick_name 字段到 history 表，用于账号切换器显示友好名称
-- Date: 2026-01-29

-- ============================================
-- 1. 添加 nick_name 字段到 history 表
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'nick_name'
  ) THEN
    ALTER TABLE public.history ADD COLUMN nick_name TEXT;
    COMMENT ON COLUMN public.history.nick_name IS '游戏账号昵称（用于账号切换器显示）';
    RAISE NOTICE '✅ 已添加 nick_name 字段到 history 表';
  ELSE
    RAISE NOTICE '⚠️  nick_name 字段已存在，跳过';
  END IF;
END $$;

-- ============================================
-- 2. 验证迁移
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'nick_name'
  ) THEN
    RAISE NOTICE '✅ Migration 049: nick_name 字段添加成功';
  ELSE
    RAISE EXCEPTION '❌ Migration 049: nick_name 字段添加失败';
  END IF;
END $$;
