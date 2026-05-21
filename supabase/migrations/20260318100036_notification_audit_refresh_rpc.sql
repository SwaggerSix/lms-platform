-- RPC helpers so the API can refresh notification_audit_rule_summary via
-- supabase-js .rpc() instead of needing raw SQL execution privileges.
-- Two variants because REFRESH MATERIALIZED VIEW CONCURRENTLY requires the
-- unique index to exist; the plain variant is a fallback for transitional
-- environments.

CREATE OR REPLACE FUNCTION notification_audit_refresh_concurrent()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY notification_audit_rule_summary;
END;
$$;

CREATE OR REPLACE FUNCTION notification_audit_refresh_plain()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW notification_audit_rule_summary;
END;
$$;

REVOKE ALL ON FUNCTION notification_audit_refresh_concurrent() FROM PUBLIC;
REVOKE ALL ON FUNCTION notification_audit_refresh_plain() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION notification_audit_refresh_concurrent() TO service_role;
GRANT EXECUTE ON FUNCTION notification_audit_refresh_plain() TO service_role;

COMMENT ON FUNCTION notification_audit_refresh_concurrent() IS
  'Refreshes notification_audit_rule_summary concurrently. Called by POST /api/admin/notification-audit/refresh-view.';
