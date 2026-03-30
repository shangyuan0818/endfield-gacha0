-- ============================================
-- 090: 重写 get_global_stats 的目标 6★ 间隔口径
--
-- 背景:
--   1. 088 虽已收窄目标匹配范围，但 avgPityTarget / avgPityUp 仍然沿用了
--      “上一次任意 6★ -> 下一次目标 6★” 的错误口径。
--   2. 正确口径应为“上一次目标 6★ -> 下一次目标 6★”，
--      首次目标命中不应再拿“开池到首个目标”的抽数参与平均。
--   3. 统计页超时的高风险点仍集中在 get_global_stats()；这里顺手把目标间隔链
--      收敛到更小的 6★/目标 6★ 子集，避免继续在大结果集上反复过滤。
--
-- 目标:
--   1. 限定池 / 武器池 avgPityTarget 改为“目标 6★ -> 目标 6★”间隔
--   2. avgPityUp 与 avgPityTarget 统一到同一真实口径
--   3. 保持既有返回 JSON 结构不变
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
    h.server_id,
    h.region,
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
six_star_target_matches AS MATERIALIZED (
  SELECT
    hb.pool_id,
    hb.user_id,
    hb.record_id,
    (
      lower(trim(COALESCE(NULLIF(hb.character_name, ''), NULLIF(hb.item_name, ''), ''))) <> ''
      AND (
        lower(trim(COALESCE(NULLIF(hb.character_name, ''), NULLIF(hb.item_name, ''), ''))) LIKE '%' || lower(trim(hb.up_character)) || '%'
        OR lower(trim(hb.up_character)) LIKE '%' || lower(trim(COALESCE(NULLIF(hb.character_name, ''), NULLIF(hb.item_name, ''), ''))) || '%'
      )
    ) AS is_target
  FROM history_base AS hb
  WHERE hb.rarity = 6
    AND hb.up_character IS NOT NULL
    AND hb.up_character <> ''
    AND NOT (hb.pool_type IN ('standard', 'beginner') OR hb.pool_id IN ('standard', 'beginner'))
),
history_enriched AS MATERIALIZED (
  SELECT
    hb.pool_id,
    hb.user_id,
    hb.record_id,
    hb.rarity,
    hb.server_id,
    hb.region,
    hb.special_type,
    hb.is_free,
    CASE
      WHEN hb.pool_type IN ('standard', 'beginner') OR hb.pool_id IN ('standard', 'beginner') THEN true
      WHEN hb.rarity = 6 AND hb.up_character IS NOT NULL AND hb.up_character <> '' THEN NOT COALESCE(stm.is_target, false)
      ELSE COALESCE(hb.is_standard, false)
    END AS is_standard_calc,
    CASE
      WHEN hb.rarity <> 6 THEN false
      WHEN hb.pool_type IN ('standard', 'beginner') OR hb.pool_id IN ('standard', 'beginner') THEN false
      ELSE COALESCE(stm.is_target, false)
    END AS is_target_calc,
    CASE
      WHEN hb.pool_type IN ('limited', 'limited_character') THEN 'limited'
      WHEN hb.pool_type IN ('weapon', 'limited_weapon') THEN 'weapon'
      WHEN hb.pool_type IN ('standard', 'beginner') OR hb.pool_id IN ('standard', 'beginner') THEN 'standard'
      WHEN split_part(hb.pool_id, '_', 1) = 'special' THEN 'limited'
      WHEN split_part(hb.pool_id, '_', 1) IN ('weaponbox', 'weponbox') THEN 'weapon'
      WHEN COALESCE(hb.is_standard, false) THEN 'standard'
      ELSE 'limited'
    END AS classified_pool_type
  FROM history_base AS hb
  LEFT JOIN six_star_target_matches AS stm
    ON stm.pool_id = hb.pool_id
   AND stm.user_id = hb.user_id
   AND stm.record_id = hb.record_id
),
valid_pulls AS MATERIALIZED (
  SELECT
    pool_id,
    user_id,
    record_id,
    rarity,
    server_id,
    region,
    is_standard_calc,
    is_target_calc,
    classified_pool_type
  FROM history_enriched
  WHERE special_type IS DISTINCT FROM 'gift'
    AND (is_free IS NOT TRUE)
),
contributor_regions AS MATERIALIZED (
  SELECT
    user_id,
    CASE
      WHEN bool_or(
        COALESCE(server_id, '') IN ('2', '3')
        OR lower(COALESCE(region, '')) IN ('asia', 'sea', 'jp', 'kr', 'tw', 'hk', 'mo', 'sg', 'global', 'international', 'eu', 'na', 'us')
        OR COALESCE(region, '') IN ('亚服', '亚洲', '海外', '欧服', '美服', '欧美')
      ) THEN 'intl'
      ELSE 'cn'
    END AS region_bucket
  FROM valid_pulls
  GROUP BY user_id
),
contributor_region_counts AS MATERIALIZED (
  SELECT
    COUNT(*) FILTER (WHERE region_bucket = 'cn') AS cn_contributors,
    COUNT(*) FILTER (WHERE region_bucket = 'intl') AS intl_contributors
  FROM contributor_regions
),
limited_pool_sequence AS MATERIALIZED (
  SELECT
    p.pool_id,
    LEAD(p.pool_id) OVER (
      ORDER BY COALESCE(p.start_time, p.created_at), p.pool_id
    ) AS next_pool_id
  FROM public.pools AS p
  WHERE p.type IN ('limited', 'limited_character')
),
limited_paid_pool_counts AS MATERIALIZED (
  SELECT
    vp.user_id,
    vp.pool_id,
    COUNT(*) AS paid_pull_count
  FROM valid_pulls AS vp
  WHERE vp.classified_pool_type = 'limited'
  GROUP BY vp.user_id, vp.pool_id
),
info_book_credits AS MATERIALIZED (
  SELECT
    lpc.user_id,
    lps.next_pool_id AS pool_id,
    SUM(10) AS credit_pull_count
  FROM limited_paid_pool_counts AS lpc
  JOIN limited_pool_sequence AS lps
    ON lps.pool_id = lpc.pool_id
  WHERE lps.next_pool_id IS NOT NULL
    AND lpc.paid_pull_count >= 60
  GROUP BY lpc.user_id, lps.next_pool_id
),
limited_paid_pull_order AS MATERIALIZED (
  SELECT
    vp.user_id,
    vp.pool_id,
    vp.record_id,
    ROW_NUMBER() OVER (
      PARTITION BY vp.user_id, vp.pool_id
      ORDER BY vp.record_id
    ) AS paid_pull_order
  FROM valid_pulls AS vp
  WHERE vp.classified_pool_type = 'limited'
),
info_book_pulls AS MATERIALIZED (
  SELECT
    lpo.user_id,
    lpo.pool_id,
    lpo.record_id
  FROM limited_paid_pull_order AS lpo
  JOIN info_book_credits AS ibc
    ON ibc.user_id = lpo.user_id
   AND ibc.pool_id = lpo.pool_id
  WHERE lpo.paid_pull_order <= ibc.credit_pull_count
),
charged_valid_pulls AS MATERIALIZED (
  SELECT vp.*
  FROM valid_pulls AS vp
  LEFT JOIN info_book_pulls AS ibp
    ON ibp.user_id = vp.user_id
   AND ibp.pool_id = vp.pool_id
   AND ibp.record_id = vp.record_id
  WHERE ibp.record_id IS NULL
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
charged_counts AS MATERIALIZED (
  SELECT
    COUNT(*) FILTER (WHERE classified_pool_type IN ('limited', 'standard')) AS charged_character_pulls,
    COUNT(*) FILTER (WHERE classified_pool_type = 'weapon') AS charged_weapon_pulls,
    COUNT(*) FILTER (WHERE classified_pool_type = 'limited') AS charged_limited_pulls,
    COUNT(*) FILTER (WHERE classified_pool_type = 'standard') AS charged_standard_pulls,
    COUNT(*) FILTER (WHERE classified_pool_type = 'weapon') AS charged_weapon_type_pulls,
    (SELECT COUNT(*) FROM info_book_pulls) AS info_book_pull_count
  FROM charged_valid_pulls
),
ordered_valid AS MATERIALIZED (
  SELECT
    pool_id,
    user_id,
    rarity,
    is_standard_calc,
    is_target_calc,
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
target_hit_rows AS MATERIALIZED (
  SELECT
    pool_id,
    user_id,
    classified_pool_type,
    rn
  FROM ordered_valid
  WHERE rarity = 6
    AND (
      (classified_pool_type = 'limited' AND is_target_calc = true)
      OR (classified_pool_type = 'weapon' AND is_standard_calc = false)
    )
),
limited_first_target AS MATERIALIZED (
  SELECT
    pool_id,
    user_id,
    MIN(rn) AS first_target_rn
  FROM target_hit_rows
  WHERE classified_pool_type = 'limited'
  GROUP BY pool_id, user_id
),
limited_target_hits AS MATERIALIZED (
  SELECT
    thr.pool_id,
    thr.user_id,
    thr.rn,
    CASE
      WHEN thr.rn = 120
        AND COALESCE(lft.first_target_rn, 999999) = 120
      THEN true
      ELSE false
    END AS is_spark
  FROM target_hit_rows AS thr
  LEFT JOIN limited_first_target AS lft
    ON lft.pool_id = thr.pool_id
   AND lft.user_id = thr.user_id
  WHERE thr.classified_pool_type = 'limited'
),
target_hit_intervals AS MATERIALIZED (
  SELECT
    th.classified_pool_type,
    th.pool_id,
    th.user_id,
    th.is_spark,
    th.rn - LAG(th.rn, 1) OVER (
      PARTITION BY th.pool_id, th.user_id
      ORDER BY th.rn
    ) AS pity
  FROM (
    SELECT
      lth.pool_id,
      lth.user_id,
      'limited'::TEXT AS classified_pool_type,
      lth.rn,
      lth.is_spark
    FROM limited_target_hits AS lth
    UNION ALL
    SELECT
      thr.pool_id,
      thr.user_id,
      thr.classified_pool_type,
      thr.rn,
      false AS is_spark
    FROM target_hit_rows AS thr
    WHERE thr.classified_pool_type = 'weapon'
  ) AS th
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
  SELECT ROUND(AVG(pity)::numeric, 1) AS avg_pity
  FROM six_pity
),
type_pity_stats AS MATERIALIZED (
  SELECT
    classified_pool_type,
    ROUND(AVG(pity)::numeric, 1) AS avg_pity
  FROM six_pity
  GROUP BY classified_pool_type
),
target_pity_stats AS MATERIALIZED (
  SELECT
    classified_pool_type,
    ROUND(
      (SUM(total)::numeric / NULLIF(SUM(target_count), 0)),
      1
    ) AS avg_pity_target
  FROM (
    SELECT
      tc.classified_pool_type,
      tc.total,
      (
        SELECT COUNT(*)
        FROM target_hit_rows AS thr2
        WHERE thr2.classified_pool_type = tc.classified_pool_type
      ) AS target_count
    FROM type_counts AS tc
    WHERE tc.classified_pool_type IN ('limited', 'weapon')
  ) AS sub
  GROUP BY classified_pool_type
),
limited_spark_stats AS MATERIALIZED (
  SELECT
    COUNT(DISTINCT user_id) FILTER (WHERE is_spark = true) AS spark_count
  FROM limited_target_hits
),
total_users AS MATERIALIZED (
  SELECT COUNT(*) AS total_users
  FROM public.profiles
)
SELECT json_build_object(
  'totalPulls', COALESCE(vc.total_pulls, 0),
  'totalPullsWithFree', COALESCE(hc.total_pulls_with_free, 0),
  'freePullCount', COALESCE(hc.free_pull_count, 0),
  'chargedCharacterPulls', COALESCE(cc.charged_character_pulls, 0),
  'chargedWeaponPulls', COALESCE(cc.charged_weapon_pulls, 0),
  'infoBookPullCount', COALESCE(cc.info_book_pull_count, 0),
  'totalUsers', COALESCE(tu.total_users, 0),
  'totalContributors', COALESCE(vc.total_contributors, 0),
  'contributorsByRegion', json_build_object(
    'cn', COALESCE(crc.cn_contributors, 0),
    'intl', COALESCE(crc.intl_contributors, 0)
  ),
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
      'chargedPulls', COALESCE(cc.charged_limited_pulls, 0),
      'six', COALESCE(tc_limited.six, 0),
      'sixStarLimited', COALESCE(tc_limited.six_star_limited, 0),
      'sixStarStandard', COALESCE(tc_limited.six_star_standard, 0),
      'avgPity', COALESCE(tps_limited.avg_pity, 0),
      'avgPityUp', COALESCE(tgt_limited.avg_pity_target, 0),
      'avgPityTarget', COALESCE(tgt_limited.avg_pity_target, 0),
      'sparkCount', COALESCE(lss.spark_count, 0),
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
      'chargedPulls', COALESCE(cc.charged_weapon_type_pulls, 0),
      'six', COALESCE(tc_weapon.six, 0),
      'sixStarLimited', COALESCE(tc_weapon.six_star_limited, 0),
      'sixStarStandard', COALESCE(tc_weapon.six_star_standard, 0),
      'avgPity', COALESCE(tps_weapon.avg_pity, 0),
      'avgPityUp', COALESCE(tgt_weapon.avg_pity_target, 0),
      'avgPityTarget', COALESCE(tgt_weapon.avg_pity_target, 0),
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
      'chargedPulls', COALESCE(cc.charged_standard_pulls, 0),
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
CROSS JOIN charged_counts AS cc
CROSS JOIN global_avg_pity AS gap
CROSS JOIN global_distribution AS gd
CROSS JOIN total_users AS tu
CROSS JOIN contributor_region_counts AS crc
CROSS JOIN limited_spark_stats AS lss
LEFT JOIN type_counts AS tc_limited
  ON tc_limited.classified_pool_type = 'limited'
LEFT JOIN type_counts AS tc_weapon
  ON tc_weapon.classified_pool_type = 'weapon'
LEFT JOIN type_counts AS tc_standard
  ON tc_standard.classified_pool_type = 'standard'
LEFT JOIN type_pity_stats AS tps_limited
  ON tps_limited.classified_pool_type = 'limited'
LEFT JOIN type_pity_stats AS tps_weapon
  ON tps_weapon.classified_pool_type = 'weapon'
LEFT JOIN type_pity_stats AS tps_standard
  ON tps_standard.classified_pool_type = 'standard'
LEFT JOIN target_pity_stats AS tgt_limited
  ON tgt_limited.classified_pool_type = 'limited'
LEFT JOIN target_pity_stats AS tgt_weapon
  ON tgt_weapon.classified_pool_type = 'weapon'
LEFT JOIN type_distributions AS td_limited
  ON td_limited.classified_pool_type = 'limited'
LEFT JOIN type_distributions AS td_weapon
  ON td_weapon.classified_pool_type = 'weapon'
LEFT JOIN type_distributions AS td_standard
  ON td_standard.classified_pool_type = 'standard';
$$;

GRANT EXECUTE ON FUNCTION public.get_global_stats() TO anon, authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 090: get_global_stats 已改为目标 6★ -> 目标 6★ 平均间隔';
END $$;
