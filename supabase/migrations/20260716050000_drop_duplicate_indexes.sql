-- DB1 (multi-role QA audit): drop the two duplicate indexes flagged by the
-- performance advisor. Migration 20260614040000_exam_records.sql recreated the
-- assessment_attempts(user_id) and (assessment_id) indexes under the modern
-- idx_assessment_attempts_* names, duplicating the originals from
-- 001_initial_schema.sql (idx_attempts_*). Two identical btree indexes on a
-- column just double write/storage cost, so drop the legacy-named twins and
-- keep the ones matching the idx_<table>_<column> convention used elsewhere.
--
-- Safe and reversible: the surviving idx_assessment_attempts_* indexes cover
-- exactly the same lookups.

DROP INDEX IF EXISTS public.idx_attempts_user;
DROP INDEX IF EXISTS public.idx_attempts_assessment;
