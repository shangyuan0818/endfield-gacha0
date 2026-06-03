-- 131: bump public site version for v4.5.1.

UPDATE public.site_config
SET
  value = 'v4.5.1',
  updated_at = NOW()
WHERE key = 'site_version';

INSERT INTO public.site_config (key, value, label, category, updated_at)
SELECT
  'site_version',
  'v4.5.1',
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
    'reason', 'migration:131_bump_site_version_451',
    'updatedAt', now()
  )::text,
  updated_at = NOW()
WHERE key = 'public_cache_epoch';
