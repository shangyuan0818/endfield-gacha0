-- =====================================================
-- 迁移文件: 051_fix_is_standard_calculation.sql
-- 描述: 修复 get_global_stats 函数中的 is_standard 计算逻辑
-- =====================================================
--
-- 问题原因：
-- 数据库中的 is_standard 字段几乎全是 false（错误的）
-- 需要基于 UP 角色匹配动态重新计算
--
-- 修复方案：
-- 1. 创建 history_with_correct_is_standard CTE
-- 2. 在所有统计中使用重新计算的 is_standard_calc
--
-- =====================================================

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
  -- 核心CTE: 重新计算所有记录的 is_standard
  -- ============================================
  WITH history_with_correct_is_standard AS (
    SELECT
      h.*,
      p.type as pool_type,
      p.up_character,
      -- 动态计算正确的 is_standard
      CASE
        -- 常驻池/新手池：全是常驻
        WHEN p.type IN ('standard', 'beginner') OR h.pool_id IN ('standard', 'beginner') THEN true
        -- 限定/武器池的6星：检查是否匹配UP
        WHEN h.rarity = 6 AND p.up_character IS NOT NULL THEN
          NOT (
            COALESCE(h.character_name, '') ILIKE '%' || p.up_character || '%' OR
            COALESCE(h.item_name, '') ILIKE '%' || p.up_character || '%' OR
            p.up_character ILIKE '%' || COALESCE(h.character_name, h.item_name, '') || '%'
          )
        -- 其他情况：保持原值
        ELSE COALESCE(h.is_standard, false)
      END as is_standard_calc
    FROM history h
    LEFT JOIN pools p ON h.pool_id = p.pool_id AND h.user_id = p.user_id
  )

  -- ============================================
  -- 1. 计算全局平均出货
  -- ============================================
  ,ordered_pulls AS (
    SELECT
      pool_id,
      user_id,
      rarity,
      ROW_NUMBER() OVER (PARTITION BY pool_id, user_id ORDER BY record_id) as rn
    FROM history_with_correct_is_standard
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
  WITH history_with_correct_is_standard AS (
    SELECT
      h.*,
      p.type as pool_type,
      p.up_character,
      CASE
        WHEN p.type IN ('standard', 'beginner') OR h.pool_id IN ('standard', 'beginner') THEN true
        WHEN h.rarity = 6 AND p.up_character IS NOT NULL THEN
          NOT (
            COALESCE(h.character_name, '') ILIKE '%' || p.up_character || '%' OR
            COALESCE(h.item_name, '') ILIKE '%' || p.up_character || '%' OR
            p.up_character ILIKE '%' || COALESCE(h.character_name, h.item_name, '') || '%'
          )
        ELSE COALESCE(h.is_standard, false)
      END as is_standard_calc
    FROM history h
    LEFT JOIN pools p ON h.pool_id = p.pool_id AND h.user_id = p.user_id
  ),
  ordered_pulls AS (
    SELECT
      h.pool_id,
      h.user_id,
      h.rarity,
      h.is_standard_calc,
      ROW_NUMBER() OVER (PARTITION BY h.pool_id, h.user_id ORDER BY h.record_id) as rn
    FROM history_with_correct_is_standard h
    WHERE h.special_type IS DISTINCT FROM 'gift'
  ),
  six_stars_pity AS (
    SELECT
      is_standard_calc,
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
      is_standard_calc
    FROM six_stars_pity
  ),
  grouped_ranges AS (
    SELECT
      range_label,
      SUM(CASE WHEN NOT is_standard_calc THEN 1 ELSE 0 END) as limited_count,
      SUM(CASE WHEN is_standard_calc THEN 1 ELSE 0 END) as standard_count
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
  WITH history_with_correct_is_standard AS (
    SELECT
      h.*,
      p.type as pool_type,
      p.up_character,
      CASE
        WHEN p.type IN ('standard', 'beginner') OR h.pool_id IN ('standard', 'beginner') THEN true
        WHEN h.rarity = 6 AND p.up_character IS NOT NULL THEN
          NOT (
            COALESCE(h.character_name, '') ILIKE '%' || p.up_character || '%' OR
            COALESCE(h.item_name, '') ILIKE '%' || p.up_character || '%' OR
            p.up_character ILIKE '%' || COALESCE(h.character_name, h.item_name, '') || '%'
          )
        ELSE COALESCE(h.is_standard, false)
      END as is_standard_calc
    FROM history h
    LEFT JOIN pools p ON h.pool_id = p.pool_id AND h.user_id = p.user_id
  ),
  base_pulls AS (
    SELECT
      h.*,
      COALESCE(
        CASE
          WHEN h.pool_type IN ('limited', 'limited_character') THEN 'limited'
          WHEN h.pool_type IN ('weapon', 'limited_weapon') THEN 'weapon'
          WHEN h.pool_type IN ('standard', 'beginner') THEN 'standard'
          ELSE NULL
        END,
        CASE
          WHEN h.pool_id IN ('standard', 'beginner') THEN 'standard'
          WHEN split_part(h.pool_id, '_', 1) = 'special' THEN 'limited'
          WHEN split_part(h.pool_id, '_', 1) IN ('weaponbox', 'weponbox') THEN 'weapon'
          WHEN h.is_standard_calc = true THEN 'standard'
          ELSE 'limited'
        END
      ) AS classified_pool_type
    FROM history_with_correct_is_standard h
    WHERE h.special_type IS DISTINCT FROM 'gift'
  ),
  limited_pulls AS (
    SELECT * FROM base_pulls WHERE classified_pool_type = 'limited'
  ),
  limited_ordered AS (
    SELECT pool_id, user_id, rarity, is_standard_calc,
           ROW_NUMBER() OVER (PARTITION BY pool_id, user_id ORDER BY record_id) as rn
    FROM limited_pulls
  ),
  limited_six_pity AS (
    SELECT pool_id, user_id, is_standard_calc,
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
      is_standard_calc
    FROM limited_six_pity
  ),
  limited_grouped AS (
    SELECT
      range_label,
      SUM(CASE WHEN NOT is_standard_calc THEN 1 ELSE 0 END) as limited_count,
      SUM(CASE WHEN is_standard_calc THEN 1 ELSE 0 END) as standard_count
    FROM limited_pity_ranges
    GROUP BY range_label
  )
  SELECT json_build_object(
    'total', COALESCE((SELECT COUNT(*) FROM limited_pulls), 0),
    'six', COALESCE((SELECT COUNT(*) FROM limited_pulls WHERE rarity = 6), 0),
    'sixStarLimited', COALESCE((SELECT COUNT(*) FROM limited_pulls WHERE rarity = 6 AND is_standard_calc = false), 0),
    'sixStarStandard', COALESCE((SELECT COUNT(*) FROM limited_pulls WHERE rarity = 6 AND is_standard_calc = true), 0),
    'avgPity', COALESCE(ROUND((SELECT AVG(pity) FROM limited_six_pity), 1), 0),
    'counts', json_build_object(
      '6', COALESCE((SELECT COUNT(*) FROM limited_pulls WHERE rarity = 6 AND is_standard_calc = false), 0),
      '6_std', COALESCE((SELECT COUNT(*) FROM limited_pulls WHERE rarity = 6 AND is_standard_calc = true), 0),
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
  WITH history_with_correct_is_standard AS (
    SELECT
      h.*,
      p.type as pool_type,
      p.up_character,
      CASE
        WHEN p.type IN ('standard', 'beginner') OR h.pool_id IN ('standard', 'beginner') THEN true
        WHEN h.rarity = 6 AND p.up_character IS NOT NULL THEN
          NOT (
            COALESCE(h.character_name, '') ILIKE '%' || p.up_character || '%' OR
            COALESCE(h.item_name, '') ILIKE '%' || p.up_character || '%' OR
            p.up_character ILIKE '%' || COALESCE(h.character_name, h.item_name, '') || '%'
          )
        ELSE COALESCE(h.is_standard, false)
      END as is_standard_calc
    FROM history h
    LEFT JOIN pools p ON h.pool_id = p.pool_id AND h.user_id = p.user_id
  ),
  base_pulls AS (
    SELECT
      h.*,
      COALESCE(
        CASE
          WHEN h.pool_type IN ('limited', 'limited_character') THEN 'limited'
          WHEN h.pool_type IN ('weapon', 'limited_weapon') THEN 'weapon'
          WHEN h.pool_type IN ('standard', 'beginner') THEN 'standard'
          ELSE NULL
        END,
        CASE
          WHEN h.pool_id IN ('standard', 'beginner') THEN 'standard'
          WHEN split_part(h.pool_id, '_', 1) = 'special' THEN 'limited'
          WHEN split_part(h.pool_id, '_', 1) IN ('weaponbox', 'weponbox') THEN 'weapon'
          WHEN h.is_standard_calc = true THEN 'standard'
          ELSE 'limited'
        END
      ) AS classified_pool_type
    FROM history_with_correct_is_standard h
    WHERE h.special_type IS DISTINCT FROM 'gift'
  ),
  weapon_pulls AS (
    SELECT * FROM base_pulls WHERE classified_pool_type = 'weapon'
  ),
  weapon_ordered AS (
    SELECT pool_id, user_id, rarity, is_standard_calc,
           ROW_NUMBER() OVER (PARTITION BY pool_id, user_id ORDER BY record_id) as rn
    FROM weapon_pulls
  ),
  weapon_six_pity AS (
    SELECT pool_id, user_id, is_standard_calc,
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
      is_standard_calc
    FROM weapon_six_pity
  ),
  weapon_grouped AS (
    SELECT
      range_label,
      SUM(CASE WHEN NOT is_standard_calc THEN 1 ELSE 0 END) as limited_count,
      SUM(CASE WHEN is_standard_calc THEN 1 ELSE 0 END) as standard_count
    FROM weapon_pity_ranges
    GROUP BY range_label
  )
  SELECT json_build_object(
    'total', COALESCE((SELECT COUNT(*) FROM weapon_pulls), 0),
    'six', COALESCE((SELECT COUNT(*) FROM weapon_pulls WHERE rarity = 6), 0),
    'sixStarLimited', COALESCE((SELECT COUNT(*) FROM weapon_pulls WHERE rarity = 6 AND is_standard_calc = false), 0),
    'sixStarStandard', COALESCE((SELECT COUNT(*) FROM weapon_pulls WHERE rarity = 6 AND is_standard_calc = true), 0),
    'avgPity', COALESCE(ROUND((SELECT AVG(pity) FROM weapon_six_pity), 1), 0),
    'counts', json_build_object(
      '6', COALESCE((SELECT COUNT(*) FROM weapon_pulls WHERE rarity = 6 AND is_standard_calc = false), 0),
      '6_std', COALESCE((SELECT COUNT(*) FROM weapon_pulls WHERE rarity = 6 AND is_standard_calc = true), 0),
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
  WITH history_with_correct_is_standard AS (
    SELECT
      h.*,
      p.type as pool_type,
      p.up_character,
      CASE
        WHEN p.type IN ('standard', 'beginner') OR h.pool_id IN ('standard', 'beginner') THEN true
        WHEN h.rarity = 6 AND p.up_character IS NOT NULL THEN
          NOT (
            COALESCE(h.character_name, '') ILIKE '%' || p.up_character || '%' OR
            COALESCE(h.item_name, '') ILIKE '%' || p.up_character || '%' OR
            p.up_character ILIKE '%' || COALESCE(h.character_name, h.item_name, '') || '%'
          )
        ELSE COALESCE(h.is_standard, false)
      END as is_standard_calc
    FROM history h
    LEFT JOIN pools p ON h.pool_id = p.pool_id AND h.user_id = p.user_id
  ),
  base_pulls AS (
    SELECT
      h.*,
      COALESCE(
        CASE
          WHEN h.pool_type IN ('limited', 'limited_character') THEN 'limited'
          WHEN h.pool_type IN ('weapon', 'limited_weapon') THEN 'weapon'
          WHEN h.pool_type IN ('standard', 'beginner') THEN 'standard'
          ELSE NULL
        END,
        CASE
          WHEN h.pool_id IN ('standard', 'beginner') THEN 'standard'
          WHEN split_part(h.pool_id, '_', 1) = 'special' THEN 'limited'
          WHEN split_part(h.pool_id, '_', 1) IN ('weaponbox', 'weponbox') THEN 'weapon'
          WHEN h.is_standard_calc = true THEN 'standard'
          ELSE 'limited'
        END
      ) AS classified_pool_type
    FROM history_with_correct_is_standard h
    WHERE h.special_type IS DISTINCT FROM 'gift'
  ),
  standard_pulls AS (
    SELECT * FROM base_pulls WHERE classified_pool_type = 'standard'
  ),
  standard_ordered AS (
    SELECT pool_id, user_id, rarity,
           ROW_NUMBER() OVER (PARTITION BY pool_id, user_id ORDER BY record_id) as rn
    FROM standard_pulls
  ),
  standard_six_pity AS (
    SELECT pool_id, user_id,
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
      END as range_label
    FROM standard_six_pity
  ),
  standard_grouped AS (
    SELECT
      range_label,
      0 as limited_count,
      COUNT(*) as standard_count
    FROM standard_pity_ranges
    GROUP BY range_label
  )
  SELECT json_build_object(
    'total', COALESCE((SELECT COUNT(*) FROM standard_pulls), 0),
    'six', COALESCE((SELECT COUNT(*) FROM standard_pulls WHERE rarity = 6), 0),
    'sixStarLimited', 0,
    'sixStarStandard', COALESCE((SELECT COUNT(*) FROM standard_pulls WHERE rarity = 6), 0),
    'avgPity', COALESCE(ROUND((SELECT AVG(pity) FROM standard_six_pity), 1), 0),
    'counts', json_build_object(
      '6', 0,
      '6_std', COALESCE((SELECT COUNT(*) FROM standard_pulls WHERE rarity = 6), 0),
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
  -- 6. 组装最终结果（使用重新计算的 is_standard）
  -- ============================================
  WITH history_with_correct_is_standard AS (
    SELECT
      h.*,
      p.type as pool_type,
      p.up_character,
      CASE
        WHEN p.type IN ('standard', 'beginner') OR h.pool_id IN ('standard', 'beginner') THEN true
        WHEN h.rarity = 6 AND p.up_character IS NOT NULL THEN
          NOT (
            COALESCE(h.character_name, '') ILIKE '%' || p.up_character || '%' OR
            COALESCE(h.item_name, '') ILIKE '%' || p.up_character || '%' OR
            p.up_character ILIKE '%' || COALESCE(h.character_name, h.item_name, '') || '%'
          )
        ELSE COALESCE(h.is_standard, false)
      END as is_standard_calc
    FROM history h
    LEFT JOIN pools p ON h.pool_id = p.pool_id AND h.user_id = p.user_id
  )
  SELECT json_build_object(
    'totalPulls', COALESCE((SELECT COUNT(*) FROM history_with_correct_is_standard WHERE special_type IS DISTINCT FROM 'gift'), 0),
    'totalUsers', COALESCE((SELECT COUNT(*) FROM profiles), 0),
    'sixStarTotal', COALESCE((SELECT COUNT(*) FROM history_with_correct_is_standard WHERE rarity = 6), 0),
    'sixStarLimited', COALESCE((SELECT COUNT(*) FROM history_with_correct_is_standard WHERE rarity = 6 AND is_standard_calc = false), 0),
    'sixStarStandard', COALESCE((SELECT COUNT(*) FROM history_with_correct_is_standard WHERE rarity = 6 AND is_standard_calc = true), 0),
    'fiveStar', COALESCE((SELECT COUNT(*) FROM history_with_correct_is_standard WHERE rarity = 5), 0),
    'fourStar', COALESCE((SELECT COUNT(*) FROM history_with_correct_is_standard WHERE rarity <= 4), 0),
    'avgPity', ROUND(avg_pity, 1),
    'counts', json_build_object(
      '6', COALESCE((SELECT COUNT(*) FROM history_with_correct_is_standard WHERE rarity = 6 AND is_standard_calc = false), 0),
      '6_std', COALESCE((SELECT COUNT(*) FROM history_with_correct_is_standard WHERE rarity = 6 AND is_standard_calc = true), 0),
      '5', COALESCE((SELECT COUNT(*) FROM history_with_correct_is_standard WHERE rarity = 5), 0),
      '4', COALESCE((SELECT COUNT(*) FROM history_with_correct_is_standard WHERE rarity <= 4), 0)
    ),
    'distribution', global_distribution,
    'byType', json_build_object(
      'limited', limited_stats,
      'weapon', weapon_stats,
      'standard', standard_stats
    ),
    -- 赠送数量（这些仍使用原始 is_standard，因为赠送不需要重新计算）
    'charGift', COALESCE((SELECT COUNT(*) FROM history WHERE special_type = 'gift' AND rarity = 6 AND is_standard = false), 0),
    'weaponGiftLimited', COALESCE((SELECT COUNT(*) FROM history WHERE special_type = 'gift' AND rarity = 6 AND is_standard = false), 0),
    'weaponGiftStandard', COALESCE((SELECT COUNT(*) FROM history WHERE special_type = 'gift' AND rarity = 6 AND is_standard = true), 0),
    'giftTotal', COALESCE((SELECT COUNT(*) FROM history WHERE special_type = 'gift'), 0)
  ) INTO result;

  RETURN result;
END;
$$;

-- 授权所有认证用户调用此函数
GRANT EXECUTE ON FUNCTION get_global_stats() TO authenticated;
-- 也授权匿名用户（如果需要未登录也能看到统计）
GRANT EXECUTE ON FUNCTION get_global_stats() TO anon;
