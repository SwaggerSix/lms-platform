-- QuickBooks Bridge pull/ack API support (Phase 2).
--
-- The QB Bridge (Web Connector / qbXML service, lives in gc-partner-portal)
-- PULLS queued events from the LMS over a secured internal API and ACKs the
-- results. This migration is purely additive:
--
--   1. `qb_sync_queue.claimed_at` — when a row was leased to a Bridge run, so
--      a crashed/abandoned lease can be reclaimed after a staleness window.
--   2. `claim_qb_bridge_events(p_limit, p_stale_after)` — atomically leases up
--      to N rows (pending, or in_progress past the staleness window) using
--      FOR UPDATE SKIP LOCKED so concurrent Bridge pulls never lease the same
--      row. It flips them to 'in_progress' and stamps claimed_at = now().
--
-- SECURITY NOTE: the pull/ack routes use the service-role client, which
-- bypasses RLS. That is correct for an authenticated machine endpoint — the
-- bearer token (env QB_BRIDGE_TOKEN, timing-safe compared) is the security
-- boundary, NOT RLS. The admin RLS policies from 20260618000000 are left
-- untouched for human/admin access.
--
-- NOTE on status vocabulary: the queue's existing CHECK allows
-- ('pending','processing','done','error'). The pull/ack contract speaks in
-- ('pending','in_progress','synced','error'); we widen the CHECK to accept
-- both vocabularies so this migration is backwards-compatible with any rows
-- already enqueued by the existing path.

-- ---------------------------------------------------------------------------
-- 1. Lease bookkeeping column.
-- ---------------------------------------------------------------------------
ALTER TABLE qb_sync_queue
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- Widen the status vocabulary to include the Bridge contract values while
-- keeping the original ones valid.
ALTER TABLE qb_sync_queue DROP CONSTRAINT IF EXISTS qb_sync_queue_status_check;
ALTER TABLE qb_sync_queue
  ADD CONSTRAINT qb_sync_queue_status_check
  CHECK (status IN (
    'pending',
    'processing',   -- legacy synonym for in_progress
    'in_progress',
    'done',         -- legacy synonym for synced
    'synced',
    'error'
  ));

-- Lease lookups scan by status + claimed_at.
CREATE INDEX IF NOT EXISTS idx_qb_sync_queue_claimed_at
  ON qb_sync_queue(status, claimed_at);

-- ---------------------------------------------------------------------------
-- 2. Atomic lease function.
--
-- Selects up to p_limit rows that are claimable — either still pending, or
-- in_progress but stale (claimed_at older than p_stale_after, i.e. a Bridge
-- run that died mid-flight). FOR UPDATE SKIP LOCKED guarantees two concurrent
-- pulls get disjoint row sets. Returns the leased rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_qb_bridge_events(
  p_limit INT,
  p_stale_after INTERVAL
)
RETURNS SETOF qb_sync_queue
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE qb_sync_queue q
  SET status = 'in_progress',
      claimed_at = now(),
      attempts = q.attempts + 1
  WHERE q.id IN (
    SELECT c.id
    FROM qb_sync_queue c
    WHERE c.status = 'pending'
       OR (
            c.status IN ('in_progress', 'processing')
            AND c.claimed_at IS NOT NULL
            AND c.claimed_at < now() - p_stale_after
          )
    ORDER BY c.created_at
    LIMIT GREATEST(p_limit, 0)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING q.*;
END;
$$;
