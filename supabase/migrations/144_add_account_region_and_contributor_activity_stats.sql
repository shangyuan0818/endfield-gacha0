-- 144: normalize account region metadata and expose contributor activity stats.
-- ACCOUNT-SERVER-001 first phase: keep history.server_id/region available and normalize region buckets.
-- STATS-006 first phase: add 90-day active/new contributor counts to cached global stats.

ALTER TABLE public.history
  ADD COLUMN IF NOT EXISTS server_id TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS is_free BOOLEAN,
  ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- Keep this migration lightweight for production: do not full-table backfill
-- history.region here. Readers below normalize server_id / region dynamically,
-- and new imports write normalized values at source.

CREATE INDEX IF NOT EXISTS idx_profiles_created_at
  ON public.profiles (created_at);

CREATE TABLE IF NOT EXISTS public.stats_cache (
  cache_key       TEXT PRIMARY KEY,
  cached_data     JSONB NOT NULL,
  row_fingerprint BIGINT NOT NULL DEFAULT 0,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stats_cache
  ADD COLUMN IF NOT EXISTS row_fingerprint BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS computed_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP FUNCTION IF EXISTS public.get_contributor_activity_stats(INT);

CREATE OR REPLACE FUNCTION public.get_contributor_activity_stats(
  p_window_days INT DEFAULT 90
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_days INT := GREATEST(COALESCE(p_window_days, 90), 1);
  v_active_users BIGINT := 0;
  v_new_users BIGINT := 0;
BEGIN
  SELECT COUNT(*)
    INTO v_active_users
    FROM (
      SELECT h.user_id
        FROM public.history AS h
       WHERE h.user_id IS NOT NULL
         AND h.pool_id IS NOT NULL
         AND h.special_type IS DISTINCT FROM 'gift'
         AND (h.is_free IS NOT TRUE)
         AND COALESCE(h.created_at, h.updated_at, h.timestamp) >= now() - make_interval(days => v_window_days)
       GROUP BY h.user_id
      HAVING COUNT(DISTINCT COALESCE(
        CASE
          WHEN h.pool_id::TEXT ~ '^(special|joint|extra|weponbox|weaponbox)_[0-9]+_[0-9]+'
          THEN regexp_replace(h.pool_id::TEXT, '^(special|joint|extra|weponbox|weaponbox)_([0-9]+)_([0-9]+).*$', 'v\2_\3')
          ELSE NULL
        END,
        h.pool_id::TEXT
      )) >= 2
    ) AS active_users;

  SELECT COUNT(*)
    INTO v_new_users
    FROM public.profiles AS p
   WHERE p.created_at >= now() - make_interval(days => v_window_days);

  RETURN jsonb_build_object(
    'windowDays', v_window_days,
    'activeUsers', COALESCE(v_active_users, 0),
    'newUsers', COALESCE(v_new_users, 0),
    'activeDefinition', '90日内至少两个版本有有效导入记录的用户',
    'newDefinition', '90日内首次使用站点的用户',
    'updatedAt', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_contributor_activity_stats(INT) TO anon, authenticated;

DELETE FROM public.stats_cache
WHERE cache_key IN ('global_stats', 'global_stats:v2', 'global_stats:v3', 'global_stats:v4');

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
  v_result_data   JSONB;
  v_quota_data    JSONB;
  v_activity_data JSONB;
  v_region_data   JSONB;
  v_total_contributors BIGINT;
  v_max_ttl       INTERVAL := INTERVAL '24 hours';
  v_cache_key     TEXT := 'global_stats:v4';
BEGIN
  SELECT
    (SELECT count(*) FROM public.history)
    + ((SELECT count(*) FROM public.profiles) * 1000000000)
    INTO v_current_count;

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
  SELECT COALESCE(public.get_pool_type_quota_stats()::JSONB, '{}'::JSONB) INTO v_quota_data;
  SELECT COALESCE(public.get_contributor_activity_stats(90), '{}'::JSONB) INTO v_activity_data;
  SELECT
    COUNT(DISTINCT h.user_id),
    jsonb_build_object(
      'cn', COUNT(DISTINCT h.user_id) FILTER (
        WHERE h.server_id::TEXT = '1'
           OR lower(coalesce(h.region::TEXT, '')) IN ('cn', 'china', 'mainland')
           OR h.region::TEXT IN ('国服', '官服', 'B服', '大陆')
      ),
      'intl', COUNT(DISTINCT h.user_id) FILTER (
        WHERE h.server_id::TEXT IN ('2', '3')
           OR lower(coalesce(h.region::TEXT, '')) IN ('intl', 'international', 'global', 'asia', 'sea', 'eu', 'na', 'us', 'america')
           OR h.region::TEXT IN ('国际服', '亚服', '亚洲', '欧服', '美服', '欧美', '欧/美')
      ),
      'unknown', COUNT(DISTINCT h.user_id) FILTER (
        WHERE NOT (
          h.server_id::TEXT = '1'
          OR lower(coalesce(h.region::TEXT, '')) IN ('cn', 'china', 'mainland')
          OR h.region::TEXT IN ('国服', '官服', 'B服', '大陆')
          OR h.server_id::TEXT IN ('2', '3')
          OR lower(coalesce(h.region::TEXT, '')) IN ('intl', 'international', 'global', 'asia', 'sea', 'eu', 'na', 'us', 'america')
          OR h.region::TEXT IN ('国际服', '亚服', '亚洲', '欧服', '美服', '欧美', '欧/美')
        )
      )
    )
    INTO v_total_contributors, v_region_data
    FROM public.history AS h
   WHERE h.user_id IS NOT NULL
     AND h.special_type IS DISTINCT FROM 'gift'
     AND (h.is_free IS NOT TRUE);

  v_result_data := COALESCE(v_result::JSONB, '{}'::JSONB);
  v_result_data := jsonb_set(v_result_data, '{byType,extra,quotaSummary}', COALESCE(v_quota_data -> 'extra', '{}'::JSONB), true);
  v_result_data := jsonb_set(v_result_data, '{byType,limited,quotaSummary}', COALESCE(v_quota_data -> 'limited', '{}'::JSONB), true);
  v_result_data := jsonb_set(v_result_data, '{byType,standard,quotaSummary}', COALESCE(v_quota_data -> 'standard', '{}'::JSONB), true);
  v_result_data := jsonb_set(v_result_data, '{byType,weapon,quotaSummary}', COALESCE(v_quota_data -> 'weapon', '{}'::JSONB), true);
  v_result_data := jsonb_set(v_result_data, '{totalContributors}', to_jsonb(COALESCE(v_total_contributors, 0)), true);
  v_result_data := jsonb_set(v_result_data, '{contributorsByRegion}', COALESCE(v_region_data, '{}'::JSONB), true);
  v_result_data := jsonb_set(v_result_data, '{activeUsers90d}', to_jsonb(COALESCE((v_activity_data ->> 'activeUsers')::BIGINT, 0)), true);
  v_result_data := jsonb_set(v_result_data, '{newUsers90d}', to_jsonb(COALESCE((v_activity_data ->> 'newUsers')::BIGINT, 0)), true);
  v_result_data := jsonb_set(v_result_data, '{contributorActivity}', v_activity_data, true);
  v_result := v_result_data::JSON;

  INSERT INTO public.stats_cache (cache_key, cached_data, row_fingerprint, computed_at)
  VALUES (v_cache_key, v_result::JSONB, v_current_count, now())
  ON CONFLICT (cache_key) DO UPDATE SET
    cached_data     = EXCLUDED.cached_data,
    row_fingerprint = EXCLUDED.row_fingerprint,
    computed_at     = EXCLUDED.computed_at;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_global_stats_cached(INT) TO anon, authenticated;
