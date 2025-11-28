-- ============================================
-- 迁移脚本：为 pools 表添加 locked 列
-- 请在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 添加 locked 列（如果不存在）
ALTER TABLE public.pools
ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE;

-- 添加注释说明
COMMENT ON COLUMN public.pools.locked IS '卡池锁定状态，仅超管可修改';

-- ============================================
-- 完成！
-- locked 列已添加，默认值为 false（未锁定）
-- ============================================
