-- 115: add explicit account password-change rate-limit bucket.
--
-- Settings-page password changes now require current-password reauthentication.
-- Keep that reauthentication path behind a dedicated server-side rate-limit
-- bucket so brute-force attempts against a signed-in session cannot run
-- without budget controls.

INSERT INTO public.rate_limit_config (action, max_attempts, window_minutes, lockout_minutes)
VALUES
  ('change_password', 5, 15, 30)
ON CONFLICT (action) DO UPDATE SET
  max_attempts = EXCLUDED.max_attempts,
  window_minutes = EXCLUDED.window_minutes,
  lockout_minutes = EXCLUDED.lockout_minutes;
