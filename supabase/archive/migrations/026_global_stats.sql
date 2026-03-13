-- =====================================================
-- 迁移文件: 026_global_stats.sql
-- 创建日期: 2026-01-06
-- 描述: "急"按钮全局点击统计功能 (v2.8.0)
-- =====================================================
--
-- 功能说明:
-- 1. 创建 global_stats 表用于存储全局统计数据
-- 2. 创建 RPC 函数支持单次和批量增加点击次数
-- 3. 配置 RLS 策略确保数据安全
-- 4. 添加自动更新时间戳的触发器
--
-- 部署后操作:
-- 1. 在 Supabase Dashboard -> Database -> Replication 中启用 global_stats 表的 Realtime
-- 2. 或执行: ALTER PUBLICATION supabase_realtime ADD TABLE global_stats;
-- 3. 验证 Realtime: 在前端订阅 global_stats 表的变化
--
-- =====================================================

-- 1. 创建全局统计表
CREATE TABLE IF NOT EXISTS public.global_stats (
  id BIGSERIAL PRIMARY KEY,
  stat_key TEXT UNIQUE NOT NULL,  -- 使用 stat_key 避免与 SQL 关键字冲突
  stat_value TEXT NOT NULL DEFAULT '0',  -- 使用 stat_value 避免与 SQL 关键字冲突
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加表注释
COMMENT ON TABLE public.global_stats IS '全局统计数据表，用于存储跨用户的统计信息';
COMMENT ON COLUMN public.global_stats.stat_key IS '统计项的唯一键，如 urgent_button_clicks';
COMMENT ON COLUMN public.global_stats.stat_value IS '统计值，使用 TEXT 类型支持大数字';

-- 2. 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_global_stats_key ON public.global_stats(stat_key);

-- 3. 插入"急"按钮点击统计的初始记录
INSERT INTO public.global_stats (stat_key, stat_value)
VALUES ('urgent_button_clicks', '0')
ON CONFLICT (stat_key) DO NOTHING;

-- 4. 创建 RPC 函数来原子性地增加点击次数（单次）
-- 这个函数确保并发点击时数据的一致性
CREATE OR REPLACE FUNCTION public.increment_urgent_clicks()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count TEXT;
BEGIN
  -- 使用 FOR UPDATE 锁定行，防止并发更新问题
  UPDATE public.global_stats
  SET
    stat_value = (CAST(stat_value AS BIGINT) + 1)::TEXT,
    updated_at = NOW()
  WHERE stat_key = 'urgent_button_clicks'
  RETURNING stat_value INTO new_count;

  -- 如果记录不存在，则创建
  IF new_count IS NULL THEN
    INSERT INTO public.global_stats (stat_key, stat_value)
    VALUES ('urgent_button_clicks', '1')
    RETURNING stat_value INTO new_count;
  END IF;

  RETURN new_count;
END;
$$;

COMMENT ON FUNCTION public.increment_urgent_clicks() IS '原子性地增加"急"按钮点击次数（单次+1）';

-- 5. 创建批量增加的 RPC 函数（优化版）
-- 用于批量上传点击次数，减少数据库请求
CREATE OR REPLACE FUNCTION public.increment_urgent_clicks_batch(increment_by BIGINT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count TEXT;
BEGIN
  -- 验证输入参数
  IF increment_by <= 0 THEN
    RAISE EXCEPTION 'increment_by must be positive';
  END IF;

  -- 使用 FOR UPDATE 锁定行，防止并发更新问题
  UPDATE public.global_stats
  SET
    stat_value = (CAST(stat_value AS BIGINT) + increment_by)::TEXT,
    updated_at = NOW()
  WHERE stat_key = 'urgent_button_clicks'
  RETURNING stat_value INTO new_count;

  -- 如果记录不存在，则创建
  IF new_count IS NULL THEN
    INSERT INTO public.global_stats (stat_key, stat_value)
    VALUES ('urgent_button_clicks', increment_by::TEXT)
    RETURNING stat_value INTO new_count;
  END IF;

  RETURN new_count;
END;
$$;

COMMENT ON FUNCTION public.increment_urgent_clicks_batch(BIGINT) IS '原子性地批量增加"急"按钮点击次数';

-- 6. 设置权限 - 允许所有人读取统计数据
-- 注意：根据你的需求调整权限策略

-- 启用行级安全（RLS）
ALTER TABLE public.global_stats ENABLE ROW LEVEL SECURITY;

-- 策略1：允许所有人（包括匿名用户）读取统计数据
DROP POLICY IF EXISTS "Anyone can read global stats" ON public.global_stats;
CREATE POLICY "Anyone can read global stats"
  ON public.global_stats
  FOR SELECT
  TO public
  USING (true);

-- 策略2：禁止直接更新表（只能通过 RPC 函数更新）
-- 这样可以确保数据一致性
DROP POLICY IF EXISTS "No direct updates" ON public.global_stats;
CREATE POLICY "No direct updates"
  ON public.global_stats
  FOR UPDATE
  TO public
  USING (false);

-- 策略3：禁止直接插入
DROP POLICY IF EXISTS "No direct inserts" ON public.global_stats;
CREATE POLICY "No direct inserts"
  ON public.global_stats
  FOR INSERT
  TO public
  WITH CHECK (false);

-- 策略4：禁止删除
DROP POLICY IF EXISTS "No deletes" ON public.global_stats;
CREATE POLICY "No deletes"
  ON public.global_stats
  FOR DELETE
  TO public
  USING (false);

-- 7. 授予 RPC 函数执行权限给所有人
GRANT EXECUTE ON FUNCTION public.increment_urgent_clicks() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_urgent_clicks_batch(BIGINT) TO anon, authenticated;

-- 8. 创建更新时间触发器
CREATE OR REPLACE FUNCTION public.update_global_stats_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_global_stats_updated_at ON public.global_stats;
CREATE TRIGGER update_global_stats_updated_at
  BEFORE UPDATE ON public.global_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_global_stats_timestamp();

COMMENT ON FUNCTION public.update_global_stats_timestamp() IS '自动更新 global_stats 表的 updated_at 字段';

-- =====================================================
-- 迁移完成！
-- =====================================================
--
-- 下一步操作（重要）:
-- 1. 在 Supabase Dashboard 中启用 Realtime:
--    - 导航到: Database -> Replication
--    - 找到 global_stats 表
--    - 启用 Realtime 开关
--    - 或执行: ALTER PUBLICATION supabase_realtime ADD TABLE global_stats;
--
-- 2. 验证设置:
--    运行以下查询来测试：
--    SELECT * FROM public.global_stats WHERE stat_key = 'urgent_button_clicks';
--    SELECT public.increment_urgent_clicks();
--    SELECT public.increment_urgent_clicks_batch(5);
--
-- 3. 故障排查:
--    - 如果 RPC 调用失败，检查函数权限
--    - 如果 Realtime 不工作，确认已启用表的实时复制
--    - 检查前端 statsService.js 的配置
--
-- =====================================================
