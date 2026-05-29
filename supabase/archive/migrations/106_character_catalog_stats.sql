-- 106: 全服角色图鉴聚合统计
-- 输出按角色聚合后的拥有率、满潜率、拷贝分布与配额汇总；不返回用户级明细。

CREATE OR REPLACE FUNCTION public.get_character_catalog_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  WITH
  valid_history AS (
    SELECT
      h.user_id,
      h.pool_id,
      h.item_name,
      h.rarity
    FROM public.history h
    WHERE h.special_type IS DISTINCT FROM 'gift'
      AND h.item_name IS NOT NULL
      AND h.item_name <> ''
      AND h.user_id IS NOT NULL
  ),
  contributors AS (
    SELECT COUNT(DISTINCT user_id)::BIGINT AS total_contributors
    FROM valid_history
  ),
  catalog AS (
    SELECT
      c.id,
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      COALESCE(c.is_limited, false) AS is_limited,
      c.release_date
    FROM public.characters c
    WHERE c.type = 'character'
  ),
  user_copies AS (
    SELECT
      c.id AS character_id,
      h.user_id,
      COUNT(*)::BIGINT AS copies
    FROM valid_history h
    JOIN public.characters c
      ON LOWER(c.name) = LOWER(h.item_name)
     AND c.type = 'character'
    GROUP BY c.id, h.user_id
  ),
  per_character AS (
    SELECT
      c.id,
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      c.is_limited,
      c.release_date,
      COALESCE(COUNT(uc.user_id), 0)::BIGINT AS owner_users,
      GREATEST((SELECT total_contributors FROM contributors) - COALESCE(COUNT(uc.user_id), 0), 0)::BIGINT AS unowned_users,
      CASE
        WHEN (SELECT total_contributors FROM contributors) > 0
        THEN ROUND((COALESCE(COUNT(uc.user_id), 0)::NUMERIC / (SELECT total_contributors FROM contributors)::NUMERIC), 6)
        ELSE 0
      END AS ownership_rate,
      COALESCE(COUNT(uc.user_id) FILTER (WHERE uc.copies >= 6), 0)::BIGINT AS full_potential_users,
      CASE
        WHEN COALESCE(COUNT(uc.user_id), 0) > 0
        THEN ROUND((COALESCE(COUNT(uc.user_id) FILTER (WHERE uc.copies >= 6), 0)::NUMERIC / COALESCE(COUNT(uc.user_id), 0)::NUMERIC), 6)
        ELSE 0
      END AS full_potential_rate_of_owners,
      CASE
        WHEN (SELECT total_contributors FROM contributors) > 0
        THEN ROUND((COALESCE(COUNT(uc.user_id) FILTER (WHERE uc.copies >= 6), 0)::NUMERIC / (SELECT total_contributors FROM contributors)::NUMERIC), 6)
        ELSE 0
      END AS full_potential_rate_of_contributors,
      COALESCE(SUM(uc.copies), 0)::BIGINT AS total_copies,
      CASE
        WHEN COALESCE(COUNT(uc.user_id), 0) > 0
        THEN ROUND((COALESCE(SUM(uc.copies), 0)::NUMERIC / COALESCE(COUNT(uc.user_id), 0)::NUMERIC), 2)
        ELSE 0
      END AS avg_copies_per_owner,
      COALESCE(COUNT(uc.user_id) FILTER (WHERE uc.copies = 1), 0)::BIGINT AS copies_1,
      COALESCE(COUNT(uc.user_id) FILTER (WHERE uc.copies = 2), 0)::BIGINT AS copies_2,
      COALESCE(COUNT(uc.user_id) FILTER (WHERE uc.copies = 3), 0)::BIGINT AS copies_3,
      COALESCE(COUNT(uc.user_id) FILTER (WHERE uc.copies = 4), 0)::BIGINT AS copies_4,
      COALESCE(COUNT(uc.user_id) FILTER (WHERE uc.copies = 5), 0)::BIGINT AS copies_5,
      COALESCE(COUNT(uc.user_id) FILTER (WHERE uc.copies = 6), 0)::BIGINT AS copies_6,
      COALESCE(COUNT(uc.user_id) FILTER (WHERE uc.copies >= 7), 0)::BIGINT AS copies_7_plus,
      COALESCE(SUM(GREATEST(uc.copies - 1, 0)), 0)::BIGINT AS duplicate_copies,
      COALESCE(SUM(GREATEST(uc.copies - 6, 0)), 0)::BIGINT AS excess_copies
    FROM catalog c
    LEFT JOIN user_copies uc ON uc.character_id = c.id
    GROUP BY c.id, c.name, c.avatar_url, c.rarity, c.type, c.is_limited, c.release_date
  ),
  enriched AS (
    SELECT
      *,
      CASE WHEN rarity BETWEEN 4 AND 6 THEN owner_users * 30 ELSE 0 END AS aic_quota_direct,
      CASE
        WHEN rarity = 5 THEN excess_copies * 20
        WHEN rarity = 4 THEN excess_copies * 5
        ELSE 0
      END AS aic_quota_convertible,
      CASE
        WHEN rarity >= 6 THEN duplicate_copies * 50
        WHEN rarity = 5 THEN duplicate_copies * 10
        ELSE 0
      END AS bond_quota_direct,
      CASE WHEN rarity >= 6 THEN excess_copies * 10 ELSE 0 END AS endpoint_quota_convertible
    FROM per_character
  ),
  weapon_quota AS (
    SELECT
      COALESCE(SUM(
        CASE
          WHEN h.rarity >= 6 THEN 50
          WHEN h.rarity = 5 THEN 10
          ELSE 0
        END
      ), 0)::BIGINT AS aic_quota_direct
    FROM valid_history h
    JOIN public.pools p
      ON p.pool_id = h.pool_id
     AND p.user_id = h.user_id
    LEFT JOIN public.characters c
      ON LOWER(c.name) = LOWER(h.item_name)
    WHERE COALESCE(p.type, '') = 'weapon'
       OR COALESCE(c.type, '') = 'weapon'
  ),
  extra_pull_quota AS (
    SELECT
      COUNT(*)::BIGINT AS bond_quota_direct
    FROM valid_history h
    JOIN public.pools p
      ON p.pool_id = h.pool_id
     AND p.user_id = h.user_id
    WHERE COALESCE(p.type, '') = 'extra'
  ),
  summary AS (
    SELECT
      COUNT(*)::BIGINT AS total_characters,
      COALESCE(COUNT(*) FILTER (WHERE owner_users > 0), 0)::BIGINT AS owned_characters,
      COALESCE(COUNT(*) FILTER (WHERE owner_users = 0), 0)::BIGINT AS unowned_characters,
      CASE
        WHEN COUNT(*) > 0
        THEN ROUND((COALESCE(COUNT(*) FILTER (WHERE owner_users > 0), 0)::NUMERIC / COUNT(*)::NUMERIC), 6)
        ELSE 0
      END AS ownership_rate,
      COALESCE(COUNT(*) FILTER (WHERE full_potential_users > 0), 0)::BIGINT AS full_potential_characters,
      COALESCE(SUM(aic_quota_direct), 0)::BIGINT AS character_aic_quota_direct,
      COALESCE(SUM(aic_quota_convertible), 0)::BIGINT AS character_aic_quota_convertible,
      (COALESCE(SUM(bond_quota_direct), 0) + COALESCE((SELECT bond_quota_direct FROM extra_pull_quota), 0))::BIGINT AS character_bond_quota_direct,
      COALESCE(SUM(endpoint_quota_convertible), 0)::BIGINT AS character_endpoint_quota_convertible,
      COALESCE((SELECT aic_quota_direct FROM weapon_quota), 0)::BIGINT AS weapon_aic_quota_direct,
      COALESCE(SUM(duplicate_copies), 0)::BIGINT AS trust_tokens_gained,
      COALESCE(SUM(excess_copies), 0)::BIGINT AS excess_trust_tokens
    FROM enriched
  )
  SELECT json_build_object(
    'totalContributors', (SELECT total_contributors FROM contributors),
    'summary', json_build_object(
      'totalCharacters', (SELECT total_characters FROM summary),
      'ownedCharacters', (SELECT owned_characters FROM summary),
      'unownedCharacters', (SELECT unowned_characters FROM summary),
      'ownershipRate', (SELECT ownership_rate FROM summary),
      'fullPotentialCharacters', (SELECT full_potential_characters FROM summary),
      'excessTrustTokens', (SELECT excess_trust_tokens FROM summary),
      'quotaAggregate', json_build_object(
        'aicQuotaDirect', (SELECT character_aic_quota_direct + weapon_aic_quota_direct FROM summary),
        'aicQuotaConvertible', (SELECT character_aic_quota_convertible FROM summary),
        'aicQuotaTotalPotential', (SELECT character_aic_quota_direct + weapon_aic_quota_direct + character_aic_quota_convertible FROM summary),
        'bondQuotaDirect', (SELECT character_bond_quota_direct FROM summary),
        'endpointQuotaConvertible', (SELECT character_endpoint_quota_convertible FROM summary),
        'trustTokensGained', (SELECT trust_tokens_gained FROM summary),
        'excessTrustTokens', (SELECT excess_trust_tokens FROM summary)
      ),
      'characterQuotaAggregate', json_build_object(
        'aicQuotaDirect', (SELECT character_aic_quota_direct FROM summary),
        'aicQuotaConvertible', (SELECT character_aic_quota_convertible FROM summary),
        'aicQuotaTotalPotential', (SELECT character_aic_quota_direct + character_aic_quota_convertible FROM summary),
        'bondQuotaDirect', (SELECT character_bond_quota_direct FROM summary),
        'endpointQuotaConvertible', (SELECT character_endpoint_quota_convertible FROM summary),
        'trustTokensGained', (SELECT trust_tokens_gained FROM summary),
        'excessTrustTokens', (SELECT excess_trust_tokens FROM summary)
      ),
      'weaponQuotaAggregate', json_build_object(
        'aicQuotaDirect', (SELECT weapon_aic_quota_direct FROM summary),
        'aicQuotaConvertible', 0,
        'aicQuotaTotalPotential', (SELECT weapon_aic_quota_direct FROM summary),
        'bondQuotaDirect', 0,
        'endpointQuotaConvertible', 0,
        'trustTokensGained', 0,
        'excessTrustTokens', 0
      )
    ),
    'characters', COALESCE((
      SELECT json_agg(json_build_object(
        'id', id,
        'name', name,
        'avatarUrl', avatar_url,
        'rarity', rarity,
        'type', type,
        'isLimited', is_limited,
        'releaseDate', release_date,
        'ownerUsers', owner_users,
        'unownedUsers', unowned_users,
        'ownershipRate', ownership_rate,
        'fullPotentialUsers', full_potential_users,
        'fullPotentialRateOfOwners', full_potential_rate_of_owners,
        'fullPotentialRateOfContributors', full_potential_rate_of_contributors,
        'totalCopies', total_copies,
        'avgCopiesPerOwner', avg_copies_per_owner,
        'copyDistribution', json_build_object(
          '0', unowned_users,
          '1', copies_1,
          '2', copies_2,
          '3', copies_3,
          '4', copies_4,
          '5', copies_5,
          '6', copies_6,
          '7plus', copies_7_plus
        ),
        'quotaAggregate', json_build_object(
          'aicQuotaDirect', aic_quota_direct,
          'aicQuotaConvertible', aic_quota_convertible,
          'aicQuotaTotalPotential', aic_quota_direct + aic_quota_convertible,
          'bondQuotaDirect', bond_quota_direct,
          'endpointQuotaConvertible', endpoint_quota_convertible,
          'trustTokensGained', duplicate_copies,
          'excessTrustTokens', excess_copies
        )
      ) ORDER BY rarity DESC, owner_users DESC, name)
      FROM enriched
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

ALTER FUNCTION public.get_character_catalog_stats()
  SET statement_timeout = '120s';

GRANT EXECUTE ON FUNCTION public.get_character_catalog_stats() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_character_catalog_stats_cached(
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
  v_max_ttl       INTERVAL := INTERVAL '24 hours';
BEGIN
  SELECT count(*) INTO v_current_count FROM public.history;

  SELECT cached_data, row_fingerprint, computed_at
    INTO v_cached_data, v_cached_fp, v_cached_at
    FROM public.stats_cache
   WHERE cache_key = 'character_catalog';

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

  SELECT public.get_character_catalog_stats() INTO v_result;

  INSERT INTO public.stats_cache (cache_key, cached_data, row_fingerprint, computed_at)
  VALUES ('character_catalog', v_result::JSONB, v_current_count, now())
  ON CONFLICT (cache_key) DO UPDATE SET
    cached_data     = EXCLUDED.cached_data,
    row_fingerprint = EXCLUDED.row_fingerprint,
    computed_at     = EXCLUDED.computed_at;

  RETURN v_result;
END;
$$;

ALTER FUNCTION public.get_character_catalog_stats_cached(INT)
  SET statement_timeout = '120s';

GRANT EXECUTE ON FUNCTION public.get_character_catalog_stats_cached(INT) TO anon, authenticated;

DELETE FROM public.stats_cache WHERE cache_key = 'character_catalog';
