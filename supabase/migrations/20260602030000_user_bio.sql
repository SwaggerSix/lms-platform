-- Instructor / user bio. Surfaced anywhere an instructor is shown in the
-- learner experience (course detail, ILT sessions). Editable by the user
-- themselves (and instructors via their portal).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bio TEXT;
