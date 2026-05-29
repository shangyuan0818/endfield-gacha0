-- ============================================
-- DATA-NEW-017 manual placeholder apply SQL
-- SQL artifact version: 1
-- Generated at: 2026-05-26T06:10:29.582Z
-- Generated from: manual-placeholder-migration-plan.generated.json
--
-- REVIEW-ONLY ARTIFACT:
--   1. Run a fresh production audit before using this file.
--   2. Take a database snapshot before apply.
--   3. Keep the dry-run JSON plan attached to the admin review.
--   4. Replace the confirmation token only after approval.
--   5. The script ends with ROLLBACK by default; change it manually only during an approved apply window.
--
-- Ready operations included: 0
-- Blocked operations excluded: 10
-- Estimated reference updates from plan: 0
-- Source placeholder rows are retained in this first apply artifact; only aliases and references are migrated.
-- ============================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $data_new_017_guard$
DECLARE
  approval_token TEXT := 'REPLACE_WITH_DATA_NEW_017_APPROVAL';
BEGIN
  IF approval_token = 'REPLACE_WITH_DATA_NEW_017_APPROVAL' THEN
    RAISE EXCEPTION 'DATA-NEW-017 apply blocked: replace approval_token after fresh audit, database snapshot, and admin approval.';
  END IF;
END
$data_new_017_guard$;

-- No ready operations. Nothing to apply.

-- Default safety ending: this review artifact rolls back even after token replacement.
-- For an approved apply window only, manually change ROLLBACK to COMMIT after reviewing every block above.
ROLLBACK;
