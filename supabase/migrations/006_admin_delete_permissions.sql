-- ============================================
-- RLS 策略更新：允许管理员删除任何记录
-- 修复 BUG: 删除操作未能同步到云端
--
-- 执行时间: 2025-12-02
-- 说明: 管理员可以删除任何用户创建的历史记录和卡池
-- ============================================

-- 1. 删除旧的 history 删除策略
DROP POLICY IF EXISTS "Users can delete own history" ON public.history;

-- 2. 创建新的 history 删除策略：管理员可删除任何记录
CREATE POLICY "Admins can delete any history" ON public.history
  FOR DELETE USING (
    -- 检查当前用户是否为管理员或超管
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE role IN ('admin', 'super_admin')
    )
  );

-- 3. 删除旧的 pools 删除策略
DROP POLICY IF EXISTS "Users can delete own pools" ON public.pools;

-- 4. 创建新的 pools 删除策略：管理员可删除任何卡池
CREATE POLICY "Admins can delete any pools" ON public.pools
  FOR DELETE USING (
    -- 检查当前用户是否为管理员或超管
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- 完成！执行后的效果：
-- 1. ✅ 管理员可以删除任何用户创建的历史记录
-- 2. ✅ 管理员可以删除任何用户创建的卡池
-- 3. ✅ 删除操作会自动同步到云端
-- 4. ✅ 普通用户（非管理员）无法删除任何记录（安全性）
-- ============================================
