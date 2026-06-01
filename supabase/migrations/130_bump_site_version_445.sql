-- 130: bump public site version for v4.4.5.

UPDATE public.site_config
SET
  value = 'v4.4.5',
  updated_at = NOW()
WHERE key = 'site_version';

INSERT INTO public.site_config (key, value, label, category, updated_at)
SELECT
  'site_version',
  'v4.4.5',
  '站点版本',
  'general',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.site_config WHERE key = 'site_version'
);

UPDATE public.site_config
SET
  value = jsonb_build_object(
    'version', ((extract(epoch from now()) * 1000)::bigint)::text,
    'scope', 'site-config',
    'reason', 'migration:130_bump_site_version_445',
    'updatedAt', now()
  )::text,
  updated_at = NOW()
WHERE key = 'public_cache_epoch';
