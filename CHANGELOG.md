# Changelog

Notable changes worth surfacing during PR review. Not every commit
needs an entry — focus on conventions, infrastructure choices, and
removals that affect future work.

## 2026-05-29

- **`isadmin-adoption-ratchet` retired at zero.** The final 5
  inequality-form sites (`/admin/workflows/[id]/runs`,
  `/admin/settings/integrations`, `/admin/settings/sso`,
  `/admin/settings/integrations/hris`, `/admin/tenants/[id]`)
  migrated to `!isAdmin(dbUser.role)`. Ratchet flipped from a
  shrinking ceiling to a hard `toEqual([])` assertion;
  `role !== "admin" && role !== "super_admin"` is now banned.
- **`src/lib/auth/role-check-patterns.ts` extracted.** The
  `INEQUALITY_ROLE_RE` and `ADMIN_MANAGER_INCLUDES_RE` constants
  live in a shared module so the live ratchets, the migration
  smoke test, and the ratchet smoke test all import the same
  regex. Both ratchet walks whitelist the module so the regex
  source doesn't self-match.
- **super_admin-omission ratchet 18 → 16.** `/api/certifications`
  and `/api/gamification` migrated to `!isManagerOrAbove(role)`.

## 2026-05-28

- **Latent `super_admin` permissions bug surfaced.** ~17 sites in
  `src/` use `!["admin", "manager"].includes(role)` to gate
  manager-or-above access. The form omits `super_admin`, which
  almost certainly should pass any admin-or-manager check.
  `super-admin-omission-audit` snapshots the offender set;
  migrations to `isManagerOrAbove()` (which includes super_admin)
  are per-site code-review conversations since they shift
  semantics. The bug isn't actively exploitable — super_admins
  in practice also carry the `admin` role today — but a future
  super_admin-only operator would silently lose access.
- **isAdmin adoption ratchet 14 → 10.** Four more admin pages
  (`/admin/settings`, `/admin/settings/xapi`, `/admin/tenants`,
  `/admin/tenants/new`) migrated to `isAdmin(role)` /
  `isManagerOrAbove(role)`. 12 pages on the canonical shape;
  ~10 inequality-form sites remain.

## 2026-05-27

- **Role-membership helpers introduced.** Added `isAdmin(role)` and
  `isManagerOrAbove(role)` in `src/lib/auth/roles.ts` as the
  canonical shape for role checks. Middleware adopted both; four
  admin pages (`/admin/users`, `/admin/audit-log`,
  `/admin/marketplace`, `/admin/cron-health`) migrated from
  `role !== "admin" && role !== "super_admin"` inequality to
  `!isAdmin(role)`. The remaining ~20 inequality-form sites stay
  untouched; they migrate when their surrounding code is touched
  again. Convention documented in `CLAUDE.md`.
- **`@infra` marker convention** replaces the central
  `INFRA_TESTS` allowlist in `conventions-doc-coverage`. Tests
  opting out of the doc-table per-row check now carry `@infra`
  in their docstring; keeps coupling localized to each test file.
- **`scripts/safe-bypass.sh`** wraps `git commit --no-verify` with
  a stash → commit → pop dance, preserving the stash on commit
  failure for easy recovery. For the snapshot-update bypass flow
  the conventions doc allows.

## 2026-05-26

- **Fixed silent Cache-Control override at the Vercel edge.**
  `vercel.json` was setting `Cache-Control: no-store, max-age=0` on
  `/api/(.*)`, which would override every `jsonCached(...)` response
  emitted by route handlers. Per-handler cache headers (the whole
  point of the cache-control convention work) were being neutralized
  in production. Removed the blanket rule plus the duplicate
  security headers that `next.config.ts` already emits. New
  `header-parity` convention test guards against re-introduction.
- **`next.config.ts` is the single source of truth for response
  headers.** `vercel.json` no longer carries `headers`; security and
  cache directives all flow from the Next config (plus per-handler
  `jsonCached` / `jsonNoStore`).

## 2026-05-23

- **Retired the GET cache-control audit ratchet.** Every GET handler
  under `src/app/api/` is now classified via `jsonCached`,
  `jsonNoStore`, or an explicit `Cache-Control` header.
  `src/__tests__/get-cache-control-audit.test.ts` flipped from a
  shrinking-snapshot ratchet to a hard `toEqual([])`. New GET
  endpoints must classify themselves on landing.
- **Tightened `isClassified` regex with `\b` word boundaries** so
  identifier prefixes (e.g. `jsonCachedThing(`, `mYjsonCached(`) no
  longer false-positive. Pinned in
  `src/__tests__/lib/get-cache-control-scanner.test.ts`.
- **`pnpm test:conventions`** bundles the 10 guardrail tests
  (action-naming conventions, GET / mutation cache audits,
  compliance-requirements ban, supabase/pending emptiness, scanner +
  runtime-guard unit tests, tenantId coverage). Whole bundle finishes
  in ~5s; runs via `.github/workflows/conventions.yml` on every PR
  alongside the full `.github/workflows/tests.yml`.
- **Retired `compliance_requirements` table.** All readers (admin /
  manager / learner / reports) flipped to
  `getRequiredCourseSources(courses.metadata.required_for)`.
  `/api/compliance` returns 410 Gone on every method. Drop migration
  is `supabase/migrations/20260318100041_compliance_requirements_drop.sql`
  with two precondition guards.

## Conventions

The repo's "every call site must do X" guardrails (cache-control
audit, mutation no-store, audit-action naming, tenant-id coverage,
compliance-requirements ban, etc.) live under
`src/__tests__/conventions/`. Long-form docs — how each guardrail
works, how to add a new one, install paths for local hooks, bypass
policy — moved to [docs/conventions.md](docs/conventions.md).
