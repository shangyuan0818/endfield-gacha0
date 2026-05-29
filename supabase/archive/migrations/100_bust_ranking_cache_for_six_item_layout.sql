-- 排行榜缓存之前只按 history 行数判断是否失效。
-- 当统计函数本身的聚合逻辑变化（例如限定池 UP 6★ 从前 5 扩展到前 6）时，
-- 旧缓存仍可能在很长时间内持续返回陈旧结果。

DELETE FROM public.stats_cache
WHERE cache_key = 'character_ranking'
   OR cache_key = 'character_ranking:v2'
   OR cache_key LIKE 'user_ranking:%'
   OR cache_key LIKE 'user_ranking:v2:%';

CREATE OR REPLACE FUNCTION public.get_character_ranking_stats_cached(
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
  v_cache_key     TEXT := 'character_ranking:v2';
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

  SELECT public.get_character_ranking_stats() INTO v_result;

  INSERT INTO public.stats_cache (cache_key, cached_data, row_fingerprint, computed_at)
  VALUES (v_cache_key, v_result::JSONB, v_current_count, now())
  ON CONFLICT (cache_key) DO UPDATE SET
    cached_data     = EXCLUDED.cached_data,
    row_fingerprint = EXCLUDED.row_fingerprint,
    computed_at     = EXCLUDED.computed_at;

  RETURN v_result;
END;
$$;

ALTER FUNCTION public.get_character_ranking_stats_cached(INT)
  SET statement_timeout = '90s';

GRANT EXECUTE ON FUNCTION public.get_character_ranking_stats_cached(INT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_user_ranking_stats_cached(
  p_user_id UUID,
  p_buffer_seconds INT DEFAULT 120
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count BIGINT;
  v_cache_key     TEXT;
  v_cached_data   JSONB;
  v_cached_fp     BIGINT;
  v_cached_at     TIMESTAMPTZ;
  v_result        JSON;
  v_max_ttl       INTERVAL := INTERVAL '6 hours';
BEGIN
  SELECT count(*) INTO v_current_count
    FROM public.history
   WHERE user_id = p_user_id;

  v_cache_key := 'user_ranking:v2:' || p_user_id::TEXT;

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

  SELECT public.get_user_ranking_stats(p_user_id) INTO v_result;

  INSERT INTO public.stats_cache (cache_key, cached_data, row_fingerprint, computed_at)
  VALUES (v_cache_key, v_result::JSONB, v_current_count, now())
  ON CONFLICT (cache_key) DO UPDATE SET
    cached_data     = EXCLUDED.cached_data,
    row_fingerprint = EXCLUDED.row_fingerprint,
    computed_at     = EXCLUDED.computed_at;

  RETURN v_result;
END;
$$;

ALTER FUNCTION public.get_user_ranking_stats_cached(UUID, INT)
  SET statement_timeout = '90s';

GRANT EXECUTE ON FUNCTION public.get_user_ranking_stats_cached(UUID, INT) TO anon, authenticated;
