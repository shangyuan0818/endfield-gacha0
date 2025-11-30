-- 扩展全服统计 RPC 函数，添加图表所需的详细数据
-- 包括：各稀有度计数、6星出货分布、分类型详细统计

DROP FUNCTION IF EXISTS get_global_stats();

CREATE OR REPLACE FUNCTION get_global_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  avg_pity NUMERIC;
  global_distribution JSON;
  limited_stats JSON;
  weapon_stats JSON;
  standard_stats JSON;
BEGIN
  -- ============================================
  -- 1. 计算全局平均出货
  -- ============================================
  WITH ordered_pulls AS (
    SELECT
      pool_id,
      user_id,
      rarity,
      ROW_NUMBER() OVER (PARTITION BY pool_id, user_id ORDER BY record_id) as rn
    FROM history
    WHERE special_type IS DISTINCT FROM 'gift'
  ),
  six_stars_with_prev AS (
    SELECT
      pool_id,
      user_id,
      rn,
      LAG(rn, 1, 0) OVER (PARTITION BY pool_id, user_id ORDER BY rn) as prev_rn
    FROM ordered_pulls
    WHERE rarity = 6
  )
  SELECT COALESCE(AVG(rn - prev_rn), 0) INTO avg_pity FROM six_stars_with_prev;

  -- ============================================
  -- 2. 计算全局6星出货分布
  -- ============================================
  WITH ordered_pulls AS (
    SELECT
      h.pool_id,
      h.user_id,
      h.rarity,
      h.is_standard,
      ROW_NUMBER() OVER (PARTITION BY h.pool_id, h.user_id ORDER BY h.record_id) as rn
    FROM history h
    WHERE h.special_type IS DISTINCT FROM 'gift'
  ),
  six_stars_pity AS (
    SELECT
      is_standard,
      rn - COALESCE(LAG(rn, 1) OVER (PARTITION BY pool_id, user_id ORDER BY rn), 0) as pity
    FROM ordered_pulls
    WHERE rarity = 6
  ),
  pity_ranges AS (
    SELECT
      CASE
        WHEN pity BETWEEN 1 AND 10 THEN '01-10'
        WHEN pity BETWEEN 11 AND 20 THEN '11-20'
        WHEN pity BETWEEN 21 AND 30 THEN '21-30'
        WHEN pity BETWEEN 31 AND 40 THEN '31-40'
        WHEN pity BETWEEN 41 AND 50 THEN '41-50'
        WHEN pity BETWEEN 51 AND 60 THEN '51-60'
        WHEN pity BETWEEN 61 AND 70 THEN '61-70'
        WHEN pity BETWEEN 71 AND 80 THEN '71-80'
        WHEN pity BETWEEN 81 AND 90 THEN '81-90'
        ELSE '91+'
      END as range_label,
      is_standard
    FROM six_stars_pity
  ),
  grouped_ranges AS (
    SELECT
      range_label,
      SUM(CASE WHEN NOT is_standard THEN 1 ELSE 0 END) as limited_count,
      SUM(CASE WHEN is_standard THEN 1 ELSE 0 END) as standard_count
    FROM pity_ranges
    GROUP BY range_label
  )
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'range', REPLACE(range_label, '01-10', '1-10'),
        'limited', limited_count,
        'standard', standard_count
      ) ORDER BY range_label
    ),
    '[]'::json
  ) INTO global_distribution FROM grouped_ranges;

  -- ============================================
  -- 3. 计算限定池统计
  -- ============================================
  WITH limited_pulls AS (
    SELECT h.*
    FROM history h
    JOIN pools p ON h.pool_id = p.pool_id AND h.user_id = p.user_id
    WHERE p.type = 'limited'
  ),
  limited_ordered AS (
    SELECT
      pool_id,
      user_id,
      rarity,
      is_standard,
      ROW_NUMBER() OVER (PARTITION BY pool_id, user_id ORDER BY record_id) as rn
    FROM limited_pulls
    WHERE special_type IS DISTINCT FROM 'gift'
  ),
  limited_six_pity AS (
    SELECT
      pool_id,
      user_id,
      is_standard,
      rn - COALESCE(LAG(rn, 1) OVER (PARTITION BY pool_id, user_id ORDER BY rn), 0) as pity
    FROM limited_ordered
    WHERE rarity = 6
  ),
  limited_pity_ranges AS (
    SELECT
      CASE
        WHEN pity BETWEEN 1 AND 10 THEN '01-10'
        WHEN pity BETWEEN 11 AND 20 THEN '11-20'
        WHEN pity BETWEEN 21 AND 30 THEN '21-30'
        WHEN pity BETWEEN 31 AND 40 THEN '31-40'
        WHEN pity BETWEEN 41 AND 50 THEN '41-50'
        WHEN pity BETWEEN 51 AND 60 THEN '51-60'
        WHEN pity BETWEEN 61 AND 70 THEN '61-70'
        WHEN pity BETWEEN 71 AND 80 THEN '71-80'
        WHEN pity BETWEEN 81 AND 90 THEN '81-90'
        ELSE '91+'
      END as range_label,
      is_standard
    FROM limited_six_pity
  ),
  limited_grouped AS (
    SELECT
      range_label,
      SUM(CASE WHEN NOT is_standard THEN 1 ELSE 0 END) as limited_count,
      SUM(CASE WHEN is_standard THEN 1 ELSE 0 END) as standard_count
    FROM limited_pity_ranges
    GROUP BY range_label
  )
  SELECT json_build_object(
    'total', COALESCE((SELECT COUNT(*) FROM limited_pulls WHERE special_type IS DISTINCT FROM 'gift'), 0),
    'six', COALESCE((SELECT COUNT(*) FROM limited_pulls WHERE rarity = 6), 0),
    'sixStarLimited', COALESCE((SELECT COUNT(*) FROM limited_pulls WHERE rarity = 6 AND is_standard = false), 0),
    'sixStarStandard', COALESCE((SELECT COUNT(*) FROM limited_pulls WHERE rarity = 6 AND is_standard = true), 0),
    'avgPity', COALESCE(ROUND((SELECT AVG(pity) FROM limited_six_pity), 1), 0),
    'counts', json_build_object(
      '6', COALESCE((SELECT COUNT(*) FROM limited_pulls WHERE rarity = 6 AND is_standard = false), 0),
      '6_std', COALESCE((SELECT COUNT(*) FROM limited_pulls WHERE rarity = 6 AND is_standard = true), 0),
      '5', COALESCE((SELECT COUNT(*) FROM limited_pulls WHERE rarity = 5), 0),
      '4', COALESCE((SELECT COUNT(*) FROM limited_pulls WHERE rarity <= 4), 0)
    ),
    'distribution', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'range', REPLACE(range_label, '01-10', '1-10'),
          'limited', limited_count,
          'standard', standard_count
        ) ORDER BY range_label
      ) FROM limited_grouped),
      '[]'::json
    )
  ) INTO limited_stats;

  -- ============================================
  -- 4. 计算武器池统计
  -- ============================================
  WITH weapon_pulls AS (
    SELECT h.*
    FROM history h
    JOIN pools p ON h.pool_id = p.pool_id AND h.user_id = p.user_id
    WHERE p.type = 'weapon'
  ),
  weapon_ordered AS (
    SELECT
      pool_id,
      user_id,
      rarity,
      is_standard,
      ROW_NUMBER() OVER (PARTITION BY pool_id, user_id ORDER BY record_id) as rn
    FROM weapon_pulls
    WHERE special_type IS DISTINCT FROM 'gift'
  ),
  weapon_six_pity AS (
    SELECT
      pool_id,
      user_id,
      is_standard,
      rn - COALESCE(LAG(rn, 1) OVER (PARTITION BY pool_id, user_id ORDER BY rn), 0) as pity
    FROM weapon_ordered
    WHERE rarity = 6
  ),
  weapon_pity_ranges AS (
    SELECT
      CASE
        WHEN pity BETWEEN 1 AND 10 THEN '01-10'
        WHEN pity BETWEEN 11 AND 20 THEN '11-20'
        WHEN pity BETWEEN 21 AND 30 THEN '21-30'
        WHEN pity BETWEEN 31 AND 40 THEN '31-40'
        WHEN pity BETWEEN 41 AND 50 THEN '41-50'
        WHEN pity BETWEEN 51 AND 60 THEN '51-60'
        WHEN pity BETWEEN 61 AND 70 THEN '61-70'
        WHEN pity BETWEEN 71 AND 80 THEN '71-80'
        WHEN pity BETWEEN 81 AND 90 THEN '81-90'
        ELSE '91+'
      END as range_label,
      is_standard
    FROM weapon_six_pity
  ),
  weapon_grouped AS (
    SELECT
      range_label,
      SUM(CASE WHEN NOT is_standard THEN 1 ELSE 0 END) as limited_count,
      SUM(CASE WHEN is_standard THEN 1 ELSE 0 END) as standard_count
    FROM weapon_pity_ranges
    GROUP BY range_label
  )
  SELECT json_build_object(
    'total', COALESCE((SELECT COUNT(*) FROM weapon_pulls WHERE special_type IS DISTINCT FROM 'gift'), 0),
    'six', COALESCE((SELECT COUNT(*) FROM weapon_pulls WHERE rarity = 6), 0),
    'sixStarLimited', COALESCE((SELECT COUNT(*) FROM weapon_pulls WHERE rarity = 6 AND is_standard = false), 0),
    'sixStarStandard', COALESCE((SELECT COUNT(*) FROM weapon_pulls WHERE rarity = 6 AND is_standard = true), 0),
    'avgPity', COALESCE(ROUND((SELECT AVG(pity) FROM weapon_six_pity), 1), 0),
    'counts', json_build_object(
      '6', COALESCE((SELECT COUNT(*) FROM weapon_pulls WHERE rarity = 6 AND is_standard = false), 0),
      '6_std', COALESCE((SELECT COUNT(*) FROM weapon_pulls WHERE rarity = 6 AND is_standard = true), 0),
      '5', COALESCE((SELECT COUNT(*) FROM weapon_pulls WHERE rarity = 5), 0),
      '4', COALESCE((SELECT COUNT(*) FROM weapon_pulls WHERE rarity <= 4), 0)
    ),
    'distribution', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'range', REPLACE(range_label, '01-10', '1-10'),
          'limited', limited_count,
          'standard', standard_count
        ) ORDER BY range_label
      ) FROM weapon_grouped),
      '[]'::json
    )
  ) INTO weapon_stats;

  -- ============================================
  -- 5. 计算常驻池统计
  -- ============================================
  WITH standard_pulls AS (
    SELECT h.*
    FROM history h
    JOIN pools p ON h.pool_id = p.pool_id AND h.user_id = p.user_id
    WHERE p.type = 'standard'
  ),
  standard_ordered AS (
    SELECT
      pool_id,
      user_id,
      rarity,
      is_standard,
      ROW_NUMBER() OVER (PARTITION BY pool_id, user_id ORDER BY record_id) as rn
    FROM standard_pulls
    WHERE special_type IS DISTINCT FROM 'gift'
  ),
  standard_six_pity AS (
    SELECT
      pool_id,
      user_id,
      is_standard,
      rn - COALESCE(LAG(rn, 1) OVER (PARTITION BY pool_id, user_id ORDER BY rn), 0) as pity
    FROM standard_ordered
    WHERE rarity = 6
  ),
  standard_pity_ranges AS (
    SELECT
      CASE
        WHEN pity BETWEEN 1 AND 10 THEN '01-10'
        WHEN pity BETWEEN 11 AND 20 THEN '11-20'
        WHEN pity BETWEEN 21 AND 30 THEN '21-30'
        WHEN pity BETWEEN 31 AND 40 THEN '31-40'
        WHEN pity BETWEEN 41 AND 50 THEN '41-50'
        WHEN pity BETWEEN 51 AND 60 THEN '51-60'
        WHEN pity BETWEEN 61 AND 70 THEN '61-70'
        WHEN pity BETWEEN 71 AND 80 THEN '71-80'
        WHEN pity BETWEEN 81 AND 90 THEN '81-90'
        ELSE '91+'
      END as range_label,
      is_standard
    FROM standard_six_pity
  ),
  standard_grouped AS (
    SELECT
      range_label,
      SUM(CASE WHEN NOT is_standard THEN 1 ELSE 0 END) as limited_count,
      SUM(CASE WHEN is_standard THEN 1 ELSE 0 END) as standard_count
    FROM standard_pity_ranges
    GROUP BY range_label
  )
  SELECT json_build_object(
    'total', COALESCE((SELECT COUNT(*) FROM standard_pulls WHERE special_type IS DISTINCT FROM 'gift'), 0),
    'six', COALESCE((SELECT COUNT(*) FROM standard_pulls WHERE rarity = 6), 0),
    'sixStarLimited', COALESCE((SELECT COUNT(*) FROM standard_pulls WHERE rarity = 6 AND is_standard = false), 0),
    'sixStarStandard', COALESCE((SELECT COUNT(*) FROM standard_pulls WHERE rarity = 6 AND is_standard = true), 0),
    'avgPity', COALESCE(ROUND((SELECT AVG(pity) FROM standard_six_pity), 1), 0),
    'counts', json_build_object(
      '6', COALESCE((SELECT COUNT(*) FROM standard_pulls WHERE rarity = 6 AND is_standard = false), 0),
      '6_std', COALESCE((SELECT COUNT(*) FROM standard_pulls WHERE rarity = 6 AND is_standard = true), 0),
      '5', COALESCE((SELECT COUNT(*) FROM standard_pulls WHERE rarity = 5), 0),
      '4', COALESCE((SELECT COUNT(*) FROM standard_pulls WHERE rarity <= 4), 0)
    ),
    'distribution', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'range', REPLACE(range_label, '01-10', '1-10'),
          'limited', limited_count,
          'standard', standard_count
        ) ORDER BY range_label
      ) FROM standard_grouped),
      '[]'::json
    )
  ) INTO standard_stats;

  -- ============================================
  -- 6. 组装最终结果
  -- ============================================
  SELECT json_build_object(
    'totalPulls', COALESCE((SELECT COUNT(*) FROM history WHERE special_type IS DISTINCT FROM 'gift'), 0),
    'totalUsers', COALESCE((SELECT COUNT(*) FROM profiles), 0),
    'sixStarTotal', COALESCE((SELECT COUNT(*) FROM history WHERE rarity = 6), 0),
    'sixStarLimited', COALESCE((SELECT COUNT(*) FROM history WHERE rarity = 6 AND is_standard = false), 0),
    'sixStarStandard', COALESCE((SELECT COUNT(*) FROM history WHERE rarity = 6 AND is_standard = true), 0),
    'fiveStar', COALESCE((SELECT COUNT(*) FROM history WHERE rarity = 5), 0),
    'fourStar', COALESCE((SELECT COUNT(*) FROM history WHERE rarity <= 4), 0),
    'avgPity', ROUND(avg_pity, 1),
    'counts', json_build_object(
      '6', COALESCE((SELECT COUNT(*) FROM history WHERE rarity = 6 AND is_standard = false), 0),
      '6_std', COALESCE((SELECT COUNT(*) FROM history WHERE rarity = 6 AND is_standard = true), 0),
      '5', COALESCE((SELECT COUNT(*) FROM history WHERE rarity = 5), 0),
      '4', COALESCE((SELECT COUNT(*) FROM history WHERE rarity <= 4), 0)
    ),
    'distribution', global_distribution,
    'byType', json_build_object(
      'limited', limited_stats,
      'weapon', weapon_stats,
      'standard', standard_stats
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- 授权所有认证用户调用此函数
GRANT EXECUTE ON FUNCTION get_global_stats() TO authenticated;
-- 也授权匿名用户（如果需要未登录也能看到统计）
GRANT EXECUTE ON FUNCTION get_global_stats() TO anon;
