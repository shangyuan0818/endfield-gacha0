-- ============================================
-- Alias merge SQL (generated)
-- Generated at: 2026-03-13T10:29:06.514Z
-- ============================================
BEGIN;

-- Character merge: manual_character_char_ab12cd_123abc -> char_official_example
DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'manual_character_char_ab12cd_123abc') INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = 'char_official_example') INTO target_exists;

  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'manual_character_char_ab12cd_123abc' AND name <> '示例角色'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected name for %', 'manual_character_char_ab12cd_123abc';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.characters WHERE id = 'manual_character_char_ab12cd_123abc' AND type <> 'character'
  ) THEN
    RAISE EXCEPTION 'character merge blocked: unexpected type for %', 'manual_character_char_ab12cd_123abc';
  END IF;

  IF NOT source_exists AND NOT target_exists THEN
    RAISE NOTICE 'character merge skipped: both source % and target % are missing', 'manual_character_char_ab12cd_123abc', 'char_official_example';
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
      'char_official_example',
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[]) || COALESCE(NULL, ARRAY[]::TEXT[]) || ARRAY['manual_character_char_ab12cd_123abc']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = 'manual_character_char_ab12cd_123abc';

    target_exists := TRUE;
  END IF;

  IF target_exists THEN
    UPDATE public.pool_characters
    SET character_id = 'char_official_example'
    WHERE character_id = 'manual_character_char_ab12cd_123abc';

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = 'manual_character_char_ab12cd_123abc' THEN 'char_official_example' ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY['manual_character_char_ab12cd_123abc']::TEXT[];

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
        'char_official_example',
        'manual_character_char_ab12cd_123abc'
      );
    END IF;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ARRAY(SELECT DISTINCT item FROM unnest(COALESCE(target.aliases, ARRAY[]::TEXT[]) || COALESCE(source.aliases, ARRAY[]::TEXT[]) || ARRAY['manual_character_char_ab12cd_123abc']) AS item WHERE item IS NOT NULL AND BTRIM(item) <> ''),
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = 'char_official_example'
      AND source.id = 'manual_character_char_ab12cd_123abc';
    DELETE FROM public.characters
    WHERE id = 'manual_character_char_ab12cd_123abc'
      AND id <> 'char_official_example';
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', 'char_official_example', 'char_official_example', TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('wiki', 'char_official_example', 'char_official_example', TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('manual_placeholder', 'manual_character_char_ab12cd_123abc', 'char_official_example', FALSE, 'Replace manual placeholder with official wiki id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
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
    RAISE EXCEPTION 'pool merge blocked: both source % and target % are missing', 'pool_limited_levantin', 'special_1_0_1';
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

  IF target_exists THEN
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
  VALUES ('legacy_manual', 'pool_limited_levantin', 'special_1_0_1', FALSE, 'Merge legacy manual pool into official limited pool id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
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
    RAISE EXCEPTION 'pool merge blocked: both source % and target % are missing', 'pool_limited_jerpeta', 'special_1_0_3';
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

  IF target_exists THEN
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
  VALUES ('legacy_manual', 'pool_limited_jerpeta', 'special_1_0_3', FALSE, 'Merge legacy manual pool into official limited pool id')
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
    RAISE EXCEPTION 'pool merge blocked: both source % and target % are missing', 'pool_limited_yiwen', 'special_1_0_2';
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

  IF target_exists THEN
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
  VALUES ('legacy_manual', 'pool_limited_yiwen', 'special_1_0_2', FALSE, 'Merge legacy manual pool into official limited pool id')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;

COMMIT;
