-- ============================================
-- 094: 回填 history.server_id / region 并清除统计缓存
--
-- 背景:
--   087 迁移为 history 新增了 server_id / region 列，
--   但已有记录这两列均为 NULL，导致 get_global_stats
--   的 contributor_regions CTE 将所有用户归入 cn。
--
-- 策略:
--   1. server_id = '1' (国服) 作为保守默认值。
--      绝大多数现有用户通过 CN 代理导入，UID 呈 "1 开头十位数" 模式。
--   2. 如果 game_uid 不符合国服模式且长度 >= 10，
--      则推断为国际服 (server_id = '2')。
--   3. 清除 stats_cache 中 global_stats 缓存行，
--      迫使下次调用 get_global_stats_cached 时重新计算。
-- ============================================

-- 1) 国际服推断: game_uid 不以 '1' 开头、不为空、且长度 >= 10
UPDATE public.history
SET server_id = '2',
    region    = 'intl'
WHERE server_id IS NULL
  AND game_uid IS NOT NULL
  AND game_uid <> ''
  AND game_uid !~ '^1[0-9]+$';

-- 2) 剩余 NULL 记录全部设为国服
UPDATE public.history
SET server_id = '1',
    region    = '国服'
WHERE server_id IS NULL;

-- 3) 清除全服统计缓存
DELETE FROM public.stats_cache WHERE cache_key = 'global_stats';

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 094: 已回填 history.server_id / region 并清除统计缓存';
END $$;
