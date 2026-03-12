-- ============================================
-- Legacy alias seed SQL (generated)
-- Generated at: 2026-03-12T00:16:36.404Z
-- ============================================
BEGIN;

DO $$
DECLARE
  history_character_id_exists BOOLEAN;
  history_legacy_pool_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'character_id'
  ) INTO history_character_id_exists;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'legacy_pool_id'
  ) INTO history_legacy_pool_id_exists;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_aitela', 'chr_0021_whiten', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0021_whiten' WHERE character_id = 'char_aitela';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_aitela' THEN 'chr_0021_whiten' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_aitela']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0021_whiten',
      'char_aitela'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_aiweiwen', 'chr_0012_avywen', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0012_avywen' WHERE character_id = 'char_aiweiwen';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_aiweiwen' THEN 'chr_0012_avywen' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_aiweiwen']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0012_avywen',
      'char_aiweiwen'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_aliesha', 'chr_0024_deepfin', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0024_deepfin' WHERE character_id = 'char_aliesha';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_aliesha' THEN 'chr_0024_deepfin' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_aliesha']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0024_deepfin',
      'char_aliesha'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_antaer', 'chr_0023_antal', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0023_antal' WHERE character_id = 'char_antaer';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_antaer' THEN 'chr_0023_antal' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_antaer']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0023_antal',
      'char_antaer'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_bieli', 'chr_0026_lastrite', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0026_lastrite' WHERE character_id = 'char_bieli';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_bieli' THEN 'chr_0026_lastrite' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_bieli']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0026_lastrite',
      'char_bieli'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_chenqianyu', 'chr_0005_chen', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0005_chen' WHERE character_id = 'char_chenqianyu';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_chenqianyu' THEN 'chr_0005_chen' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_chenqianyu']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0005_chen',
      'char_chenqianyu'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_dapan', 'chr_0018_dapan', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0018_dapan' WHERE character_id = 'char_dapan';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_dapan' THEN 'chr_0018_dapan' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_dapan']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0018_dapan',
      'char_dapan'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_eldelra', 'chr_0025_ardelia', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0025_ardelia' WHERE character_id = 'char_eldelra';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_eldelra' THEN 'chr_0025_ardelia' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_eldelra']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0025_ardelia',
      'char_eldelra'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_huguang', 'chr_0007_ikut', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0007_ikut' WHERE character_id = 'char_huguang';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_huguang' THEN 'chr_0007_ikut' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_huguang']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0007_ikut',
      'char_huguang'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_jerpeta', 'chr_0013_aglina', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0013_aglina' WHERE character_id = 'char_jerpeta';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_jerpeta' THEN 'chr_0013_aglina' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_jerpeta']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0013_aglina',
      'char_jerpeta'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_junwei', 'chr_0029_pograni', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0029_pograni' WHERE character_id = 'char_junwei';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_junwei' THEN 'chr_0029_pograni' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_junwei']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0029_pograni',
      'char_junwei'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_kaqi', 'chr_0020_meurs', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0020_meurs' WHERE character_id = 'char_kaqi';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_kaqi' THEN 'chr_0020_meurs' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_kaqi']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0020_meurs',
      'char_kaqi'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_langwei', 'chr_0006_wolfgd', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0006_wolfgd' WHERE character_id = 'char_langwei';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_langwei' THEN 'chr_0006_wolfgd' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_langwei']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0006_wolfgd',
      'char_langwei'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_levantin', 'chr_0016_laevat', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0016_laevat' WHERE character_id = 'char_levantin';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_levantin' THEN 'chr_0016_laevat' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_levantin']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0016_laevat',
      'char_levantin'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_lifeng', 'chr_0015_lifeng', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0015_lifeng' WHERE character_id = 'char_lifeng';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_lifeng' THEN 'chr_0015_lifeng' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_lifeng']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0015_lifeng',
      'char_lifeng'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_perika', 'chr_0004_pelica', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0004_pelica' WHERE character_id = 'char_perika';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_perika' THEN 'chr_0004_pelica' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_perika']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0004_pelica',
      'char_perika'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_qiuli', 'chr_0019_karin', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0019_karin' WHERE character_id = 'char_qiuli';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_qiuli' THEN 'chr_0019_karin' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_qiuli']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0019_karin',
      'char_qiuli'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_saixi', 'chr_0011_seraph', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0011_seraph' WHERE character_id = 'char_saixi';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_saixi' THEN 'chr_0011_seraph' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_saixi']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0011_seraph',
      'char_saixi'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_yingshi', 'chr_0022_bounda', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0022_bounda' WHERE character_id = 'char_yingshi';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_yingshi' THEN 'chr_0022_bounda' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_yingshi']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0022_bounda',
      'char_yingshi'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_yiwen', 'chr_0017_yvonne', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0017_yvonne' WHERE character_id = 'char_yiwen';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_yiwen' THEN 'chr_0017_yvonne' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_yiwen']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0017_yvonne',
      'char_yiwen'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_yujin', 'chr_0009_azrila', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0009_azrila' WHERE character_id = 'char_yujin';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_yujin' THEN 'chr_0009_azrila' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_yujin']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0009_azrila',
      'char_yujin'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_zhouxue', 'chr_0014_aurora', FALSE, 'Unique exact name match between legacy seed and official snapshot')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'chr_0014_aurora' WHERE character_id = 'char_zhouxue';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'char_zhouxue' THEN 'chr_0014_aurora' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_zhouxue']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'chr_0014_aurora',
      'char_zhouxue'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'weapon_jerpeta_sig', 'wpn_funnel_0011', FALSE, 'Matched via official weapon pool weponbox_1_0_3 up_character')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'wpn_funnel_0011' WHERE character_id = 'weapon_jerpeta_sig';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'weapon_jerpeta_sig' THEN 'wpn_funnel_0011' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['weapon_jerpeta_sig']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'wpn_funnel_0011',
      'weapon_jerpeta_sig'
    );
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'weapon_levantin_sig', 'wpn_sword_0006', FALSE, 'Matched via official weapon pool weponbox_1_0_1 up_character')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET character_id = 'wpn_sword_0006' WHERE character_id = 'weapon_levantin_sig';
  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT DISTINCT CASE WHEN item = 'weapon_levantin_sig' THEN 'wpn_sword_0006' ELSE item END
      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
      WHERE item IS NOT NULL AND BTRIM(item) <> ''
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['weapon_levantin_sig']::TEXT[];

  IF history_character_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
      'wpn_sword_0006',
      'weapon_levantin_sig'
    );
  END IF;

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('legacy_manual', 'pool_limited_jerpeta', 'special_1_0_3', FALSE, 'Matched by up_character and start_date')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET pool_id = 'special_1_0_3' WHERE pool_id = 'pool_limited_jerpeta';
  IF history_legacy_pool_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET pool_id = %L, legacy_pool_id = COALESCE(legacy_pool_id, %L), updated_at = NOW() WHERE pool_id = %L',
      'special_1_0_3',
      'pool_limited_jerpeta',
      'pool_limited_jerpeta'
    );
  ELSE
    EXECUTE format(
      'UPDATE public.history SET pool_id = %L, updated_at = NOW() WHERE pool_id = %L',
      'special_1_0_3',
      'pool_limited_jerpeta'
    );
  END IF;

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('legacy_manual', 'pool_limited_levantin', 'special_1_0_1', FALSE, 'Matched by up_character and start_date')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET pool_id = 'special_1_0_1' WHERE pool_id = 'pool_limited_levantin';
  IF history_legacy_pool_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET pool_id = %L, legacy_pool_id = COALESCE(legacy_pool_id, %L), updated_at = NOW() WHERE pool_id = %L',
      'special_1_0_1',
      'pool_limited_levantin',
      'pool_limited_levantin'
    );
  ELSE
    EXECUTE format(
      'UPDATE public.history SET pool_id = %L, updated_at = NOW() WHERE pool_id = %L',
      'special_1_0_1',
      'pool_limited_levantin'
    );
  END IF;

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('legacy_manual', 'pool_limited_yiwen', 'special_1_0_2', FALSE, 'Matched by up_character and start_date')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET pool_id = 'special_1_0_2' WHERE pool_id = 'pool_limited_yiwen';
  IF history_legacy_pool_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET pool_id = %L, legacy_pool_id = COALESCE(legacy_pool_id, %L), updated_at = NOW() WHERE pool_id = %L',
      'special_1_0_2',
      'pool_limited_yiwen',
      'pool_limited_yiwen'
    );
  ELSE
    EXECUTE format(
      'UPDATE public.history SET pool_id = %L, updated_at = NOW() WHERE pool_id = %L',
      'special_1_0_2',
      'pool_limited_yiwen'
    );
  END IF;

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('legacy_manual', 'pool_standard_main', 'standard', FALSE, 'Matched to canonical standard pool')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET pool_id = 'standard' WHERE pool_id = 'pool_standard_main';
  IF history_legacy_pool_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET pool_id = %L, legacy_pool_id = COALESCE(legacy_pool_id, %L), updated_at = NOW() WHERE pool_id = %L',
      'standard',
      'pool_standard_main',
      'pool_standard_main'
    );
  ELSE
    EXECUTE format(
      'UPDATE public.history SET pool_id = %L, updated_at = NOW() WHERE pool_id = %L',
      'standard',
      'pool_standard_main'
    );
  END IF;

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('legacy_manual', 'pool_weapon_jerpeta', 'weponbox_1_0_3', FALSE, 'Derived from matched limited event id and existing official weapon pool')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET pool_id = 'weponbox_1_0_3' WHERE pool_id = 'pool_weapon_jerpeta';
  IF history_legacy_pool_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET pool_id = %L, legacy_pool_id = COALESCE(legacy_pool_id, %L), updated_at = NOW() WHERE pool_id = %L',
      'weponbox_1_0_3',
      'pool_weapon_jerpeta',
      'pool_weapon_jerpeta'
    );
  ELSE
    EXECUTE format(
      'UPDATE public.history SET pool_id = %L, updated_at = NOW() WHERE pool_id = %L',
      'weponbox_1_0_3',
      'pool_weapon_jerpeta'
    );
  END IF;

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('legacy_manual', 'pool_weapon_levantin', 'weponbox_1_0_1', FALSE, 'Derived from matched limited event id and existing official weapon pool')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();

  UPDATE public.pool_characters SET pool_id = 'weponbox_1_0_1' WHERE pool_id = 'pool_weapon_levantin';
  IF history_legacy_pool_id_exists THEN
    EXECUTE format(
      'UPDATE public.history SET pool_id = %L, legacy_pool_id = COALESCE(legacy_pool_id, %L), updated_at = NOW() WHERE pool_id = %L',
      'weponbox_1_0_1',
      'pool_weapon_levantin',
      'pool_weapon_levantin'
    );
  ELSE
    EXECUTE format(
      'UPDATE public.history SET pool_id = %L, updated_at = NOW() WHERE pool_id = %L',
      'weponbox_1_0_1',
      'pool_weapon_levantin'
    );
  END IF;

  RAISE NOTICE '✅ Legacy alias seed applied';
END $$;

COMMIT;
