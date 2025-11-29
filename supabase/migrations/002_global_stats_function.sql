-- 创建全服统计 RPC 函数（使用 SECURITY DEFINER 绕过 RLS）
CREATE OR REPLACE FUNCTION get_global_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  avg_pity NUMERIC;
BEGIN
  -- 使用窗口函数计算精确的平均出货（每个6星的垫刀数）
  WITH valid_pulls AS (
    -- 排除赠送的记录
    SELECT
      user_id,
      pool_id,
      record_id,
      rarity,
      timestamp,
      ROW_NUMBER() OVER (PARTITION BY user_id, pool_id ORDER BY record_id) as pull_num
    FROM history
    WHERE special_type IS DISTINCT FROM 'gift'
  ),
  six_star_pity AS (
    -- 计算每个6星的垫刀数
    SELECT
      v1.user_id,
      v1.pool_id,
      v1.pull_num - COALESCE(
        (SELECT MAX(v2.pull_num)
         FROM valid_pulls v2
         WHERE v2.user_id = v1.user_id
           AND v2.pool_id = v1.pool_id
           AND v2.rarity = 6
           AND v2.pull_num < v1.pull_num),
        0
      ) as pity_count
    FROM valid_pulls v1
    WHERE v1.rarity = 6
  )
  SELECT COALESCE(AVG(pity_count), 0) INTO avg_pity FROM six_star_pity;

  SELECT json_build_object(
    'totalPulls', COALESCE((SELECT COUNT(*) FROM history WHERE special_type IS DISTINCT FROM 'gift'), 0),
    'totalUsers', COALESCE((SELECT COUNT(*) FROM profiles), 0),
    'sixStarTotal', COALESCE((SELECT COUNT(*) FROM history WHERE rarity = 6), 0),
    'sixStarLimited', COALESCE((SELECT COUNT(*) FROM history WHERE rarity = 6 AND is_standard = false), 0),
    'sixStarStandard', COALESCE((SELECT COUNT(*) FROM history WHERE rarity = 6 AND is_standard = true), 0),
    'fiveStar', COALESCE((SELECT COUNT(*) FROM history WHERE rarity = 5), 0),
    'fourStar', COALESCE((SELECT COUNT(*) FROM history WHERE rarity <= 4), 0),
    'avgPity', ROUND(avg_pity, 1),
    'byType', json_build_object(
      'limited', json_build_object(
        'total', COALESCE((SELECT COUNT(*) FROM history h JOIN pools p ON h.pool_id = p.pool_id AND h.user_id = p.user_id WHERE p.type = 'limited' AND h.special_type IS DISTINCT FROM 'gift'), 0)
      ),
      'weapon', json_build_object(
        'total', COALESCE((SELECT COUNT(*) FROM history h JOIN pools p ON h.pool_id = p.pool_id AND h.user_id = p.user_id WHERE p.type = 'weapon' AND h.special_type IS DISTINCT FROM 'gift'), 0)
      ),
      'standard', json_build_object(
        'total', COALESCE((SELECT COUNT(*) FROM history h JOIN pools p ON h.pool_id = p.pool_id AND h.user_id = p.user_id WHERE p.type = 'standard' AND h.special_type IS DISTINCT FROM 'gift'), 0)
      )
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- 授权所有认证用户调用此函数
GRANT EXECUTE ON FUNCTION get_global_stats() TO authenticated;
-- 也授权匿名用户（如果需要未登录也能看到统计）
GRANT EXECUTE ON FUNCTION get_global_stats() TO anon;
