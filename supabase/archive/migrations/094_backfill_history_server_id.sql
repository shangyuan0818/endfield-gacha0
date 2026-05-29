-- 094: backfill history.server_id / region and invalidate stats cache

-- 1) INTL: game_uid does not start with '1', is not empty
UPDATE public.history
SET server_id = '2',
    region    = 'intl'
WHERE server_id IS NULL
  AND game_uid IS NOT NULL
  AND game_uid <> ''
  AND NOT (game_uid ~ '^1[0-9]+$');

-- 2) Remaining NULL records default to CN
UPDATE public.history
SET server_id = '1',
    region    = 'cn'
WHERE server_id IS NULL;

-- 3) Invalidate global stats cache
DELETE FROM public.stats_cache WHERE cache_key = 'global_stats';
