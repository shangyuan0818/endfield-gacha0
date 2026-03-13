-- ============================================
-- 072: app 端卡池读取边界收口
-- 目的:
--   1. 停止客户端直接 select * 拉全表后再前端去重
--   2. 统一“公开共享卡池 + 当前用户自有卡池”的读取口径
-- ============================================

DROP FUNCTION IF EXISTS public.get_app_visible_pools();

CREATE OR REPLACE FUNCTION public.get_app_visible_pools()
RETURNS TABLE (
  pool_id TEXT,
  name TEXT,
  type TEXT,
  locked BOOLEAN,
  is_limited_weapon BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  user_id UUID,
  creator_username TEXT,
  creator_role TEXT,
  up_character TEXT,
  description TEXT,
  banner_url TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  featured_characters TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visible_pools AS (
    SELECT p.*
    FROM public.pools AS p
    WHERE
      p.pool_id IN ('standard', 'beginner')
      OR split_part(p.pool_id, '_', 1) IN ('special', 'weponbox', 'weaponbox')
      OR
      p.user_id IS NULL
      OR p.user_id = auth.uid()
      OR p.locked = true
      OR EXISTS (
        SELECT 1
        FROM public.profiles AS owner_profile
        WHERE owner_profile.id = p.user_id
          AND owner_profile.role IN ('admin', 'super_admin')
      )
  ),
  ranked_pools AS (
    SELECT
      p.pool_id,
      p.name,
      p.type,
      p.locked,
      p.is_limited_weapon,
      p.created_at,
      p.updated_at,
      p.user_id,
      prof.username AS creator_username,
      prof.role AS creator_role,
      p.up_character,
      p.description,
      p.banner_url,
      p.start_time,
      p.end_time,
      p.featured_characters,
      ROW_NUMBER() OVER (
        PARTITION BY p.pool_id
        ORDER BY
          CASE
            WHEN prof.role = 'super_admin' THEN 3
            WHEN prof.role = 'admin' THEN 2
            ELSE 1
          END DESC,
          (
            CASE WHEN NULLIF(BTRIM(COALESCE(p.up_character, '')), '') IS NOT NULL THEN 4 ELSE 0 END +
            CASE WHEN p.start_time IS NOT NULL THEN 2 ELSE 0 END +
            CASE WHEN p.end_time IS NOT NULL THEN 2 ELSE 0 END +
            CASE WHEN COALESCE(array_length(p.featured_characters, 1), 0) > 0 THEN 1 ELSE 0 END +
            CASE WHEN NULLIF(BTRIM(COALESCE(p.banner_url, '')), '') IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN NULLIF(BTRIM(COALESCE(p.description, '')), '') IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN p.locked THEN 1 ELSE 0 END
          ) DESC,
          CASE WHEN p.user_id = auth.uid() THEN 1 ELSE 0 END DESC,
          COALESCE(p.start_time, p.updated_at, p.created_at, to_timestamp(0)) DESC,
          COALESCE(p.updated_at, p.created_at, to_timestamp(0)) DESC
      ) AS row_rank
    FROM visible_pools AS p
    LEFT JOIN public.profiles AS prof
      ON prof.id = p.user_id
  )
  SELECT
    pool_id,
    name,
    type,
    locked,
    is_limited_weapon,
    created_at,
    updated_at,
    user_id,
    creator_username,
    creator_role,
    up_character,
    description,
    banner_url,
    start_time,
    end_time,
    featured_characters
  FROM ranked_pools
  WHERE row_rank = 1
  ORDER BY COALESCE(start_time, created_at, updated_at, to_timestamp(0)) DESC, pool_id ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_app_visible_pools() TO anon, authenticated;

COMMENT ON FUNCTION public.get_app_visible_pools() IS
  '返回 app 端可见的卡池集合：公开共享卡池 + 当前用户自有卡池，并在服务端完成 pool_id 级别去重与共享池优先级排序。';
