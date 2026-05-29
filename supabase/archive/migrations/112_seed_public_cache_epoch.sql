-- 112: Seed the public cache epoch used by same-origin public API cache keys.

INSERT INTO public.site_config (key, value, label, category, updated_at)
VALUES (
  'public_cache_epoch',
  jsonb_build_object(
    'version', ((extract(epoch from now()) * 1000)::bigint)::text,
    'scope', 'migration',
    'reason', 'migration:112_seed_public_cache_epoch',
    'updatedAt', now()
  )::text,
  '公共缓存版本',
  'system',
  now()
)
ON CONFLICT (key) DO NOTHING;
