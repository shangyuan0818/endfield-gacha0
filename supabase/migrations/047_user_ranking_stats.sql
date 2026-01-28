-- =====================================================
-- 047: 用户个人出货排名统计函数
--
-- 功能：获取指定用户的各卡池类型中角色/武器出货排名
-- =====================================================

-- 删除旧函数（如果存在）
DROP FUNCTION IF EXISTS public.get_user_ranking_stats(uuid);

-- 创建用户个人排名统计函数
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
      h.is_standard,
      h.is_free,
      h.special_type,
      h.pool_id,
      -- 从 characters 表获取物品类型（角色/武器）
      COALESCE(c.type, 'character') as item_type,
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
    -- LEFT JOIN characters 表获取物品类型
    LEFT JOIN public.characters c ON c.name = h.item_name
    WHERE h.user_id = p_user_id
      AND h.special_type IS DISTINCT FROM 'gift'
      AND h.item_name IS NOT NULL
      AND h.item_name != ''
  ),

  -- ========== 限定池统计（仅角色） ==========
  limited_six_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_info
    WHERE pool_type = 'limited' AND rarity = 6 AND item_type = 'character'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),
  limited_five_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_info
    WHERE pool_type = 'limited' AND rarity = 5 AND item_type = 'character'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),

  -- ========== 常驻池统计（仅角色） ==========
  standard_six_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_info
    WHERE pool_type = 'standard' AND rarity = 6 AND item_type = 'character'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),
  standard_five_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_info
    WHERE pool_type = 'standard' AND rarity = 5 AND item_type = 'character'
    GROUP BY item_name
    ORDER BY count DESC
    LIMIT 3
  ),

  -- ========== 武器池统计（仅武器） ==========
  weapon_six_star AS (
    SELECT item_name as name, COUNT(*) as count
    FROM history_with_info
    WHERE pool_type = 'weapon' AND rarity = 6 AND item_type = 'weapon'
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
  )

  SELECT json_build_object(
    'limited', json_build_object(
      'sixStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_six_star),
      'fiveStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM limited_five_star)
    ),
    'standard', json_build_object(
      'sixStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM standard_six_star),
      'fiveStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM standard_five_star)
    ),
    'weapon', json_build_object(
      'sixStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM weapon_six_star),
      'fiveStar', (SELECT COALESCE(json_agg(json_build_object('name', name, 'count', count)), '[]'::json) FROM weapon_five_star)
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.get_user_ranking_stats(uuid) IS '获取指定用户的各卡池类型中角色/武器出货排名前3的统计数据';

-- 授予执行权限
GRANT EXECUTE ON FUNCTION public.get_user_ranking_stats(uuid) TO anon, authenticated;
