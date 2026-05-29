-- 104: distinguish update announcements from temporary status-style notices.
-- Existing rows remain update announcements.

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS announcement_type TEXT NOT NULL DEFAULT 'update',
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info';

ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_type_check;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_type_check
  CHECK (announcement_type IN ('update', 'temporary'));

ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_severity_check;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_severity_check
  CHECK (severity IN ('info', 'maintenance', 'warning', 'critical'));

UPDATE public.announcements
   SET announcement_type = 'update'
 WHERE announcement_type IS NULL;

UPDATE public.announcements
   SET severity = 'info'
 WHERE severity IS NULL;

COMMENT ON COLUMN public.announcements.announcement_type IS
  '站点公告类型：update 为更新公告，temporary 为临时公告。';

COMMENT ON COLUMN public.announcements.severity IS
  '临时公告重要程度：info / maintenance / warning / critical。更新公告默认 info。';
