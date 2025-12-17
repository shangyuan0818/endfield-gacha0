-- ============================================
-- 023: 添加数据完整性约束
-- 创建日期: 2025-12-17
-- 目的: 增强数据完整性验证，防止异常数据插入
-- ============================================

-- ============================================
-- 1. history 表数据完整性约束
-- ============================================

-- item_name 长度限制（1-100字符）
ALTER TABLE public.history
  ADD CONSTRAINT check_item_name_length
    CHECK (item_name IS NULL OR LENGTH(item_name) BETWEEN 1 AND 100);

COMMENT ON CONSTRAINT check_item_name_length ON public.history
  IS '物品名称长度限制：1-100字符';

-- timestamp 不能为未来时间
ALTER TABLE public.history
  ADD CONSTRAINT check_timestamp_not_future
    CHECK (timestamp <= NOW());

COMMENT ON CONSTRAINT check_timestamp_not_future ON public.history
  IS '时间戳不能为未来时间';

-- rarity 稀有度范围限制（3-6）
ALTER TABLE public.history
  ADD CONSTRAINT check_rarity_range
    CHECK (rarity BETWEEN 3 AND 6);

COMMENT ON CONSTRAINT check_rarity_range ON public.history
  IS '稀有度范围：3-6星';

-- ============================================
-- 2. pools 表数据完整性约束
-- ============================================

-- name 长度限制（1-100字符）
ALTER TABLE public.pools
  ADD CONSTRAINT check_pool_name_length
    CHECK (LENGTH(name) BETWEEN 1 AND 100);

COMMENT ON CONSTRAINT check_pool_name_length ON public.pools
  IS '卡池名称长度限制：1-100字符';

-- type 类型限制（limited, standard, weapon）
ALTER TABLE public.pools
  ADD CONSTRAINT check_pool_type
    CHECK (type IN ('limited', 'standard', 'weapon'));

COMMENT ON CONSTRAINT check_pool_type ON public.pools
  IS '卡池类型限制：limited, standard, weapon';

-- ============================================
-- 3. profiles 表数据完整性约束
-- ============================================

-- username 长度限制（2-50字符，可为空）
ALTER TABLE public.profiles
  ADD CONSTRAINT check_username_length
    CHECK (username IS NULL OR LENGTH(username) BETWEEN 2 AND 50);

COMMENT ON CONSTRAINT check_username_length ON public.profiles
  IS '用户名长度限制：2-50字符';

-- role 角色限制（user, admin, super_admin）
ALTER TABLE public.profiles
  ADD CONSTRAINT check_role_type
    CHECK (role IN ('user', 'admin', 'super_admin'));

COMMENT ON CONSTRAINT check_role_type ON public.profiles
  IS '角色限制：user, admin, super_admin';

-- ============================================
-- 4. admin_applications 表数据完整性约束
-- ============================================

-- status 状态限制
ALTER TABLE public.admin_applications
  ADD CONSTRAINT check_application_status
    CHECK (status IN ('pending', 'approved', 'rejected'));

COMMENT ON CONSTRAINT check_application_status ON public.admin_applications
  IS '申请状态限制：pending, approved, rejected';

-- reason 长度限制（10-500字符）
ALTER TABLE public.admin_applications
  ADD CONSTRAINT check_application_reason_length
    CHECK (LENGTH(reason) BETWEEN 10 AND 500);

COMMENT ON CONSTRAINT check_application_reason_length ON public.admin_applications
  IS '申请理由长度限制：10-500字符';

-- ============================================
-- 5. announcements 表数据完整性约束
-- ============================================

-- title 长度限制
ALTER TABLE public.announcements
  ADD CONSTRAINT check_announcement_title_length
    CHECK (LENGTH(title) BETWEEN 1 AND 100);

COMMENT ON CONSTRAINT check_announcement_title_length ON public.announcements
  IS '公告标题长度限制：1-100字符';

-- content 长度限制
ALTER TABLE public.announcements
  ADD CONSTRAINT check_announcement_content_length
    CHECK (LENGTH(content) BETWEEN 1 AND 5000);

COMMENT ON CONSTRAINT check_announcement_content_length ON public.announcements
  IS '公告内容长度限制：1-5000字符';

-- priority 优先级范围
ALTER TABLE public.announcements
  ADD CONSTRAINT check_announcement_priority
    CHECK (priority BETWEEN 0 AND 100);

COMMENT ON CONSTRAINT check_announcement_priority ON public.announcements
  IS '公告优先级范围：0-100';

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
    AND constraint_name LIKE 'check_%'
    AND table_name IN ('history', 'pools', 'profiles', 'admin_applications', 'announcements');

  RAISE NOTICE '成功创建 % 个数据完整性约束', constraint_count;
END $$;
