-- 108: seed the 2026-05-14 "辉光庆典" Joint / extra recruitment pool.
-- The official record API exposes this banner as:
--   pool_type = E_CharacterGachaPoolType_Joint
--   poolId    = joint_1_2_2

DO $$
DECLARE
  v_admin_uuid UUID;
  v_pool_id TEXT := 'joint_1_2_2';
  v_featured_refs TEXT[];
BEGIN
  SELECT id
    INTO v_admin_uuid
    FROM public.profiles
   WHERE role = 'super_admin'
   ORDER BY created_at ASC NULLS LAST
   LIMIT 1;

  IF v_admin_uuid IS NULL THEN
    RAISE NOTICE '108_seed_fest_of_brilliance_joint_pool skipped: no super_admin profile found';
    RETURN;
  END IF;

  WITH featured(source_id, legacy_id, fallback_name, sort_order) AS (
    VALUES
      ('chr_0016_laevat', 'char_levantin', '莱万汀', 1),
      ('chr_0013_aglina', 'char_jerpeta', '洁尔佩塔', 2),
      ('chr_0025_ardelia', 'char_eldelra', '艾尔黛拉', 3),
      ('chr_0029_pograni', 'char_junwei', '骏卫', 4)
  )
  SELECT ARRAY_AGG(COALESCE(source_match.id, legacy_match.id, featured.fallback_name) ORDER BY featured.sort_order)
    INTO v_featured_refs
    FROM featured
    LEFT JOIN public.characters AS source_match
      ON source_match.id = featured.source_id
    LEFT JOIN public.characters AS legacy_match
      ON legacy_match.id = featured.legacy_id;

  INSERT INTO public.pools (
    user_id,
    pool_id,
    name,
    name_en,
    type,
    locked,
    is_limited_weapon,
    up_character,
    description,
    featured_characters,
    created_at,
    updated_at
  )
  VALUES (
    v_admin_uuid,
    v_pool_id,
    '辉光庆典',
    'Fest of Brilliance',
    'extra',
    TRUE,
    NULL,
    '莱万汀',
    '2026-05-14 附加寻访。全部可能出现的 6 星为莱万汀、洁尔佩塔、艾尔黛拉、骏卫；保底独立计算。',
    v_featured_refs,
    NOW(),
    NOW()
  )
  ON CONFLICT (pool_id) DO UPDATE
  SET
    name = EXCLUDED.name,
    name_en = EXCLUDED.name_en,
    type = 'extra',
    locked = TRUE,
    is_limited_weapon = NULL,
    up_character = EXCLUDED.up_character,
    description = COALESCE(NULLIF(public.pools.description, ''), EXCLUDED.description),
    featured_characters = EXCLUDED.featured_characters,
    updated_at = NOW();

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES
    ('official_api', v_pool_id, v_pool_id, TRUE, 'Official Joint recruitment pool id for 2026-05-14 辉光庆典'),
    ('official_notice', v_pool_id, v_pool_id, TRUE, 'Official notice pool id for 2026-05-14 辉光庆典'),
    ('official_notice', '辉光庆典', v_pool_id, FALSE, 'Official Chinese banner name for 2026-05-14 Joint recruitment')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = EXCLUDED.is_primary,
    note = EXCLUDED.note,
    updated_at = NOW();

  WITH featured(source_id, legacy_id, sort_order) AS (
    VALUES
      ('chr_0016_laevat', 'char_levantin', 1),
      ('chr_0013_aglina', 'char_jerpeta', 2),
      ('chr_0025_ardelia', 'char_eldelra', 3),
      ('chr_0029_pograni', 'char_junwei', 4)
  ),
  resolved AS (
    SELECT
      COALESCE(source_match.id, legacy_match.id) AS character_id,
      featured.sort_order
    FROM featured
    LEFT JOIN public.characters AS source_match
      ON source_match.id = featured.source_id
    LEFT JOIN public.characters AS legacy_match
      ON legacy_match.id = featured.legacy_id
  )
  INSERT INTO public.pool_characters (pool_id, character_id, is_up)
  SELECT v_pool_id, character_id, TRUE
    FROM resolved
   WHERE character_id IS NOT NULL
   ORDER BY sort_order
  ON CONFLICT (pool_id, character_id) DO UPDATE
  SET is_up = TRUE;
END $$;
