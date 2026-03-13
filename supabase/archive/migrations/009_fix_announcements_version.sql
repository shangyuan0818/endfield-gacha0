-- 修复：为已存在的 announcements 表添加缺失的 version 字段

-- 添加 version 字段（如果不存在）
ALTER TABLE public.announcements
ADD COLUMN IF NOT EXISTS version VARCHAR(20) DEFAULT '1.0.0';

-- 添加注释
COMMENT ON COLUMN public.announcements.version IS '公告版本号，用户可选择在此版本更新前不再显示';

-- 确保其他必要字段存在
ALTER TABLE public.announcements
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE public.announcements
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 更新现有公告的版本号（如果为空）
UPDATE public.announcements
SET version = '1.0.0'
WHERE version IS NULL;
