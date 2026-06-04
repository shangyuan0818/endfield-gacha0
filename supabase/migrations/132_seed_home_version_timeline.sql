-- 132: seed homepage version timeline config.

INSERT INTO public.site_config (key, value, label, category, updated_at)
SELECT
  'home_version_timeline',
  jsonb_build_object(
    'versions',
    jsonb_build_array(
      jsonb_build_object(
        'id', 'pre-summer-2026',
        'name', '寻遗散记',
        'name_en', 'Lost Heirlooms',
        'starts_at', '2026-06-05T12:00:00+08:00',
        'ends_at', null,
        'enabled', true,
        'order', 10,
        'pool_ids', jsonb_build_array()
      )
    )
  )::text,
  '首页版本时间线',
  'content',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.site_config WHERE key = 'home_version_timeline'
);

UPDATE public.site_config
SET
  value = '2026-06-05T12:00:00+08:00',
  updated_at = NOW()
WHERE key = 'home_next_version_target_at'
  AND (value IS NULL OR trim(value) = '');

INSERT INTO public.site_config (key, value, label, category, updated_at)
SELECT
  'home_next_version_target_at',
  '2026-06-05T12:00:00+08:00',
  '首页下版本倒计时',
  'content',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.site_config WHERE key = 'home_next_version_target_at'
);

UPDATE public.site_config
SET
  value = jsonb_build_object(
    'version', ((extract(epoch from now()) * 1000)::bigint)::text,
    'scope', 'home-version-timeline',
    'reason', 'migration:132_seed_home_version_timeline',
    'updatedAt', now()
  )::text,
  updated_at = NOW()
WHERE key = 'public_cache_epoch';
