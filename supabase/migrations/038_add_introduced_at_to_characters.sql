-- =====================================================
-- 038: 为角色 pool_config 添加 introduced_at 字段
-- 用于追踪角色首次出现的时间，确保新角色不会出现在之前的池子中
-- =====================================================

-- 为现有角色设置 introduced_at 为一个早期时间（游戏公测开始时间）
-- 这样现有角色会出现在所有池子中
UPDATE characters
SET pool_config = pool_config || jsonb_build_object('introduced_at', '2026-01-22T11:00:00+08:00')
WHERE pool_config IS NOT NULL 
  AND pool_config->>'introduced_at' IS NULL;

-- 添加注释说明
COMMENT ON COLUMN characters.pool_config IS '卡池配置JSON，包含：
- pools: 角色可出现的卡池类型数组 ["limited", "standard", "weapon"]
- limited_rotation_count: 当前轮换次数
- removes_after: 几次轮换后从限定池移出
- is_active_in_limited: 是否在限定池中激活
- introduced_at: 角色首次引入时间，新角色只出现在此时间之后的池子中';

