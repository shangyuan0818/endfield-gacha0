-- 110: add pool-type quota summaries to global stats cache.
--
-- Migration 109 made extra / Joint pools visible in global stats and rankings.
-- The global all-pool resource summary can still receive aggregate quota data
-- from the character catalog RPC, but pool-type views need per-type quota
-- summaries. This migration computes quota aggregates by classified pool type
-- and injects them into get_global_stats_cached().

CREATE OR REPLACE FUNCTION public.get_pool_type_quota_stats()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH history_base AS MATERIALIZED (
  SELECT
    h.pool_id,
    h.user_id,
    h.rarity,
    h.special_type,
    h.is_standard,
    h.character_name,
    h.item_name,
    p.type AS pool_type
  FROM public.history AS h
  LEFT JOIN public.pools AS p ON p.pool_id = h.pool_id
  WHERE h.special_type IS DISTINCT FROM 'gift'
),
history_classified AS MATERIALIZED (
  SELECT
    hb.pool_id,
    hb.user_id,
    hb.rarity,
    COALESCE(NULLIF(hb.character_name, ''), NULLIF(hb.item_name, ''), '') AS item_name,
    CASE
      WHEN hb.pool_type = 'extra' OR hb.pool_id LIKE 'joint_%' OR hb.pool_id LIKE 'extra_%' THEN 'extra'
      WHEN hb.pool_type IN ('limited', 'limited_character') THEN 'limited'
      WHEN hb.pool_type IN ('weapon', 'limited_weapon') THEN 'weapon'
      WHEN hb.pool_type IN ('standard', 'beginner') OR hb.pool_id IN ('standard', 'beginner') THEN 'standard'
      WHEN split_part(hb.pool_id, '_', 1) = 'special' THEN 'limited'
      WHEN split_part(hb.pool_id, '_', 1) IN ('weaponbox', 'weponbox') THEN 'weapon'
      WHEN COALESCE(hb.is_standard, false) THEN 'standard'
      ELSE 'limited'
    END AS classified_pool_type
  FROM history_base AS hb
),
quota_rows AS MATERIALIZED (
  SELECT
    hc.classified_pool_type,
    hc.user_id,
    hc.rarity,
    COALESCE(c.type, CASE WHEN hc.classified_pool_type = 'weapon' THEN 'weapon' ELSE 'character' END) AS item_type,
    COALESCE(c.id::TEXT, lower(trim(hc.item_name))) AS item_key
  FROM history_classified AS hc
  LEFT JOIN public.characters AS c
    ON lower(c.name) = lower(trim(hc.item_name))
  WHERE hc.item_name <> ''
    AND hc.rarity >= 4
),
character_copies AS MATERIALIZED (
  SELECT
    classified_pool_type,
    user_id,
    item_key,
    MAX(rarity) AS rarity,
    COUNT(*)::BIGINT AS copies
  FROM quota_rows
  WHERE item_type IS DISTINCT FROM 'weapon'
  GROUP BY classified_pool_type, user_id, item_key
),
character_quota_by_type AS MATERIALIZED (
  SELECT
    classified_pool_type,
    COALESCE(SUM(CASE WHEN rarity BETWEEN 4 AND 6 AND copies > 0 THEN 30 ELSE 0 END), 0)::BIGINT AS aic_quota_direct,
    COALESCE(SUM(CASE
      WHEN rarity = 5 THEN GREATEST(copies - 6, 0) * 20
      WHEN rarity = 4 THEN GREATEST(copies - 6, 0) * 5
      ELSE 0
    END), 0)::BIGINT AS aic_quota_convertible,
    COALESCE(SUM(CASE
      WHEN rarity >= 6 THEN GREATEST(copies - 1, 0) * 50
      WHEN rarity = 5 THEN GREATEST(copies - 1, 0) * 10
      ELSE 0
    END), 0)::BIGINT AS bond_quota_direct,
    COALESCE(SUM(CASE WHEN rarity >= 6 THEN GREATEST(copies - 6, 0) * 10 ELSE 0 END), 0)::BIGINT AS endpoint_quota_convertible,
    COALESCE(SUM(GREATEST(copies - 1, 0)), 0)::BIGINT AS trust_tokens_gained,
    COALESCE(SUM(GREATEST(copies - 6, 0)), 0)::BIGINT AS excess_trust_tokens
  FROM character_copies
  GROUP BY classified_pool_type
),
weapon_quota_by_type AS MATERIALIZED (
  SELECT
    classified_pool_type,
    COALESCE(SUM(CASE
      WHEN rarity >= 6 THEN 50
      WHEN rarity = 5 THEN 10
      ELSE 0
    END), 0)::BIGINT AS aic_quota_direct
  FROM quota_rows
  WHERE item_type = 'weapon'
  GROUP BY classified_pool_type
),
extra_pull_quota_by_type AS MATERIALIZED (
  SELECT
    'extra'::TEXT AS classified_pool_type,
    COUNT(*)::BIGINT AS bond_quota_direct
  FROM history_classified
  WHERE classified_pool_type = 'extra'
),
pool_types AS (
  SELECT 'extra'::TEXT AS classified_pool_type
  UNION ALL SELECT 'limited'
  UNION ALL SELECT 'standard'
  UNION ALL SELECT 'weapon'
)
SELECT json_object_agg(
  pt.classified_pool_type,
  json_build_object(
    'aicQuotaDirect',
      COALESCE(cq.aic_quota_direct, 0) + COALESCE(wq.aic_quota_direct, 0),
    'aicQuotaConvertible',
      COALESCE(cq.aic_quota_convertible, 0),
    'aicQuotaTotalPotential',
      COALESCE(cq.aic_quota_direct, 0) + COALESCE(wq.aic_quota_direct, 0) + COALESCE(cq.aic_quota_convertible, 0),
    'bondQuotaDirect',
      COALESCE(cq.bond_quota_direct, 0) + COALESCE(epq.bond_quota_direct, 0),
    'endpointQuotaConvertible',
      COALESCE(cq.endpoint_quota_convertible, 0),
    'trustTokensGained',
      COALESCE(cq.trust_tokens_gained, 0),
    'excessTrustTokens',
      COALESCE(cq.excess_trust_tokens, 0)
  )
) AS quota_by_type
FROM pool_types AS pt
LEFT JOIN character_quota_by_type AS cq
  ON cq.classified_pool_type = pt.classified_pool_type
LEFT JOIN weapon_quota_by_type AS wq
  ON wq.classified_pool_type = pt.classified_pool_type
LEFT JOIN extra_pull_quota_by_type AS epq
  ON epq.classified_pool_type = pt.classified_pool_type;
$$;

ALTER FUNCTION public.get_pool_type_quota_stats()
  SET statement_timeout = '120s';

GRANT EXECUTE ON FUNCTION public.get_pool_type_quota_stats() TO anon, authenticated;

DELETE FROM public.stats_cache
WHERE cache_key IN ('global_stats', 'global_stats:v2', 'global_stats:v3');

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
  v_max_ttl       INTERVAL := INTERVAL '24 hours';
  v_cache_key     TEXT := 'global_stats:v3';
BEGIN
  SELECT count(*) INTO v_current_count FROM public.history;

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

  v_result_data := COALESCE(v_result::JSONB, '{}'::JSONB);
  v_result_data := jsonb_set(v_result_data, '{byType,extra,quotaSummary}', COALESCE(v_quota_data -> 'extra', '{}'::JSONB), true);
  v_result_data := jsonb_set(v_result_data, '{byType,limited,quotaSummary}', COALESCE(v_quota_data -> 'limited', '{}'::JSONB), true);
  v_result_data := jsonb_set(v_result_data, '{byType,standard,quotaSummary}', COALESCE(v_quota_data -> 'standard', '{}'::JSONB), true);
  v_result_data := jsonb_set(v_result_data, '{byType,weapon,quotaSummary}', COALESCE(v_quota_data -> 'weapon', '{}'::JSONB), true);
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

ALTER FUNCTION public.get_global_stats_cached(INT)
  SET statement_timeout = '120s';

GRANT EXECUTE ON FUNCTION public.get_global_stats_cached(INT) TO anon, authenticated;
