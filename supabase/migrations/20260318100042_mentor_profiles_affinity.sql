-- Optional, opt-in preferences on a mentor profile to help mentees self-select
-- on dimensions that matter to them (language, affinity groups). Empty by
-- default and never used to gate access; purely surfaced on the mentor card.
ALTER TABLE mentor_profiles
  ADD COLUMN IF NOT EXISTS affinity_groups TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS languages TEXT[] NOT NULL DEFAULT '{}';
