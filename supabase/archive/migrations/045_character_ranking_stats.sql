-- =====================================================
-- 045: 角色出货排名统计函数
-- 用于统计各卡池类型中出货最多的角色
--
-- 功能：
-- - 统计限定池、常驻池中6★和5★角色的出货排名
-- - 返回前3名角色及其出货数量
-- - 同时提供6★含免费和不含免费的统计
-- =====================================================

-- 删除旧函数（如果存在）
DROP FUNCTION IF EXISTS public.get_character_ranking_stats();

-- 创建角色排名统计函数
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
  -- 关联卡池类型（安全处理 pool_id：仅当 pool_id 是有效 UUID 时才 JOIN）
  history_with_pool AS (
    SELECT
      h.rarity,
      h.item_name,
      h.is_standard,
      h.is_free,
      h.special_type,
      CASE
        -- 如果 pool_id 不是有效 UUID 格式，根据 pool_id 值判断类型
        WHEN h.pool_id = 'standard' THEN 'standard'
        WHEN h.pool_id = 'limited' THEN 'limited'
        WHEN h.pool_id = 'weapon' THEN 'weapon'
        -- 如果是有效 UUID，从 pools 表获取类型
        WHEN h.pool_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
          COALESCE(
            (SELECT
              CASE
                WHEN p.type IN ('limited', 'limited_character') THEN 'limited'
                WHEN p.type IN ('weapon', 'limited_weapon') THEN 'weapon'
                ELSE 'standard'
              END
            FROM public.pools p
            WHERE p.id = h.pool_id::uuid
            ),
            'standard'
          )
        ELSE 'standard'
      END as pool_type
    FROM public.history h
    WHERE h.special_type IS DISTINCT FROM 'gift'
      AND h.item_name IS NOT NULL
      AND h.item_name != ''
  ),

  -- 限定池6★排名（不区分免费）
  limited_six_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_pool
    WHERE pool_type = 'limited' AND rarity = 6
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),

  -- 限定池5★排名
  limited_five_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_pool
    WHERE pool_type = 'limited' AND rarity = 5
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),

  -- 常驻池6★排名
  standard_six_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_pool
    WHERE pool_type = 'standard' AND rarity = 6
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),

  -- 常驻池5★排名
  standard_five_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_pool
    WHERE pool_type = 'standard' AND rarity = 5
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),

  -- 限定池6★数量统计（区分免费）
  limited_six_counts AS (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_free = false OR is_free IS NULL) as excluding_free
    FROM history_with_pool
    WHERE pool_type = 'limited' AND rarity = 6
  ),

  -- 常驻池6★数量统计
  standard_six_counts AS (
    SELECT COUNT(*) as total
    FROM history_with_pool
    WHERE pool_type = 'standard' AND rarity = 6
  )

  SELECT json_build_object(
    'limited', json_build_object(
      'sixStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_six_star),
      'fiveStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_five_star),
      'sixStarTotal', (SELECT total FROM limited_six_counts),
      'sixStarExcludingFree', (SELECT excluding_free FROM limited_six_counts)
    ),
    'standard', json_build_object(
      'sixStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM standard_six_star),
      'fiveStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM standard_five_star),
      'sixStarTotal', (SELECT total FROM standard_six_counts)
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.get_character_ranking_stats() IS '获取各卡池类型中角色出货排名前3的统计数据';

-- 授予执行权限
GRANT EXECUTE ON FUNCTION public.get_character_ranking_stats() TO anon, authenticated;

-- =====================================================
-- 使用示例：
-- SELECT public.get_character_ranking_stats();
--
-- 返回格式：
-- {
--   "limited": {
--     "sixStar": [{"name": "莱万汀", "count": 150}, ...],
--     "fiveStar": [{"name": "某5星", "count": 500}, ...],
--     "sixStarTotal": 1200,
--     "sixStarExcludingFree": 1100
--   },
--   "standard": {
--     "sixStar": [{"name": "某常驻6星", "count": 80}, ...],
--     "fiveStar": [{"name": "某5星", "count": 300}, ...],
--     "sixStarTotal": 500
--   }
-- }
-- =====================================================
