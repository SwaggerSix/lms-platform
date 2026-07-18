-- L3 (gamification hardening): a real leaderboard aggregation.
--
-- Every leaderboard surface previously fell back to client-side aggregation:
-- the API called get_user_points without its required argument (always an
-- error), and the achievements page called this function before it existed.
-- The fallbacks aggregated at most one PostgREST page (1000 ledger rows) and
-- were not tenant-scoped. This function aggregates the full ledger in SQL,
-- optionally scoped to a white-label tenant via tenant_memberships.
--
-- SECURITY INVOKER (default): when called by an authenticated PostgREST user,
-- RLS on points_ledger/users applies; server code calls it via the service
-- role.

CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_tenant_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  total_points bigint,
  badge_count bigint,
  rank bigint
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT
    u.id AS user_id,
    COALESCE(
      NULLIF(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), ''),
      'Unknown'
    ) AS display_name,
    SUM(pl.points)::bigint AS total_points,
    (SELECT count(*) FROM user_badges ub WHERE ub.user_id = u.id) AS badge_count,
    rank() OVER (ORDER BY SUM(pl.points) DESC) AS rank
  FROM users u
  JOIN points_ledger pl ON pl.user_id = u.id
  WHERE u.status = 'active'
    AND (
      p_tenant_id IS NULL
      OR EXISTS (
        SELECT 1 FROM tenant_memberships tm
        WHERE tm.user_id = u.id AND tm.tenant_id = p_tenant_id
      )
    )
  GROUP BY u.id
  ORDER BY total_points DESC, display_name ASC
  LIMIT GREATEST(COALESCE(p_limit, 20), 1);
$$;
