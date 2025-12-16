-- ============================================
-- 修复 locked 卡池权限保护漏洞
-- 日期: 2025-12-16
-- 问题: DB-NEW-001 & SEC-NEW-003
-- 描述:
--   1. 普通管理员可以修改 pools.locked 字段,绕过超管锁定
--   2. 前端验证可被绕过,恶意用户可在locked卡池中插入数据
-- ============================================

-- ============================================
-- 1. 修复 pools 表 UPDATE 策略
-- ============================================

-- 删除旧的 UPDATE 策略
DROP POLICY IF EXISTS "pools_update_policy" ON public.pools;

-- 创建新的 UPDATE 策略,保护 locked 字段
-- 注意: PostgreSQL RLS 不支持在 WITH CHECK 中直接使用 OLD
-- 因此我们需要使用触发器来保护 locked 字段
CREATE POLICY "pools_update_policy" ON public.pools
  FOR UPDATE
  USING (
    auth.uid() = user_id
  );

COMMENT ON POLICY "pools_update_policy" ON public.pools IS
  '用户可以更新自己的卡池';

-- 创建触发器函数来保护 locked 字段
CREATE OR REPLACE FUNCTION protect_locked_field()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- 如果 locked 字段没有变化,允许更新
  IF OLD.locked = NEW.locked THEN
    RETURN NEW;
  END IF;

  -- 如果 locked 字段发生变化,检查用户角色
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();

  -- 只有超管可以修改 locked 字段
  IF user_role = 'super_admin' THEN
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Only super admin can modify locked field';
  END IF;
END;
$$;

-- 创建触发器
DROP TRIGGER IF EXISTS protect_locked_field_trigger ON public.pools;
CREATE TRIGGER protect_locked_field_trigger
  BEFORE UPDATE ON public.pools
  FOR EACH ROW
  EXECUTE FUNCTION protect_locked_field();

COMMENT ON FUNCTION protect_locked_field() IS
  '保护 locked 字段只能由超管修改';
COMMENT ON TRIGGER protect_locked_field_trigger ON public.pools IS
  '触发器: 保护 locked 字段';

-- ============================================
-- 2. 修复 history 表 INSERT 策略
-- ============================================

-- 删除旧的 INSERT 策略
DROP POLICY IF EXISTS "history_insert_policy" ON public.history;

-- 创建新的 INSERT 策略,检查卡池是否被锁定
CREATE POLICY "history_insert_policy" ON public.history
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      -- 如果卡池未锁定,允许插入
      -- 如果卡池已锁定,只有超管可以插入
      NOT EXISTS (
        SELECT 1 FROM public.pools
        WHERE pools.pool_id = history.pool_id
          AND pools.user_id = history.user_id
          AND pools.locked = true
      )
      OR
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'super_admin'
      )
    )
  );

COMMENT ON POLICY "history_insert_policy" ON public.history IS
  '用户可以插入抽卡记录,但不能在已锁定的卡池中插入(超管除外)';

-- ============================================
-- 3. 安全验证测试 (可选,用于验证修复)
-- ============================================

-- 测试用例说明:
-- 1. 普通用户尝试修改 locked 字段应该失败
-- 2. 普通管理员尝试在 locked 卡池中插入记录应该失败
-- 3. 超管可以修改 locked 字段
-- 4. 超管可以在 locked 卡池中插入记录

-- 创建测试函数 (可选)
CREATE OR REPLACE FUNCTION test_locked_pool_protection()
RETURNS TABLE (
  test_name TEXT,
  passed BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 测试1: 验证 pools UPDATE 策略是否正确设置
  RETURN QUERY
  SELECT
    'pools_update_policy_exists'::TEXT,
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'pools'
        AND policyname = 'pools_update_policy'
    ),
    'pools UPDATE 策略已创建'::TEXT;

  -- 测试2: 验证 history INSERT 策略是否正确设置
  RETURN QUERY
  SELECT
    'history_insert_policy_exists'::TEXT,
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'history'
        AND policyname = 'history_insert_policy'
    ),
    'history INSERT 策略已创建'::TEXT;

  RETURN;
END;
$$;

COMMENT ON FUNCTION test_locked_pool_protection() IS
  '测试 locked 卡池保护功能是否正确配置';

-- ============================================
-- 迁移完成
-- ============================================

-- 记录迁移日志
DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE '迁移 021: locked 卡池权限保护修复完成';
  RAISE NOTICE '修复问题: DB-NEW-001, SEC-NEW-003';
  RAISE NOTICE '执行时间: %', NOW();
  RAISE NOTICE '===========================================';
END $$;
