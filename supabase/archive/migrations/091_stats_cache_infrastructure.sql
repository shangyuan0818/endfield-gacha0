-- ============================================
-- 091: 统计缓存基础设施 (PERF-009)
--
-- 背景:
--   get_global_stats / get_character_ranking_stats / get_user_ranking_stats
--   每次调用都全量扫描 ~60 万行 history 表，即使数据没有变化。
--
-- 目标:
--   1. 创建 stats_cache 表存储预计算结果
--   2. 创建 cached wrapper RPC，通过 count(*) 变更检测 + 缓冲期
--      避免无意义的重复计算
--   3. 全服统计/排名缓冲期 300s，用户排名缓冲期 120s
--   4. 最大 TTL 兜底（全服 24h，用户 6h），防止永不刷新
-- ============================================

-- ── stats_cache 表 ──
CREATE TABLE IF NOT EXISTS public.stats_cache (
  cache_key       TEXT PRIMARY KEY,
  cached_data     JSONB NOT NULL,
  row_fingerprint BIGINT NOT NULL DEFAULT 0,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stats_cache ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.stats_cache IS 'PERF-009: 统计 RPC 结果缓存，通过 history 行数变更检测避免重复计算';

-- ── get_global_stats_cached ──
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
  v_max_ttl       INTERVAL := INTERVAL '24 hours';
BEGIN
  SELECT count(*) INTO v_current_count FROM public.history;

  SELECT cached_data, row_fingerprint, computed_at
    INTO v_cached_data, v_cached_fp, v_cached_at
    FROM public.stats_cache
   WHERE cache_key = 'global_stats';

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

  INSERT INTO public.stats_cache (cache_key, cached_data, row_fingerprint, computed_at)
  VALUES ('global_stats', v_result::JSONB, v_current_count, now())
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

-- ── get_character_ranking_stats_cached ──
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
BEGIN
  SELECT count(*) INTO v_current_count FROM public.history;

  SELECT cached_data, row_fingerprint, computed_at
    INTO v_cached_data, v_cached_fp, v_cached_at
    FROM public.stats_cache
   WHERE cache_key = 'character_ranking';

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
  VALUES ('character_ranking', v_result::JSONB, v_current_count, now())
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

-- ── get_user_ranking_stats_cached ──
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

  v_cache_key := 'user_ranking:' || p_user_id::TEXT;

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

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 091: stats_cache 基础设施 — PERF-009 变更感知缓存';
END $$;
