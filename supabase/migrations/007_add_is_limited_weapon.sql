-- 为 pools 表添加 is_limited_weapon 字段
-- 用于区分限定武器池（有额外获取内容）和常驻武器池（无额外获取）

-- 添加字段，默认为 true（向后兼容：现有武器池默认为限定武器池）
ALTER TABLE public.pools
ADD COLUMN IF NOT EXISTS is_limited_weapon BOOLEAN DEFAULT TRUE;

-- 添加注释说明
COMMENT ON COLUMN public.pools.is_limited_weapon IS '武器池类型：true=限定武器池（有额外获取），false=常驻武器池（无额外获取）。仅当 type=weapon 时有效。';

-- 更新说明：
-- 限定武器池（is_limited_weapon = true）：
--   - 累计申领10次，额外获得补充武库箱×1
--   - 累计申领18次，额外获得限定UP武器×1
--   - 之后每8次申领交替获得
--
-- 常驻武器池（is_limited_weapon = false）：
--   - 无额外获取内容
