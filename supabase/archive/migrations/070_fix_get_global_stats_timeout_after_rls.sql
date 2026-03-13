-- ============================================
-- 070: 修复 get_global_stats 在 RLS 加固后的超时
--
-- 问题:
--   1. 061 将 history SELECT 策略改为每次读取都查询 profiles 判断 super_admin
--   2. 060 的 get_global_stats() 会重复多次扫描 history + pools
--   3. 在生产数据量下，RPC /rest/v1/rpc/get_global_stats 开始出现 8s+ 的 500
--
-- 修复:
--   1. history SELECT 策略改为直接调用 is_super_admin() helper
--   2. 为统计路径补充关键索引
--   3. 重写 get_global_stats()，用 MATERIALIZED CTE 共享一次 history/pools enrich 结果
-- ============================================

-- ---------- history: 降低 RLS 判断开销 ----------

DROP POLICY IF EXISTS "history_select_own_or_admin" ON public.history;

CREATE POLICY "history_select_own_or_admin" ON public.history
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR (SELECT public.is_super_admin())
  );

COMMENT ON POLICY "history_select_own_or_admin" ON public.history IS
  '仅允许用户查看自己的 history，super_admin 可查看全部；使用 helper function 降低 RLS 成本';

-- ---------- stats: 补充执行路径索引 ----------

CREATE INDEX IF NOT EXISTS idx_history_pool_user_record
  ON public.history (pool_id, user_id, record_id);

CREATE INDEX IF NOT EXISTS idx_history_valid_pool_user_record
  ON public.history (pool_id, user_id, record_id)
  WHERE special_type IS DISTINCT FROM 'gift'
    AND (is_free IS NOT TRUE);

CREATE INDEX IF NOT EXISTS idx_history_gift_pool_rarity_standard
  ON public.history (pool_id, rarity, is_standard)
  WHERE special_type = 'gift';

-- ---------- stats: 单次数据管线重写 RPC ----------

CREATE OR REPLACE FUNCTION public.get_global_stats()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH history_base AS MATERIALIZED (
  SELECT
    h.*,
    p.type AS pool_type,
    p.up_character,
    CASE
      WHEN p.type IN ('standard', 'beginner') OR h.pool_id IN ('standard', 'beginner') THEN true
      WHEN h.rarity = 6 AND p.up_character IS NOT NULL THEN
        NOT (
          COALESCE(h.character_name, '') ILIKE '%' || p.up_character || '%'
          OR COALESCE(h.item_name, '') ILIKE '%' || p.up_character || '%'
          OR p.up_character ILIKE '%' || COALESCE(h.character_name, h.item_name, '') || '%'
        )
      ELSE COALESCE(h.is_standard, false)
    END AS is_standard_calc
  FROM public.history AS h
  LEFT JOIN public.pools AS p ON p.pool_id = h.pool_id
),
history_enriched AS MATERIALIZED (
  SELECT
    hb.*,
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
        WHEN hb.is_standard_calc = true THEN 'standard'
        ELSE 'limited'
      END
    ) AS classified_pool_type
  FROM history_base AS hb
),
valid_pulls AS MATERIALIZED (
  SELECT *
  FROM history_enriched
  WHERE special_type IS DISTINCT FROM 'gift'
    AND (is_free IS NOT TRUE)
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
    rarity,
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
limited_six_pity AS MATERIALIZED (
  SELECT
    pool_id,
    user_id,
    is_standard_calc,
    rn,
    pity,
    CASE
      WHEN is_standard_calc = false
        AND rn = 120
        AND MIN(
          CASE
            WHEN is_standard_calc = false THEN rn
            ELSE 999999
          END
        ) OVER (PARTITION BY pool_id, user_id) = 120
      THEN true
      ELSE false
    END AS is_spark
  FROM six_pity
  WHERE classified_pool_type = 'limited'
),
global_grouped AS (
  SELECT
    range_label,
    SUM(CASE WHEN NOT is_standard_calc THEN 1 ELSE 0 END) AS limited_count,
    SUM(CASE WHEN is_standard_calc THEN 1 ELSE 0 END) AS standard_count
  FROM (
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
      END AS range_label,
      is_standard_calc
    FROM six_pity
  ) AS t
  GROUP BY range_label
),
limited_grouped AS (
  SELECT
    range_label,
    SUM(CASE WHEN NOT is_standard_calc THEN 1 ELSE 0 END) AS limited_count,
    SUM(CASE WHEN is_standard_calc THEN 1 ELSE 0 END) AS standard_count
  FROM (
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
      END AS range_label,
      is_standard_calc
    FROM limited_six_pity
  ) AS t
  GROUP BY range_label
),
weapon_grouped AS (
  SELECT
    range_label,
    SUM(CASE WHEN NOT is_standard_calc THEN 1 ELSE 0 END) AS limited_count,
    SUM(CASE WHEN is_standard_calc THEN 1 ELSE 0 END) AS standard_count
  FROM (
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
      END AS range_label,
      is_standard_calc
    FROM six_pity
    WHERE classified_pool_type = 'weapon'
  ) AS t
  GROUP BY range_label
),
standard_grouped AS (
  SELECT
    range_label,
    0 AS limited_count,
    COUNT(*) AS standard_count
  FROM (
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
      END AS range_label
    FROM six_pity
    WHERE classified_pool_type = 'standard'
  ) AS t
  GROUP BY range_label
)
SELECT json_build_object(
  'totalPulls', COALESCE((SELECT COUNT(*) FROM valid_pulls), 0),
  'totalPullsWithFree', COALESCE((
    SELECT COUNT(*)
    FROM history_enriched
    WHERE special_type IS DISTINCT FROM 'gift'
  ), 0),
  'freePullCount', COALESCE((
    SELECT COUNT(*)
    FROM history_enriched
    WHERE special_type IS DISTINCT FROM 'gift'
      AND is_free = true
  ), 0),
  'totalUsers', COALESCE((SELECT COUNT(*) FROM public.public_profiles), 0),
  'totalContributors', COALESCE((SELECT COUNT(DISTINCT user_id) FROM valid_pulls), 0),
  'sixStarTotal', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE rarity = 6), 0),
  'sixStarLimited', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE rarity = 6 AND is_standard_calc = false), 0),
  'sixStarStandard', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE rarity = 6 AND is_standard_calc = true), 0),
  'fiveStar', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE rarity = 5), 0),
  'fourStar', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE rarity <= 4), 0),
  'avgPity', COALESCE((SELECT ROUND(AVG(pity), 1) FROM six_pity), 0),
  'counts', json_build_object(
    '6', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE rarity = 6 AND is_standard_calc = false), 0),
    '6_std', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE rarity = 6 AND is_standard_calc = true), 0),
    '5', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE rarity = 5), 0),
    '4', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE rarity <= 4), 0)
  ),
  'distribution', COALESCE((
    SELECT json_agg(
      json_build_object(
        'range', REPLACE(range_label, '01-10', '1-10'),
        'limited', limited_count,
        'standard', standard_count
      )
      ORDER BY range_label
    )
    FROM global_grouped
  ), '[]'::json),
  'byType', json_build_object(
    'limited', json_build_object(
      'total', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'limited'), 0),
      'six', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'limited' AND rarity = 6), 0),
      'sixStarLimited', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'limited' AND rarity = 6 AND is_standard_calc = false), 0),
      'sixStarStandard', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'limited' AND rarity = 6 AND is_standard_calc = true), 0),
      'avgPity', COALESCE((SELECT ROUND(AVG(pity), 1) FROM limited_six_pity), 0),
      'avgPityUp', COALESCE((SELECT ROUND(AVG(pity), 1) FROM limited_six_pity WHERE is_standard_calc = false AND NOT is_spark), 0),
      'sparkCount', COALESCE((SELECT COUNT(DISTINCT user_id) FROM limited_six_pity WHERE is_spark = true), 0),
      'counts', json_build_object(
        '6', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'limited' AND rarity = 6 AND is_standard_calc = false), 0),
        '6_std', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'limited' AND rarity = 6 AND is_standard_calc = true), 0),
        '5', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'limited' AND rarity = 5), 0),
        '4', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'limited' AND rarity <= 4), 0)
      ),
      'distribution', COALESCE((
        SELECT json_agg(
          json_build_object(
            'range', REPLACE(range_label, '01-10', '1-10'),
            'limited', limited_count,
            'standard', standard_count
          )
          ORDER BY range_label
        )
        FROM limited_grouped
      ), '[]'::json)
    ),
    'weapon', json_build_object(
      'total', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'weapon'), 0),
      'six', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'weapon' AND rarity = 6), 0),
      'sixStarLimited', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'weapon' AND rarity = 6 AND is_standard_calc = false), 0),
      'sixStarStandard', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'weapon' AND rarity = 6 AND is_standard_calc = true), 0),
      'avgPity', COALESCE((SELECT ROUND(AVG(pity), 1) FROM six_pity WHERE classified_pool_type = 'weapon'), 0),
      'avgPityUp', COALESCE((SELECT ROUND(AVG(pity), 1) FROM six_pity WHERE classified_pool_type = 'weapon' AND is_standard_calc = false), 0),
      'counts', json_build_object(
        '6', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'weapon' AND rarity = 6 AND is_standard_calc = false), 0),
        '6_std', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'weapon' AND rarity = 6 AND is_standard_calc = true), 0),
        '5', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'weapon' AND rarity = 5), 0),
        '4', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'weapon' AND rarity <= 4), 0)
      ),
      'distribution', COALESCE((
        SELECT json_agg(
          json_build_object(
            'range', REPLACE(range_label, '01-10', '1-10'),
            'limited', limited_count,
            'standard', standard_count
          )
          ORDER BY range_label
        )
        FROM weapon_grouped
      ), '[]'::json)
    ),
    'standard', json_build_object(
      'total', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'standard'), 0),
      'six', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'standard' AND rarity = 6), 0),
      'sixStarLimited', 0,
      'sixStarStandard', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'standard' AND rarity = 6), 0),
      'avgPity', COALESCE((SELECT ROUND(AVG(pity), 1) FROM six_pity WHERE classified_pool_type = 'standard'), 0),
      'counts', json_build_object(
        '6', 0,
        '6_std', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'standard' AND rarity = 6), 0),
        '5', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'standard' AND rarity = 5), 0),
        '4', COALESCE((SELECT COUNT(*) FROM valid_pulls WHERE classified_pool_type = 'standard' AND rarity <= 4), 0)
      ),
      'distribution', COALESCE((
        SELECT json_agg(
          json_build_object(
            'range', REPLACE(range_label, '01-10', '1-10'),
            'limited', limited_count,
            'standard', standard_count
          )
          ORDER BY range_label
        )
        FROM standard_grouped
      ), '[]'::json)
    )
  ),
  'charGift', COALESCE((
    SELECT COUNT(*)
    FROM history_enriched
    WHERE special_type = 'gift'
      AND rarity = 6
      AND classified_pool_type = 'limited'
  ), 0),
  'weaponGiftLimited', COALESCE((
    SELECT COUNT(*)
    FROM history_enriched
    WHERE special_type = 'gift'
      AND rarity = 6
      AND classified_pool_type = 'weapon'
      AND is_standard_calc = false
  ), 0),
  'weaponGiftStandard', COALESCE((
    SELECT COUNT(*)
    FROM history_enriched
    WHERE special_type = 'gift'
      AND rarity = 6
      AND classified_pool_type = 'weapon'
      AND is_standard_calc = true
  ), 0),
  'giftTotal', COALESCE((
    SELECT COUNT(*)
    FROM history_enriched
    WHERE special_type = 'gift'
  ), 0)
);
$$;

GRANT EXECUTE ON FUNCTION public.get_global_stats() TO anon, authenticated;
