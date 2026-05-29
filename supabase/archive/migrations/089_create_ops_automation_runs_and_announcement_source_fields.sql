-- ============================================
-- 089: 运营自动化运行审计表 + 公告源元数据
--
-- 目标:
--   1. 为自动抓取任务保留可查询的运行记录、差异摘要与人工审核包
--   2. 给 announcements 增加 source_id / source_url / published_at / summary，
--      使自动导入公告与站内手工公告可以并存
-- ============================================

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS source_id TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS summary TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_announcements_source_id
  ON public.announcements(source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_announcements_published_at
  ON public.announcements(published_at DESC);

COMMENT ON COLUMN public.announcements.source_id IS
  '自动同步公告的外部源主键；手工公告可为空。';

COMMENT ON COLUMN public.announcements.source_url IS
  '自动同步公告的原始来源链接。';

COMMENT ON COLUMN public.announcements.published_at IS
  '自动同步公告的原始发布时间。';

COMMENT ON COLUMN public.announcements.summary IS
  '自动同步公告的摘要/导语；手工公告可为空。';

CREATE TABLE IF NOT EXISTS public.ops_automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  job_label TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'api'
    CHECK (trigger_type IN ('cron', 'manual', 'api')),
  status TEXT NOT NULL
    CHECK (status IN ('success', 'failure', 'skipped')),
  dry_run BOOLEAN NOT NULL DEFAULT TRUE,
  dedupe_key TEXT,
  source_tag TEXT,
  source_url TEXT,
  summary JSONB,
  top_changed_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  preview JSONB,
  review_bundle JSONB,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_automation_runs_job_dedupe
  ON public.ops_automation_runs(job_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ops_automation_runs_job_created_at
  ON public.ops_automation_runs(job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_automation_runs_status_created_at
  ON public.ops_automation_runs(status, created_at DESC);

ALTER TABLE public.ops_automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view ops automation runs" ON public.ops_automation_runs;
CREATE POLICY "Super admins can view ops automation runs"
  ON public.ops_automation_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

GRANT SELECT ON public.ops_automation_runs TO authenticated;

DROP TRIGGER IF EXISTS update_ops_automation_runs_updated_at ON public.ops_automation_runs;
CREATE TRIGGER update_ops_automation_runs_updated_at
  BEFORE UPDATE ON public.ops_automation_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.ops_automation_runs IS
  '运营自动化任务运行记录：保存 dry-run 差异摘要、人工审核包与失败原因。';

COMMENT ON COLUMN public.ops_automation_runs.dedupe_key IS
  '调度去重键；cron 任务按日去重，避免平台重复投递造成重复审计记录。';

COMMENT ON COLUMN public.ops_automation_runs.review_bundle IS
  '供人工审核/发布的完整审计包快照。';
