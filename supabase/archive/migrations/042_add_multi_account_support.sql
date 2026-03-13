-- Migration: 042_add_multi_account_support
-- Description: 添加多账号支持字段到 pools 表
-- Date: 2026-01-28
-- Feature: 支持同一用户管理多个游戏账号（官服/B服）

-- ============================================
-- 1. 添加多账号支持字段到 pools 表
-- ============================================
ALTER TABLE public.pools
  ADD COLUMN IF NOT EXISTS game_uid TEXT,
  ADD COLUMN IF NOT EXISTS nick_name TEXT;

-- ============================================
-- 2. 添加字段注释
-- ============================================
COMMENT ON COLUMN public.pools.game_uid IS '游戏账号 UID（用于区分官服/B服等不同账号）';
COMMENT ON COLUMN public.pools.nick_name IS '游戏账号昵称';

-- ============================================
-- 3. 创建索引（加速按游戏账号查询）
-- ============================================
CREATE INDEX IF NOT EXISTS idx_pools_game_uid ON public.pools(user_id, game_uid);

-- ============================================
-- 4. 验证迁移
-- ============================================
DO $$
DECLARE
  missing_columns TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 检查 game_uid
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pools' AND column_name = 'game_uid'
  ) THEN
    missing_columns := array_append(missing_columns, 'game_uid');
  END IF;

  -- 检查 nick_name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pools' AND column_name = 'nick_name'
  ) THEN
    missing_columns := array_append(missing_columns, 'nick_name');
  END IF;

  -- 报告结果
  IF array_length(missing_columns, 1) IS NULL THEN
    RAISE NOTICE '✅ Migration 042: pools 表多账号支持字段添加成功';
    RAISE NOTICE '   - game_uid ✓';
    RAISE NOTICE '   - nick_name ✓';
    RAISE NOTICE '   - idx_pools_game_uid ✓';
  ELSE
    RAISE EXCEPTION '❌ Migration 042: 以下字段添加失败: %', array_to_string(missing_columns, ', ');
  END IF;
END $$;
