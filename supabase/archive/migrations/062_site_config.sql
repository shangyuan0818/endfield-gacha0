-- 062: 站点配置表
-- 将硬编码的备案号、作者信息等从代码迁移到数据库，支持管理面板编辑

CREATE TABLE IF NOT EXISTS public.site_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- RLS: 所有人可读，仅超管可写
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_config_select_all" ON public.site_config
  FOR SELECT USING (true);

CREATE POLICY "site_config_admin_write" ON public.site_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- 预置数据（占位值，部署后通过管理面板配置实际内容）
INSERT INTO public.site_config (key, value, label, category) VALUES
  ('site_version', 'v0.0.0', '站点版本', 'general'),
  ('build_info', '', '构建信息', 'general'),
  ('icp_number', '', 'ICP备案号', 'legal'),
  ('icp_url', 'https://beian.miit.gov.cn/', 'ICP备案链接', 'legal'),
  ('police_number', '', '公安备案号', 'legal'),
  ('police_url', 'https://www.beian.gov.cn/', '公安备案链接', 'legal'),
  ('author_name', '', '作者名', 'social'),
  ('author_bilibili', '', 'Bilibili主页', 'social'),
  ('github_url', '', 'GitHub仓库', 'social')
ON CONFLICT (key) DO NOTHING;
