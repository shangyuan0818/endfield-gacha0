-- ============================================================
-- Migration 059: 修复 pity 数据并添加约束
-- BUG-FIX-011: 数据库>=81抽出货异常
--
-- 问题: calculatePity() 之前未排除免费十连(is_free=true)，
--       导致数据库中存储了超过80的 pity 值。
--
-- 修复:
--   1. 重算所有记录的 pity 值（排除 is_free=true 的记录）
--   2. 钳制仍然超出范围的值（不完整数据导致的边界情况）
--   3. 添加 CHECK 约束防止未来再次发生
-- ============================================================

-- 步骤 1: 创建临时函数重算 pity
CREATE OR REPLACE FUNCTION _temp_recalculate_pity() RETURNS void AS $$
DECLARE
  rec RECORD;
  current_pity INTEGER := 0;
  prev_user_id UUID := NULL;
  prev_pool_id TEXT := NULL;
BEGIN
  FOR rec IN
    SELECT user_id, record_id, pool_id, rarity, is_free
    FROM public.history
    ORDER BY user_id, pool_id, timestamp ASC, record_id ASC
  LOOP
    -- 当 user 或 pool 切换时，重置 pity 计数器
    IF rec.user_id IS DISTINCT FROM prev_user_id
       OR rec.pool_id IS DISTINCT FROM prev_pool_id THEN
      current_pity := 0;
      prev_user_id := rec.user_id;
      prev_pool_id := rec.pool_id;
    END IF;

    -- 免费十连不计入保底进度
    IF rec.is_free IS NOT TRUE THEN
      current_pity := current_pity + 1;
    END IF;

    -- 更新该记录的 pity 值
    UPDATE public.history
    SET pity = current_pity
    WHERE user_id = rec.user_id AND record_id = rec.record_id;

    -- 抽到6星后重置计数器
    IF rec.rarity = 6 THEN
      current_pity := 0;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 步骤 2: 执行重算
SELECT _temp_recalculate_pity();

-- 步骤 3: 清理临时函数
DROP FUNCTION _temp_recalculate_pity();

-- 步骤 4: 钳制边界情况
-- 某些用户的数据可能不完整（缺少6星记录），导致重算后 pity 仍然 > 80
-- 将这些值钳制到 80，防止 CHECK 约束失败
UPDATE public.history SET pity = 80 WHERE pity > 80;
UPDATE public.history SET pity = 0 WHERE pity < 0;

-- 步骤 5: 添加 CHECK 约束
ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_pity_check;
ALTER TABLE public.history ADD CONSTRAINT history_pity_check
  CHECK (pity >= 0 AND pity <= 80);
