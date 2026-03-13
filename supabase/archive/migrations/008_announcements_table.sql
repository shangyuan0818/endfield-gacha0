-- 创建公告表
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',  -- 用于"下次更新前不显示"功能
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 添加注释
COMMENT ON TABLE public.announcements IS '系统公告表';
COMMENT ON COLUMN public.announcements.version IS '公告版本号，用户可选择在此版本更新前不再显示';
COMMENT ON COLUMN public.announcements.is_active IS '公告是否激活显示';
COMMENT ON COLUMN public.announcements.priority IS '显示优先级，数字越大越靠前';

-- 启用 RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 所有人可读取激活的公告
CREATE POLICY "Anyone can read active announcements"
  ON public.announcements FOR SELECT
  USING (is_active = true);

-- 超级管理员可以管理公告
CREATE POLICY "Super admins can manage announcements"
  ON public.announcements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- 插入默认公告
INSERT INTO public.announcements (title, content, version, is_active, priority)
VALUES (
  '欢迎使用抽卡分析器',
  '本站为 《明日方舟：终末地》 抽卡数据统计分析工具。

## 功能说明

- 支持**限定池**、**常驻池**、**武器池**数据录入
- 自动计算保底进度、出货分布
- 支持数据导入导出

> 如需录入数据，请登录后申请成为管理员。',
  '2.1.0',
  true,
  1
);
