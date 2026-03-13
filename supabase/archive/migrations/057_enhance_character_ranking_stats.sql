-- =====================================================
-- 057: 增强角色出货排名统计函数
--
-- FEAT-010 需求：
-- 1. 限定池六星单独列出个数（UP六星 vs 歪出六星）
-- 2. 将"限定池六星排名"改为统计"歪出的六星"
-- 3. 为常驻池六星排名增加第四名和第五名（LIMIT 5）
--
-- 修复：使用 characters.is_limited 判断是否为限定角色
--       而不是依赖 history.is_standard（该字段数据不准确）
-- =====================================================

-- 删除旧函数
DROP FUNCTION IF EXISTS public.get_character_ranking_stats();

-- 创建增强后的角色排名统计函数
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
  -- 关联卡池类型和角色/武器类型
  history_with_info AS (
    SELECT
      h.rarity,
      h.item_name,
      h.is_free,
      h.special_type,
      h.pool_id,
      -- 从 characters 表获取物品类型（角色/武器）
      COALESCE(c.type, 'character') as item_type,
      -- 🔧 修复：使用 characters.is_limited 判断是否为限定角色
      COALESCE(c.is_limited, false) as char_is_limited,
      -- 根据 pool_id 前缀判断卡池类型
      CASE
        -- 限定池：以 special_ 开头
        WHEN h.pool_id LIKE 'special_%' THEN 'limited'
        -- 武器池：以 weapon 开头（包括 weaponbox_、weponbox_ 等）
        WHEN h.pool_id LIKE 'weapon%' OR h.pool_id LIKE 'wepon%' THEN 'weapon'
        -- 常驻池：standard 或 beginner
        WHEN h.pool_id IN ('standard', 'beginner') THEN 'standard'
        -- UUID 格式的 pool_id，从 pools 表获取类型
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
    -- LEFT JOIN characters 表获取物品类型和限定状态
    LEFT JOIN public.characters c ON c.name = h.item_name
    WHERE h.special_type IS DISTINCT FROM 'gift'
      AND h.item_name IS NOT NULL
      AND h.item_name != ''
  ),

  -- ========== 限定池统计（仅角色） ==========
  -- 限定池6★UP角色排名（限定角色 = char_is_limited = true）
  limited_six_star_up AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_info
    WHERE pool_type = 'limited'
      AND rarity = 6
      AND item_type = 'character'
      AND char_is_limited = true
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 5
  ),

  -- 限定池6★歪出角色排名（常驻角色 = char_is_limited = false）
  limited_six_star_off AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_info
    WHERE pool_type = 'limited'
      AND rarity = 6
      AND item_type = 'character'
      AND char_is_limited = false
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 5
  ),

  -- 限定池5★角色排名
  limited_five_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_info
    WHERE pool_type = 'limited'
      AND rarity = 5
      AND item_type = 'character'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),

  -- ========== 常驻池统计（仅角色）- 增加到 TOP5 ==========
  -- 常驻池6★角色排名
  standard_six_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_info
    WHERE pool_type = 'standard'
      AND rarity = 6
      AND item_type = 'character'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 5
  ),

  -- 常驻池5★角色排名
  standard_five_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_info
    WHERE pool_type = 'standard'
      AND rarity = 5
      AND item_type = 'character'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),

  -- ========== 武器池统计（仅武器） ==========
  -- 武器池6★UP武器排名（限定武器）
  weapon_six_star_up AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_info
    WHERE pool_type = 'weapon'
      AND rarity = 6
      AND item_type = 'weapon'
      AND char_is_limited = true
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),

  -- 武器池6★歪出武器排名（常驻武器）
  weapon_six_star_off AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_info
    WHERE pool_type = 'weapon'
      AND rarity = 6
      AND item_type = 'weapon'
      AND char_is_limited = false
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),

  -- 武器池5★武器排名
  weapon_five_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_info
    WHERE pool_type = 'weapon'
      AND rarity = 5
      AND item_type = 'weapon'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),

  -- ========== 数量统计 ==========
  -- 限定池6★角色数量统计（区分UP/歪/免费）
  limited_six_counts AS (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_free = false OR is_free IS NULL) as excluding_free,
      COUNT(*) FILTER (WHERE char_is_limited = true) as up_count,
      COUNT(*) FILTER (WHERE char_is_limited = false) as off_count,
      COUNT(*) FILTER (WHERE char_is_limited = true AND (is_free = false OR is_free IS NULL)) as up_excluding_free,
      COUNT(*) FILTER (WHERE char_is_limited = false AND (is_free = false OR is_free IS NULL)) as off_excluding_free
    FROM history_with_info
    WHERE pool_type = 'limited'
      AND rarity = 6
      AND item_type = 'character'
  ),

  -- 常驻池6★角色数量统计
  standard_six_counts AS (
    SELECT COUNT(*) as total
    FROM history_with_info
    WHERE pool_type = 'standard'
      AND rarity = 6
      AND item_type = 'character'
  ),

  -- 武器池6★武器数量统计（区分UP/歪）
  weapon_six_counts AS (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE char_is_limited = true) as up_count,
      COUNT(*) FILTER (WHERE char_is_limited = false) as off_count
    FROM history_with_info
    WHERE pool_type = 'weapon'
      AND rarity = 6
      AND item_type = 'weapon'
  )

  SELECT json_build_object(
    'limited', json_build_object(
      'sixStarUp', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_six_star_up),
      'sixStarOff', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_six_star_off),
      'sixStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_six_star_up),
      'fiveStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_five_star),
      'sixStarTotal', (SELECT COALESCE(total, 0) FROM limited_six_counts),
      'sixStarExcludingFree', (SELECT COALESCE(excluding_free, 0) FROM limited_six_counts),
      'sixStarUpCount', (SELECT COALESCE(up_count, 0) FROM limited_six_counts),
      'sixStarOffCount', (SELECT COALESCE(off_count, 0) FROM limited_six_counts),
      'sixStarUpExcludingFree', (SELECT COALESCE(up_excluding_free, 0) FROM limited_six_counts),
      'sixStarOffExcludingFree', (SELECT COALESCE(off_excluding_free, 0) FROM limited_six_counts)
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

-- 添加函数注释
COMMENT ON FUNCTION public.get_character_ranking_stats() IS 'FEAT-010: 增强版角色排名统计 - 使用 characters.is_limited 判断UP/歪出';

-- 授予执行权限
GRANT EXECUTE ON FUNCTION public.get_character_ranking_stats() TO anon, authenticated;

-- =====================================================
-- 同步更新用户个人排名函数
-- =====================================================

DROP FUNCTION IF EXISTS public.get_user_ranking_stats(uuid);

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
  -- 关联卡池类型和角色/武器类型
  history_with_info AS (
    SELECT
      h.rarity,
      h.item_name,
      h.is_free,
      h.special_type,
      h.pool_id,
      COALESCE(c.type, 'character') as item_type,
      -- 🔧 修复：使用 characters.is_limited 判断是否为限定角色
      COALESCE(c.is_limited, false) as char_is_limited,
      CASE
        WHEN h.pool_id LIKE 'special_%' THEN 'limited'
        WHEN h.pool_id LIKE 'weapon%' OR h.pool_id LIKE 'wepon%' THEN 'weapon'
        WHEN h.pool_id IN ('standard', 'beginner') THEN 'standard'
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
    LEFT JOIN public.characters c ON c.name = h.item_name
    WHERE h.user_id = p_user_id
      AND h.special_type IS DISTINCT FROM 'gift'
      AND h.item_name IS NOT NULL
      AND h.item_name != ''
  ),

  -- 限定池6★UP角色排名（限定角色）
  limited_six_star_up AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_info
    WHERE pool_type = 'limited' AND rarity = 6 AND item_type = 'character'
      AND char_is_limited = true
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 5
  ),

  -- 限定池6★歪出角色排名（常驻角色）
  limited_six_star_off AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_info
    WHERE pool_type = 'limited' AND rarity = 6 AND item_type = 'character'
      AND char_is_limited = false
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 5
  ),

  limited_five_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_info
    WHERE pool_type = 'limited' AND rarity = 5 AND item_type = 'character'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),

  -- 常驻池 TOP5
  standard_six_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_info
    WHERE pool_type = 'standard' AND rarity = 6 AND item_type = 'character'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 5
  ),
  standard_five_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_info
    WHERE pool_type = 'standard' AND rarity = 5 AND item_type = 'character'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),

  -- 武器池
  weapon_six_star_up AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_info
    WHERE pool_type = 'weapon' AND rarity = 6 AND item_type = 'weapon'
      AND char_is_limited = true
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),
  weapon_six_star_off AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_info
    WHERE pool_type = 'weapon' AND rarity = 6 AND item_type = 'weapon'
      AND char_is_limited = false
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),
  weapon_five_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_info
    WHERE pool_type = 'weapon' AND rarity = 5 AND item_type = 'weapon'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),

  -- 数量统计
  limited_six_counts AS (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE char_is_limited = true) as up_count,
      COUNT(*) FILTER (WHERE char_is_limited = false) as off_count
    FROM history_with_info
    WHERE pool_type = 'limited' AND rarity = 6 AND item_type = 'character'
  )

  SELECT json_build_object(
    'limited', json_build_object(
      'sixStarUp', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_six_star_up),
      'sixStarOff', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_six_star_off),
      'sixStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_six_star_up),
      'fiveStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_five_star),
      'sixStarUpCount', (SELECT COALESCE(up_count, 0) FROM limited_six_counts),
      'sixStarOffCount', (SELECT COALESCE(off_count, 0) FROM limited_six_counts)
    ),
    'standard', json_build_object(
      'sixStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM standard_six_star),
      'fiveStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM standard_five_star)
    ),
    'weapon', json_build_object(
      'sixStarUp', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM weapon_six_star_up),
      'sixStarOff', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM weapon_six_star_off),
      'sixStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM weapon_six_star_up),
      'fiveStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM weapon_five_star)
    )
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_user_ranking_stats(uuid) IS 'FEAT-010: 增强版用户排名统计 - 使用 characters.is_limited 判断UP/歪出';
GRANT EXECUTE ON FUNCTION public.get_user_ranking_stats(uuid) TO anon, authenticated;

-- =====================================================
-- 修复说明：
--
-- 问题原因：
--   history.is_standard 字段在导入时设置不准确
--   当 poolUpCharacterMap 中没有 UP 角色信息时，所有 6★ 都被标记为 UP
--
-- 解决方案：
--   使用 characters.is_limited 字段动态判断角色是否为限定
--   - char_is_limited = true  → UP 角色（限定）
--   - char_is_limited = false → 歪出角色（常驻）
--
-- 返回格式：
-- {
--   "limited": {
--     "sixStarUp": [{"name": "莱万汀", "count": 5}, ...],   -- 限定角色（不歪）
--     "sixStarOff": [{"name": "丽芙", "count": 3}, ...],    -- 常驻角色（歪出）
--     "sixStarUpCount": 7,                                  -- 限定角色总数
--     "sixStarOffCount": 3                                  -- 歪出角色总数
--   },
--   ...
-- }
-- =====================================================
