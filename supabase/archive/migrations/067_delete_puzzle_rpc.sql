-- 允许上传者或管理员删除题目（SECURITY DEFINER 绕过 RLS）
-- 拒绝审核时也调用此函数，直接从数据库删除，不保留 rejected 状态
CREATE OR REPLACE FUNCTION public.delete_puzzle(puzzle_id INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 须为上传者本人或管理员
  IF NOT EXISTS (
    SELECT 1 FROM public.puzzles WHERE id = puzzle_id AND (
      uploader_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM public.puzzles WHERE id = puzzle_id;
END;
$$;
