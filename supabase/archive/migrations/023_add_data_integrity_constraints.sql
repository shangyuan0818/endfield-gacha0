-- ============================================
-- 023: 添加数据完整性约束
-- 创建日期: 2025-12-17
-- 目的: 增强数据完整性验证，防止异常数据插入
-- 注意:
--   1. 使用 NOT VALID 避免检查现有数据，仅对新数据生效
--   2. 跳过已存在的约束（001 中已定义的 CHECK 约束）
--   3. 添加列存在性检查，兼容不同版本的 schema
-- ============================================

-- ============================================
-- 1. history 表数据完整性约束
-- ============================================

-- timestamp 不能为未来时间
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'history'
      AND constraint_name = 'check_timestamp_not_future'
  ) THEN
    ALTER TABLE public.history
      ADD CONSTRAINT check_timestamp_not_future
        CHECK (timestamp <= NOW())
        NOT VALID;
    RAISE NOTICE '已添加约束: check_timestamp_not_future';
  END IF;
END $$;

-- rarity 约束已在 001_init_tables.sql 中定义，跳过

-- ============================================
-- 2. pools 表数据完整性约束
-- ============================================

-- name 长度限制（1-100字符）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'pools'
      AND constraint_name = 'check_pool_name_length'
  ) THEN
    ALTER TABLE public.pools
      ADD CONSTRAINT check_pool_name_length
        CHECK (LENGTH(name) BETWEEN 1 AND 100)
        NOT VALID;
    RAISE NOTICE '已添加约束: check_pool_name_length';
  END IF;
END $$;

-- type 约束已在 001_init_tables.sql 中定义，跳过

-- ============================================
-- 3. profiles 表数据完整性约束
-- ============================================

-- username 长度限制（2-50字符，可为空）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'profiles'
      AND constraint_name = 'check_username_length'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT check_username_length
        CHECK (username IS NULL OR LENGTH(username) BETWEEN 2 AND 50)
        NOT VALID;
    RAISE NOTICE '已添加约束: check_username_length';
  END IF;
END $$;

-- role 约束已在 001_init_tables.sql 中定义，跳过

-- ============================================
-- 4. admin_applications 表数据完整性约束
-- ============================================

-- reason 长度限制（10-500字符）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'admin_applications'
      AND constraint_name = 'check_application_reason_length'
  ) THEN
    ALTER TABLE public.admin_applications
      ADD CONSTRAINT check_application_reason_length
        CHECK (LENGTH(reason) BETWEEN 10 AND 500)
        NOT VALID;
    RAISE NOTICE '已添加约束: check_application_reason_length';
  END IF;
END $$;

-- status 约束已在 001_init_tables.sql 中定义，跳过

-- ============================================
-- 5. announcements 表数据完整性约束
-- ============================================

-- 检查 announcements 表是否存在
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'announcements'
  ) THEN
    -- title 长度限制
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_schema = 'public'
        AND table_name = 'announcements'
        AND constraint_name = 'check_announcement_title_length'
    ) THEN
      EXECUTE 'ALTER TABLE public.announcements
        ADD CONSTRAINT check_announcement_title_length
          CHECK (LENGTH(title) BETWEEN 1 AND 100)
          NOT VALID';
      RAISE NOTICE '已添加约束: check_announcement_title_length';
    END IF;

    -- content 长度限制
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_schema = 'public'
        AND table_name = 'announcements'
        AND constraint_name = 'check_announcement_content_length'
    ) THEN
      EXECUTE 'ALTER TABLE public.announcements
        ADD CONSTRAINT check_announcement_content_length
          CHECK (LENGTH(content) BETWEEN 1 AND 5000)
          NOT VALID';
      RAISE NOTICE '已添加约束: check_announcement_content_length';
    END IF;

    -- priority 优先级范围
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_schema = 'public'
        AND table_name = 'announcements'
        AND constraint_name = 'check_announcement_priority'
    ) THEN
      EXECUTE 'ALTER TABLE public.announcements
        ADD CONSTRAINT check_announcement_priority
          CHECK (priority BETWEEN 0 AND 100)
          NOT VALID';
      RAISE NOTICE '已添加约束: check_announcement_priority';
    END IF;
  ELSE
    RAISE NOTICE 'announcements 表不存在，跳过相关约束';
  END IF;
END $$;

-- ============================================
-- 验证约束创建
-- ============================================

DO $$
DECLARE
  constraint_count INT;
BEGIN
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.table_constraints
  WHERE constraint_schema = 'public'
    AND constraint_name IN (
      'check_timestamp_not_future',
      'check_pool_name_length',
      'check_username_length',
      'check_application_reason_length',
      'check_announcement_title_length',
      'check_announcement_content_length',
      'check_announcement_priority'
    );

  RAISE NOTICE '=====================================';
  RAISE NOTICE '数据完整性约束部署完成';
  RAISE NOTICE '已创建/验证 % 个约束', constraint_count;
  RAISE NOTICE '使用 NOT VALID 选项，仅对新数据生效';
  RAISE NOTICE '=====================================';
END $$;
