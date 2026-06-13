-- Per-user timezone (all roles). Captured at registration and editable in
-- profile settings; used to display scheduled times in the user's local time.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS timezone TEXT;
