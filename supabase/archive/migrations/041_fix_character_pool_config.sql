-- =====================================================
-- 041: 修复角色的 pool_config.pools 数据
-- 角色(type='character')不应该在武器池中
-- 武器(type='weapon')不应该在限定角色池和常驻池中
-- =====================================================

-- 从角色的 pools 数组中移除 'weapon'
UPDATE characters
SET pool_config = jsonb_set(
  pool_config,
  '{pools}',
  (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements_text(pool_config->'pools') AS elem
    WHERE elem != 'weapon'
  )
),
updated_at = NOW()
WHERE type = 'character'
  AND pool_config->'pools' ? 'weapon';

-- 确保武器只在 weapon 池中
UPDATE characters
SET pool_config = jsonb_set(
  pool_config,
  '{pools}',
  '["weapon"]'::jsonb
),
updated_at = NOW()
WHERE type = 'weapon'
  AND (
    pool_config->'pools' ? 'limited'
    OR pool_config->'pools' ? 'standard'
  );

-- 验证：显示修复结果
-- SELECT id, name, type, pool_config->'pools' as pools FROM characters ORDER BY type, rarity DESC;

