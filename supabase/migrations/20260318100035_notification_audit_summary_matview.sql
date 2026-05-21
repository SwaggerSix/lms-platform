-- Upgrade notification_audit_rule_summary from a plain view to a
-- materialized view. Reads become O(unique rules) instead of O(failures),
-- which matters once the underlying log table grows past a few hundred
-- thousand rows.
--
-- Refresh strategy: REFRESH MATERIALIZED VIEW CONCURRENTLY is triggered by
-- POST /api/admin/notification-audit/refresh-view, which the audit UI
-- exposes as a button. A nightly cron could also call it.

DROP VIEW IF EXISTS notification_audit_rule_summary;

CREATE MATERIALIZED VIEW notification_audit_rule_summary AS
SELECT
  rule_id,
  COUNT(*)::int AS failures,
  MAX(created_at) AS latest
FROM enrollment_rule_logs
WHERE action_type = 'send_notification'
  AND status = 'error'
GROUP BY rule_id;

-- A unique index is required for REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX notification_audit_rule_summary_rule_id_uidx
  ON notification_audit_rule_summary (rule_id);

COMMENT ON MATERIALIZED VIEW notification_audit_rule_summary IS
  'Per-rule failure count and latest timestamp for send_notification actions. Refresh via /api/admin/notification-audit/refresh-view.';
