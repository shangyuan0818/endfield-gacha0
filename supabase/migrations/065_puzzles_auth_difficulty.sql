-- 拼图系统：登录 + 审核 + 难度
-- 为 puzzles 表增加 difficulty、status、uploader_id 列
-- 替换 RLS 策略，增加审核 RPC

-- ═══ 1. 新增列 ═══
ALTER TABLE public.puzzles
  ADD COLUMN IF NOT EXISTS difficulty SMALLINT NOT NULL DEFAULT 2
    CHECK (difficulty IN (1, 2, 3)),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS uploader_id UUID REFERENCES auth.users(id)
    ON DELETE SET NULL;

-- ═══ 2. 索引 ═══
CREATE INDEX IF NOT EXISTS idx_puzzles_status ON public.puzzles (status);
CREATE INDEX IF NOT EXISTS idx_puzzles_difficulty ON public.puzzles (difficulty);

-- ═══ 3. 替换 RLS 策略 ═══

-- 删除旧策略
DROP POLICY IF EXISTS "puzzles_select_all" ON public.puzzles;
DROP POLICY IF EXISTS "puzzles_insert_all" ON public.puzzles;

-- SELECT: 已通过→所有人 | 上传者→自己的题 | 管理员→所有
CREATE POLICY "puzzles_select_v2" ON public.puzzles
  FOR SELECT USING (
    status = 'approved'
    OR (auth.uid() IS NOT NULL AND auth.uid() = uploader_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- INSERT: 须登录，须为自己，须为 pending
CREATE POLICY "puzzles_insert_v2" ON public.puzzles
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND uploader_id = auth.uid()
    AND status = 'pending'
  );

-- UPDATE: 仅管理员（审核用）
CREATE POLICY "puzzles_update_admin" ON public.puzzles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- ═══ 4. 审核 RPC ═══
CREATE OR REPLACE FUNCTION public.review_puzzle(puzzle_id INT, new_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', new_status;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.puzzles SET status = new_status WHERE id = puzzle_id;
END;
$$;
