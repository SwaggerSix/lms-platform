-- Add CPE / CEU tracking to instructor-led training sessions.
-- Some sessions of the same course may award different credit amounts
-- (e.g. extended workshop vs. lunch-and-learn), so credits live on the
-- session rather than being inherited from the course.

ALTER TABLE ilt_sessions
  ADD COLUMN IF NOT EXISTS cpe_credits NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ceu_hours NUMERIC(5,2) DEFAULT 0;

COMMENT ON COLUMN ilt_sessions.cpe_credits IS 'NASBA CPE credits awarded for attending this session. Zero if not CPE-eligible.';
COMMENT ON COLUMN ilt_sessions.ceu_hours IS 'Continuing education units (hours) awarded for attending this session.';
