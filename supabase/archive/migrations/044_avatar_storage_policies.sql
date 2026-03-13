-- =====================================================
-- 044: Avatar Storage RLS Policies
-- 头像存储桶的行级安全策略
--
-- 功能：
-- - 所有人可读取头像（公开访问）
-- - 仅超级管理员可上传/更新/删除头像
-- =====================================================

-- 注意：需要先在 Supabase Dashboard -> Storage 中创建名为 "avatars" 的 Public bucket
-- 1. 进入 Supabase Dashboard -> Storage
-- 2. 点击 "New bucket"
-- 3. 名称填写 "avatars"，勾选 "Public bucket"

-- =====================================================
-- 1. 删除已存在的策略（如果有）
-- =====================================================
DROP POLICY IF EXISTS "Public can read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Only super_admin can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Only super_admin can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Only super_admin can delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow all for avatars bucket" ON storage.objects;

-- =====================================================
-- 2. 创建读取策略 - 所有人可读取头像
-- =====================================================
CREATE POLICY "Public can read avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- =====================================================
-- 3. 创建上传策略 - 仅超级管理员可上传
-- =====================================================
CREATE POLICY "Only super_admin can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
);

-- =====================================================
-- 4. 创建更新策略 - 仅超级管理员可更新（覆盖上传）
-- =====================================================
CREATE POLICY "Only super_admin can update avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
);

-- =====================================================
-- 5. 创建删除策略 - 仅超级管理员可删除
-- =====================================================
CREATE POLICY "Only super_admin can delete avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
);

-- =====================================================
-- 权限说明：
-- =====================================================
-- | 操作   | 匿名用户 | 普通用户 | 管理员 | 超级管理员 |
-- |--------|----------|----------|--------|------------|
-- | SELECT | ✅       | ✅       | ✅     | ✅         |
-- | INSERT | ❌       | ❌       | ❌     | ✅         |
-- | UPDATE | ❌       | ❌       | ❌     | ✅         |
-- | DELETE | ❌       | ❌       | ❌     | ✅         |
-- =====================================================
