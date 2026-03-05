-- 拼图题库表（共享题库 + 未来验证码题目来源）
CREATE TABLE IF NOT EXISTS public.puzzles (
  id SERIAL PRIMARY KEY,
  author TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL,
  piece_count SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  solve_count INT NOT NULL DEFAULT 0
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_puzzles_created_at ON public.puzzles (created_at DESC);

-- RLS
ALTER TABLE public.puzzles ENABLE ROW LEVEL SECURITY;

-- 所有人可读
CREATE POLICY "puzzles_select_all" ON public.puzzles
  FOR SELECT USING (true);

-- 所有人可插入
CREATE POLICY "puzzles_insert_all" ON public.puzzles
  FOR INSERT WITH CHECK (true);

-- 禁止直接 UPDATE/DELETE（通过 RPC 更新 solve_count）

-- 解题计数 RPC（SECURITY DEFINER 绕过 RLS）
CREATE OR REPLACE FUNCTION public.increment_puzzle_solve(puzzle_id INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.puzzles
  SET solve_count = solve_count + 1
  WHERE id = puzzle_id;
END;
$$;
