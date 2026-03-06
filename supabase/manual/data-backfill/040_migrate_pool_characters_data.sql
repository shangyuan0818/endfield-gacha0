-- =====================================================
-- 040: 迁移现有数据到 pool_characters 表
-- 根据角色的 pool_config.pools 和池子的 up_character 填充关联
-- =====================================================

-- 为每个限定池添加所有限定角色
INSERT INTO pool_characters (pool_id, character_id, is_up)
SELECT 
  p.pool_id,
  c.id,
  (p.up_character = c.name) AS is_up
FROM pools p
CROSS JOIN characters c
WHERE 
  p.type IN ('limited', 'limited_character')
  AND c.type = 'character'
  AND c.pool_config->'pools' ? 'limited'
  -- 只添加在该池子开始时间之前或同时引入的角色
  AND (
    c.pool_config->>'introduced_at' IS NULL 
    OR (c.pool_config->>'introduced_at')::timestamptz <= COALESCE(p.start_time, NOW())
  )
ON CONFLICT (pool_id, character_id) DO NOTHING;

-- 为每个常驻池添加所有常驻角色
INSERT INTO pool_characters (pool_id, character_id, is_up)
SELECT 
  p.pool_id,
  c.id,
  FALSE AS is_up
FROM pools p
CROSS JOIN characters c
WHERE 
  p.type = 'standard'
  AND c.type = 'character'
  AND c.pool_config->'pools' ? 'standard'
ON CONFLICT (pool_id, character_id) DO NOTHING;

-- 为每个武器池添加所有武器
INSERT INTO pool_characters (pool_id, character_id, is_up)
SELECT 
  p.pool_id,
  c.id,
  (p.up_character = c.name) AS is_up
FROM pools p
CROSS JOIN characters c
WHERE 
  p.type IN ('weapon', 'limited_weapon')
  AND c.type = 'weapon'
  AND c.pool_config->'pools' ? 'weapon'
ON CONFLICT (pool_id, character_id) DO NOTHING;

-- 添加说明注释
COMMENT ON TABLE pool_characters IS '池子-角色关联表。每个池子独立管理自己的角色列表。新角色只会被添加到创建时指定的池子中，不会自动添加到其他池子。';

