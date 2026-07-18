-- Database hygiene: the safe, zero-behavior-change subset of the Supabase
-- performance advisors. Scoped deliberately to changes that cannot alter access
-- or query results:
--   * duplicate_index (2): two pairs of byte-identical indexes on
--     assessment_attempts. We drop the redundant copy of each pair and keep the
--     one that covers the foreign key (assessment_id / user_id).
--   * multiple_permissive_policies — exact duplicates only (2): content_blocks
--     and content_templates each carry two identical `FOR SELECT USING (true)`
--     policies created by overlapping migrations. We drop one of each; the
--     surviving "Anyone can read ..." policy preserves the exact same access.
--
-- The bulk advisor findings (142 other "unused" indexes measured from scan stats
-- on a near-empty database, and the intentional admin-manage + user-scoped policy
-- overlaps across ~85 tables) are deliberately NOT touched here: dropping indexes
-- on meaningless stats and rewriting production RLS at scale is risk without
-- current benefit. This migration is the reviewed-safe slice only.

-- Duplicate indexes (keep the FK-covering idx_assessment_attempts_* copies).
DROP INDEX IF EXISTS idx_attempts_assessment;
DROP INDEX IF EXISTS idx_attempts_user;

-- Exact-duplicate SELECT policies (identical to the retained "Anyone can read"
-- policies; removing the duplicate does not change who can read).
DROP POLICY IF EXISTS content_blocks_select ON content_blocks;
DROP POLICY IF EXISTS content_templates_select ON content_templates;
