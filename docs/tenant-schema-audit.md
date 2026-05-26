# Tenant-scope schema audit

Tables that hold admin-scoped data and don't yet have a direct `tenant_id`
column. Each row notes whether the gap matters and the cheapest path to
plug it.

| Table | Current scoping | Recommended | Priority |
|---|---|---|---|
| `enrollment_rule_logs` | None — inherits from `rule_id` only by join | Denormalize from `enrollment_rules.tenant_id` via a trigger (mirrors the `workflow_runs` pattern) | Medium — needed so the audit endpoint can do a single `.eq("tenant_id", x)` instead of the current `.in("user_id", […])` workaround |
| `scheduled_reports` | Created-by, owner, recipients — no tenant column | Add `tenant_id` so a tenant admin can see/manage only their own scheduled reports | Medium |
| `certificate_templates` | Global. Branding lives at platform level | Add `tenant_id` with NULL = platform default; tenants override | High if multi-tenant branding is a near-term need; low otherwise |
| `ilt_sessions` | Linked to `courses(id)`. Courses have no tenant either | Out of scope here — needs a broader courses-tenant story first | Low |
| `evaluation_assignments` | `user_id` only, infer via user → organization | Add `tenant_id` via trigger on insert (copy from user's org) for cheaper scope filters in reports | Low — assignments are read per-user already |
| `cron_runs` | Global infrastructure | Should stay platform-wide; cron health applies to the whole deployment | N/A |

## What's already landed

- `workflows.tenant_id` (`20260318100037`)
- `workflow_runs.tenant_id` + trigger (`20260318100038`)
- `workflow_step_logs.tenant_id` + trigger (`20260318100038`)
- `audit_logs.tenant_id` (`20260318100039`)
- `enrollment_rules.tenant_id` (`20260318100040`)
- `compliance_requirements` — retired entirely
  (see [migrations.md](migrations.md))

The audit endpoint at `/api/admin/notification-audit` filters
workflow logs via the new column directly, removing the previous
workflows → runs join chain.

## What's still open

The Medium/High-priority items above. They each need their own
migration + (in some cases) a backfill + (in some cases) an RLS-policy
update. Tackling them in isolation rather than as one mega-migration
keeps each change reviewable, and the audit endpoint can adopt them
incrementally — its tenant-scope branch already prefers a direct
`.eq("tenant_id", …)` filter when the column exists, so the next
migration drops in cleanly.
