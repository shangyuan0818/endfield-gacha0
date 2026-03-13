-- ============================================
-- DR-S01: 修复 history 表 SELECT 策略
--
-- 问题: history 表 FOR SELECT USING (true) 导致任何人可查询所有用户的抽卡记录
-- 修复: 普通用户只能查看自己的数据，超管可查看所有数据
-- 注意: get_global_stats() 使用 SECURITY DEFINER，不受 RLS 影响
--
-- 执行日期: 2026-02-24
-- ============================================

-- 1. 删除所有旧的 SELECT 策略
DROP POLICY IF EXISTS "history_select_policy" ON public.history;
DROP POLICY IF EXISTS "All users can view all history" ON public.history;
DROP POLICY IF EXISTS "history_select_all" ON public.history;

-- 2. 创建新的 SELECT 策略：用户只能查看自己的数据，超管可查看所有
CREATE POLICY "history_select_own_or_admin" ON public.history
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- ============================================
-- 执行后的效果：
-- 1. ✅ 普通用户只能查询自己的抽卡记录
-- 2. ✅ 超管可查询所有用户的记录（管理面板功能）
-- 3. ✅ get_global_stats() 不受影响（SECURITY DEFINER 绕过 RLS）
-- 4. ✅ game_uid 等敏感字段不再暴露给其他用户
-- ============================================
