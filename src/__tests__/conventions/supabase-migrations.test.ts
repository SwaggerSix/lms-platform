import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Snapshot the migration filename set. New migrations land as a
 * deliberate diff line; accidental deletions (a stale rebase
 * dropping a migration) show up too.
 *
 * Filenames carry their own ordering via the `YYYYMMDDHHMMSS_` or
 * `NNN_` prefix — sorting alphabetically is also sorting by apply
 * order. A re-numbering across a rebase would surface as a
 * snapshot diff showing both the old and new filenames.
 */

describe("supabase/migrations", () => {
  it("filename set is snapshotted", () => {
    const dir = join(process.cwd(), "supabase/migrations");
    const files = readdirSync(dir)
      .filter((n) => n.endsWith(".sql"))
      .sort();
    expect(files).toMatchInlineSnapshot(`
      [
        "001_initial_schema.sql",
        "002_seed_data.sql",
        "003_portal_features.sql",
        "004_missing_tables.sql",
        "005_seed_badges.sql",
        "006_fix_rls_recursion.sql",
        "20260318100000_drip_content.sql",
        "20260318100001_prerequisites.sql",
        "20260318100002_sso_config.sql",
        "20260318100003_ai_recommendations.sql",
        "20260318100004_enrollment_rules.sql",
        "20260318100005_video_conferencing.sql",
        "20260318100006_certificate_designer.sql",
        "20260318100007_i18n.sql",
        "20260318100008_content_authoring.sql",
        "20260318100009_ecommerce.sql",
        "20260318100010_xapi_lrs.sql",
        "20260318100011_workflows.sql",
        "20260318100012_360_feedback.sql",
        "20260318100013_ai_chatbot.sql",
        "20260318100014_multi_tenant.sql",
        "20260318100015_mentorship.sql",
        "20260318100016_predictive_analytics.sql",
        "20260318100017_hris_integrations.sql",
        "20260318100018_observation_checklists.sql",
        "20260318100019_microlearning.sql",
        "20260318100020_vr_xr_content.sql",
        "20260318100021_content_marketplace.sql",
        "20260318100022_enable_rls_security.sql",
        "20260318100023_fix_rls_comprehensive.sql",
        "20260318100024_seed_demo_data.sql",
        "20260318100025_tenant_features.sql",
        "20260318100026_push_subscriptions.sql",
        "20260318100027_webhook_deliveries.sql",
        "20260318100028_cron_monitoring.sql",
        "20260318100029_training_evaluations.sql",
        "20260318100030_ilt_session_cpe.sql",
        "20260318100031_compliance_backfill.sql",
        "20260318100032_compliance_requirements_retirement.sql",
        "20260318100034_notification_audit_summary_view.sql",
        "20260318100035_notification_audit_summary_matview.sql",
        "20260318100036_notification_audit_refresh_rpc.sql",
        "20260318100037_workflow_tenant_id.sql",
        "20260318100038_workflow_runs_tenant_id.sql",
        "20260318100039_audit_logs_tenant_id.sql",
        "20260318100040_enrollment_rules_tenant_id.sql",
        "20260318100041_compliance_requirements_drop.sql",
      ]
    `);
  });
});
