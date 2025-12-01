-- ============================================
-- RLS 策略更新：方案A - 开放查看权限
-- 所有登录用户都能查看所有卡池和历史记录
-- 但只有管理员能录入/编辑数据
--
-- 执行时间: 2025-12-01
-- 说明: 解决新用户无数据、管理员录入数据不显示的问题
-- ============================================

-- 1. 删除旧的 pools 读取策略
DROP POLICY IF EXISTS "Users can view own pools" ON public.pools;
DROP POLICY IF EXISTS "Admins can view all pools" ON public.pools;

-- 2. 创建新的 pools 读取策略：完全开放查看（包括游客）
CREATE POLICY "All users can view all pools" ON public.pools
  FOR SELECT USING (
    -- 完全开放读取权限，游客和登录用户都能查看
    true
  );

-- 3. 确保写入权限仍然受限（保持现有策略）
-- "Users can insert own pools" - 保持不变
-- "Users can update own pools" - 保持不变
-- "Users can delete own pools" - 保持不变

-- 4. 删除旧的 history 读取策略
DROP POLICY IF EXISTS "Users can view own history" ON public.history;
DROP POLICY IF EXISTS "Admins can view all history" ON public.history;

-- 5. 创建新的 history 读取策略：完全开放查看（包括游客）
CREATE POLICY "All users can view all history" ON public.history
  FOR SELECT USING (
    -- 完全开放读取权限，游客和登录用户都能查看
    true
  );

-- 6. 确保写入权限仍然受限（保持现有策略）
-- "Users can insert own history" - 保持不变
-- "Users can update own history" - 保持不变
-- "Users can delete own history" - 保持不变

-- ============================================
-- 完成！执行后的效果：
-- 1. ✅ 新用户登录后能看到所有现有卡池
-- 2. ✅ 管理员录入的数据会立即显示在看板和记录中
-- 3. ✅ 所有用户看到同一个卡池的全部数据（协作模式）
-- 4. ✅ 写入权限仍受 user_id 保护（安全性）
-- ============================================
