-- View that aggregates failed send_notification actions across all time,
-- avoiding the 5000-row cap the API uses when grouping in JS. The audit
-- endpoint now reads top_affected_rules_all_time from this view when
-- available, falling back to the in-JS aggregation if the view is missing
-- (older databases that haven't run this migration).

CREATE OR REPLACE VIEW notification_audit_rule_summary AS
SELECT
  rule_id,
  COUNT(*)::int AS failures,
  MAX(created_at) AS latest
FROM enrollment_rule_logs
WHERE action_type = 'send_notification'
  AND status = 'error'
GROUP BY rule_id;

COMMENT ON VIEW notification_audit_rule_summary IS
  'Per-rule failure count and latest timestamp for send_notification actions. Used by /api/admin/notification-audit.';
