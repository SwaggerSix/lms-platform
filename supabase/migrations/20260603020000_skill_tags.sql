-- Skills mapping tags: free-form tags admins can attach to a skill to aid
-- mapping/grouping. Org-wide skill rows; tags default to empty.

ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
