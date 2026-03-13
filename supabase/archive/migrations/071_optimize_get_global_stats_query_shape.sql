-- ============================================
-- 071: 进一步优化 get_global_stats 查询形状
--
-- 背景:
--   070 已将旧版 get_global_stats() 从多段重复全表扫描
--   收敛到共享 CTE，但最终 json_build_object 仍然对
--   valid_pulls / six_pity / history_enriched 做了大量重复 scalar subquery。
--
-- 目标:
--   1. 保持返回 JSON 结构不变
--   2. 将大结果集上的重复扫描改为一次聚合
--   3. 缩窄中间 CTE 的列宽，降低 materialize / spill 成本
-- ============================================

CREATE OR REPLACE FUNCTION public.get_global_stats()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH history_base AS MATERIALIZED (
  SELECT
    h.pool_id,
    h.user_id,
    h.record_id,
    h.rarity,
    h.special_type,
    h.is_free,
    h.is_standard,
    h.character_name,
    h.item_name,
    p.type AS pool_type,
    p.up_character
  FROM public.history AS h
  LEFT JOIN public.pools AS p ON p.pool_id = h.pool_id
),
history_enriched AS MATERIALIZED (
  SELECT
    hb.pool_id,
    hb.user_id,
    hb.record_id,
    hb.rarity,
    hb.special_type,
    hb.is_free,
    CASE
      WHEN hb.pool_type IN ('standard', 'beginner') OR hb.pool_id IN ('standard', 'beginner') THEN true
      WHEN hb.rarity = 6 AND hb.up_character IS NOT NULL THEN
        NOT (
          COALESCE(hb.character_name, '') ILIKE '%' || hb.up_character || '%'
          OR COALESCE(hb.item_name, '') ILIKE '%' || hb.up_character || '%'
          OR hb.up_character ILIKE '%' || COALESCE(hb.character_name, hb.item_name, '') || '%'
        )
      ELSE COALESCE(hb.is_standard, false)
    END AS is_standard_calc,
    COALESCE(
      CASE
        WHEN hb.pool_type IN ('limited', 'limited_character') THEN 'limited'
        WHEN hb.pool_type IN ('weapon', 'limited_weapon') THEN 'weapon'
        WHEN hb.pool_type IN ('standard', 'beginner') THEN 'standard'
        ELSE NULL
      END,
      CASE
        WHEN hb.pool_id IN ('standard', 'beginner') THEN 'standard'
        WHEN split_part(hb.pool_id, '_', 1) = 'special' THEN 'limited'
        WHEN split_part(hb.pool_id, '_', 1) IN ('weaponbox', 'weponbox') THEN 'weapon'
        WHEN
          CASE
            WHEN hb.pool_type IN ('standard', 'beginner') OR hb.pool_id IN ('standard', 'beginner') THEN true
            WHEN hb.rarity = 6 AND hb.up_character IS NOT NULL THEN
              NOT (
                COALESCE(hb.character_name, '') ILIKE '%' || hb.up_character || '%'
                OR COALESCE(hb.item_name, '') ILIKE '%' || hb.up_character || '%'
                OR hb.up_character ILIKE '%' || COALESCE(hb.character_name, hb.item_name, '') || '%'
              )
            ELSE COALESCE(hb.is_standard, false)
          END
        THEN 'standard'
        ELSE 'limited'
      END
    ) AS classified_pool_type
  FROM history_base AS hb
),
valid_pulls AS MATERIALIZED (
  SELECT
    pool_id,
    user_id,
    record_id,
    rarity,
    is_standard_calc,
    classified_pool_type
  FROM history_enriched
  WHERE special_type IS DISTINCT FROM 'gift'
    AND (is_free IS NOT TRUE)
),
valid_counts AS MATERIALIZED (
  SELECT
    COUNT(*) AS total_pulls,
    COUNT(DISTINCT user_id) AS total_contributors,
    COUNT(*) FILTER (WHERE rarity = 6) AS six_star_total,
    COUNT(*) FILTER (WHERE rarity = 6 AND is_standard_calc = false) AS six_star_limited,
    COUNT(*) FILTER (WHERE rarity = 6 AND is_standard_calc = true) AS six_star_standard,
    COUNT(*) FILTER (WHERE rarity = 5) AS five_star,
    COUNT(*) FILTER (WHERE rarity <= 4) AS four_star
  FROM valid_pulls
),
history_counts AS MATERIALIZED (
  SELECT
    COUNT(*) FILTER (WHERE special_type IS DISTINCT FROM 'gift') AS total_pulls_with_free,
    COUNT(*) FILTER (WHERE special_type IS DISTINCT FROM 'gift' AND is_free = true) AS free_pull_count,
    COUNT(*) FILTER (WHERE special_type = 'gift') AS gift_total,
    COUNT(*) FILTER (
      WHERE special_type = 'gift'
        AND rarity = 6
        AND classified_pool_type = 'limited'
    ) AS char_gift,
    COUNT(*) FILTER (
      WHERE special_type = 'gift'
        AND rarity = 6
        AND classified_pool_type = 'weapon'
        AND is_standard_calc = false
    ) AS weapon_gift_limited,
    COUNT(*) FILTER (
      WHERE special_type = 'gift'
        AND rarity = 6
        AND classified_pool_type = 'weapon'
        AND is_standard_calc = true
    ) AS weapon_gift_standard
  FROM history_enriched
),
type_counts AS MATERIALIZED (
  SELECT
    classified_pool_type,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE rarity = 6) AS six,
    COUNT(*) FILTER (WHERE rarity = 6 AND is_standard_calc = false) AS six_star_limited,
    COUNT(*) FILTER (WHERE rarity = 6 AND is_standard_calc = true) AS six_star_standard,
    COUNT(*) FILTER (WHERE rarity = 5) AS five,
    COUNT(*) FILTER (WHERE rarity <= 4) AS four
  FROM valid_pulls
  GROUP BY classified_pool_type
),
ordered_valid AS MATERIALIZED (
  SELECT
    pool_id,
    user_id,
    rarity,
    is_standard_calc,
    classified_pool_type,
    record_id,
    ROW_NUMBER() OVER (PARTITION BY pool_id, user_id ORDER BY record_id) AS rn
  FROM valid_pulls
),
six_pity AS MATERIALIZED (
  SELECT
    pool_id,
    user_id,
    is_standard_calc,
    classified_pool_type,
    rn,
    LEAST(
      rn - COALESCE(LAG(rn, 1) OVER (PARTITION BY pool_id, user_id ORDER BY rn), 0),
      80
    ) AS pity
  FROM ordered_valid
  WHERE rarity = 6
),
limited_first_up AS MATERIALIZED (
  SELECT
    pool_id,
    user_id,
    MIN(rn) FILTER (WHERE is_standard_calc = false) AS first_up_rn
  FROM six_pity
  WHERE classified_pool_type = 'limited'
  GROUP BY pool_id, user_id
),
limited_six_pity AS MATERIALIZED (
  SELECT
    sp.pool_id,
    sp.user_id,
    sp.is_standard_calc,
    sp.rn,
    sp.pity,
    CASE
      WHEN sp.is_standard_calc = false
        AND sp.rn = 120
        AND COALESCE(lfu.first_up_rn, 999999) = 120
      THEN true
      ELSE false
    END AS is_spark
  FROM six_pity AS sp
  LEFT JOIN limited_first_up AS lfu
    ON lfu.pool_id = sp.pool_id
   AND lfu.user_id = sp.user_id
  WHERE sp.classified_pool_type = 'limited'
),
pity_ranges AS MATERIALIZED (
  SELECT
    classified_pool_type,
    is_standard_calc,
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
    END AS range_label
  FROM six_pity
),
global_distribution_rows AS MATERIALIZED (
  SELECT
    range_label,
    COUNT(*) FILTER (WHERE is_standard_calc = false) AS limited_count,
    COUNT(*) FILTER (WHERE is_standard_calc = true) AS standard_count
  FROM pity_ranges
  GROUP BY range_label
),
type_distribution_rows AS MATERIALIZED (
  SELECT
    classified_pool_type,
    range_label,
    COUNT(*) FILTER (WHERE is_standard_calc = false) AS limited_count,
    COUNT(*) FILTER (WHERE is_standard_calc = true) AS standard_count
  FROM pity_ranges
  GROUP BY classified_pool_type, range_label
),
global_distribution AS MATERIALIZED (
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'range', REPLACE(range_label, '01-10', '1-10'),
        'limited', limited_count,
        'standard', standard_count
      )
      ORDER BY range_label
    ),
    '[]'::json
  ) AS distribution
  FROM global_distribution_rows
),
type_distributions AS MATERIALIZED (
  SELECT
    classified_pool_type,
    COALESCE(
      json_agg(
        json_build_object(
          'range', REPLACE(range_label, '01-10', '1-10'),
          'limited', limited_count,
          'standard', standard_count
        )
        ORDER BY range_label
      ),
      '[]'::json
    ) AS distribution
  FROM type_distribution_rows
  GROUP BY classified_pool_type
),
global_avg_pity AS MATERIALIZED (
  SELECT COALESCE(ROUND(AVG(pity)::numeric, 1), 0) AS avg_pity
  FROM six_pity
),
type_pity_stats AS MATERIALIZED (
  SELECT
    classified_pool_type,
    COALESCE(ROUND(AVG(pity)::numeric, 1), 0) AS avg_pity,
    COALESCE(ROUND(AVG(pity) FILTER (WHERE is_standard_calc = false)::numeric, 1), 0) AS avg_pity_up
  FROM six_pity
  GROUP BY classified_pool_type
),
limited_pity_stats AS MATERIALIZED (
  SELECT
    COALESCE(ROUND(AVG(pity)::numeric, 1), 0) AS avg_pity,
    COALESCE(ROUND(AVG(pity) FILTER (WHERE is_standard_calc = false AND NOT is_spark)::numeric, 1), 0) AS avg_pity_up,
    COUNT(DISTINCT user_id) FILTER (WHERE is_spark = true) AS spark_count
  FROM limited_six_pity
),
total_users AS MATERIALIZED (
  SELECT COUNT(*) AS total_users
  FROM public.profiles
)
SELECT json_build_object(
  'totalPulls', COALESCE(vc.total_pulls, 0),
  'totalPullsWithFree', COALESCE(hc.total_pulls_with_free, 0),
  'freePullCount', COALESCE(hc.free_pull_count, 0),
  'totalUsers', COALESCE(tu.total_users, 0),
  'totalContributors', COALESCE(vc.total_contributors, 0),
  'sixStarTotal', COALESCE(vc.six_star_total, 0),
  'sixStarLimited', COALESCE(vc.six_star_limited, 0),
  'sixStarStandard', COALESCE(vc.six_star_standard, 0),
  'fiveStar', COALESCE(vc.five_star, 0),
  'fourStar', COALESCE(vc.four_star, 0),
  'avgPity', COALESCE(gap.avg_pity, 0),
  'counts', json_build_object(
    '6', COALESCE(vc.six_star_limited, 0),
    '6_std', COALESCE(vc.six_star_standard, 0),
    '5', COALESCE(vc.five_star, 0),
    '4', COALESCE(vc.four_star, 0)
  ),
  'distribution', COALESCE(gd.distribution, '[]'::json),
  'byType', json_build_object(
    'limited', json_build_object(
      'total', COALESCE(tc_limited.total, 0),
      'six', COALESCE(tc_limited.six, 0),
      'sixStarLimited', COALESCE(tc_limited.six_star_limited, 0),
      'sixStarStandard', COALESCE(tc_limited.six_star_standard, 0),
      'avgPity', COALESCE(lps.avg_pity, 0),
      'avgPityUp', COALESCE(lps.avg_pity_up, 0),
      'sparkCount', COALESCE(lps.spark_count, 0),
      'counts', json_build_object(
        '6', COALESCE(tc_limited.six_star_limited, 0),
        '6_std', COALESCE(tc_limited.six_star_standard, 0),
        '5', COALESCE(tc_limited.five, 0),
        '4', COALESCE(tc_limited.four, 0)
      ),
      'distribution', COALESCE(td_limited.distribution, '[]'::json)
    ),
    'weapon', json_build_object(
      'total', COALESCE(tc_weapon.total, 0),
      'six', COALESCE(tc_weapon.six, 0),
      'sixStarLimited', COALESCE(tc_weapon.six_star_limited, 0),
      'sixStarStandard', COALESCE(tc_weapon.six_star_standard, 0),
      'avgPity', COALESCE(tps_weapon.avg_pity, 0),
      'avgPityUp', COALESCE(tps_weapon.avg_pity_up, 0),
      'counts', json_build_object(
        '6', COALESCE(tc_weapon.six_star_limited, 0),
        '6_std', COALESCE(tc_weapon.six_star_standard, 0),
        '5', COALESCE(tc_weapon.five, 0),
        '4', COALESCE(tc_weapon.four, 0)
      ),
      'distribution', COALESCE(td_weapon.distribution, '[]'::json)
    ),
    'standard', json_build_object(
      'total', COALESCE(tc_standard.total, 0),
      'six', COALESCE(tc_standard.six, 0),
      'sixStarLimited', 0,
      'sixStarStandard', COALESCE(tc_standard.six, 0),
      'avgPity', COALESCE(tps_standard.avg_pity, 0),
      'counts', json_build_object(
        '6', 0,
        '6_std', COALESCE(tc_standard.six, 0),
        '5', COALESCE(tc_standard.five, 0),
        '4', COALESCE(tc_standard.four, 0)
      ),
      'distribution', COALESCE(td_standard.distribution, '[]'::json)
    )
  ),
  'charGift', COALESCE(hc.char_gift, 0),
  'weaponGiftLimited', COALESCE(hc.weapon_gift_limited, 0),
  'weaponGiftStandard', COALESCE(hc.weapon_gift_standard, 0),
  'giftTotal', COALESCE(hc.gift_total, 0)
)
FROM valid_counts AS vc
CROSS JOIN history_counts AS hc
CROSS JOIN global_avg_pity AS gap
CROSS JOIN global_distribution AS gd
CROSS JOIN limited_pity_stats AS lps
CROSS JOIN total_users AS tu
LEFT JOIN type_counts AS tc_limited
  ON tc_limited.classified_pool_type = 'limited'
LEFT JOIN type_counts AS tc_weapon
  ON tc_weapon.classified_pool_type = 'weapon'
LEFT JOIN type_counts AS tc_standard
  ON tc_standard.classified_pool_type = 'standard'
LEFT JOIN type_pity_stats AS tps_weapon
  ON tps_weapon.classified_pool_type = 'weapon'
LEFT JOIN type_pity_stats AS tps_standard
  ON tps_standard.classified_pool_type = 'standard'
LEFT JOIN type_distributions AS td_limited
  ON td_limited.classified_pool_type = 'limited'
LEFT JOIN type_distributions AS td_weapon
  ON td_weapon.classified_pool_type = 'weapon'
LEFT JOIN type_distributions AS td_standard
  ON td_standard.classified_pool_type = 'standard';
$$;

GRANT EXECUTE ON FUNCTION public.get_global_stats() TO anon, authenticated;
