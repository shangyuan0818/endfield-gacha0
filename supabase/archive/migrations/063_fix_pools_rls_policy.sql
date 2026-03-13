-- ============================================
-- 迁移 063: 修复卡池 RLS 策略
-- ============================================
-- 问题: 048 迁移将 pools 表改为全局共享 (移除 user_id 主键)
--       但 021 迁移的 RLS 策略未同步更新 (仍要求 auth.uid() = user_id)
--       导致管理员无法编辑非自己创建的卡池
--
-- 修复: 允许管理员和超管编辑全局共享卡池
-- 日期: 2026-02-24
-- ============================================

-- 删除旧的 UPDATE 策略 (来自 021 迁移)
DROP POLICY IF EXISTS "pools_update_policy" ON public.pools;

-- 创建新的 UPDATE 策略: 允许管理员和超管编辑所有卡池
CREATE POLICY "pools_update_policy" ON public.pools
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- 同时检查并修复其他可能过时的策略

-- 删除旧的 INSERT 策略 (如果存在)
DROP POLICY IF EXISTS "pools_insert_policy" ON public.pools;

-- 创建新的 INSERT 策略: 允许管理员和超管创建卡池
CREATE POLICY "pools_insert_policy" ON public.pools
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- 删除旧的 DELETE 策略 (如果存在)
DROP POLICY IF EXISTS "pools_delete_policy" ON public.pools;

-- 创建新的 DELETE 策略: 仅允许超管删除卡池
CREATE POLICY "pools_delete_policy" ON public.pools
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- 验证 SELECT 策略是否正确 (应该允许所有人查看)
-- 如果不存在，则创建
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pools'
      AND policyname = 'pools_select_policy'
  ) THEN
    CREATE POLICY "pools_select_policy" ON public.pools
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- 添加注释说明策略变更
COMMENT ON POLICY "pools_update_policy" ON public.pools IS
  '允许管理员和超管编辑所有卡池 (适配 048 迁移的全局共享架构)';

COMMENT ON POLICY "pools_insert_policy" ON public.pools IS
  '允许管理员和超管创建卡池';

COMMENT ON POLICY "pools_delete_policy" ON public.pools IS
  '仅允许超管删除卡池';
