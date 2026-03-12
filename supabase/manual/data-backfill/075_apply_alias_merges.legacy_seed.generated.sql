-- ============================================
-- Alias merge SQL (generated)
-- Generated at: 2026-03-12T00:55:06.931Z
-- ============================================
BEGIN;

-- Character merge: char_aitela -> chr_0021_whiten
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_aitela') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0021_whiten') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_aitela' AND name <> '埃特拉'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_aitela';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_aitela' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_aitela';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_aitela', 'chr_0021_whiten';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0021_whiten',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_aitela']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_aitela';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_aitela']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0021_whiten'
      AND source.id = 'char_aitela';

    UPDATE public.pool_characters
    SET character_id = 'chr_0021_whiten'
    WHERE character_id = 'char_aitela';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_aitela' THEN 'chr_0021_whiten' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_aitela']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0021_whiten',
        'char_aitela'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_aitela'
      AND id <> 'chr_0021_whiten';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0021_whiten', 'chr_0021_whiten', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0021_whiten', 'chr_0021_whiten', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_aitela', 'chr_0021_whiten', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: char_aiweiwen -> chr_0012_avywen
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_aiweiwen') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0012_avywen') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_aiweiwen' AND name <> '艾维文娜'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_aiweiwen';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_aiweiwen' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_aiweiwen';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_aiweiwen', 'chr_0012_avywen';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0012_avywen',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_aiweiwen']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_aiweiwen';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_aiweiwen']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0012_avywen'
      AND source.id = 'char_aiweiwen';

    UPDATE public.pool_characters
    SET character_id = 'chr_0012_avywen'
    WHERE character_id = 'char_aiweiwen';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_aiweiwen' THEN 'chr_0012_avywen' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_aiweiwen']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0012_avywen',
        'char_aiweiwen'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_aiweiwen'
      AND id <> 'chr_0012_avywen';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0012_avywen', 'chr_0012_avywen', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0012_avywen', 'chr_0012_avywen', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_aiweiwen', 'chr_0012_avywen', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: char_aliesha -> chr_0024_deepfin
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_aliesha') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0024_deepfin') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_aliesha' AND name <> '阿列什'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_aliesha';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_aliesha' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_aliesha';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_aliesha', 'chr_0024_deepfin';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0024_deepfin',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_aliesha']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_aliesha';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_aliesha']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0024_deepfin'
      AND source.id = 'char_aliesha';

    UPDATE public.pool_characters
    SET character_id = 'chr_0024_deepfin'
    WHERE character_id = 'char_aliesha';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_aliesha' THEN 'chr_0024_deepfin' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_aliesha']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0024_deepfin',
        'char_aliesha'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_aliesha'
      AND id <> 'chr_0024_deepfin';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0024_deepfin', 'chr_0024_deepfin', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0024_deepfin', 'chr_0024_deepfin', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_aliesha', 'chr_0024_deepfin', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: char_antaer -> chr_0023_antal
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_antaer') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0023_antal') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_antaer' AND name <> '安塔尔'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_antaer';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_antaer' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_antaer';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_antaer', 'chr_0023_antal';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0023_antal',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_antaer']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_antaer';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_antaer']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0023_antal'
      AND source.id = 'char_antaer';

    UPDATE public.pool_characters
    SET character_id = 'chr_0023_antal'
    WHERE character_id = 'char_antaer';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_antaer' THEN 'chr_0023_antal' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_antaer']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0023_antal',
        'char_antaer'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_antaer'
      AND id <> 'chr_0023_antal';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0023_antal', 'chr_0023_antal', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0023_antal', 'chr_0023_antal', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_antaer', 'chr_0023_antal', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: char_bieli -> chr_0026_lastrite
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_bieli') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0026_lastrite') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_bieli' AND name <> '别礼'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_bieli';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_bieli' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_bieli';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_bieli', 'chr_0026_lastrite';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0026_lastrite',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_bieli']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_bieli';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_bieli']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0026_lastrite'
      AND source.id = 'char_bieli';

    UPDATE public.pool_characters
    SET character_id = 'chr_0026_lastrite'
    WHERE character_id = 'char_bieli';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_bieli' THEN 'chr_0026_lastrite' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_bieli']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0026_lastrite',
        'char_bieli'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_bieli'
      AND id <> 'chr_0026_lastrite';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0026_lastrite', 'chr_0026_lastrite', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0026_lastrite', 'chr_0026_lastrite', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_bieli', 'chr_0026_lastrite', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: char_chenqianyu -> chr_0005_chen
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_chenqianyu') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0005_chen') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_chenqianyu' AND name <> '陈千语'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_chenqianyu';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_chenqianyu' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_chenqianyu';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_chenqianyu', 'chr_0005_chen';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0005_chen',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_chenqianyu']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_chenqianyu';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_chenqianyu']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0005_chen'
      AND source.id = 'char_chenqianyu';

    UPDATE public.pool_characters
    SET character_id = 'chr_0005_chen'
    WHERE character_id = 'char_chenqianyu';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_chenqianyu' THEN 'chr_0005_chen' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_chenqianyu']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0005_chen',
        'char_chenqianyu'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_chenqianyu'
      AND id <> 'chr_0005_chen';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0005_chen', 'chr_0005_chen', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0005_chen', 'chr_0005_chen', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_chenqianyu', 'chr_0005_chen', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: char_dapan -> chr_0018_dapan
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_dapan') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0018_dapan') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_dapan' AND name <> '大潘'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_dapan';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_dapan' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_dapan';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_dapan', 'chr_0018_dapan';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0018_dapan',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_dapan']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_dapan';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_dapan']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0018_dapan'
      AND source.id = 'char_dapan';

    UPDATE public.pool_characters
    SET character_id = 'chr_0018_dapan'
    WHERE character_id = 'char_dapan';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_dapan' THEN 'chr_0018_dapan' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_dapan']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0018_dapan',
        'char_dapan'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_dapan'
      AND id <> 'chr_0018_dapan';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0018_dapan', 'chr_0018_dapan', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0018_dapan', 'chr_0018_dapan', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_dapan', 'chr_0018_dapan', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: char_eldelra -> chr_0025_ardelia
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_eldelra') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0025_ardelia') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_eldelra' AND name <> '艾尔黛拉'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_eldelra';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_eldelra' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_eldelra';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_eldelra', 'chr_0025_ardelia';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0025_ardelia',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_eldelra']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_eldelra';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_eldelra']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0025_ardelia'
      AND source.id = 'char_eldelra';

    UPDATE public.pool_characters
    SET character_id = 'chr_0025_ardelia'
    WHERE character_id = 'char_eldelra';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_eldelra' THEN 'chr_0025_ardelia' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_eldelra']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0025_ardelia',
        'char_eldelra'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_eldelra'
      AND id <> 'chr_0025_ardelia';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0025_ardelia', 'chr_0025_ardelia', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0025_ardelia', 'chr_0025_ardelia', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_eldelra', 'chr_0025_ardelia', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: char_huguang -> chr_0007_ikut
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_huguang') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0007_ikut') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_huguang' AND name <> '弧光'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_huguang';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_huguang' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_huguang';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_huguang', 'chr_0007_ikut';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0007_ikut',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_huguang']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_huguang';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_huguang']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0007_ikut'
      AND source.id = 'char_huguang';

    UPDATE public.pool_characters
    SET character_id = 'chr_0007_ikut'
    WHERE character_id = 'char_huguang';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_huguang' THEN 'chr_0007_ikut' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_huguang']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0007_ikut',
        'char_huguang'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_huguang'
      AND id <> 'chr_0007_ikut';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0007_ikut', 'chr_0007_ikut', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0007_ikut', 'chr_0007_ikut', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_huguang', 'chr_0007_ikut', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: char_jerpeta -> chr_0013_aglina
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_jerpeta') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0013_aglina') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_jerpeta' AND name <> '洁尔佩塔'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_jerpeta';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_jerpeta' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_jerpeta';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_jerpeta', 'chr_0013_aglina';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0013_aglina',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_jerpeta']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_jerpeta';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_jerpeta']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0013_aglina'
      AND source.id = 'char_jerpeta';

    UPDATE public.pool_characters
    SET character_id = 'chr_0013_aglina'
    WHERE character_id = 'char_jerpeta';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_jerpeta' THEN 'chr_0013_aglina' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_jerpeta']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0013_aglina',
        'char_jerpeta'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_jerpeta'
      AND id <> 'chr_0013_aglina';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0013_aglina', 'chr_0013_aglina', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0013_aglina', 'chr_0013_aglina', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_jerpeta', 'chr_0013_aglina', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: char_junwei -> chr_0029_pograni
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_junwei') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0029_pograni') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_junwei' AND name <> '骏卫'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_junwei';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_junwei' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_junwei';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_junwei', 'chr_0029_pograni';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0029_pograni',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_junwei']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_junwei';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_junwei']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0029_pograni'
      AND source.id = 'char_junwei';

    UPDATE public.pool_characters
    SET character_id = 'chr_0029_pograni'
    WHERE character_id = 'char_junwei';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_junwei' THEN 'chr_0029_pograni' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_junwei']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0029_pograni',
        'char_junwei'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_junwei'
      AND id <> 'chr_0029_pograni';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0029_pograni', 'chr_0029_pograni', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0029_pograni', 'chr_0029_pograni', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_junwei', 'chr_0029_pograni', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: char_kaqi -> chr_0020_meurs
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_kaqi') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0020_meurs') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_kaqi' AND name <> '卡契尔'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_kaqi';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_kaqi' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_kaqi';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_kaqi', 'chr_0020_meurs';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0020_meurs',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_kaqi']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_kaqi';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_kaqi']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0020_meurs'
      AND source.id = 'char_kaqi';

    UPDATE public.pool_characters
    SET character_id = 'chr_0020_meurs'
    WHERE character_id = 'char_kaqi';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_kaqi' THEN 'chr_0020_meurs' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_kaqi']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0020_meurs',
        'char_kaqi'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_kaqi'
      AND id <> 'chr_0020_meurs';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0020_meurs', 'chr_0020_meurs', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0020_meurs', 'chr_0020_meurs', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_kaqi', 'chr_0020_meurs', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: char_langwei -> chr_0006_wolfgd
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_langwei') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0006_wolfgd') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_langwei' AND name <> '狼卫'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_langwei';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_langwei' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_langwei';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_langwei', 'chr_0006_wolfgd';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0006_wolfgd',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_langwei']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_langwei';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_langwei']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0006_wolfgd'
      AND source.id = 'char_langwei';

    UPDATE public.pool_characters
    SET character_id = 'chr_0006_wolfgd'
    WHERE character_id = 'char_langwei';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_langwei' THEN 'chr_0006_wolfgd' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_langwei']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0006_wolfgd',
        'char_langwei'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_langwei'
      AND id <> 'chr_0006_wolfgd';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0006_wolfgd', 'chr_0006_wolfgd', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0006_wolfgd', 'chr_0006_wolfgd', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_langwei', 'chr_0006_wolfgd', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: char_levantin -> chr_0016_laevat
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_levantin') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0016_laevat') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_levantin' AND name <> '莱万汀'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_levantin';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_levantin' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_levantin';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_levantin', 'chr_0016_laevat';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0016_laevat',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_levantin']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_levantin';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_levantin']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0016_laevat'
      AND source.id = 'char_levantin';

    UPDATE public.pool_characters
    SET character_id = 'chr_0016_laevat'
    WHERE character_id = 'char_levantin';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_levantin' THEN 'chr_0016_laevat' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_levantin']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0016_laevat',
        'char_levantin'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_levantin'
      AND id <> 'chr_0016_laevat';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0016_laevat', 'chr_0016_laevat', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0016_laevat', 'chr_0016_laevat', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_levantin', 'chr_0016_laevat', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: char_lifeng -> chr_0015_lifeng
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_lifeng') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0015_lifeng') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_lifeng' AND name <> '黎风'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_lifeng';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_lifeng' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_lifeng';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_lifeng', 'chr_0015_lifeng';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0015_lifeng',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_lifeng']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_lifeng';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_lifeng']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0015_lifeng'
      AND source.id = 'char_lifeng';

    UPDATE public.pool_characters
    SET character_id = 'chr_0015_lifeng'
    WHERE character_id = 'char_lifeng';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_lifeng' THEN 'chr_0015_lifeng' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_lifeng']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0015_lifeng',
        'char_lifeng'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_lifeng'
      AND id <> 'chr_0015_lifeng';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0015_lifeng', 'chr_0015_lifeng', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0015_lifeng', 'chr_0015_lifeng', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_lifeng', 'chr_0015_lifeng', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: char_perika -> chr_0004_pelica
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_perika') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0004_pelica') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_perika' AND name <> '佩丽卡'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_perika';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_perika' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_perika';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_perika', 'chr_0004_pelica';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0004_pelica',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_perika']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_perika';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_perika']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0004_pelica'
      AND source.id = 'char_perika';

    UPDATE public.pool_characters
    SET character_id = 'chr_0004_pelica'
    WHERE character_id = 'char_perika';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_perika' THEN 'chr_0004_pelica' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_perika']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0004_pelica',
        'char_perika'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_perika'
      AND id <> 'chr_0004_pelica';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0004_pelica', 'chr_0004_pelica', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0004_pelica', 'chr_0004_pelica', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_perika', 'chr_0004_pelica', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: char_qiuli -> chr_0019_karin
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_qiuli') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0019_karin') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_qiuli' AND name <> '秋栗'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_qiuli';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_qiuli' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_qiuli';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_qiuli', 'chr_0019_karin';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0019_karin',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_qiuli']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_qiuli';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_qiuli']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0019_karin'
      AND source.id = 'char_qiuli';

    UPDATE public.pool_characters
    SET character_id = 'chr_0019_karin'
    WHERE character_id = 'char_qiuli';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_qiuli' THEN 'chr_0019_karin' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_qiuli']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0019_karin',
        'char_qiuli'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_qiuli'
      AND id <> 'chr_0019_karin';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0019_karin', 'chr_0019_karin', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0019_karin', 'chr_0019_karin', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_qiuli', 'chr_0019_karin', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: char_saixi -> chr_0011_seraph
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_saixi') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0011_seraph') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_saixi' AND name <> '赛希'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_saixi';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_saixi' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_saixi';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_saixi', 'chr_0011_seraph';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0011_seraph',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_saixi']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_saixi';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_saixi']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0011_seraph'
      AND source.id = 'char_saixi';

    UPDATE public.pool_characters
    SET character_id = 'chr_0011_seraph'
    WHERE character_id = 'char_saixi';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_saixi' THEN 'chr_0011_seraph' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_saixi']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0011_seraph',
        'char_saixi'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_saixi'
      AND id <> 'chr_0011_seraph';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0011_seraph', 'chr_0011_seraph', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0011_seraph', 'chr_0011_seraph', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_saixi', 'chr_0011_seraph', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: char_yingshi -> chr_0022_bounda
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_yingshi') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0022_bounda') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_yingshi' AND name <> '萤石'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_yingshi';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_yingshi' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_yingshi';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_yingshi', 'chr_0022_bounda';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0022_bounda',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_yingshi']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_yingshi';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_yingshi']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0022_bounda'
      AND source.id = 'char_yingshi';

    UPDATE public.pool_characters
    SET character_id = 'chr_0022_bounda'
    WHERE character_id = 'char_yingshi';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_yingshi' THEN 'chr_0022_bounda' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_yingshi']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0022_bounda',
        'char_yingshi'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_yingshi'
      AND id <> 'chr_0022_bounda';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0022_bounda', 'chr_0022_bounda', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0022_bounda', 'chr_0022_bounda', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_yingshi', 'chr_0022_bounda', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: char_yiwen -> chr_0017_yvonne
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_yiwen') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0017_yvonne') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_yiwen' AND name <> '伊冯'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_yiwen';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_yiwen' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_yiwen';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_yiwen', 'chr_0017_yvonne';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0017_yvonne',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_yiwen']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_yiwen';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_yiwen']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0017_yvonne'
      AND source.id = 'char_yiwen';

    UPDATE public.pool_characters
    SET character_id = 'chr_0017_yvonne'
    WHERE character_id = 'char_yiwen';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_yiwen' THEN 'chr_0017_yvonne' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_yiwen']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0017_yvonne',
        'char_yiwen'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_yiwen'
      AND id <> 'chr_0017_yvonne';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0017_yvonne', 'chr_0017_yvonne', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0017_yvonne', 'chr_0017_yvonne', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_yiwen', 'chr_0017_yvonne', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: char_yujin -> chr_0009_azrila
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_yujin') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0009_azrila') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_yujin' AND name <> '余烬'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_yujin';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_yujin' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_yujin';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_yujin', 'chr_0009_azrila';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0009_azrila',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_yujin']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_yujin';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_yujin']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0009_azrila'
      AND source.id = 'char_yujin';

    UPDATE public.pool_characters
    SET character_id = 'chr_0009_azrila'
    WHERE character_id = 'char_yujin';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_yujin' THEN 'chr_0009_azrila' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_yujin']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0009_azrila',
        'char_yujin'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_yujin'
      AND id <> 'chr_0009_azrila';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0009_azrila', 'chr_0009_azrila', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0009_azrila', 'chr_0009_azrila', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_yujin', 'chr_0009_azrila', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: char_zhouxue -> chr_0014_aurora
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_zhouxue') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'chr_0014_aurora') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_zhouxue' AND name <> '昼雪'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'char_zhouxue';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'char_zhouxue' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'char_zhouxue';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'char_zhouxue', 'chr_0014_aurora';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'chr_0014_aurora',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['char_zhouxue']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'char_zhouxue';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['char_zhouxue']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'chr_0014_aurora'
      AND source.id = 'char_zhouxue';

    UPDATE public.pool_characters
    SET character_id = 'chr_0014_aurora'
    WHERE character_id = 'char_zhouxue';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'char_zhouxue' THEN 'chr_0014_aurora' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['char_zhouxue']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'chr_0014_aurora',
        'char_zhouxue'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'char_zhouxue'
      AND id <> 'chr_0014_aurora';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'chr_0014_aurora', 'chr_0014_aurora', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'chr_0014_aurora', 'chr_0014_aurora', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'char_zhouxue', 'chr_0014_aurora', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: weapon_jerpeta_sig -> wpn_funnel_0011
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'weapon_jerpeta_sig') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'wpn_funnel_0011') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'weapon_jerpeta_sig' AND name <> '洁尔佩塔专武'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'weapon_jerpeta_sig';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'weapon_jerpeta_sig' AND type <> 'weapon'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'weapon_jerpeta_sig';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'weapon_jerpeta_sig', 'wpn_funnel_0011';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'wpn_funnel_0011',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['weapon_jerpeta_sig']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'weapon_jerpeta_sig';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['weapon_jerpeta_sig']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'wpn_funnel_0011'
      AND source.id = 'weapon_jerpeta_sig';

    UPDATE public.pool_characters
    SET character_id = 'wpn_funnel_0011'
    WHERE character_id = 'weapon_jerpeta_sig';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'weapon_jerpeta_sig' THEN 'wpn_funnel_0011' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['weapon_jerpeta_sig']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'wpn_funnel_0011',
        'weapon_jerpeta_sig'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'weapon_jerpeta_sig'
      AND id <> 'wpn_funnel_0011';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'wpn_funnel_0011', 'wpn_funnel_0011', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'wpn_funnel_0011', 'wpn_funnel_0011', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'weapon_jerpeta_sig', 'wpn_funnel_0011', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Character merge: weapon_levantin_sig -> wpn_sword_0006
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'weapon_levantin_sig') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'wpn_sword_0006') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'weapon_levantin_sig' AND name <> '莱万汀专武'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'weapon_levantin_sig';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'weapon_levantin_sig' AND type <> 'weapon'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'weapon_levantin_sig';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'weapon_levantin_sig', 'wpn_sword_0006';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      'wpn_sword_0006',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['weapon_levantin_sig']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'weapon_levantin_sig';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['weapon_levantin_sig']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'wpn_sword_0006'
      AND source.id = 'weapon_levantin_sig';

    UPDATE public.pool_characters
    SET character_id = 'wpn_sword_0006'
    WHERE character_id = 'weapon_levantin_sig';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'weapon_levantin_sig' THEN 'wpn_sword_0006' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['weapon_levantin_sig']::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        'wpn_sword_0006',
        'weapon_levantin_sig'
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = 'weapon_levantin_sig'
      AND id <> 'wpn_sword_0006';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'wpn_sword_0006', 'wpn_sword_0006', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('official_api', 'wpn_sword_0006', 'wpn_sword_0006', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('legacy_manual', 'weapon_levantin_sig', 'wpn_sword_0006', FALSE, 'Merge legacy alias seed into canonical official character id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Pool merge: pool_limited_jerpeta -> special_1_0_3
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_legacy_pool_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.pools WHERE pool_id = 'pool_limited_jerpeta') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.pools WHERE pool_id = 'special_1_0_3') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.pools WHERE pool_id = 'pool_limited_jerpeta' AND name <> '限定-洁尔佩塔'
  ) THEN
    RAISE EXCEPTION 'pool merge blocked: unexpected name for %', 'pool_limited_jerpeta';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pools WHERE pool_id = 'pool_limited_jerpeta' AND type <> 'limited'
  ) THEN
    RAISE EXCEPTION 'pool merge blocked: unexpected type for %', 'pool_limited_jerpeta';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'pool merge skipped: both source % and target % are missing', 'pool_limited_jerpeta', 'special_1_0_3';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.pools (
      pool_id,
      user_id,
      name,
      type,
      locked,
      is_limited_weapon,
      created_at,
      updated_at,
      description,
      start_time,
      end_time,
      banner_url,
      featured_characters,
      up_character,
      rotation_processed
    )
    SELECT
      'special_1_0_3',
      p.user_id,
      p.name,
      p.type,
      p.locked,
      p.is_limited_weapon,
      p.created_at,
      NOW(),
      p.description,
      p.start_time,
      p.end_time,
      p.banner_url,
      p.featured_characters,
      p.up_character,
      p.rotation_processed
    FROM public.pools AS p
    WHERE p.pool_id = 'pool_limited_jerpeta';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.pools AS target
    SET
      description = COALESCE(target.description, source.description),
      start_time = COALESCE(target.start_time, source.start_time),
      end_time = COALESCE(target.end_time, source.end_time),
      banner_url = COALESCE(target.banner_url, source.banner_url),
      featured_characters = CASE
        WHEN COALESCE(array_length(target.featured_characters, 1), 0) > 0 THEN target.featured_characters
        ELSE source.featured_characters
      END,
      up_character = COALESCE(target.up_character, source.up_character),
      locked = COALESCE(target.locked, FALSE) OR COALESCE(source.locked, FALSE),
      is_limited_weapon = COALESCE(target.is_limited_weapon, source.is_limited_weapon),
      rotation_processed = COALESCE(target.rotation_processed, FALSE) OR COALESCE(source.rotation_processed, FALSE),
      updated_at = NOW()
    FROM public.pools AS source
    WHERE target.pool_id = 'special_1_0_3'
      AND source.pool_id = 'pool_limited_jerpeta';

    UPDATE public.pool_characters
    SET pool_id = 'special_1_0_3'
    WHERE pool_id = 'pool_limited_jerpeta';

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'legacy_pool_id'
    ) INTO history_legacy_pool_id_exists;

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

    DELETE FROM public.pools
    WHERE pool_id = 'pool_limited_jerpeta'
      AND pool_id <> 'special_1_0_3';
  END IF;

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('internal', 'special_1_0_3', 'special_1_0_3', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('official_api', 'special_1_0_3', 'special_1_0_3', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('legacy_manual', 'pool_limited_jerpeta', 'special_1_0_3', FALSE, 'Merge legacy alias seed into canonical official pool id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Pool merge: pool_limited_levantin -> special_1_0_1
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_legacy_pool_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.pools WHERE pool_id = 'pool_limited_levantin') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.pools WHERE pool_id = 'special_1_0_1') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.pools WHERE pool_id = 'pool_limited_levantin' AND name <> '限定-莱万汀'
  ) THEN
    RAISE EXCEPTION 'pool merge blocked: unexpected name for %', 'pool_limited_levantin';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pools WHERE pool_id = 'pool_limited_levantin' AND type <> 'limited'
  ) THEN
    RAISE EXCEPTION 'pool merge blocked: unexpected type for %', 'pool_limited_levantin';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'pool merge skipped: both source % and target % are missing', 'pool_limited_levantin', 'special_1_0_1';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.pools (
      pool_id,
      user_id,
      name,
      type,
      locked,
      is_limited_weapon,
      created_at,
      updated_at,
      description,
      start_time,
      end_time,
      banner_url,
      featured_characters,
      up_character,
      rotation_processed
    )
    SELECT
      'special_1_0_1',
      p.user_id,
      p.name,
      p.type,
      p.locked,
      p.is_limited_weapon,
      p.created_at,
      NOW(),
      p.description,
      p.start_time,
      p.end_time,
      p.banner_url,
      p.featured_characters,
      p.up_character,
      p.rotation_processed
    FROM public.pools AS p
    WHERE p.pool_id = 'pool_limited_levantin';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.pools AS target
    SET
      description = COALESCE(target.description, source.description),
      start_time = COALESCE(target.start_time, source.start_time),
      end_time = COALESCE(target.end_time, source.end_time),
      banner_url = COALESCE(target.banner_url, source.banner_url),
      featured_characters = CASE
        WHEN COALESCE(array_length(target.featured_characters, 1), 0) > 0 THEN target.featured_characters
        ELSE source.featured_characters
      END,
      up_character = COALESCE(target.up_character, source.up_character),
      locked = COALESCE(target.locked, FALSE) OR COALESCE(source.locked, FALSE),
      is_limited_weapon = COALESCE(target.is_limited_weapon, source.is_limited_weapon),
      rotation_processed = COALESCE(target.rotation_processed, FALSE) OR COALESCE(source.rotation_processed, FALSE),
      updated_at = NOW()
    FROM public.pools AS source
    WHERE target.pool_id = 'special_1_0_1'
      AND source.pool_id = 'pool_limited_levantin';

    UPDATE public.pool_characters
    SET pool_id = 'special_1_0_1'
    WHERE pool_id = 'pool_limited_levantin';

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'legacy_pool_id'
    ) INTO history_legacy_pool_id_exists;

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

    DELETE FROM public.pools
    WHERE pool_id = 'pool_limited_levantin'
      AND pool_id <> 'special_1_0_1';
  END IF;

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('internal', 'special_1_0_1', 'special_1_0_1', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('official_api', 'special_1_0_1', 'special_1_0_1', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('legacy_manual', 'pool_limited_levantin', 'special_1_0_1', FALSE, 'Merge legacy alias seed into canonical official pool id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Pool merge: pool_limited_yiwen -> special_1_0_2
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_legacy_pool_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.pools WHERE pool_id = 'pool_limited_yiwen') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.pools WHERE pool_id = 'special_1_0_2') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.pools WHERE pool_id = 'pool_limited_yiwen' AND name <> '限定-伊冯'
  ) THEN
    RAISE EXCEPTION 'pool merge blocked: unexpected name for %', 'pool_limited_yiwen';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pools WHERE pool_id = 'pool_limited_yiwen' AND type <> 'limited'
  ) THEN
    RAISE EXCEPTION 'pool merge blocked: unexpected type for %', 'pool_limited_yiwen';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'pool merge skipped: both source % and target % are missing', 'pool_limited_yiwen', 'special_1_0_2';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.pools (
      pool_id,
      user_id,
      name,
      type,
      locked,
      is_limited_weapon,
      created_at,
      updated_at,
      description,
      start_time,
      end_time,
      banner_url,
      featured_characters,
      up_character,
      rotation_processed
    )
    SELECT
      'special_1_0_2',
      p.user_id,
      p.name,
      p.type,
      p.locked,
      p.is_limited_weapon,
      p.created_at,
      NOW(),
      p.description,
      p.start_time,
      p.end_time,
      p.banner_url,
      p.featured_characters,
      p.up_character,
      p.rotation_processed
    FROM public.pools AS p
    WHERE p.pool_id = 'pool_limited_yiwen';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.pools AS target
    SET
      description = COALESCE(target.description, source.description),
      start_time = COALESCE(target.start_time, source.start_time),
      end_time = COALESCE(target.end_time, source.end_time),
      banner_url = COALESCE(target.banner_url, source.banner_url),
      featured_characters = CASE
        WHEN COALESCE(array_length(target.featured_characters, 1), 0) > 0 THEN target.featured_characters
        ELSE source.featured_characters
      END,
      up_character = COALESCE(target.up_character, source.up_character),
      locked = COALESCE(target.locked, FALSE) OR COALESCE(source.locked, FALSE),
      is_limited_weapon = COALESCE(target.is_limited_weapon, source.is_limited_weapon),
      rotation_processed = COALESCE(target.rotation_processed, FALSE) OR COALESCE(source.rotation_processed, FALSE),
      updated_at = NOW()
    FROM public.pools AS source
    WHERE target.pool_id = 'special_1_0_2'
      AND source.pool_id = 'pool_limited_yiwen';

    UPDATE public.pool_characters
    SET pool_id = 'special_1_0_2'
    WHERE pool_id = 'pool_limited_yiwen';

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'legacy_pool_id'
    ) INTO history_legacy_pool_id_exists;

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

    DELETE FROM public.pools
    WHERE pool_id = 'pool_limited_yiwen'
      AND pool_id <> 'special_1_0_2';
  END IF;

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('internal', 'special_1_0_2', 'special_1_0_2', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('official_api', 'special_1_0_2', 'special_1_0_2', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('legacy_manual', 'pool_limited_yiwen', 'special_1_0_2', FALSE, 'Merge legacy alias seed into canonical official pool id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Pool merge: pool_standard_main -> standard
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_legacy_pool_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.pools WHERE pool_id = 'pool_standard_main') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.pools WHERE pool_id = 'standard') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.pools WHERE pool_id = 'pool_standard_main' AND name <> '常驻角色池'
  ) THEN
    RAISE EXCEPTION 'pool merge blocked: unexpected name for %', 'pool_standard_main';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pools WHERE pool_id = 'pool_standard_main' AND type <> 'standard'
  ) THEN
    RAISE EXCEPTION 'pool merge blocked: unexpected type for %', 'pool_standard_main';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'pool merge skipped: both source % and target % are missing', 'pool_standard_main', 'standard';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.pools (
      pool_id,
      user_id,
      name,
      type,
      locked,
      is_limited_weapon,
      created_at,
      updated_at,
      description,
      start_time,
      end_time,
      banner_url,
      featured_characters,
      up_character,
      rotation_processed
    )
    SELECT
      'standard',
      p.user_id,
      p.name,
      p.type,
      p.locked,
      p.is_limited_weapon,
      p.created_at,
      NOW(),
      p.description,
      p.start_time,
      p.end_time,
      p.banner_url,
      p.featured_characters,
      p.up_character,
      p.rotation_processed
    FROM public.pools AS p
    WHERE p.pool_id = 'pool_standard_main';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.pools AS target
    SET
      description = COALESCE(target.description, source.description),
      start_time = COALESCE(target.start_time, source.start_time),
      end_time = COALESCE(target.end_time, source.end_time),
      banner_url = COALESCE(target.banner_url, source.banner_url),
      featured_characters = CASE
        WHEN COALESCE(array_length(target.featured_characters, 1), 0) > 0 THEN target.featured_characters
        ELSE source.featured_characters
      END,
      up_character = COALESCE(target.up_character, source.up_character),
      locked = COALESCE(target.locked, FALSE) OR COALESCE(source.locked, FALSE),
      is_limited_weapon = COALESCE(target.is_limited_weapon, source.is_limited_weapon),
      rotation_processed = COALESCE(target.rotation_processed, FALSE) OR COALESCE(source.rotation_processed, FALSE),
      updated_at = NOW()
    FROM public.pools AS source
    WHERE target.pool_id = 'standard'
      AND source.pool_id = 'pool_standard_main';

    UPDATE public.pool_characters
    SET pool_id = 'standard'
    WHERE pool_id = 'pool_standard_main';

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'legacy_pool_id'
    ) INTO history_legacy_pool_id_exists;

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

    DELETE FROM public.pools
    WHERE pool_id = 'pool_standard_main'
      AND pool_id <> 'standard';
  END IF;

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('internal', 'standard', 'standard', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('official_api', 'standard', 'standard', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('legacy_manual', 'pool_standard_main', 'standard', FALSE, 'Merge legacy alias seed into canonical official pool id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Pool merge: pool_weapon_jerpeta -> weponbox_1_0_3
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_legacy_pool_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.pools WHERE pool_id = 'pool_weapon_jerpeta') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.pools WHERE pool_id = 'weponbox_1_0_3') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.pools WHERE pool_id = 'pool_weapon_jerpeta' AND name <> '武器-洁尔佩塔'
  ) THEN
    RAISE EXCEPTION 'pool merge blocked: unexpected name for %', 'pool_weapon_jerpeta';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pools WHERE pool_id = 'pool_weapon_jerpeta' AND type <> 'weapon'
  ) THEN
    RAISE EXCEPTION 'pool merge blocked: unexpected type for %', 'pool_weapon_jerpeta';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'pool merge skipped: both source % and target % are missing', 'pool_weapon_jerpeta', 'weponbox_1_0_3';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.pools (
      pool_id,
      user_id,
      name,
      type,
      locked,
      is_limited_weapon,
      created_at,
      updated_at,
      description,
      start_time,
      end_time,
      banner_url,
      featured_characters,
      up_character,
      rotation_processed
    )
    SELECT
      'weponbox_1_0_3',
      p.user_id,
      p.name,
      p.type,
      p.locked,
      p.is_limited_weapon,
      p.created_at,
      NOW(),
      p.description,
      p.start_time,
      p.end_time,
      p.banner_url,
      p.featured_characters,
      p.up_character,
      p.rotation_processed
    FROM public.pools AS p
    WHERE p.pool_id = 'pool_weapon_jerpeta';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.pools AS target
    SET
      description = COALESCE(target.description, source.description),
      start_time = COALESCE(target.start_time, source.start_time),
      end_time = COALESCE(target.end_time, source.end_time),
      banner_url = COALESCE(target.banner_url, source.banner_url),
      featured_characters = CASE
        WHEN COALESCE(array_length(target.featured_characters, 1), 0) > 0 THEN target.featured_characters
        ELSE source.featured_characters
      END,
      up_character = COALESCE(target.up_character, source.up_character),
      locked = COALESCE(target.locked, FALSE) OR COALESCE(source.locked, FALSE),
      is_limited_weapon = COALESCE(target.is_limited_weapon, source.is_limited_weapon),
      rotation_processed = COALESCE(target.rotation_processed, FALSE) OR COALESCE(source.rotation_processed, FALSE),
      updated_at = NOW()
    FROM public.pools AS source
    WHERE target.pool_id = 'weponbox_1_0_3'
      AND source.pool_id = 'pool_weapon_jerpeta';

    UPDATE public.pool_characters
    SET pool_id = 'weponbox_1_0_3'
    WHERE pool_id = 'pool_weapon_jerpeta';

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'legacy_pool_id'
    ) INTO history_legacy_pool_id_exists;

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

    DELETE FROM public.pools
    WHERE pool_id = 'pool_weapon_jerpeta'
      AND pool_id <> 'weponbox_1_0_3';
  END IF;

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('internal', 'weponbox_1_0_3', 'weponbox_1_0_3', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('official_api', 'weponbox_1_0_3', 'weponbox_1_0_3', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('legacy_manual', 'pool_weapon_jerpeta', 'weponbox_1_0_3', FALSE, 'Merge legacy alias seed into canonical official pool id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

-- Pool merge: pool_weapon_levantin -> weponbox_1_0_1
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_legacy_pool_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.pools WHERE pool_id = 'pool_weapon_levantin') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.pools WHERE pool_id = 'weponbox_1_0_1') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.pools WHERE pool_id = 'pool_weapon_levantin' AND name <> '武器-莱万汀'
  ) THEN
    RAISE EXCEPTION 'pool merge blocked: unexpected name for %', 'pool_weapon_levantin';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pools WHERE pool_id = 'pool_weapon_levantin' AND type <> 'weapon'
  ) THEN
    RAISE EXCEPTION 'pool merge blocked: unexpected type for %', 'pool_weapon_levantin';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'pool merge skipped: both source % and target % are missing', 'pool_weapon_levantin', 'weponbox_1_0_1';
    RETURN;
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.pools (
      pool_id,
      user_id,
      name,
      type,
      locked,
      is_limited_weapon,
      created_at,
      updated_at,
      description,
      start_time,
      end_time,
      banner_url,
      featured_characters,
      up_character,
      rotation_processed
    )
    SELECT
      'weponbox_1_0_1',
      p.user_id,
      p.name,
      p.type,
      p.locked,
      p.is_limited_weapon,
      p.created_at,
      NOW(),
      p.description,
      p.start_time,
      p.end_time,
      p.banner_url,
      p.featured_characters,
      p.up_character,
      p.rotation_processed
    FROM public.pools AS p
    WHERE p.pool_id = 'pool_weapon_levantin';

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.pools AS target
    SET
      description = COALESCE(target.description, source.description),
      start_time = COALESCE(target.start_time, source.start_time),
      end_time = COALESCE(target.end_time, source.end_time),
      banner_url = COALESCE(target.banner_url, source.banner_url),
      featured_characters = CASE
        WHEN COALESCE(array_length(target.featured_characters, 1), 0) > 0 THEN target.featured_characters
        ELSE source.featured_characters
      END,
      up_character = COALESCE(target.up_character, source.up_character),
      locked = COALESCE(target.locked, FALSE) OR COALESCE(source.locked, FALSE),
      is_limited_weapon = COALESCE(target.is_limited_weapon, source.is_limited_weapon),
      rotation_processed = COALESCE(target.rotation_processed, FALSE) OR COALESCE(source.rotation_processed, FALSE),
      updated_at = NOW()
    FROM public.pools AS source
    WHERE target.pool_id = 'weponbox_1_0_1'
      AND source.pool_id = 'pool_weapon_levantin';

    UPDATE public.pool_characters
    SET pool_id = 'weponbox_1_0_1'
    WHERE pool_id = 'pool_weapon_levantin';

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'legacy_pool_id'
    ) INTO history_legacy_pool_id_exists;

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

    DELETE FROM public.pools
    WHERE pool_id = 'pool_weapon_levantin'
      AND pool_id <> 'weponbox_1_0_1';
  END IF;

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('internal', 'weponbox_1_0_1', 'weponbox_1_0_1', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('official_api', 'weponbox_1_0_1', 'weponbox_1_0_1', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('legacy_manual', 'pool_weapon_levantin', 'weponbox_1_0_1', FALSE, 'Merge legacy alias seed into canonical official pool id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

COMMIT;
