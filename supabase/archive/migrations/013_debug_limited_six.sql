-- 调试：检查限定池6星数量
-- 在 Supabase SQL Editor 中运行

-- 1. 查看限定池的所有6星记录
SELECT h.record_id, h.rarity, h.is_standard, h.special_type, p.type as pool_type, p.pool_id
FROM history h
JOIN pools p ON h.pool_id = p.pool_id AND h.user_id = p.user_id
WHERE p.type = 'limited' AND h.rarity = 6
ORDER BY h.record_id;

-- 2. 统计限定池6星数量（排除gift）
SELECT
  COUNT(*) as total_six,
  COUNT(*) FILTER (WHERE special_type IS DISTINCT FROM 'gift') as six_excluding_gift,
  COUNT(*) FILTER (WHERE special_type = 'gift') as gift_six
FROM history h
JOIN pools p ON h.pool_id = p.pool_id AND h.user_id = p.user_id
WHERE p.type = 'limited' AND h.rarity = 6;

-- 3. 查看限定池总抽数
SELECT p.pool_id, p.type, COUNT(*) as total_pulls
FROM history h
JOIN pools p ON h.pool_id = p.pool_id AND h.user_id = p.user_id
WHERE p.type = 'limited'
GROUP BY p.pool_id, p.type;
