-- The settings page and /api/profile select and update users.bio and
-- users.timezone, but the columns were never added to the schema, so the
-- queries errored and the settings page redirected every user away.
-- Applied manually to the live LMS project on 2026-06-12.
alter table public.users add column if not exists bio text;
alter table public.users add column if not exists timezone text;
