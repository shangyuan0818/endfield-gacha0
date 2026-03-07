-- =====================================================
-- "急"按钮点击统计 - Supabase 数据库设置
-- =====================================================
--
-- 使用方法:
-- 1. 登录你的 Supabase 项目
-- 2. 进入 SQL Editor
-- 3. 复制并执行下面的 SQL 语句
--
-- =====================================================

-- 1. 创建全局统计表
CREATE TABLE IF NOT EXISTS public.global_stats (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL DEFAULT '0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_global_stats_key ON public.global_stats(key);

-- 3. 插入"急"按钮点击统计的初始记录
INSERT INTO public.global_stats (key, value)
VALUES ('urgent_button_clicks', '0')
ON CONFLICT (key) DO NOTHING;

-- 4. 创建 RPC 函数来原子性地增加点击次数
-- 这个函数确保并发点击时数据的一致性
CREATE OR REPLACE FUNCTION public.increment_urgent_clicks()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_count TEXT;
BEGIN
  -- 使用 FOR UPDATE 锁定行，防止并发更新问题
  UPDATE public.global_stats
  SET
    value = (CAST(value AS BIGINT) + 1)::TEXT,
    updated_at = NOW()
  WHERE key = 'urgent_button_clicks'
  RETURNING value INTO new_count;

  -- 如果记录不存在，则创建
  IF new_count IS NULL THEN
    INSERT INTO public.global_stats (key, value)
    VALUES ('urgent_button_clicks', '1')
    RETURNING value INTO new_count;
  END IF;

  RETURN new_count;
END;
$$;

-- 5. 创建批量增加的 RPC 函数（优化版）
-- 用于批量上传点击次数，减少数据库请求
CREATE OR REPLACE FUNCTION public.increment_urgent_clicks_batch(increment_by BIGINT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_count TEXT;
BEGIN
  -- 使用 FOR UPDATE 锁定行，防止并发更新问题
  UPDATE public.global_stats
  SET
    value = (CAST(value AS BIGINT) + increment_by)::TEXT,
    updated_at = NOW()
  WHERE key = 'urgent_button_clicks'
  RETURNING value INTO new_count;

  -- 如果记录不存在，则创建
  IF new_count IS NULL THEN
    INSERT INTO public.global_stats (key, value)
    VALUES ('urgent_button_clicks', increment_by::TEXT)
    RETURNING value INTO new_count;
  END IF;

  RETURN new_count;
END;
$$;

-- 5. 设置权限 - 允许所有人读取统计数据
-- 注意：根据你的需求调整权限策略

-- 启用行级安全（RLS）
ALTER TABLE public.global_stats ENABLE ROW LEVEL SECURITY;

-- 策略1：允许所有人（包括匿名用户）读取统计数据
CREATE POLICY "Anyone can read global stats"
  ON public.global_stats
  FOR SELECT
  TO public
  USING (true);

-- 策略2：禁止直接更新表（只能通过 RPC 函数更新）
-- 这样可以确保数据一致性
CREATE POLICY "No direct updates"
  ON public.global_stats
  FOR UPDATE
  TO public
  USING (false);

-- 策略3：禁止直接插入
CREATE POLICY "No direct inserts"
  ON public.global_stats
  FOR INSERT
  TO public
  WITH CHECK (false);

-- 策略4：禁止删除
CREATE POLICY "No deletes"
  ON public.global_stats
  FOR DELETE
  TO public
  USING (false);

-- 6. 授予 RPC 函数执行权限给所有人
GRANT EXECUTE ON FUNCTION public.increment_urgent_clicks() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_urgent_clicks_batch(BIGINT) TO anon, authenticated;

-- 7. 创建更新时间触发器（可选）
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_global_stats_updated_at
  BEFORE UPDATE ON public.global_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 设置完成！
-- =====================================================
--
-- 验证设置:
-- 运行以下查询来测试：
-- SELECT * FROM public.global_stats WHERE key = 'urgent_button_clicks';
-- SELECT public.increment_urgent_clicks();
--
-- 注意事项:
-- 1. 确保你的 Supabase 项目已启用实时更新功能
-- 2. 如果需要监控点击统计，可以在 Supabase Dashboard 的
--    Table Editor 中查看 global_stats 表
-- 3. RPC 函数使用了 SECURITY DEFINER，确保它可以绕过 RLS 策略
--    来更新数据
--
-- =====================================================
