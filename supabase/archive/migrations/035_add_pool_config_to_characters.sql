-- Migration: 添加 pool_config 字段到 characters 表
-- 用于存储角色的卡池归属配置和轮换信息

-- 添加 pool_config JSONB 字段
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS pool_config JSONB DEFAULT '{}'::jsonb;

-- 添加注释说明字段用途
COMMENT ON COLUMN public.characters.pool_config IS '卡池配置：
{
  "pools": ["limited", "standard"],  -- 可出现的卡池类型
  "limited_rotation_count": 0,       -- 当前已轮换次数（仅限定角色）
  "removes_after": 3,                -- 多少次轮换后移出（null=永不移出）
  "is_active_in_limited": true       -- 当前是否在限定池中
}';

-- 创建 GIN 索引以支持 JSONB 查询
CREATE INDEX IF NOT EXISTS idx_characters_pool_config
  ON public.characters USING GIN(pool_config);

-- 创建索引以支持按卡池类型查询
CREATE INDEX IF NOT EXISTS idx_characters_pool_config_pools
  ON public.characters USING GIN((pool_config->'pools'));
