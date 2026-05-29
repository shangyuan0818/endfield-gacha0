-- 将限定池 UP 6★ 排名扩展到前 6 名，供统计页左侧两列卡片展示。
-- 仅调整 limited_six_star_up；其他排行榜仍保持现有 Top 5 / Top 3 设计。

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
      h.item_name,
      h.is_free,
      h.special_type,
      h.pool_id,
      COALESCE(c.type, 'character') as item_type,
      COALESCE(c.is_limited, false) as char_is_limited,
      p.up_character as pool_up_character,
      CASE
        WHEN h.pool_id LIKE 'special_%' THEN 'limited'
        WHEN h.pool_id LIKE 'weapon%' OR h.pool_id LIKE 'wepon%' THEN 'weapon'
        WHEN h.pool_id IN ('standard', 'beginner') THEN 'standard'
        WHEN p.type IS NOT NULL THEN
          CASE
            WHEN p.type IN ('limited', 'limited_character') THEN 'limited'
            WHEN p.type IN ('weapon', 'limited_weapon') THEN 'weapon'
            ELSE 'standard'
          END
        ELSE 'standard'
      END as pool_type
    FROM public.history h
    LEFT JOIN public.characters c ON c.name = h.item_name
    LEFT JOIN public.pools p ON p.pool_id = h.pool_id
    WHERE h.special_type IS DISTINCT FROM 'gift'
      AND h.item_name IS NOT NULL
      AND h.item_name != ''
  ),
  history_classified AS (
    SELECT *,
      CASE
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

COMMENT ON FUNCTION public.get_character_ranking_stats() IS 'FEAT-013: 歪出六星分类统计 - 区分歪常驻/歪非当期限定';
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
      h.item_name,
      h.is_free,
      h.special_type,
      h.pool_id,
      COALESCE(c.type, 'character') as item_type,
      COALESCE(c.is_limited, false) as char_is_limited,
      p.up_character as pool_up_character,
      CASE
        WHEN h.pool_id LIKE 'special_%' THEN 'limited'
        WHEN h.pool_id LIKE 'weapon%' OR h.pool_id LIKE 'wepon%' THEN 'weapon'
        WHEN h.pool_id IN ('standard', 'beginner') THEN 'standard'
        WHEN p.type IS NOT NULL THEN
          CASE
            WHEN p.type IN ('limited', 'limited_character') THEN 'limited'
            WHEN p.type IN ('weapon', 'limited_weapon') THEN 'weapon'
            ELSE 'standard'
          END
        ELSE 'standard'
      END as pool_type
    FROM public.history h
    LEFT JOIN public.characters c ON c.name = h.item_name
    LEFT JOIN public.pools p ON p.pool_id = h.pool_id
    WHERE h.user_id = p_user_id
      AND h.special_type IS DISTINCT FROM 'gift'
      AND h.item_name IS NOT NULL
      AND h.item_name != ''
  ),
  history_classified AS (
    SELECT *,
      CASE
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

COMMENT ON FUNCTION public.get_user_ranking_stats(uuid) IS 'FEAT-013: 用户个人排名 - 歪出六星分类统计';
GRANT EXECUTE ON FUNCTION public.get_user_ranking_stats(uuid) TO anon, authenticated;
