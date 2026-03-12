-- ============================================
-- 076 验收：legacy ID alias seed 核验脚本
--
-- 用途：
--   1. 验证 076 legacy alias seed 是否已完整写入 character_id_aliases / pool_id_aliases
--   2. 检查 pool_characters / pools.featured_characters / history 中是否仍残留无法解析的 legacy ID
--   3. 给 DATA-NEW-008 的“执行后验收”提供统一查询入口
--
-- 使用方式：
--   在 Supabase SQL Editor 中整段执行。
--   结果集会按 section 分类输出，若 section 对应 0 行则表示该项通过。
-- ============================================

WITH expected_character_aliases(alias_id, canonical_id) AS (
  VALUES
    ('char_aitela', 'chr_0021_whiten'),
    ('char_aiweiwen', 'chr_0012_avywen'),
    ('char_aliesha', 'chr_0024_deepfin'),
    ('char_antaer', 'chr_0023_antal'),
    ('char_bieli', 'chr_0026_lastrite'),
    ('char_chenqianyu', 'chr_0005_chen'),
    ('char_dapan', 'chr_0018_dapan'),
    ('char_eldelra', 'chr_0025_ardelia'),
    ('char_huguang', 'chr_0007_ikut'),
    ('char_jerpeta', 'chr_0013_aglina'),
    ('char_junwei', 'chr_0029_pograni'),
    ('char_kaqi', 'chr_0020_meurs'),
    ('char_langwei', 'chr_0006_wolfgd'),
    ('char_levantin', 'chr_0016_laevat'),
    ('char_lifeng', 'chr_0015_lifeng'),
    ('char_perika', 'chr_0004_pelica'),
    ('char_qiuli', 'chr_0019_karin'),
    ('char_saixi', 'chr_0011_seraph'),
    ('char_yingshi', 'chr_0022_bounda'),
    ('char_yiwen', 'chr_0017_yvonne'),
    ('char_yujin', 'chr_0009_azrila'),
    ('char_zhouxue', 'chr_0014_aurora'),
    ('weapon_jerpeta_sig', 'wpn_funnel_0011'),
    ('weapon_levantin_sig', 'wpn_sword_0006')
),
expected_pool_aliases(alias_id, canonical_id) AS (
  VALUES
    ('pool_limited_jerpeta', 'special_1_0_3'),
    ('pool_limited_levantin', 'special_1_0_1'),
    ('pool_limited_yiwen', 'special_1_0_2'),
    ('pool_standard_main', 'standard'),
    ('pool_weapon_jerpeta', 'weponbox_1_0_3'),
    ('pool_weapon_levantin', 'weponbox_1_0_1')
),
missing_character_aliases AS (
  SELECT
    e.alias_id,
    e.canonical_id
  FROM expected_character_aliases AS e
  LEFT JOIN public.character_id_aliases AS a
    ON a.source = 'legacy_manual'
   AND a.alias_id = e.alias_id
   AND a.character_id = e.canonical_id
  WHERE a.id IS NULL
),
missing_pool_aliases AS (
  SELECT
    e.alias_id,
    e.canonical_id
  FROM expected_pool_aliases AS e
  LEFT JOIN public.pool_id_aliases AS a
    ON a.source = 'legacy_manual'
   AND a.alias_id = e.alias_id
   AND a.pool_id = e.canonical_id
  WHERE a.id IS NULL
),
unresolved_pool_character_refs AS (
  SELECT
    pc.pool_id,
    pc.character_id
  FROM public.pool_characters AS pc
  LEFT JOIN public.pools AS p
    ON p.pool_id = pc.pool_id
  LEFT JOIN public.pool_id_aliases AS pa
    ON pa.alias_id = pc.pool_id
  LEFT JOIN public.characters AS c
    ON c.id = pc.character_id
  LEFT JOIN public.character_id_aliases AS ca
    ON ca.alias_id = pc.character_id
  WHERE (p.pool_id IS NULL AND pa.id IS NULL)
     OR (c.id IS NULL AND ca.id IS NULL)
),
featured_character_refs AS (
  SELECT
    p.pool_id,
    p.name AS pool_name,
    item AS character_id
  FROM public.pools AS p
  CROSS JOIN LATERAL unnest(COALESCE(p.featured_characters, ARRAY[]::TEXT[])) AS item
  WHERE item IS NOT NULL
    AND BTRIM(item) <> ''
),
unresolved_featured_character_refs AS (
  SELECT
    f.pool_id,
    f.pool_name,
    f.character_id
  FROM featured_character_refs AS f
  LEFT JOIN public.characters AS c
    ON c.id = f.character_id
  LEFT JOIN public.character_id_aliases AS ca
    ON ca.alias_id = f.character_id
  WHERE c.id IS NULL
    AND ca.id IS NULL
)
SELECT
  'summary' AS section,
  'missing_character_aliases' AS item,
  COUNT(*)::TEXT AS detail_1,
  NULL::TEXT AS detail_2,
  NULL::TEXT AS detail_3
FROM missing_character_aliases

UNION ALL

SELECT
  'summary' AS section,
  'missing_pool_aliases' AS item,
  COUNT(*)::TEXT AS detail_1,
  NULL::TEXT AS detail_2,
  NULL::TEXT AS detail_3
FROM missing_pool_aliases

UNION ALL

SELECT
  'summary' AS section,
  'unresolved_pool_characters_refs' AS item,
  COUNT(*)::TEXT AS detail_1,
  NULL::TEXT AS detail_2,
  NULL::TEXT AS detail_3
FROM unresolved_pool_character_refs

UNION ALL

SELECT
  'summary' AS section,
  'unresolved_featured_character_refs' AS item,
  COUNT(*)::TEXT AS detail_1,
  NULL::TEXT AS detail_2,
  NULL::TEXT AS detail_3
FROM unresolved_featured_character_refs

UNION ALL

SELECT
  'missing_character_aliases' AS section,
  alias_id AS item,
  canonical_id AS detail_1,
  NULL::TEXT AS detail_2,
  NULL::TEXT AS detail_3
FROM missing_character_aliases

UNION ALL

SELECT
  'missing_pool_aliases' AS section,
  alias_id AS item,
  canonical_id AS detail_1,
  NULL::TEXT AS detail_2,
  NULL::TEXT AS detail_3
FROM missing_pool_aliases

UNION ALL

SELECT
  'unresolved_pool_character_refs' AS section,
  pool_id AS item,
  character_id AS detail_1,
  NULL::TEXT AS detail_2,
  NULL::TEXT AS detail_3
FROM unresolved_pool_character_refs

UNION ALL

SELECT
  'unresolved_featured_character_refs' AS section,
  pool_id AS item,
  pool_name AS detail_1,
  character_id AS detail_2,
  NULL::TEXT AS detail_3
FROM unresolved_featured_character_refs

ORDER BY
  CASE section
    WHEN 'summary' THEN 0
    WHEN 'missing_character_aliases' THEN 1
    WHEN 'missing_pool_aliases' THEN 2
    WHEN 'unresolved_pool_character_refs' THEN 3
    WHEN 'unresolved_featured_character_refs' THEN 4
    ELSE 9
  END,
  item;

DO $$
DECLARE
  history_character_id_exists BOOLEAN;
  history_pool_id_exists BOOLEAN;
  unresolved_history_character_refs BIGINT := 0;
  unresolved_history_pool_refs BIGINT := 0;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'history'
      AND column_name = 'character_id'
  ) INTO history_character_id_exists;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'history'
      AND column_name = 'pool_id'
  ) INTO history_pool_id_exists;

  IF history_character_id_exists THEN
    EXECUTE $sql$
      SELECT COUNT(*)
      FROM public.history AS h
      LEFT JOIN public.characters AS c
        ON c.id = h.character_id
      LEFT JOIN public.character_id_aliases AS ca
        ON ca.alias_id = h.character_id
      WHERE h.character_id IS NOT NULL
        AND BTRIM(h.character_id) <> ''
        AND c.id IS NULL
        AND ca.id IS NULL
    $sql$
    INTO unresolved_history_character_refs;

    RAISE NOTICE 'history.character_id unresolved refs: %', unresolved_history_character_refs;
  ELSE
    RAISE NOTICE 'history.character_id column does not exist, skipped';
  END IF;

  IF history_pool_id_exists THEN
    EXECUTE $sql$
      SELECT COUNT(*)
      FROM public.history AS h
      LEFT JOIN public.pools AS p
        ON p.pool_id = h.pool_id
      LEFT JOIN public.pool_id_aliases AS pa
        ON pa.alias_id = h.pool_id
      WHERE h.pool_id IS NOT NULL
        AND BTRIM(h.pool_id) <> ''
        AND p.pool_id IS NULL
        AND pa.id IS NULL
    $sql$
    INTO unresolved_history_pool_refs;

    RAISE NOTICE 'history.pool_id unresolved refs: %', unresolved_history_pool_refs;
  ELSE
    RAISE NOTICE 'history.pool_id column does not exist, skipped';
  END IF;
END $$;
