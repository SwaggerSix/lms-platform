-- Per-course availability window for client licensing.
--   available_from  : course is hidden/blocked before this time (NULL = available now)
--   available_until : course is hidden/blocked after this time  (NULL = never expires / "live forever")
-- Both NULL means the course is always available.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS available_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS available_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_courses_available_until
  ON public.courses(available_until);
