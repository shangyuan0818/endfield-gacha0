-- Migration: 初始化角色数据
-- 插入所有角色的完整数据，包括卡池配置

-- ============================================
-- 限定6星角色（3个）
-- ============================================

-- 莱万汀 (3次轮换后移出)
INSERT INTO public.characters (id, name, rarity, type, is_limited, pool_config, aliases, created_at, updated_at)
VALUES (
  'char_levantin',
  '莱万汀',
  6,
  'character',
  true,
  jsonb_build_object(
    'pools', ARRAY['limited', 'standard']::text[],
    'limited_rotation_count', 0,
    'removes_after', 3,
    'is_active_in_limited', true
  ),
  ARRAY['莱万丁', 'Levantin', 'LWT']::text[],
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  pool_config = EXCLUDED.pool_config,
  updated_at = NOW();

-- 伊冯 (4次轮换后移出)
INSERT INTO public.characters (id, name, rarity, type, is_limited, pool_config, aliases, created_at, updated_at)
VALUES (
  'char_yiwen',
  '伊冯',
  6,
  'character',
  true,
  jsonb_build_object(
    'pools', ARRAY['limited', 'standard']::text[],
    'limited_rotation_count', 0,
    'removes_after', 4,
    'is_active_in_limited', true
  ),
  ARRAY['Yvonne', 'YW']::text[],
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  pool_config = EXCLUDED.pool_config,
  updated_at = NOW();

-- 洁尔佩塔 (5次轮换后移出)
INSERT INTO public.characters (id, name, rarity, type, is_limited, pool_config, aliases, created_at, updated_at)
VALUES (
  'char_jerpeta',
  '洁尔佩塔',
  6,
  'character',
  true,
  jsonb_build_object(
    'pools', ARRAY['limited', 'standard']::text[],
    'limited_rotation_count', 0,
    'removes_after', 5,
    'is_active_in_limited', true
  ),
  ARRAY['Gerpetta', 'JEPT']::text[],
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  pool_config = EXCLUDED.pool_config,
  updated_at = NOW();

-- ============================================
-- 常驻6星角色（5个，永不移出）
-- ============================================

-- 艾尔黛拉
INSERT INTO public.characters (id, name, rarity, type, is_limited, pool_config, aliases, created_at, updated_at)
VALUES (
  'char_eldela',
  '艾尔黛拉',
  6,
  'character',
  false,
  jsonb_build_object(
    'pools', ARRAY['limited', 'standard']::text[],
    'removes_after', NULL,
    'is_active_in_limited', true
  ),
  ARRAY['小羊', 'Eldela', 'AEDL']::text[],
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  pool_config = EXCLUDED.pool_config,
  updated_at = NOW();

-- 骏卫
INSERT INTO public.characters (id, name, rarity, type, is_limited, pool_config, aliases, created_at, updated_at)
VALUES (
  'char_junwei',
  '骏卫',
  6,
  'character',
  false,
  jsonb_build_object(
    'pools', ARRAY['limited', 'standard']::text[],
    'removes_after', NULL,
    'is_active_in_limited', true
  ),
  ARRAY['Junwei', 'JW']::text[],
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  pool_config = EXCLUDED.pool_config,
  updated_at = NOW();

-- 别礼
INSERT INTO public.characters (id, name, rarity, type, is_limited, pool_config, aliases, created_at, updated_at)
VALUES (
  'char_bieli',
  '别礼',
  6,
  'character',
  false,
  jsonb_build_object(
    'pools', ARRAY['limited', 'standard']::text[],
    'removes_after', NULL,
    'is_active_in_limited', true
  ),
  ARRAY['Bieli', 'BL']::text[],
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  pool_config = EXCLUDED.pool_config,
  updated_at = NOW();

-- 余烬
INSERT INTO public.characters (id, name, rarity, type, is_limited, pool_config, aliases, created_at, updated_at)
VALUES (
  'char_yujin',
  '余烬',
  6,
  'character',
  false,
  jsonb_build_object(
    'pools', ARRAY['limited', 'standard']::text[],
    'removes_after', NULL,
    'is_active_in_limited', true
  ),
  ARRAY['Ember', 'YJ']::text[],
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  pool_config = EXCLUDED.pool_config,
  updated_at = NOW();

-- 黎风
INSERT INTO public.characters (id, name, rarity, type, is_limited, pool_config, aliases, created_at, updated_at)
VALUES (
  'char_lifeng',
  '黎风',
  6,
  'character',
  false,
  jsonb_build_object(
    'pools', ARRAY['limited', 'standard']::text[],
    'removes_after', NULL,
    'is_active_in_limited', true
  ),
  ARRAY['Lifeng', 'LF']::text[],
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  pool_config = EXCLUDED.pool_config,
  updated_at = NOW();

-- ============================================
-- 5星角色（9个）
-- ============================================

INSERT INTO public.characters (id, name, rarity, type, is_limited, pool_config, created_at, updated_at)
VALUES
  ('char_peilika', '佩丽卡', 5, 'character', false, jsonb_build_object('pools', ARRAY['limited', 'standard']::text[]), NOW(), NOW()),
  ('char_huguang', '弧光', 5, 'character', false, jsonb_build_object('pools', ARRAY['limited', 'standard']::text[]), NOW(), NOW()),
  ('char_aiweiwen', '艾维文娜', 5, 'character', false, jsonb_build_object('pools', ARRAY['limited', 'standard']::text[]), NOW(), NOW()),
  ('char_dapan', '大潘', 5, 'character', false, jsonb_build_object('pools', ARRAY['limited', 'standard']::text[]), NOW(), NOW()),
  ('char_chenqianyu', '陈千语', 5, 'character', false, jsonb_build_object('pools', ARRAY['limited', 'standard']::text[]), NOW(), NOW()),
  ('char_langwei', '狼卫', 5, 'character', false, jsonb_build_object('pools', ARRAY['limited', 'standard']::text[]), NOW(), NOW()),
  ('char_saixi', '赛希', 5, 'character', false, jsonb_build_object('pools', ARRAY['limited', 'standard']::text[]), NOW(), NOW()),
  ('char_zhouxue', '昼雪', 5, 'character', false, jsonb_build_object('pools', ARRAY['limited', 'standard']::text[]), NOW(), NOW()),
  ('char_alieshen', '阿列什', 5, 'character', false, jsonb_build_object('pools', ARRAY['limited', 'standard']::text[]), NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  pool_config = EXCLUDED.pool_config,
  updated_at = NOW();

-- ============================================
-- 4星角色（5个）
-- ============================================

INSERT INTO public.characters (id, name, rarity, type, is_limited, pool_config, created_at, updated_at)
VALUES
  ('char_qiuli', '秋栗', 4, 'character', false, jsonb_build_object('pools', ARRAY['limited', 'standard']::text[]), NOW(), NOW()),
  ('char_kaqier', '卡契尔', 4, 'character', false, jsonb_build_object('pools', ARRAY['limited', 'standard']::text[]), NOW(), NOW()),
  ('char_aitela', '埃特拉', 4, 'character', false, jsonb_build_object('pools', ARRAY['limited', 'standard']::text[]), NOW(), NOW()),
  ('char_yingshi', '萤石', 4, 'character', false, jsonb_build_object('pools', ARRAY['limited', 'standard']::text[]), NOW(), NOW()),
  ('char_antaer', '安塔尔', 4, 'character', false, jsonb_build_object('pools', ARRAY['limited', 'standard']::text[]), NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  pool_config = EXCLUDED.pool_config,
  updated_at = NOW();

-- ============================================
-- 武器（占位符）
-- ============================================

-- 6星限定武器
INSERT INTO public.characters (id, name, rarity, type, is_limited, pool_config, created_at, updated_at)
VALUES
  ('weapon_6star_limited', '6星限定武器', 6, 'weapon', true, jsonb_build_object('pools', ARRAY['weapon']::text[]), NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  pool_config = EXCLUDED.pool_config,
  updated_at = NOW();

-- 6星常驻武器（6把）
INSERT INTO public.characters (id, name, rarity, type, is_limited, pool_config, created_at, updated_at)
VALUES
  ('weapon_6star_std_1', '6星常驻武器-1', 6, 'weapon', false, jsonb_build_object('pools', ARRAY['weapon']::text[]), NOW(), NOW()),
  ('weapon_6star_std_2', '6星常驻武器-2', 6, 'weapon', false, jsonb_build_object('pools', ARRAY['weapon']::text[]), NOW(), NOW()),
  ('weapon_6star_std_3', '6星常驻武器-3', 6, 'weapon', false, jsonb_build_object('pools', ARRAY['weapon']::text[]), NOW(), NOW()),
  ('weapon_6star_std_4', '6星常驻武器-4', 6, 'weapon', false, jsonb_build_object('pools', ARRAY['weapon']::text[]), NOW(), NOW()),
  ('weapon_6star_std_5', '6星常驻武器-5', 6, 'weapon', false, jsonb_build_object('pools', ARRAY['weapon']::text[]), NOW(), NOW()),
  ('weapon_6star_std_6', '6星常驻武器-6', 6, 'weapon', false, jsonb_build_object('pools', ARRAY['weapon']::text[]), NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  pool_config = EXCLUDED.pool_config,
  updated_at = NOW();

-- 5星武器（9把）
INSERT INTO public.characters (id, name, rarity, type, is_limited, pool_config, created_at, updated_at)
VALUES
  ('weapon_5star_1', '5星武器-1', 5, 'weapon', false, jsonb_build_object('pools', ARRAY['weapon']::text[]), NOW(), NOW()),
  ('weapon_5star_2', '5星武器-2', 5, 'weapon', false, jsonb_build_object('pools', ARRAY['weapon']::text[]), NOW(), NOW()),
  ('weapon_5star_3', '5星武器-3', 5, 'weapon', false, jsonb_build_object('pools', ARRAY['weapon']::text[]), NOW(), NOW()),
  ('weapon_5star_4', '5星武器-4', 5, 'weapon', false, jsonb_build_object('pools', ARRAY['weapon']::text[]), NOW(), NOW()),
  ('weapon_5star_5', '5星武器-5', 5, 'weapon', false, jsonb_build_object('pools', ARRAY['weapon']::text[]), NOW(), NOW()),
  ('weapon_5star_6', '5星武器-6', 5, 'weapon', false, jsonb_build_object('pools', ARRAY['weapon']::text[]), NOW(), NOW()),
  ('weapon_5star_7', '5星武器-7', 5, 'weapon', false, jsonb_build_object('pools', ARRAY['weapon']::text[]), NOW(), NOW()),
  ('weapon_5star_8', '5星武器-8', 5, 'weapon', false, jsonb_build_object('pools', ARRAY['weapon']::text[]), NOW(), NOW()),
  ('weapon_5star_9', '5星武器-9', 5, 'weapon', false, jsonb_build_object('pools', ARRAY['weapon']::text[]), NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  pool_config = EXCLUDED.pool_config,
  updated_at = NOW();

-- 4星武器（5把）
INSERT INTO public.characters (id, name, rarity, type, is_limited, pool_config, created_at, updated_at)
VALUES
  ('weapon_4star_1', '4星武器-1', 4, 'weapon', false, jsonb_build_object('pools', ARRAY['weapon']::text[]), NOW(), NOW()),
  ('weapon_4star_2', '4星武器-2', 4, 'weapon', false, jsonb_build_object('pools', ARRAY['weapon']::text[]), NOW(), NOW()),
  ('weapon_4star_3', '4星武器-3', 4, 'weapon', false, jsonb_build_object('pools', ARRAY['weapon']::text[]), NOW(), NOW()),
  ('weapon_4star_4', '4星武器-4', 4, 'weapon', false, jsonb_build_object('pools', ARRAY['weapon']::text[]), NOW(), NOW()),
  ('weapon_4star_5', '4星武器-5', 4, 'weapon', false, jsonb_build_object('pools', ARRAY['weapon']::text[]), NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  pool_config = EXCLUDED.pool_config,
  updated_at = NOW();
