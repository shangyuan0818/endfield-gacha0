-- 114: add public per-pool analytics cache for developer API v1.
--
-- The public API must not compute target/off-rate, average pity, or pity
-- distribution buckets by scanning raw history during request handling. This
-- cache is refreshed by controlled admin/ops jobs and read by same-origin API
-- handlers. The table stores anonymous aggregate data only.

CREATE TABLE IF NOT EXISTS public.public_pool_analytics_cache (
  pool_id TEXT PRIMARY KEY,
  pool_type TEXT NOT NULL CHECK (pool_type IN ('extra', 'limited', 'standard', 'weapon', 'beginner')),
  total_pulls BIGINT NOT NULL DEFAULT 0,
  total_pulls_with_free BIGINT NOT NULL DEFAULT 0,
  free_pull_count BIGINT NOT NULL DEFAULT 0,
  rarity_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_six_star BIGINT NOT NULL DEFAULT 0,
  offrate_six_star BIGINT NOT NULL DEFAULT 0,
  avg_pity_six_star NUMERIC(10, 2),
  avg_pity_five_star NUMERIC(10, 2),
  avg_pity_target_six_star NUMERIC(10, 2),
  distribution JSONB NOT NULL DEFAULT '[]'::jsonb,
  first_pull_at TIMESTAMPTZ,
  last_pull_at TIMESTAMPTZ,
  source_version TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_pool_analytics_cache_type
  ON public.public_pool_analytics_cache(pool_type);

CREATE INDEX IF NOT EXISTS idx_public_pool_analytics_cache_last_pull
  ON public.public_pool_analytics_cache(last_pull_at DESC NULLS LAST);

ALTER TABLE public.public_pool_analytics_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_pool_analytics_cache_select_policy
  ON public.public_pool_analytics_cache;

CREATE POLICY public_pool_analytics_cache_select_policy
  ON public.public_pool_analytics_cache
  FOR SELECT
  USING (true);

GRANT SELECT ON public.public_pool_analytics_cache TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_public_pool_analytics_cache()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_refreshed_count INTEGER := 0;
BEGIN
  TRUNCATE public.public_pool_analytics_cache;

  WITH history_base AS MATERIALIZED (
    SELECT
      h.pool_id,
      h.user_id,
      h.record_id,
      h.seq_id,
      h.rarity,
      h.special_type,
      h.is_free,
      h.is_standard,
      h.character_name,
      h.item_name,
      h.timestamp,
      h.updated_at,
      p.type AS raw_pool_type,
      p.up_character
    FROM public.history AS h
    LEFT JOIN public.pools AS p
      ON p.pool_id = h.pool_id
    WHERE h.pool_id IS NOT NULL
  ),
  history_enriched AS MATERIALIZED (
    SELECT
      hb.*,
      CASE
        WHEN hb.raw_pool_type = 'extra' OR hb.pool_id LIKE 'joint_%' OR hb.pool_id LIKE 'extra_%' THEN 'extra'
        WHEN hb.raw_pool_type IN ('limited', 'limited_character') OR hb.pool_id LIKE 'special_%' THEN 'limited'
        WHEN hb.raw_pool_type IN ('weapon', 'limited_weapon') OR hb.pool_id LIKE 'weapon%' OR hb.pool_id LIKE 'wepon%' THEN 'weapon'
        WHEN hb.raw_pool_type IN ('standard', 'beginner') OR hb.pool_id IN ('standard', 'beginner') THEN 'standard'
        WHEN COALESCE(hb.is_standard, false) THEN 'standard'
        ELSE 'limited'
      END AS pool_type,
      CASE
        WHEN hb.raw_pool_type IN ('standard', 'beginner') OR hb.pool_id IN ('standard', 'beginner') THEN true
        WHEN hb.rarity = 6 AND (hb.raw_pool_type = 'extra' OR hb.pool_id LIKE 'joint_%' OR hb.pool_id LIKE 'extra_%') THEN false
        WHEN hb.rarity = 6
          AND hb.up_character IS NOT NULL
          AND hb.up_character <> ''
          AND lower(trim(COALESCE(NULLIF(hb.character_name, ''), NULLIF(hb.item_name, ''), ''))) <> ''
        THEN NOT (
          lower(trim(COALESCE(NULLIF(hb.character_name, ''), NULLIF(hb.item_name, ''), ''))) LIKE '%' || lower(trim(hb.up_character)) || '%'
          OR lower(trim(hb.up_character)) LIKE '%' || lower(trim(COALESCE(NULLIF(hb.character_name, ''), NULLIF(hb.item_name, ''), ''))) || '%'
        )
        ELSE COALESCE(hb.is_standard, false)
      END AS is_standard_calc,
      CASE
        WHEN hb.rarity <> 6 THEN false
        WHEN hb.raw_pool_type IN ('standard', 'beginner') OR hb.pool_id IN ('standard', 'beginner') THEN false
        WHEN hb.raw_pool_type = 'extra' OR hb.pool_id LIKE 'joint_%' OR hb.pool_id LIKE 'extra_%' THEN true
        WHEN hb.up_character IS NOT NULL
          AND hb.up_character <> ''
          AND lower(trim(COALESCE(NULLIF(hb.character_name, ''), NULLIF(hb.item_name, ''), ''))) <> ''
        THEN (
          lower(trim(COALESCE(NULLIF(hb.character_name, ''), NULLIF(hb.item_name, ''), ''))) LIKE '%' || lower(trim(hb.up_character)) || '%'
          OR lower(trim(hb.up_character)) LIKE '%' || lower(trim(COALESCE(NULLIF(hb.character_name, ''), NULLIF(hb.item_name, ''), ''))) || '%'
        )
        ELSE COALESCE(hb.is_standard, false) IS NOT TRUE
      END AS is_target_calc
    FROM history_base AS hb
  ),
  visible_history AS MATERIALIZED (
    SELECT *
    FROM history_enriched
    WHERE special_type IS DISTINCT FROM 'gift'
  ),
  paid_history AS MATERIALIZED (
    SELECT *
    FROM visible_history
    WHERE is_free IS NOT TRUE
  ),
  numbered_paid_history AS MATERIALIZED (
    SELECT
      *,
      ROW_NUMBER() OVER (
        PARTITION BY pool_id, user_id
        ORDER BY timestamp NULLS LAST, COALESCE(seq_id, record_id), record_id
      ) AS rn
    FROM paid_history
  ),
  six_star_pity AS MATERIALIZED (
    SELECT
      pool_id,
      user_id,
      pool_type,
      is_standard_calc,
      is_target_calc,
      LEAST(
        rn - COALESCE(LAG(rn) OVER (PARTITION BY pool_id, user_id ORDER BY rn), 0),
        80
      ) AS pity
    FROM numbered_paid_history
    WHERE rarity = 6
  ),
  five_star_pity AS MATERIALIZED (
    SELECT
      pool_id,
      user_id,
      LEAST(
        rn - COALESCE(LAG(rn) OVER (PARTITION BY pool_id, user_id ORDER BY rn), 0),
        10
      ) AS pity
    FROM numbered_paid_history
    WHERE rarity = 5
  ),
  pity_ranges AS MATERIALIZED (
    SELECT
      pool_id,
      is_standard_calc,
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
    FROM six_star_pity
  ),
  distribution_rows AS MATERIALIZED (
    SELECT
      pool_id,
      range_label,
      COUNT(*) FILTER (WHERE is_standard_calc = false) AS limited_count,
      COUNT(*) FILTER (WHERE is_standard_calc = true) AS standard_count
    FROM pity_ranges
    GROUP BY pool_id, range_label
  ),
  pool_distributions AS MATERIALIZED (
    SELECT
      pool_id,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'range', REPLACE(range_label, '01-10', '1-10'),
            'limited', limited_count,
            'standard', standard_count
          )
          ORDER BY range_label
        ),
        '[]'::jsonb
      ) AS distribution
    FROM distribution_rows
    GROUP BY pool_id
  ),
  pool_counts AS MATERIALIZED (
    SELECT
      pool_id,
      MAX(pool_type) AS pool_type,
      COUNT(*) AS total_pulls,
      COUNT(*) FILTER (WHERE rarity <= 4) AS four_star,
      COUNT(*) FILTER (WHERE rarity = 5) AS five_star,
      COUNT(*) FILTER (WHERE rarity = 6) AS six_star,
      COUNT(*) FILTER (WHERE rarity = 6 AND is_target_calc = true) AS target_six_star,
      COUNT(*) FILTER (WHERE rarity = 6 AND is_standard_calc = true) AS offrate_six_star,
      MIN(timestamp) AS first_pull_at,
      MAX(timestamp) AS last_pull_at,
      MAX(updated_at) AS latest_history_update
    FROM paid_history
    GROUP BY pool_id
  ),
  pool_free_counts AS MATERIALIZED (
    SELECT
      pool_id,
      COUNT(*) AS total_pulls_with_free,
      COUNT(*) FILTER (WHERE is_free = true) AS free_pull_count
    FROM visible_history
    GROUP BY pool_id
  ),
  six_star_avg AS MATERIALIZED (
    SELECT
      pool_id,
      ROUND(AVG(pity)::numeric, 2) AS avg_pity_six_star
    FROM six_star_pity
    GROUP BY pool_id
  ),
  five_star_avg AS MATERIALIZED (
    SELECT
      pool_id,
      ROUND(AVG(pity)::numeric, 2) AS avg_pity_five_star
    FROM five_star_pity
    GROUP BY pool_id
  )
  INSERT INTO public.public_pool_analytics_cache (
    pool_id,
    pool_type,
    total_pulls,
    total_pulls_with_free,
    free_pull_count,
    rarity_counts,
    target_six_star,
    offrate_six_star,
    avg_pity_six_star,
    avg_pity_five_star,
    avg_pity_target_six_star,
    distribution,
    first_pull_at,
    last_pull_at,
    source_version,
    updated_at
  )
  SELECT
    pc.pool_id,
    pc.pool_type,
    pc.total_pulls,
    COALESCE(pfc.total_pulls_with_free, pc.total_pulls),
    COALESCE(pfc.free_pull_count, 0),
    jsonb_build_object(
      '4', COALESCE(pc.four_star, 0),
      '5', COALESCE(pc.five_star, 0),
      '6', COALESCE(pc.six_star, 0)
    ),
    COALESCE(pc.target_six_star, 0),
    COALESCE(pc.offrate_six_star, 0),
    ssa.avg_pity_six_star,
    fsa.avg_pity_five_star,
    CASE
      WHEN COALESCE(pc.target_six_star, 0) > 0
      THEN ROUND((pc.total_pulls::numeric / NULLIF(pc.target_six_star, 0)), 2)
      ELSE NULL
    END AS avg_pity_target_six_star,
    COALESCE(pd.distribution, '[]'::jsonb),
    pc.first_pull_at,
    pc.last_pull_at,
    md5(CONCAT_WS(':', pc.pool_id, pc.total_pulls::text, COALESCE(pc.latest_history_update::text, ''))),
    NOW()
  FROM pool_counts AS pc
  LEFT JOIN pool_free_counts AS pfc
    ON pfc.pool_id = pc.pool_id
  LEFT JOIN six_star_avg AS ssa
    ON ssa.pool_id = pc.pool_id
  LEFT JOIN five_star_avg AS fsa
    ON fsa.pool_id = pc.pool_id
  LEFT JOIN pool_distributions AS pd
    ON pd.pool_id = pc.pool_id;

  GET DIAGNOSTICS v_refreshed_count = ROW_COUNT;

  UPDATE public.site_config
  SET value = jsonb_build_object(
    'version', ((extract(epoch from now()) * 1000)::bigint)::text,
    'scope', 'stats',
    'reason', 'refresh_public_pool_analytics_cache',
    'updatedAt', now()
  )::text,
  updated_at = now()
  WHERE key = 'public_cache_epoch';

  RETURN jsonb_build_object(
    'success', true,
    'refreshedPools', v_refreshed_count,
    'updatedAt', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_public_pool_analytics_cache() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.refresh_public_pool_analytics_cache() TO service_role;
  END IF;
END $$;

COMMENT ON TABLE public.public_pool_analytics_cache IS
  'Anonymous public per-pool analytics cache for API v1. Does not contain user ids, game uid, or raw history ids.';

COMMENT ON FUNCTION public.refresh_public_pool_analytics_cache() IS
  'Refreshes anonymous public per-pool analytics cache from history. Intended for admin/ops/server-side jobs only.';
