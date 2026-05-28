-- Capture structured outcomes alongside the freeform mentor review so we can
-- report on whether mentorships actually delivered on their goals, not just
-- whether the mentor was rated highly.
ALTER TABLE mentor_reviews
  ADD COLUMN IF NOT EXISTS outcomes_met BOOLEAN,
  ADD COLUMN IF NOT EXISTS would_recommend BOOLEAN,
  ADD COLUMN IF NOT EXISTS key_takeaways TEXT;
