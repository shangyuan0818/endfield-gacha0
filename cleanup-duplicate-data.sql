-- ============================================
-- 清理重复上传的数据
-- 请先查询确认，再执行删除
-- ============================================

-- 步骤 1: 查看你的用户 ID（替换你的邮箱）
SELECT id, email FROM auth.users WHERE email = '你的邮箱@example.com';

-- 步骤 2: 查看可能是重复的卡池（你的用户ID下，但 pool_id 与其他用户重复的）
-- 替换 '5cf8c649-48aa-4f56-af27-d0a5837deea1' 为你的实际用户 ID
WITH my_pools AS (
  SELECT pool_id, created_at FROM public.pools WHERE user_id = '5cf8c649-48aa-4f56-af27-d0a5837deea1'
),
other_user_pools AS (
  SELECT DISTINCT pool_id FROM public.pools WHERE user_id != '5cf8c649-48aa-4f56-af27-d0a5837deea1'
)
SELECT mp.pool_id, mp.created_at
FROM my_pools mp
INNER JOIN other_user_pools op ON mp.pool_id = op.pool_id
ORDER BY mp.created_at DESC;

-- 步骤 3: 查看最近上传的卡池（按时间排序，可以看到哪些是刚刚错误上传的）
SELECT pool_id, name, created_at, updated_at
FROM public.pools
WHERE user_id = '5cf8c649-48aa-4f56-af27-d0a5837deea1'
ORDER BY updated_at DESC
LIMIT 50;

-- 步骤 4: 删除你账号下与其他用户重复的卡池
-- ⚠️ 警告：执行前请确认这些确实是重复数据！
-- 替换 '5cf8c649-48aa-4f56-af27-d0a5837deea1' 为你的实际用户 ID
/*
DELETE FROM public.history
WHERE user_id = '5cf8c649-48aa-4f56-af27-d0a5837deea1'
  AND pool_id IN (
    SELECT DISTINCT p1.pool_id
    FROM public.pools p1
    INNER JOIN public.pools p2 ON p1.pool_id = p2.pool_id
    WHERE p1.user_id = '5cf8c649-48aa-4f56-af27-d0a5837deea1' AND p2.user_id != '5cf8c649-48aa-4f56-af27-d0a5837deea1'
  );

DELETE FROM public.pools
WHERE user_id = '5cf8c649-48aa-4f56-af27-d0a5837deea1'
  AND pool_id IN (
    SELECT DISTINCT p1.pool_id
    FROM public.pools p1
    INNER JOIN public.pools p2 ON p1.pool_id = p2.pool_id
    WHERE p1.user_id = '5cf8c649-48aa-4f56-af27-d0a5837deea1' AND p2.user_id != '5cf8c649-48aa-4f56-af27-d0a5837deea1'
  );
*/

-- 或者，如果你知道这些数据是在某个时间点之后上传的，可以按时间删除
-- 步骤 5: 按时间范围删除（更安全的方法）
-- 替换时间戳为你执行错误同步的大概时间
/*
DELETE FROM public.history
WHERE user_id = '5cf8c649-48aa-4f56-af27-d0a5837deea1'
  AND updated_at >= '2025-12-01T00:00:00Z';

DELETE FROM public.pools
WHERE user_id = '5cf8c649-48aa-4f56-af27-d0a5837deea1'
  AND updated_at >= '2025-12-01T00:00:00Z';
*/
