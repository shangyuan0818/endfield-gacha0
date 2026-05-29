-- 103: rate limit buckets for Public Analytics API v1.
-- Existing dev_api_public remains as a compatibility fallback.

INSERT INTO public.rate_limit_config (action, max_attempts, window_minutes, lockout_minutes) VALUES
  ('dev_api_catalog', 1200, 60, 5),
  ('dev_api_stats_light', 600, 60, 5),
  ('dev_api_stats_heavy', 120, 60, 10)
ON CONFLICT (action) DO NOTHING;
