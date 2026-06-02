-- Add an optional topic/category to discussion threads so discussions can be
-- segregated by topic in addition to by course.

ALTER TABLE public.discussions
  ADD COLUMN IF NOT EXISTS topic TEXT;

CREATE INDEX IF NOT EXISTS idx_discussions_topic ON public.discussions(topic);
