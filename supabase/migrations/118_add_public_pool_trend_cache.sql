-- 118: add public trend cache for developer API v1.
--
-- Public trend endpoints must not aggregate raw history during request
-- handling. This table stores anonymous aggregate-only buckets refreshed by
-- controlled admin/ops jobs.

CREATE TABLE IF NOT EXISTS public.public_pool_trend_cache (
  metric TEXT NOT NULL CHECK (metric IN ('pulls', 'six_star', 'five_star')),
  granularity TEXT NOT NULL CHECK (granularity IN ('day', 'week')),
  period_start DATE NOT NULL,
  pool_type TEXT NOT NULL DEFAULT 'all' CHECK (pool_type IN ('all', 'extra', 'limited', 'standard', 'weapon')),
  pool_id TEXT NOT NULL DEFAULT 'all',
  value BIGINT NOT NULL DEFAULT 0,
  source_version TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (metric, granularity, period_start, pool_type, pool_id)
);

CREATE INDEX IF NOT EXISTS idx_public_pool_trend_cache_scope
  ON public.public_pool_trend_cache(metric, granularity, pool_type, pool_id, period_start DESC);

ALTER TABLE public.public_pool_trend_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_pool_trend_cache_select_policy
  ON public.public_pool_trend_cache;

CREATE POLICY public_pool_trend_cache_select_policy
  ON public.public_pool_trend_cache
  FOR SELECT
  USING (true);

GRANT SELECT ON public.public_pool_trend_cache TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_public_pool_trend_cache()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_refreshed_count INTEGER := 0;
  v_updated_at TIMESTAMPTZ := NOW();
BEGIN
  TRUNCATE public.public_pool_trend_cache;

  WITH paid_history AS MATERIALIZED (
    SELECT
      h.pool_id,
      h.rarity,
      h.timestamp,
      h.updated_at,
      CASE
        WHEN p.type = 'extra' OR h.pool_id LIKE 'joint_%' OR h.pool_id LIKE 'extra_%' THEN 'extra'
        WHEN p.type IN ('limited', 'limited_character') OR h.pool_id LIKE 'special_%' THEN 'limited'
        WHEN p.type IN ('weapon', 'limited_weapon') OR h.pool_id LIKE 'weapon%' OR h.pool_id LIKE 'wepon%' THEN 'weapon'
        WHEN p.type IN ('standard', 'beginner') OR h.pool_id IN ('standard', 'beginner') THEN 'standard'
        WHEN COALESCE(h.is_standard, false) THEN 'standard'
        ELSE 'limited'
      END AS pool_type
    FROM public.history AS h
    LEFT JOIN public.pools AS p
      ON p.pool_id = h.pool_id
    WHERE h.pool_id IS NOT NULL
      AND h.timestamp IS NOT NULL
      AND h.special_type IS DISTINCT FROM 'gift'
      AND h.is_free IS NOT TRUE
  ),
  bucketed AS MATERIALIZED (
    SELECT
      'day'::TEXT AS granularity,
      date_trunc('day', timestamp)::DATE AS period_start,
      pool_type,
      pool_id,
      rarity,
      updated_at
    FROM paid_history
    UNION ALL
    SELECT
      'week'::TEXT AS granularity,
      date_trunc('week', timestamp)::DATE AS period_start,
      pool_type,
      pool_id,
      rarity,
      updated_at
    FROM paid_history
  ),
  scoped AS MATERIALIZED (
    SELECT
      granularity,
      period_start,
      'all'::TEXT AS scope_pool_type,
      'all'::TEXT AS scope_pool_id,
      rarity,
      updated_at
    FROM bucketed
    UNION ALL
    SELECT
      granularity,
      period_start,
      pool_type AS scope_pool_type,
      'all'::TEXT AS scope_pool_id,
      rarity,
      updated_at
    FROM bucketed
    UNION ALL
    SELECT
      granularity,
      period_start,
      pool_type AS scope_pool_type,
      pool_id AS scope_pool_id,
      rarity,
      updated_at
    FROM bucketed
  ),
  grouped AS MATERIALIZED (
    SELECT
      granularity,
      period_start,
      scope_pool_type,
      scope_pool_id,
      COUNT(*)::BIGINT AS pulls,
      COUNT(*) FILTER (WHERE rarity = 6)::BIGINT AS six_star,
      COUNT(*) FILTER (WHERE rarity = 5)::BIGINT AS five_star,
      MAX(updated_at) AS latest_history_update
    FROM scoped
    GROUP BY granularity, period_start, scope_pool_type, scope_pool_id
  ),
  metric_rows AS MATERIALIZED (
    SELECT
      'pulls'::TEXT AS metric,
      granularity,
      period_start,
      scope_pool_type AS pool_type,
      scope_pool_id AS pool_id,
      pulls AS value,
      latest_history_update
    FROM grouped
    UNION ALL
    SELECT
      'six_star'::TEXT AS metric,
      granularity,
      period_start,
      scope_pool_type AS pool_type,
      scope_pool_id AS pool_id,
      six_star AS value,
      latest_history_update
    FROM grouped
    UNION ALL
    SELECT
      'five_star'::TEXT AS metric,
      granularity,
      period_start,
      scope_pool_type AS pool_type,
      scope_pool_id AS pool_id,
      five_star AS value,
      latest_history_update
    FROM grouped
  )
  INSERT INTO public.public_pool_trend_cache (
    metric,
    granularity,
    period_start,
    pool_type,
    pool_id,
    value,
    source_version,
    updated_at
  )
  SELECT
    metric,
    granularity,
    period_start,
    pool_type,
    pool_id,
    value,
    md5(CONCAT_WS(
      ':',
      metric,
      granularity,
      period_start::TEXT,
      pool_type,
      pool_id,
      value::TEXT,
      COALESCE(latest_history_update::TEXT, '')
    )),
    v_updated_at
  FROM metric_rows;

  GET DIAGNOSTICS v_refreshed_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'refreshedTrendRows', v_refreshed_count,
    'updatedAt', v_updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_public_analytics_cache()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool_result JSONB := '{}'::jsonb;
  v_trend_result JSONB := '{}'::jsonb;
  v_updated_at TIMESTAMPTZ := NOW();
  v_version TEXT := ((extract(epoch from v_updated_at) * 1000)::bigint)::text;
BEGIN
  v_pool_result := public.refresh_public_pool_analytics_cache();
  v_trend_result := public.refresh_public_pool_trend_cache();

  UPDATE public.site_config
  SET value = jsonb_build_object(
    'version', v_version,
    'scope', 'stats',
    'reason', 'refresh_public_analytics_cache',
    'updatedAt', v_updated_at
  )::text,
  updated_at = v_updated_at
  WHERE key = 'public_cache_epoch';

  RETURN jsonb_build_object(
    'success', true,
    'pool', v_pool_result,
    'trends', v_trend_result,
    'refreshedPools', COALESCE((v_pool_result->>'refreshedPools')::INTEGER, 0),
    'refreshedTrendRows', COALESCE((v_trend_result->>'refreshedTrendRows')::INTEGER, 0),
    'cacheVersion', v_version,
    'updatedAt', v_updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_public_pool_trend_cache() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_public_analytics_cache() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.refresh_public_pool_trend_cache() TO service_role;
    GRANT EXECUTE ON FUNCTION public.refresh_public_analytics_cache() TO service_role;
  END IF;
END $$;

COMMENT ON TABLE public.public_pool_trend_cache IS
  'Anonymous public trend cache for API v1. Stores aggregate buckets only and does not contain user ids, game uid, or raw history ids.';

COMMENT ON FUNCTION public.refresh_public_pool_trend_cache() IS
  'Refreshes anonymous public trend cache from history. Intended for admin/ops/server-side jobs only.';

COMMENT ON FUNCTION public.refresh_public_analytics_cache() IS
  'Refreshes public per-pool analytics and trend caches, then updates the public cache epoch.';
