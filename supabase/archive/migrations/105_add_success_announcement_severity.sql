-- 105: add a green resolved/recovery severity for temporary notices.

ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_severity_check;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_severity_check
  CHECK (severity IN ('info', 'success', 'maintenance', 'warning', 'critical'));

COMMENT ON COLUMN public.announcements.severity IS
  '临时公告重要程度：info / success / maintenance / warning / critical。更新公告默认 info。';
