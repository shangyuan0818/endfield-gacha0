-- =====================================================
-- 037: 为卡池添加轮换处理标记
-- 用于追踪卡池结束后是否已自动处理轮换
-- =====================================================

-- 添加 rotation_processed 字段
ALTER TABLE pools
ADD COLUMN IF NOT EXISTS rotation_processed BOOLEAN DEFAULT FALSE;

-- 添加注释
COMMENT ON COLUMN pools.rotation_processed IS '是否已处理轮换（卡池结束后自动为限定池角色增加轮换次数）';

-- 为已结束的卡池设置为已处理（历史数据兼容）
-- 避免重复处理已有的历史卡池
UPDATE pools
SET rotation_processed = TRUE
WHERE end_time IS NOT NULL AND end_time < NOW();

-- 创建索引，用于快速查询需要处理轮换的卡池
CREATE INDEX IF NOT EXISTS idx_pools_pending_rotation
ON pools (type, end_time, rotation_processed)
WHERE rotation_processed = FALSE AND end_time IS NOT NULL;

