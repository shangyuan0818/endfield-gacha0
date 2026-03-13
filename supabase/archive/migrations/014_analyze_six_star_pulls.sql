-- 详细分析限定池6星出货情况
-- 在 Supabase SQL Editor 中运行

-- 1. 查看每个6星的出货位置和垫刀数
WITH ordered_pulls AS (
  SELECT 
    h.record_id,
    h.rarity,
    h.is_standard,
    h.special_type,
    ROW_NUMBER() OVER (ORDER BY h.record_id) as pull_number
  FROM history h
  JOIN pools p ON h.pool_id = p.pool_id AND h.user_id = p.user_id
  WHERE p.type = 'limited'
),
six_stars_with_pity AS (
  SELECT 
    record_id,
    is_standard,
    special_type,
    pull_number,
    pull_number - COALESCE(LAG(pull_number) OVER (ORDER BY pull_number), 0) as pity_count
  FROM ordered_pulls
  WHERE rarity = 6
)
SELECT 
  ROW_NUMBER() OVER (ORDER BY pull_number) as "第几个6星",
  record_id as "记录ID",
  CASE WHEN is_standard THEN '常驻(歪)' ELSE '限定UP' END as "类型",
  COALESCE(special_type, '普通抽取') as "特殊标记",
  pull_number as "第几抽出的",
  pity_count as "垫刀数"
FROM six_stars_with_pity
ORDER BY pull_number;

-- 2. 统计总览
SELECT 
  '总抽数' as "指标",
  COUNT(*)::text as "数值"
FROM history h
JOIN pools p ON h.pool_id = p.pool_id AND h.user_id = p.user_id
WHERE p.type = 'limited'

UNION ALL

SELECT 
  '6星总数',
  COUNT(*)::text
FROM history h
JOIN pools p ON h.pool_id = p.pool_id AND h.user_id = p.user_id
WHERE p.type = 'limited' AND h.rarity = 6

UNION ALL

SELECT 
  '限定UP数',
  COUNT(*)::text
FROM history h
JOIN pools p ON h.pool_id = p.pool_id AND h.user_id = p.user_id
WHERE p.type = 'limited' AND h.rarity = 6 AND h.is_standard = false

UNION ALL

SELECT 
  '常驻歪数',
  COUNT(*)::text
FROM history h
JOIN pools p ON h.pool_id = p.pool_id AND h.user_id = p.user_id
WHERE p.type = 'limited' AND h.rarity = 6 AND h.is_standard = true

UNION ALL

SELECT 
  '计算平均出货',
  ROUND(480.0 / NULLIF((SELECT COUNT(*) FROM history h JOIN pools p ON h.pool_id = p.pool_id AND h.user_id = p.user_id WHERE p.type = 'limited' AND h.rarity = 6), 0), 1)::text

UNION ALL

SELECT
  '理论赠送数(480/240)',
  FLOOR(480 / 240)::text;

-- 3. 检查是否有异常的垫刀数（比如 0 或 1，可能是赠送误录入）
-- 正常抽卡至少需要 1 抽，赠送的如果误录入可能垫刀数为 0 或很小


