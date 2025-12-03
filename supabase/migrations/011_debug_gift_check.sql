-- 调试脚本：检查 gift 数据情况
-- 在 Supabase SQL Editor 中运行此脚本查看结果

-- 1. 检查 special_type 字段的所有不同值
SELECT DISTINCT special_type, COUNT(*) as count
FROM history
GROUP BY special_type;

-- 2. 检查 6 星中有多少是 gift
SELECT
  COUNT(*) as total_six_star,
  COUNT(*) FILTER (WHERE special_type = 'gift') as gift_count,
  COUNT(*) FILTER (WHERE special_type IS NULL) as null_count,
  COUNT(*) FILTER (WHERE special_type IS DISTINCT FROM 'gift') as non_gift_count
FROM history
WHERE rarity = 6;

-- 3. 检查当前 RPC 函数是否存在
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_name = 'get_global_stats';
