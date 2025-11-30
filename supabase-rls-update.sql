-- ============================================
-- RLS 策略更新：允许管理员/超管读取所有卡池和历史记录
-- 请在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. 删除旧的 pools 读取策略
DROP POLICY IF EXISTS "Users can view own pools" ON public.pools;

-- 2. 创建新的 pools 读取策略：管理员和超管可以读取所有卡池
CREATE POLICY "Admins can view all pools" ON public.pools
  FOR SELECT USING (
    -- 允许读取自己的卡池
    auth.uid() = user_id
    OR
    -- 或者是管理员/超管可以读取所有卡池
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- 3. 删除旧的 history 读取策略
DROP POLICY IF EXISTS "Users can view own history" ON public.history;

-- 4. 创建新的 history 读取策略：管理员和超管可以读取所有历史记录
CREATE POLICY "Admins can view all history" ON public.history
  FOR SELECT USING (
    -- 允许读取自己的历史记录
    auth.uid() = user_id
    OR
    -- 或者是管理员/超管可以读取所有历史记录
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- 完成！
-- 执行后，管理员和超管将能看到所有用户的卡池和历史记录
-- ============================================
