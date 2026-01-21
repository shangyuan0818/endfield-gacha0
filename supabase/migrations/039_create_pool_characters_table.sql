-- =====================================================
-- 039: 创建池子-角色关联表
-- 实现每个池子独立管理角色列表
-- =====================================================

-- 首先确保 pools 表的 pool_id 列有唯一约束
DO $$
BEGIN
  -- 检查是否已存在唯一约束
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'pools_pool_id_key' 
    AND conrelid = 'pools'::regclass
  ) THEN
    -- 添加唯一约束
    ALTER TABLE pools ADD CONSTRAINT pools_pool_id_key UNIQUE (pool_id);
  END IF;
END $$;

-- 创建关联表
CREATE TABLE IF NOT EXISTS pool_characters (
  id SERIAL PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES pools(pool_id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  is_up BOOLEAN DEFAULT FALSE,  -- 是否为该池子的UP角色
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 确保同一个池子不会重复添加同一个角色
  UNIQUE(pool_id, character_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_pool_characters_pool_id ON pool_characters(pool_id);
CREATE INDEX IF NOT EXISTS idx_pool_characters_character_id ON pool_characters(character_id);

-- 添加注释
COMMENT ON TABLE pool_characters IS '池子-角色关联表，每个池子独立管理自己的角色列表';
COMMENT ON COLUMN pool_characters.pool_id IS '池子ID，关联到 pools 表';
COMMENT ON COLUMN pool_characters.character_id IS '角色ID，关联到 characters 表';
COMMENT ON COLUMN pool_characters.is_up IS '是否为该池子的UP角色';

-- RLS 策略（简化版 - 允许已认证用户操作）
ALTER TABLE pool_characters ENABLE ROW LEVEL SECURITY;

-- 所有人可读
CREATE POLICY "pool_characters_select_policy" ON pool_characters
  FOR SELECT USING (true);

-- 已认证用户可以增删改（实际权限由前端控制）
CREATE POLICY "pool_characters_insert_policy" ON pool_characters
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "pool_characters_update_policy" ON pool_characters
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "pool_characters_delete_policy" ON pool_characters
  FOR DELETE USING (auth.uid() IS NOT NULL);

