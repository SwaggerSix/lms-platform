-- Track when we last sent a cadence-nudge to a mentorship pair so the daily
-- cron can respect a cooldown and not spam them.
ALTER TABLE mentorship_requests
  ADD COLUMN IF NOT EXISTS last_nudge_sent_at TIMESTAMPTZ;
