-- 133: extend public analytics refresh timeout for production-size history.
--
-- Production refresh currently completes inside the database in about half a
-- minute, but PostgREST RPC can still inherit a shorter statement timeout and
-- cancel the request. Keep the analytics SQL unchanged and only give the three
-- refresh functions enough time to finish through the normal admin/API path.

ALTER FUNCTION public.refresh_public_pool_analytics_cache()
  SET statement_timeout = '10min';

ALTER FUNCTION public.refresh_public_pool_trend_cache()
  SET statement_timeout = '10min';

ALTER FUNCTION public.refresh_public_analytics_cache()
  SET statement_timeout = '10min';
