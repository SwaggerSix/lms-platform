-- Lock down claim_qb_bridge_events (QA hardening).
--
-- 20260618120000_qb_bridge_pull_ack.sql created claim_qb_bridge_events as a
-- plain function: SECURITY INVOKER with the default implicit PUBLIC execute
-- grant, leaving it reachable over any RLS-scoped (anon/authenticated) session.
--
-- This migration brings it in line with the coaching platform's equivalent:
--   * SECURITY DEFINER + a fixed `search_path = public` so the machine endpoint
--     (service-role) leases rows deterministically and the definer context is
--     pinned to a known schema.
--   * REVOKE the implicit PUBLIC / anon / authenticated execute grants and
--     GRANT EXECUTE only to service_role.
--
-- The pull route calls this via the service-role client, so behavior is
-- unchanged — this only removes the PUBLIC-invokable surface. The function
-- body is reproduced verbatim from the original migration; only the security
-- clauses and grants are added.

CREATE OR REPLACE FUNCTION claim_qb_bridge_events(
  p_limit INT,
  p_stale_after INTERVAL
)
RETURNS SETOF qb_sync_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Only the service-role (machine endpoint) needs to execute this. Revoke the
-- implicit PUBLIC grant and the anon/authenticated roles so it can never be
-- reached over an RLS-scoped session.
REVOKE ALL ON FUNCTION claim_qb_bridge_events(INT, INTERVAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_qb_bridge_events(INT, INTERVAL) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_qb_bridge_events(INT, INTERVAL) TO service_role;
