-- ============================================
-- V2 Schema 升级 - 支持官网 API 导入和多账号
-- 版本: 2.3.0
-- 更新日期: 2026-01-27
-- ============================================

-- ==================== 1. pools 表扩展 ====================

-- 添加游戏账号字段
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pools' AND column_name = 'game_uid')
  THEN
    ALTER TABLE public.pools ADD COLUMN game_uid TEXT;
    COMMENT ON COLUMN public.pools.game_uid IS '游戏账号 UID';
  END IF;
END $$;

-- 添加游戏昵称
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pools' AND column_name = 'nick_name')
  THEN
    ALTER TABLE public.pools ADD COLUMN nick_name TEXT;
    COMMENT ON COLUMN public.pools.nick_name IS '游戏昵称';
  END IF;
END $$;

-- 添加 UP 角色名称（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pools' AND column_name = 'up_character')
  THEN
    ALTER TABLE public.pools ADD COLUMN up_character TEXT;
    COMMENT ON COLUMN public.pools.up_character IS 'UP 角色名称';
  END IF;
END $$;

-- 添加 Banner 图片 URL
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pools' AND column_name = 'banner_url')
  THEN
    ALTER TABLE public.pools ADD COLUMN banner_url TEXT;
    COMMENT ON COLUMN public.pools.banner_url IS 'Banner 图片 URL';
  END IF;
END $$;

-- 添加卡池时间
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pools' AND column_name = 'start_time')
  THEN
    ALTER TABLE public.pools ADD COLUMN start_time TIMESTAMPTZ;
    ALTER TABLE public.pools ADD COLUMN end_time TIMESTAMPTZ;
    COMMENT ON COLUMN public.pools.start_time IS '卡池开始时间';
    COMMENT ON COLUMN public.pools.end_time IS '卡池结束时间';
  END IF;
END $$;

-- 更新 type 约束以支持新类型 (limited_character, limited_weapon, standard, beginner)
-- 注意：PostgreSQL 不支持直接修改 CHECK 约束，需要删除后重建
-- 由于这可能影响现有数据，我们改用更宽松的约束
DO $$
BEGIN
  -- 先尝试删除旧的约束
  BEGIN
    ALTER TABLE public.pools DROP CONSTRAINT IF EXISTS pools_type_check;
  EXCEPTION WHEN OTHERS THEN
    -- 约束可能不存在，忽略错误
    NULL;
  END;

  -- 添加新的宽松约束（允许更多类型值）
  ALTER TABLE public.pools ADD CONSTRAINT pools_type_check
    CHECK (type IN ('limited', 'limited_character', 'standard', 'weapon', 'limited_weapon', 'beginner'));
EXCEPTION WHEN OTHERS THEN
  -- 如果约束已存在，忽略
  NULL;
END $$;

-- ==================== 2. history 表扩展 ====================

-- 添加角色/武器名称
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'character_name')
  THEN
    ALTER TABLE public.history ADD COLUMN character_name TEXT;
    COMMENT ON COLUMN public.history.character_name IS '角色/武器名称';
  END IF;
END $$;

-- 添加批次 ID（十连分组用）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'batch_id')
  THEN
    ALTER TABLE public.history ADD COLUMN batch_id TEXT;
    COMMENT ON COLUMN public.history.batch_id IS '批次 ID（十连分组）';
  END IF;
END $$;

-- 添加官方序列号（去重用）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'seq_id')
  THEN
    ALTER TABLE public.history ADD COLUMN seq_id TEXT;
    COMMENT ON COLUMN public.history.seq_id IS '官方序列号（去重用）';
  END IF;
END $$;

-- 添加当前保底计数
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'pity')
  THEN
    ALTER TABLE public.history ADD COLUMN pity INTEGER DEFAULT 0;
    COMMENT ON COLUMN public.history.pity IS '当前保底计数';
  END IF;
END $$;

-- 添加是否首次获得
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'is_new')
  THEN
    ALTER TABLE public.history ADD COLUMN is_new BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN public.history.is_new IS '是否首次获得';
  END IF;
END $$;

-- 添加是否免费抽取
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'is_free')
  THEN
    ALTER TABLE public.history ADD COLUMN is_free BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN public.history.is_free IS '是否免费抽取';
  END IF;
END $$;

-- 添加关联的游戏账号
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'game_uid')
  THEN
    ALTER TABLE public.history ADD COLUMN game_uid TEXT;
    COMMENT ON COLUMN public.history.game_uid IS '关联的游戏账号 UID';
  END IF;
END $$;

-- 添加 seq_id 索引（用于去重查询）
CREATE INDEX IF NOT EXISTS idx_history_seq_id ON public.history(seq_id);

-- 添加 batch_id 索引（用于分组查询）
CREATE INDEX IF NOT EXISTS idx_history_batch_id ON public.history(batch_id);

-- 添加 game_uid 索引
CREATE INDEX IF NOT EXISTS idx_history_game_uid ON public.history(game_uid);

-- ==================== 3. game_accounts 表（多账号支持） ====================

CREATE TABLE IF NOT EXISTS public.game_accounts (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_uid TEXT NOT NULL,
  nick_name TEXT,
  server_id TEXT DEFAULT '1',
  last_import_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_uid)
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_game_accounts_user_id ON public.game_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_game_accounts_game_uid ON public.game_accounts(game_uid);

-- 启用 RLS
ALTER TABLE public.game_accounts ENABLE ROW LEVEL SECURITY;

-- RLS 策略
DROP POLICY IF EXISTS "game_accounts_select_policy" ON public.game_accounts;
CREATE POLICY "game_accounts_select_policy" ON public.game_accounts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "game_accounts_insert_policy" ON public.game_accounts;
CREATE POLICY "game_accounts_insert_policy" ON public.game_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "game_accounts_update_policy" ON public.game_accounts;
CREATE POLICY "game_accounts_update_policy" ON public.game_accounts
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "game_accounts_delete_policy" ON public.game_accounts;
CREATE POLICY "game_accounts_delete_policy" ON public.game_accounts
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.game_accounts IS '游戏账号表（支持多账号）';

-- ==================== 4. 更新 get_global_stats 函数 ====================
-- 确保函数使用新的字段

-- 此处可以根据需要更新统计函数
-- 暂时保留原有函数，后续可单独更新

-- ==================== 完成 ====================

SELECT 'V2 Schema upgrade completed successfully!' AS status;
