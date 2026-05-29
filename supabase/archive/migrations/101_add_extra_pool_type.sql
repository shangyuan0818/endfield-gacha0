-- 101: allow explicit extra pool type for the one-off 2026-05 banner family.
-- Notes:
--   1. Keep historical special_* / limited logic untouched.
--   2. Only extend pools.type validation to accept `extra`.

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT tc.constraint_name
    INTO v_constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc
      ON cc.constraint_name = tc.constraint_name
   WHERE tc.table_schema = 'public'
     AND tc.table_name = 'pools'
     AND tc.constraint_type = 'CHECK'
     AND cc.check_clause LIKE '%type%'
     AND cc.check_clause LIKE '%limited%'
     AND cc.check_clause LIKE '%weapon%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.pools DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE public.pools
  ADD CONSTRAINT pools_type_check
  CHECK (type IN ('extra', 'limited', 'standard', 'weapon', 'beginner'));

COMMENT ON CONSTRAINT pools_type_check ON public.pools IS
  '允许 extra / limited / standard / weapon / beginner 五类卡池。';
