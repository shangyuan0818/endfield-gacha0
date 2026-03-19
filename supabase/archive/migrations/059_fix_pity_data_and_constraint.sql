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

DO $$
DECLARE
  rec RECORD;
  current_pity INTEGER := 0;
  prev_user_id UUID := NULL;
  prev_pool_id TEXT := NULL;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'pity'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'is_free'
  ) THEN
    RAISE NOTICE 'Migration 059 skipped because history.pity / history.is_free are unavailable';
    RETURN;
  END IF;

  -- 步骤 1~3: 直接在 DO 块中重算 pity
  FOR rec IN
    SELECT user_id, record_id, pool_id, rarity, is_free
    FROM public.history
    ORDER BY user_id, pool_id, timestamp ASC, record_id ASC
  LOOP
    IF rec.user_id IS DISTINCT FROM prev_user_id
       OR rec.pool_id IS DISTINCT FROM prev_pool_id THEN
      current_pity := 0;
      prev_user_id := rec.user_id;
      prev_pool_id := rec.pool_id;
    END IF;

    IF rec.is_free IS NOT TRUE THEN
      current_pity := current_pity + 1;
    END IF;

    UPDATE public.history
    SET pity = current_pity
    WHERE user_id = rec.user_id AND record_id = rec.record_id;

    IF rec.rarity = 6 THEN
      current_pity := 0;
    END IF;
  END LOOP;

  -- 步骤 4: 钳制边界情况
  UPDATE public.history SET pity = 80 WHERE pity > 80;
  UPDATE public.history SET pity = 0 WHERE pity < 0;

  -- 步骤 5: 添加 CHECK 约束
  ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_pity_check;
  ALTER TABLE public.history ADD CONSTRAINT history_pity_check
    CHECK (pity >= 0 AND pity <= 80);
END $$;
