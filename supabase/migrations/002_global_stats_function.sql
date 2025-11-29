-- 创建全服统计 RPC 函数（使用 SECURITY DEFINER 绕过 RLS）
CREATE OR REPLACE FUNCTION get_global_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'totalPulls', COALESCE((SELECT COUNT(*) FROM history WHERE special_type IS DISTINCT FROM 'gift'), 0),
    'totalUsers', COALESCE((SELECT COUNT(*) FROM profiles), 0),
    'sixStarTotal', COALESCE((SELECT COUNT(*) FROM history WHERE rarity = 6), 0),
    'sixStarLimited', COALESCE((SELECT COUNT(*) FROM history WHERE rarity = 6 AND is_standard = false), 0),
    'sixStarStandard', COALESCE((SELECT COUNT(*) FROM history WHERE rarity = 6 AND is_standard = true), 0),
    'fiveStar', COALESCE((SELECT COUNT(*) FROM history WHERE rarity = 5), 0),
    'fourStar', COALESCE((SELECT COUNT(*) FROM history WHERE rarity <= 4), 0),
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
