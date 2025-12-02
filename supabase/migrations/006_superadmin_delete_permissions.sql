-- ============================================
-- RLS 策略更新：超管删除权限
-- 允许超级管理员删除任何用户的数据
-- 普通用户/管理员只能删除自己创建的数据
--
-- 执行时间: 2025-12-02
-- 说明: 修复超管无法删除其他用户数据的问题
-- ============================================

-- 1. 删除旧的 pools 删除策略
DROP POLICY IF EXISTS "Users can delete own pools" ON public.pools;

-- 2. 创建新的 pools 删除策略：超管可删除任何卡池，普通用户只能删除自己的
CREATE POLICY "Users and superadmins can delete pools" ON public.pools
  FOR DELETE USING (
    -- 超管可以删除任何卡池
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
    OR
    -- 普通用户只能删除自己创建的卡池
    user_id = auth.uid()
  );

-- 3. 删除旧的 history 删除策略
DROP POLICY IF EXISTS "Users can delete own history" ON public.history;

-- 4. 创建新的 history 删除策略：超管可删除任何记录，普通用户只能删除自己的
CREATE POLICY "Users and superadmins can delete history" ON public.history
  FOR DELETE USING (
    -- 超管可以删除任何历史记录
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
    OR
    -- 普通用户只能删除自己创建的记录
    user_id = auth.uid()
  );

-- ============================================
-- 完成！执行后的效果：
-- 1. ✅ 超管可以删除任何用户创建的卡池和历史记录
-- 2. ✅ 普通用户/管理员只能删除自己创建的数据
-- 3. ✅ 保持数据安全性的同时，赋予超管完全管理权限
-- ============================================
