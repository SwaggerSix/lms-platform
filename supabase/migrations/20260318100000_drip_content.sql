-- ============================================
-- Drip Content / Scheduled Release
-- Add drip/scheduled release fields to modules table
-- ============================================

-- drip_type meanings:
-- 'immediate' = available right away (default, backward compatible)
-- 'after_days' = available N days after enrollment date
-- 'on_date' = available on specific date
-- 'after_previous' = available after previous module is completed

ALTER TABLE modules ADD COLUMN IF NOT EXISTS drip_type TEXT DEFAULT 'immediate' CHECK (drip_type IN ('immediate', 'after_days', 'on_date', 'after_previous'));
ALTER TABLE modules ADD COLUMN IF NOT EXISTS drip_days INTEGER DEFAULT 0;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS drip_date TIMESTAMPTZ;
