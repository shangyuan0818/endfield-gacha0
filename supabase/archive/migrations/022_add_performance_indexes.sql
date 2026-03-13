-- ============================================
-- 022: 添加性能优化索引
-- 创建日期: 2025-12-17
-- 目的: 优化频繁查询的性能
-- ============================================

-- ============================================
-- 1. profiles.role 索引 (优化权限检查)
-- ============================================

-- profiles.role 频繁用于权限检查
-- 例如: SELECT * FROM profiles WHERE role = 'admin'
CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON public.profiles(role);

COMMENT ON INDEX idx_profiles_role
  IS '优化权限检查查询性能';

-- ============================================
-- 2. pools 复合索引 (优化locked卡池查询)
-- ============================================

-- 优化查询locked卡池
-- 例如: SELECT * FROM pools WHERE locked = true AND user_id = ?
CREATE INDEX IF NOT EXISTS idx_pools_locked_user
  ON public.pools(locked, user_id)
  WHERE locked = true;

COMMENT ON INDEX idx_pools_locked_user
  IS '优化locked卡池查询（部分索引）';

-- ============================================
-- 3. history 复合索引 (优化统计查询)
-- ============================================

-- 优化用户+卡池的历史记录查询（最常用）
-- 例如: SELECT * FROM history WHERE user_id = ? AND pool_id = ? ORDER BY timestamp DESC
CREATE INDEX IF NOT EXISTS idx_history_user_pool_time
  ON public.history(user_id, pool_id, timestamp DESC);

COMMENT ON INDEX idx_history_user_pool_time
  IS '优化用户卡池历史记录查询';

-- 优化稀有度统计查询（部分索引）
-- 例如: SELECT * FROM history WHERE pool_id = ? AND rarity >= 5
CREATE INDEX IF NOT EXISTS idx_history_pool_high_rarity
  ON public.history(pool_id, rarity)
  WHERE rarity >= 5;

COMMENT ON INDEX idx_history_pool_high_rarity
  IS '优化高稀有度统计查询（仅索引5星和6星）';

-- ============================================
-- 验证索引创建
-- ============================================

-- 查看所有新创建的索引
DO $$
DECLARE
  idx_count INT;
BEGIN
  SELECT COUNT(*) INTO idx_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN (
      'idx_profiles_role',
      'idx_pools_locked_user',
      'idx_history_user_pool_time',
      'idx_history_pool_high_rarity'
    );

  RAISE NOTICE '成功创建 % 个性能优化索引', idx_count;
END $$;
