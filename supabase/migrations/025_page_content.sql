-- ============================================
-- 025: 页面内容管理
-- 支持超管编辑首页使用指南等内容
-- ============================================

-- 1. 创建页面内容表
CREATE TABLE IF NOT EXISTS public.page_content (
  id TEXT PRIMARY KEY,  -- 页面标识，如 'home_guide', 'home_welcome'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 启用 RLS
ALTER TABLE public.page_content ENABLE ROW LEVEL SECURITY;

-- 3. RLS 策略：所有人可读取激活的内容
CREATE POLICY "page_content_select_active" ON public.page_content
  FOR SELECT USING (is_active = true);

-- 4. RLS 策略：超管可读取所有内容（包括未激活）
CREATE POLICY "page_content_select_super" ON public.page_content
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- 5. RLS 策略：仅超管可插入、更新、删除
CREATE POLICY "page_content_insert_super" ON public.page_content
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "page_content_update_super" ON public.page_content
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "page_content_delete_super" ON public.page_content
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- 6. 添加 updated_at 触发器
DROP TRIGGER IF EXISTS update_page_content_updated_at ON public.page_content;
CREATE TRIGGER update_page_content_updated_at
  BEFORE UPDATE ON public.page_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. 插入默认内容（首页使用指南）
INSERT INTO public.page_content (id, title, content, is_active)
VALUES (
  'home_guide',
  '使用指南',
  '## 快速开始

### 第一步：登录账号
点击右上角「登录」按钮注册或登录您的账号。

### 第二步：申请管理员权限
如需录入数据，请点击右上角「申请」按钮申请成为管理员。

### 第三步：选择或创建卡池
点击顶部卡池切换器选择现有卡池或创建新卡池。

### 第四步：录入抽卡数据
在「卡池详情」页面使用单抽、十连或文本录入数据。

---

## 文本录入格式

连续输入数字代表星级，无需空格分隔：
- `4` - 4星
- `5` - 5星
- `6` - 6星限定
- `6s` 或 `6歪` - 6星常驻(歪)

用逗号、分号或斜杠分隔多组十连。

**示例**: `4454464444,4445444454`
',
  true
)
ON CONFLICT (id) DO NOTHING;

-- 8. 添加注释
COMMENT ON TABLE public.page_content IS '页面内容表，存储可编辑的静态页面内容';
COMMENT ON COLUMN public.page_content.id IS '页面标识符，如 home_guide';
COMMENT ON COLUMN public.page_content.title IS '内容标题';
COMMENT ON COLUMN public.page_content.content IS '内容正文（支持 Markdown）';
COMMENT ON COLUMN public.page_content.is_active IS '是否激活显示';
COMMENT ON COLUMN public.page_content.updated_by IS '最后更新者';
