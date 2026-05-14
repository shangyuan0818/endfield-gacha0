-- 109: include extra / Joint recruitment pools in stats RPCs.
--
-- FEAT-028 introduced the explicit `extra` pool type for the 2026-05-14
-- Joint recruitment banner. Earlier stats RPCs still classified unknown
-- pool IDs as limited/standard and only returned limited/weapon/standard
-- buckets. This migration makes the reporting contract explicit:
--   - pools.type = 'extra', pool_id joint_*, and pool_id extra_* => extra
--   - every 6-star character in extra pools is counted as a target 6-star
--   - extra remains a separate byType/ranking bucket and also contributes
--     to aggregate character-pool stats on the client
--   - 120-pull spark/info-book logic remains limited-pool only

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
    AND NOT (hb.pool_type = 'extra' OR hb.pool_id LIKE 'joint_%' OR hb.pool_id LIKE 'extra_%')
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
      WHEN hb.rarity = 6 AND (hb.pool_type = 'extra' OR hb.pool_id LIKE 'joint_%' OR hb.pool_id LIKE 'extra_%') THEN false
      WHEN hb.rarity = 6 AND hb.up_character IS NOT NULL AND hb.up_character <> '' THEN NOT COALESCE(stm.is_target, false)
      ELSE COALESCE(hb.is_standard, false)
    END AS is_standard_calc,
    CASE
      WHEN hb.rarity <> 6 THEN false
      WHEN hb.pool_type IN ('standard', 'beginner') OR hb.pool_id IN ('standard', 'beginner') THEN false
      WHEN hb.pool_type = 'extra' OR hb.pool_id LIKE 'joint_%' OR hb.pool_id LIKE 'extra_%' THEN true
      ELSE COALESCE(stm.is_target, false)
    END AS is_target_calc,
    CASE
      WHEN hb.pool_type = 'extra' OR hb.pool_id LIKE 'joint_%' OR hb.pool_id LIKE 'extra_%' THEN 'extra'
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
        OR COALESCE(region, '') IN ('intl')
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
info_book_pull_total AS MATERIALIZED (
  SELECT COALESCE(SUM(
    LEAST(ibc.credit_pull_count, COALESCE(next_pool.paid_pull_count, 0))
  ), 0) AS info_book_pull_count
  FROM info_book_credits AS ibc
  LEFT JOIN limited_paid_pool_counts AS next_pool
    ON next_pool.user_id = ibc.user_id
   AND next_pool.pool_id = ibc.pool_id
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
valid_counts AS (
  SELECT
    COALESCE(SUM(total), 0) AS total_pulls,
    (SELECT COUNT(*) FROM contributor_regions) AS total_contributors,
    COALESCE(SUM(six), 0) AS six_star_total,
    COALESCE(SUM(six_star_limited), 0) AS six_star_limited,
    COALESCE(SUM(six_star_standard), 0) AS six_star_standard,
    COALESCE(SUM(five), 0) AS five_star,
    COALESCE(SUM(four), 0) AS four_star
  FROM type_counts
),
charged_counts AS (
  SELECT
    COALESCE(tc_extra.total, 0) + COALESCE(tc_l.total, 0) - ibt.info_book_pull_count + COALESCE(tc_s.total, 0) AS charged_character_pulls,
    COALESCE(tc_w.total, 0) AS charged_weapon_pulls,
    COALESCE(tc_extra.total, 0) AS charged_extra_pulls,
    COALESCE(tc_l.total, 0) - ibt.info_book_pull_count AS charged_limited_pulls,
    COALESCE(tc_s.total, 0) AS charged_standard_pulls,
    COALESCE(tc_w.total, 0) AS charged_weapon_type_pulls,
    ibt.info_book_pull_count
  FROM info_book_pull_total AS ibt
  LEFT JOIN type_counts AS tc_extra ON tc_extra.classified_pool_type = 'extra'
  LEFT JOIN type_counts AS tc_l ON tc_l.classified_pool_type = 'limited'
  LEFT JOIN type_counts AS tc_s ON tc_s.classified_pool_type = 'standard'
  LEFT JOIN type_counts AS tc_w ON tc_w.classified_pool_type = 'weapon'
),
six_star_pity AS MATERIALIZED (
  SELECT
    pool_id,
    user_id,
    is_standard_calc,
    is_target_calc,
    classified_pool_type,
    rn,
    LEAST(
      rn - COALESCE(LAG(rn) OVER (PARTITION BY pool_id, user_id ORDER BY rn), 0),
      80
    ) AS pity
  FROM (
    SELECT
      pool_id, user_id, rarity, is_standard_calc, is_target_calc, classified_pool_type,
      ROW_NUMBER() OVER (PARTITION BY pool_id, user_id ORDER BY record_id) AS rn
    FROM valid_pulls
  ) AS all_numbered
  WHERE rarity = 6
),
target_hit_rows AS MATERIALIZED (
  SELECT
    pool_id,
    user_id,
    classified_pool_type,
    rn
  FROM six_star_pity
  WHERE (classified_pool_type IN ('extra', 'limited') AND is_target_calc = true)
     OR (classified_pool_type = 'weapon' AND is_standard_calc = false)
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
target_hit_counts AS MATERIALIZED (
  SELECT
    classified_pool_type,
    COUNT(*) AS target_count
  FROM target_hit_rows
  GROUP BY classified_pool_type
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
  FROM six_star_pity
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
  FROM six_star_pity
),
type_pity_stats AS MATERIALIZED (
  SELECT
    classified_pool_type,
    ROUND(AVG(pity)::numeric, 1) AS avg_pity
  FROM six_star_pity
  GROUP BY classified_pool_type
),
target_pity_stats AS MATERIALIZED (
  SELECT
    tc.classified_pool_type,
    ROUND(
      tc.total::numeric / NULLIF(thc.target_count, 0),
      1
    ) AS avg_pity_target
  FROM type_counts AS tc
  JOIN target_hit_counts AS thc
    ON thc.classified_pool_type = tc.classified_pool_type
  WHERE tc.classified_pool_type IN ('extra', 'limited', 'weapon')
),
limited_spark_stats AS MATERIALIZED (
  SELECT
    COUNT(*) FILTER (WHERE is_spark = true) AS spark_count
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
    'extra', json_build_object(
      'total', COALESCE(tc_extra.total, 0),
      'chargedPulls', COALESCE(cc.charged_extra_pulls, 0),
      'six', COALESCE(tc_extra.six, 0),
      'sixStarLimited', COALESCE(tc_extra.six_star_limited, 0),
      'sixStarStandard', COALESCE(tc_extra.six_star_standard, 0),
      'avgPity', COALESCE(tps_extra.avg_pity, 0),
      'avgPityUp', COALESCE(tgt_extra.avg_pity_target, 0),
      'avgPityTarget', COALESCE(tgt_extra.avg_pity_target, 0),
      'sparkCount', 0,
      'counts', json_build_object(
        '6', COALESCE(tc_extra.six_star_limited, 0),
        '6_std', COALESCE(tc_extra.six_star_standard, 0),
        '5', COALESCE(tc_extra.five, 0),
        '4', COALESCE(tc_extra.four, 0)
      ),
      'distribution', COALESCE(td_extra.distribution, '[]'::json)
    ),
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
LEFT JOIN type_counts AS tc_extra
  ON tc_extra.classified_pool_type = 'extra'
LEFT JOIN type_counts AS tc_limited
  ON tc_limited.classified_pool_type = 'limited'
LEFT JOIN type_counts AS tc_weapon
  ON tc_weapon.classified_pool_type = 'weapon'
LEFT JOIN type_counts AS tc_standard
  ON tc_standard.classified_pool_type = 'standard'
LEFT JOIN type_pity_stats AS tps_extra
  ON tps_extra.classified_pool_type = 'extra'
LEFT JOIN type_pity_stats AS tps_limited
  ON tps_limited.classified_pool_type = 'limited'
LEFT JOIN type_pity_stats AS tps_weapon
  ON tps_weapon.classified_pool_type = 'weapon'
LEFT JOIN type_pity_stats AS tps_standard
  ON tps_standard.classified_pool_type = 'standard'
LEFT JOIN target_pity_stats AS tgt_extra
  ON tgt_extra.classified_pool_type = 'extra'
LEFT JOIN target_pity_stats AS tgt_limited
  ON tgt_limited.classified_pool_type = 'limited'
LEFT JOIN target_pity_stats AS tgt_weapon
  ON tgt_weapon.classified_pool_type = 'weapon'
LEFT JOIN type_distributions AS td_extra
  ON td_extra.classified_pool_type = 'extra'
LEFT JOIN type_distributions AS td_limited
  ON td_limited.classified_pool_type = 'limited'
LEFT JOIN type_distributions AS td_weapon
  ON td_weapon.classified_pool_type = 'weapon'
LEFT JOIN type_distributions AS td_standard
  ON td_standard.classified_pool_type = 'standard';
$$;

GRANT EXECUTE ON FUNCTION public.get_global_stats() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_character_ranking_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  WITH
  history_with_info AS (
    SELECT
      h.rarity,
      COALESCE(NULLIF(h.item_name, ''), NULLIF(h.character_name, '')) AS item_name,
      h.is_free,
      h.special_type,
      h.pool_id,
      COALESCE(c.type, 'character') as item_type,
      COALESCE(c.is_limited, false) as char_is_limited,
      p.up_character as pool_up_character,
      CASE
        WHEN h.pool_id LIKE 'joint_%' OR h.pool_id LIKE 'extra_%' THEN 'extra'
        WHEN h.pool_id LIKE 'special_%' THEN 'limited'
        WHEN h.pool_id LIKE 'weapon%' OR h.pool_id LIKE 'wepon%' THEN 'weapon'
        WHEN h.pool_id IN ('standard', 'beginner') THEN 'standard'
        WHEN p.type IS NOT NULL THEN
          CASE
            WHEN p.type = 'extra' THEN 'extra'
            WHEN p.type IN ('limited', 'limited_character') THEN 'limited'
            WHEN p.type IN ('weapon', 'limited_weapon') THEN 'weapon'
            ELSE 'standard'
          END
        ELSE 'standard'
      END as pool_type
    FROM public.history h
    LEFT JOIN public.pools p ON p.pool_id = h.pool_id
    LEFT JOIN public.characters c
      ON c.name = COALESCE(NULLIF(h.item_name, ''), NULLIF(h.character_name, ''))
    WHERE h.special_type IS DISTINCT FROM 'gift'
      AND COALESCE(NULLIF(h.item_name, ''), NULLIF(h.character_name, '')) IS NOT NULL
  ),
  history_classified AS (
    SELECT *,
      CASE
        WHEN pool_type = 'extra' AND rarity = 6 THEN 'up'
        WHEN rarity = 6 AND char_is_limited = true THEN
          CASE
            WHEN pool_up_character IS NOT NULL
              AND (
                LOWER(item_name) = LOWER(pool_up_character)
                OR LOWER(item_name) LIKE '%' || LOWER(pool_up_character) || '%'
                OR LOWER(pool_up_character) LIKE '%' || LOWER(item_name) || '%'
              )
            THEN 'up'
            ELSE 'off_limited'
          END
        WHEN rarity = 6 AND char_is_limited = false THEN 'off_standard'
        ELSE 'other'
      END as six_star_category
    FROM history_with_info
  ),
  extra_six_star_up AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'extra'
      AND rarity = 6
      AND item_type = 'character'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 6
  ),
  extra_five_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'extra'
      AND rarity = 5
      AND item_type = 'character'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),
  limited_six_star_up AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'limited'
      AND rarity = 6
      AND item_type = 'character'
      AND six_star_category = 'up'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 6
  ),
  limited_six_star_off_standard AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'limited'
      AND rarity = 6
      AND item_type = 'character'
      AND six_star_category = 'off_standard'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 5
  ),
  limited_six_star_off_limited AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'limited'
      AND rarity = 6
      AND item_type = 'character'
      AND six_star_category = 'off_limited'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 5
  ),
  limited_five_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'limited'
      AND rarity = 5
      AND item_type = 'character'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),
  standard_six_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'standard'
      AND rarity = 6
      AND item_type = 'character'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 5
  ),
  standard_five_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'standard'
      AND rarity = 5
      AND item_type = 'character'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),
  weapon_six_star_up AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'weapon'
      AND rarity = 6
      AND item_type = 'weapon'
      AND six_star_category = 'up'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),
  weapon_six_star_off AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'weapon'
      AND rarity = 6
      AND item_type = 'weapon'
      AND six_star_category IN ('off_standard', 'off_limited')
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),
  weapon_five_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'weapon'
      AND rarity = 5
      AND item_type = 'weapon'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),
  extra_six_counts AS (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_free = false OR is_free IS NULL) as excluding_free
    FROM history_classified
    WHERE pool_type = 'extra'
      AND rarity = 6
      AND item_type = 'character'
  ),
  limited_six_counts AS (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_free = false OR is_free IS NULL) as excluding_free,
      COUNT(*) FILTER (WHERE six_star_category = 'up') as up_count,
      COUNT(*) FILTER (WHERE six_star_category IN ('off_standard', 'off_limited')) as off_count,
      COUNT(*) FILTER (WHERE six_star_category = 'off_standard') as off_standard_count,
      COUNT(*) FILTER (WHERE six_star_category = 'off_limited') as off_limited_count,
      COUNT(*) FILTER (WHERE six_star_category = 'up' AND (is_free = false OR is_free IS NULL)) as up_excluding_free,
      COUNT(*) FILTER (WHERE six_star_category IN ('off_standard', 'off_limited') AND (is_free = false OR is_free IS NULL)) as off_excluding_free,
      COUNT(*) FILTER (WHERE six_star_category = 'off_standard' AND (is_free = false OR is_free IS NULL)) as off_standard_excluding_free,
      COUNT(*) FILTER (WHERE six_star_category = 'off_limited' AND (is_free = false OR is_free IS NULL)) as off_limited_excluding_free
    FROM history_classified
    WHERE pool_type = 'limited'
      AND rarity = 6
      AND item_type = 'character'
  ),
  standard_six_counts AS (
    SELECT COUNT(*) as total
    FROM history_classified
    WHERE pool_type = 'standard'
      AND rarity = 6
      AND item_type = 'character'
  ),
  weapon_six_counts AS (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE six_star_category = 'up') as up_count,
      COUNT(*) FILTER (WHERE six_star_category IN ('off_standard', 'off_limited')) as off_count
    FROM history_classified
    WHERE pool_type = 'weapon'
      AND rarity = 6
      AND item_type = 'weapon'
  )
  SELECT json_build_object(
    'extra', json_build_object(
      'sixStarUp', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM extra_six_star_up),
      'sixStarOff', '[]'::json,
      'sixStarOffLimited', '[]'::json,
      'sixStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM extra_six_star_up),
      'fiveStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM extra_five_star),
      'sixStarTotal', (SELECT COALESCE(total, 0) FROM extra_six_counts),
      'sixStarExcludingFree', (SELECT COALESCE(excluding_free, 0) FROM extra_six_counts),
      'sixStarUpCount', (SELECT COALESCE(total, 0) FROM extra_six_counts),
      'sixStarOffCount', 0,
      'sixStarOffStandardCount', 0,
      'sixStarOffLimitedCount', 0,
      'sixStarUpExcludingFree', (SELECT COALESCE(excluding_free, 0) FROM extra_six_counts),
      'sixStarOffExcludingFree', 0,
      'sixStarOffStandardExcludingFree', 0,
      'sixStarOffLimitedExcludingFree', 0
    ),
    'limited', json_build_object(
      'sixStarUp', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_six_star_up),
      'sixStarOff', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_six_star_off_standard),
      'sixStarOffLimited', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_six_star_off_limited),
      'sixStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_six_star_up),
      'fiveStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_five_star),
      'sixStarTotal', (SELECT COALESCE(total, 0) FROM limited_six_counts),
      'sixStarExcludingFree', (SELECT COALESCE(excluding_free, 0) FROM limited_six_counts),
      'sixStarUpCount', (SELECT COALESCE(up_count, 0) FROM limited_six_counts),
      'sixStarOffCount', (SELECT COALESCE(off_count, 0) FROM limited_six_counts),
      'sixStarOffStandardCount', (SELECT COALESCE(off_standard_count, 0) FROM limited_six_counts),
      'sixStarOffLimitedCount', (SELECT COALESCE(off_limited_count, 0) FROM limited_six_counts),
      'sixStarUpExcludingFree', (SELECT COALESCE(up_excluding_free, 0) FROM limited_six_counts),
      'sixStarOffExcludingFree', (SELECT COALESCE(off_excluding_free, 0) FROM limited_six_counts),
      'sixStarOffStandardExcludingFree', (SELECT COALESCE(off_standard_excluding_free, 0) FROM limited_six_counts),
      'sixStarOffLimitedExcludingFree', (SELECT COALESCE(off_limited_excluding_free, 0) FROM limited_six_counts)
    ),
    'standard', json_build_object(
      'sixStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM standard_six_star),
      'fiveStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM standard_five_star),
      'sixStarTotal', (SELECT COALESCE(total, 0) FROM standard_six_counts)
    ),
    'weapon', json_build_object(
      'sixStarUp', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM weapon_six_star_up),
      'sixStarOff', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM weapon_six_star_off),
      'sixStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM weapon_six_star_up),
      'fiveStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM weapon_five_star),
      'sixStarTotal', (SELECT COALESCE(total, 0) FROM weapon_six_counts),
      'sixStarUpCount', (SELECT COALESCE(up_count, 0) FROM weapon_six_counts),
      'sixStarOffCount', (SELECT COALESCE(off_count, 0) FROM weapon_six_counts)
    )
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_character_ranking_stats() IS 'FEAT-028: character ranking stats include extra / Joint recruitment pools';
GRANT EXECUTE ON FUNCTION public.get_character_ranking_stats() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_user_ranking_stats(p_user_id uuid)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  WITH
  history_with_info AS (
    SELECT
      h.rarity,
      COALESCE(NULLIF(h.item_name, ''), NULLIF(h.character_name, '')) AS item_name,
      h.is_free,
      h.special_type,
      h.pool_id,
      COALESCE(c.type, 'character') as item_type,
      COALESCE(c.is_limited, false) as char_is_limited,
      p.up_character as pool_up_character,
      CASE
        WHEN h.pool_id LIKE 'joint_%' OR h.pool_id LIKE 'extra_%' THEN 'extra'
        WHEN h.pool_id LIKE 'special_%' THEN 'limited'
        WHEN h.pool_id LIKE 'weapon%' OR h.pool_id LIKE 'wepon%' THEN 'weapon'
        WHEN h.pool_id IN ('standard', 'beginner') THEN 'standard'
        WHEN p.type IS NOT NULL THEN
          CASE
            WHEN p.type = 'extra' THEN 'extra'
            WHEN p.type IN ('limited', 'limited_character') THEN 'limited'
            WHEN p.type IN ('weapon', 'limited_weapon') THEN 'weapon'
            ELSE 'standard'
          END
        ELSE 'standard'
      END as pool_type
    FROM public.history h
    LEFT JOIN public.pools p ON p.pool_id = h.pool_id
    LEFT JOIN public.characters c
      ON c.name = COALESCE(NULLIF(h.item_name, ''), NULLIF(h.character_name, ''))
    WHERE h.user_id = p_user_id
      AND h.special_type IS DISTINCT FROM 'gift'
      AND COALESCE(NULLIF(h.item_name, ''), NULLIF(h.character_name, '')) IS NOT NULL
  ),
  history_classified AS (
    SELECT *,
      CASE
        WHEN pool_type = 'extra' AND rarity = 6 THEN 'up'
        WHEN rarity = 6 AND char_is_limited = true THEN
          CASE
            WHEN pool_up_character IS NOT NULL
              AND (
                LOWER(item_name) = LOWER(pool_up_character)
                OR LOWER(item_name) LIKE '%' || LOWER(pool_up_character) || '%'
                OR LOWER(pool_up_character) LIKE '%' || LOWER(item_name) || '%'
              )
            THEN 'up'
            ELSE 'off_limited'
          END
        WHEN rarity = 6 AND char_is_limited = false THEN 'off_standard'
        ELSE 'other'
      END as six_star_category
    FROM history_with_info
  ),
  extra_six_star_up AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'extra' AND rarity = 6 AND item_type = 'character'
    GROUP BY item_name ORDER BY count DESC LIMIT 6
  ),
  extra_five_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'extra' AND rarity = 5 AND item_type = 'character'
    GROUP BY item_name ORDER BY count DESC LIMIT 3
  ),
  limited_six_star_up AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'limited' AND rarity = 6 AND item_type = 'character'
      AND six_star_category = 'up'
    GROUP BY item_name ORDER BY count DESC LIMIT 6
  ),
  limited_six_star_off_standard AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'limited' AND rarity = 6 AND item_type = 'character'
      AND six_star_category = 'off_standard'
    GROUP BY item_name ORDER BY count DESC LIMIT 5
  ),
  limited_six_star_off_limited AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'limited' AND rarity = 6 AND item_type = 'character'
      AND six_star_category = 'off_limited'
    GROUP BY item_name ORDER BY count DESC LIMIT 5
  ),
  limited_five_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'limited' AND rarity = 5 AND item_type = 'character'
    GROUP BY item_name ORDER BY count DESC LIMIT 3
  ),
  standard_six_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'standard' AND rarity = 6 AND item_type = 'character'
    GROUP BY item_name ORDER BY count DESC LIMIT 5
  ),
  standard_five_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'standard' AND rarity = 5 AND item_type = 'character'
    GROUP BY item_name ORDER BY count DESC LIMIT 3
  ),
  weapon_six_star_up AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'weapon' AND rarity = 6 AND item_type = 'weapon'
      AND six_star_category = 'up'
    GROUP BY item_name ORDER BY count DESC LIMIT 3
  ),
  weapon_six_star_off AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'weapon' AND rarity = 6 AND item_type = 'weapon'
      AND six_star_category IN ('off_standard', 'off_limited')
    GROUP BY item_name ORDER BY count DESC LIMIT 3
  ),
  weapon_five_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_classified
    WHERE pool_type = 'weapon' AND rarity = 5 AND item_type = 'weapon'
    GROUP BY item_name ORDER BY count DESC LIMIT 3
  ),
  extra_six_counts AS (
    SELECT COUNT(*) as total
    FROM history_classified
    WHERE pool_type = 'extra' AND rarity = 6 AND item_type = 'character'
  ),
  limited_six_counts AS (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE six_star_category = 'up') as up_count,
      COUNT(*) FILTER (WHERE six_star_category IN ('off_standard', 'off_limited')) as off_count,
      COUNT(*) FILTER (WHERE six_star_category = 'off_standard') as off_standard_count,
      COUNT(*) FILTER (WHERE six_star_category = 'off_limited') as off_limited_count
    FROM history_classified
    WHERE pool_type = 'limited' AND rarity = 6 AND item_type = 'character'
  ),
  weapon_six_counts AS (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE six_star_category = 'up') as up_count,
      COUNT(*) FILTER (WHERE six_star_category IN ('off_standard', 'off_limited')) as off_count
    FROM history_classified
    WHERE pool_type = 'weapon' AND rarity = 6 AND item_type = 'weapon'
  )
  SELECT json_build_object(
    'extra', json_build_object(
      'sixStarUp', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM extra_six_star_up),
      'sixStarOff', '[]'::json,
      'sixStarOffLimited', '[]'::json,
      'sixStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM extra_six_star_up),
      'fiveStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM extra_five_star),
      'sixStarUpCount', (SELECT COALESCE(total, 0) FROM extra_six_counts),
      'sixStarOffCount', 0,
      'sixStarOffStandardCount', 0,
      'sixStarOffLimitedCount', 0
    ),
    'limited', json_build_object(
      'sixStarUp', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_six_star_up),
      'sixStarOff', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_six_star_off_standard),
      'sixStarOffLimited', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_six_star_off_limited),
      'sixStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_six_star_up),
      'fiveStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_five_star),
      'sixStarUpCount', (SELECT COALESCE(up_count, 0) FROM limited_six_counts),
      'sixStarOffCount', (SELECT COALESCE(off_count, 0) FROM limited_six_counts),
      'sixStarOffStandardCount', (SELECT COALESCE(off_standard_count, 0) FROM limited_six_counts),
      'sixStarOffLimitedCount', (SELECT COALESCE(off_limited_count, 0) FROM limited_six_counts)
    ),
    'standard', json_build_object(
      'sixStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM standard_six_star),
      'fiveStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM standard_five_star)
    ),
    'weapon', json_build_object(
      'sixStarUp', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM weapon_six_star_up),
      'sixStarOff', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM weapon_six_star_off),
      'sixStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM weapon_six_star_up),
      'fiveStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM weapon_five_star),
      'sixStarUpCount', (SELECT COALESCE(up_count, 0) FROM weapon_six_counts),
      'sixStarOffCount', (SELECT COALESCE(off_count, 0) FROM weapon_six_counts)
    )
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_user_ranking_stats(uuid) IS 'FEAT-028: user ranking stats include extra / Joint recruitment pools';
GRANT EXECUTE ON FUNCTION public.get_user_ranking_stats(uuid) TO anon, authenticated;

DELETE FROM public.stats_cache
WHERE cache_key IN (
    'global_stats',
    'global_stats:v2',
    'character_ranking',
    'character_ranking:v2',
    'character_ranking:v3'
  )
   OR cache_key LIKE 'user_ranking:%'
   OR cache_key LIKE 'user_ranking:v2:%'
   OR cache_key LIKE 'user_ranking:v3:%';

CREATE OR REPLACE FUNCTION public.get_global_stats_cached(
  p_buffer_seconds INT DEFAULT 300
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count BIGINT;
  v_cached_data   JSONB;
  v_cached_fp     BIGINT;
  v_cached_at     TIMESTAMPTZ;
  v_result        JSON;
  v_max_ttl       INTERVAL := INTERVAL '24 hours';
  v_cache_key     TEXT := 'global_stats:v2';
BEGIN
  SELECT count(*) INTO v_current_count FROM public.history;

  SELECT cached_data, row_fingerprint, computed_at
    INTO v_cached_data, v_cached_fp, v_cached_at
    FROM public.stats_cache
   WHERE cache_key = v_cache_key;

  IF v_cached_data IS NOT NULL THEN
    IF v_cached_fp = v_current_count
       AND v_cached_at + v_max_ttl > now() THEN
      RETURN v_cached_data::JSON;
    END IF;

    IF v_cached_fp <> v_current_count
       AND v_cached_at + (p_buffer_seconds || ' seconds')::INTERVAL > now() THEN
      RETURN v_cached_data::JSON;
    END IF;
  END IF;

  SELECT public.get_global_stats() INTO v_result;

  INSERT INTO public.stats_cache (cache_key, cached_data, row_fingerprint, computed_at)
  VALUES (v_cache_key, v_result::JSONB, v_current_count, now())
  ON CONFLICT (cache_key) DO UPDATE SET
    cached_data     = EXCLUDED.cached_data,
    row_fingerprint = EXCLUDED.row_fingerprint,
    computed_at     = EXCLUDED.computed_at;

  RETURN v_result;
END;
$$;

ALTER FUNCTION public.get_global_stats_cached(INT)
  SET statement_timeout = '120s';

GRANT EXECUTE ON FUNCTION public.get_global_stats_cached(INT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_character_ranking_stats_cached(
  p_buffer_seconds INT DEFAULT 300
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count BIGINT;
  v_cached_data   JSONB;
  v_cached_fp     BIGINT;
  v_cached_at     TIMESTAMPTZ;
  v_result        JSON;
  v_max_ttl       INTERVAL := INTERVAL '24 hours';
  v_cache_key     TEXT := 'character_ranking:v3';
BEGIN
  SELECT count(*) INTO v_current_count FROM public.history;

  SELECT cached_data, row_fingerprint, computed_at
    INTO v_cached_data, v_cached_fp, v_cached_at
    FROM public.stats_cache
   WHERE cache_key = v_cache_key;

  IF v_cached_data IS NOT NULL THEN
    IF v_cached_fp = v_current_count
       AND v_cached_at + v_max_ttl > now() THEN
      RETURN v_cached_data::JSON;
    END IF;

    IF v_cached_fp <> v_current_count
       AND v_cached_at + (p_buffer_seconds || ' seconds')::INTERVAL > now() THEN
      RETURN v_cached_data::JSON;
    END IF;
  END IF;

  SELECT public.get_character_ranking_stats() INTO v_result;

  INSERT INTO public.stats_cache (cache_key, cached_data, row_fingerprint, computed_at)
  VALUES (v_cache_key, v_result::JSONB, v_current_count, now())
  ON CONFLICT (cache_key) DO UPDATE SET
    cached_data     = EXCLUDED.cached_data,
    row_fingerprint = EXCLUDED.row_fingerprint,
    computed_at     = EXCLUDED.computed_at;

  RETURN v_result;
END;
$$;

ALTER FUNCTION public.get_character_ranking_stats_cached(INT)
  SET statement_timeout = '90s';

GRANT EXECUTE ON FUNCTION public.get_character_ranking_stats_cached(INT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_user_ranking_stats_cached(
  p_user_id UUID,
  p_buffer_seconds INT DEFAULT 120
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count BIGINT;
  v_cache_key     TEXT;
  v_cached_data   JSONB;
  v_cached_fp     BIGINT;
  v_cached_at     TIMESTAMPTZ;
  v_result        JSON;
  v_max_ttl       INTERVAL := INTERVAL '6 hours';
BEGIN
  SELECT count(*) INTO v_current_count
    FROM public.history
   WHERE user_id = p_user_id;

  v_cache_key := 'user_ranking:v3:' || p_user_id::TEXT;

  SELECT cached_data, row_fingerprint, computed_at
    INTO v_cached_data, v_cached_fp, v_cached_at
    FROM public.stats_cache
   WHERE cache_key = v_cache_key;

  IF v_cached_data IS NOT NULL THEN
    IF v_cached_fp = v_current_count
       AND v_cached_at + v_max_ttl > now() THEN
      RETURN v_cached_data::JSON;
    END IF;

    IF v_cached_fp <> v_current_count
       AND v_cached_at + (p_buffer_seconds || ' seconds')::INTERVAL > now() THEN
      RETURN v_cached_data::JSON;
    END IF;
  END IF;

  SELECT public.get_user_ranking_stats(p_user_id) INTO v_result;

  INSERT INTO public.stats_cache (cache_key, cached_data, row_fingerprint, computed_at)
  VALUES (v_cache_key, v_result::JSONB, v_current_count, now())
  ON CONFLICT (cache_key) DO UPDATE SET
    cached_data     = EXCLUDED.cached_data,
    row_fingerprint = EXCLUDED.row_fingerprint,
    computed_at     = EXCLUDED.computed_at;

  RETURN v_result;
END;
$$;

ALTER FUNCTION public.get_user_ranking_stats_cached(UUID, INT)
  SET statement_timeout = '90s';

GRANT EXECUTE ON FUNCTION public.get_user_ranking_stats_cached(UUID, INT) TO anon, authenticated;
