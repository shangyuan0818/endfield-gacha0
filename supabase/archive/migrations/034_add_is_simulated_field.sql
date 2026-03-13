-- 添加 is_simulated 字段用于标识模拟数据
-- 创建时间: 2026-01-18
-- 用途: 区分真实抽卡数据和模拟器生成的数据

-- 1. 添加 is_simulated 字段到 history 表
ALTER TABLE public.history
ADD COLUMN IF NOT EXISTS is_simulated BOOLEAN DEFAULT FALSE;

-- 2. 添加注释说明
COMMENT ON COLUMN public.history.is_simulated IS '是否为模拟器数据（true=模拟数据，false=真实数据）';

-- 3. 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_history_is_simulated
  ON public.history(user_id, is_simulated);

-- 4. 创建复合索引（用户+卡池+是否模拟）
CREATE INDEX IF NOT EXISTS idx_history_user_pool_simulated
  ON public.history(user_id, pool_id, is_simulated);

-- 5. 更新 RLS 策略（保持现有策略不变，但确保模拟数据也受保护）
-- 现有的 RLS 策略已经通过 user_id 限制访问权限，无需额外修改

-- 验证迁移
DO $$
BEGIN
  -- 检查字段是否添加成功
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'history'
      AND column_name = 'is_simulated'
  ) THEN
    RAISE EXCEPTION 'is_simulated 字段添加失败';
  END IF;

  RAISE NOTICE 'is_simulated 字段添加成功';
END $$;
