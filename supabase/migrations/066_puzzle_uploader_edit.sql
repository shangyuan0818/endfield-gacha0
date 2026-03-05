-- 允许上传者修改自己题目的难度（通过 SECURITY DEFINER RPC，绕过只允许管理员 UPDATE 的 RLS）
CREATE OR REPLACE FUNCTION public.update_puzzle_difficulty(puzzle_id INT, new_difficulty SMALLINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new_difficulty NOT IN (1, 2, 3) THEN
    RAISE EXCEPTION 'Invalid difficulty: %', new_difficulty;
  END IF;
  -- 须为上传者本人或管理员
  IF NOT EXISTS (
    SELECT 1 FROM public.puzzles WHERE id = puzzle_id AND (
      uploader_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.puzzles SET difficulty = new_difficulty WHERE id = puzzle_id;
END;
$$;
