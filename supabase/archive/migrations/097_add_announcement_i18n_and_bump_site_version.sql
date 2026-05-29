ALTER TABLE public.announcements
ADD COLUMN IF NOT EXISTS title_en TEXT;

ALTER TABLE public.announcements
ADD COLUMN IF NOT EXISTS content_en TEXT;

UPDATE public.site_config
SET value = 'v4.0.0'
WHERE key = 'site_version';
