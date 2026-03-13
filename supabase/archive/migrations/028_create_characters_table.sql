-- Migration: 028_create_characters_table
-- Description: 创建角色映射表，存储角色/武器基础信息
-- Date: 2026-01-11
-- FEAT-007: 卡池详情系统重构 - 角色映射系统

-- 1. 创建角色映射表
CREATE TABLE IF NOT EXISTS public.characters (
  id VARCHAR(50) PRIMARY KEY,                   -- 角色唯一ID，如 'char_levantin'
  name VARCHAR(100) NOT NULL,                   -- 角色显示名称，如 '莱万汀'
  avatar_url TEXT,                              -- CDN头像地址（可空，预留公测后补充）
  rarity INTEGER NOT NULL CHECK (rarity BETWEEN 3 AND 6),  -- 稀有度：3-6星
  type TEXT NOT NULL CHECK (type IN ('character', 'weapon')),  -- 类型：角色/武器
  aliases TEXT[],                               -- 别名数组（用于模糊搜索），如 ['莱万丁', 'Levantin']
  is_limited BOOLEAN DEFAULT FALSE,             -- 是否限定角色/武器
  release_date DATE,                            -- 首次上线日期（可空）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_characters_name ON public.characters(name);
CREATE INDEX IF NOT EXISTS idx_characters_type_rarity ON public.characters(type, rarity);
CREATE INDEX IF NOT EXISTS idx_characters_aliases ON public.characters USING GIN(aliases);

-- 3. 启用 RLS 策略（行级安全）
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

-- 3.1 所有人可读
CREATE POLICY "characters_select_all" ON public.characters
  FOR SELECT USING (true);

-- 3.2 仅超级管理员可管理
CREATE POLICY "characters_manage_super_admin" ON public.characters
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- 4. 创建触发器（自动更新 updated_at）
CREATE TRIGGER update_characters_updated_at
  BEFORE UPDATE ON public.characters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. 插入初始角色数据（三测角色）
INSERT INTO public.characters (id, name, rarity, type, is_limited, aliases) VALUES
  -- 限定6星角色
  ('char_levantin', '莱万汀', 6, 'character', true, ARRAY['莱万丁', 'Levantin', 'LWT']),
  ('char_yangyan', '杨颜', 6, 'character', true, ARRAY['Yang Yan', '阳炎', 'YY']),
  ('char_yiwen', '伊冯', 6, 'character', true, ARRAY['Yiwen', 'Ivan', '伊文', 'YW']),
  ('char_jerpeta', '洁尔佩塔', 6, 'character', true, ARRAY['Jerpeta', 'Gerpeta', 'JEPT']),

  -- 常驻6星角色（示例，根据实际游戏数据补充）
  ('char_standard_1', '常驻角色1', 6, 'character', false, ARRAY['Standard1']),
  ('char_standard_2', '常驻角色2', 6, 'character', false, ARRAY['Standard2']),

  -- 5星角色（示例）
  ('char_5star_1', '5星角色1', 5, 'character', false, ARRAY['5Star1']),

  -- 武器（示例）
  ('weapon_6star_1', '6星武器1', 6, 'weapon', true, ARRAY['Weapon1'])
ON CONFLICT (id) DO NOTHING;

-- 6. 添加表注释
COMMENT ON TABLE public.characters IS '角色/武器基础信息映射表，用于展示角色名称和头像';
COMMENT ON COLUMN public.characters.id IS '角色唯一标识符，格式：char_xxx 或 weapon_xxx';
COMMENT ON COLUMN public.characters.aliases IS '别名数组，用于模糊搜索和多语言支持';
COMMENT ON COLUMN public.characters.is_limited IS '是否为限定角色/武器（UP池专属）';

-- 7. 验证迁移
DO $$
DECLARE
  character_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO character_count FROM public.characters;

  IF character_count > 0 THEN
    RAISE NOTICE '✅ Migration 028: characters 表创建成功，已插入 % 个初始角色', character_count;
  ELSE
    RAISE WARNING '⚠️ Migration 028: characters 表已创建，但初始数据为空';
  END IF;
END $$;
