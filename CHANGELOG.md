# Changelog

Notable changes worth surfacing during PR review. Not every commit
needs an entry — focus on conventions, infrastructure choices, and
removals that affect future work.

## 2026-05-29

- **`as-any` ratchet 95 → 71.** Cleared the mid-size clusters
  (assessments, tenant branding, audit-log, knowledge-base,
  certifications, ilt-sessions — drops + corrected relation types)
  and **finished `learn/catalog/[slug]/page.tsx` (3 → 0)** by
  dropping the whole-row `course` cast (its columns are typed by
  `select("*")`) and handling only the `categories` join + `metadata`
  Json explicitly.
- **`any-annotation` ratchet 325 → 322** from the catalog
  `(a,b)`/`(lesson)`/`(mod)` callback param conversions.
- **Documented a realistic floor** for both ratchets in
  `src/types/README.md` — polymorphic values, intentionally-loose
  props, external-lib boundaries, and varying Json blobs are
  defensible survivors; the goal is "every survivor is justified,"
  not zero.
- **`as-any` ratchet 112 → 95.** Cleared the small `×2` files
  (cron/history, gamification, manager/skills, documents,
  organizations, settings — flat-select drops + corrected relation
  types) and the flat-select casts in `learn/catalog/[slug]`
  (instructor, progress, related). The `embed/[token]/page.tsx`
  `widget.config` casts were typed; its polymorphic `content: any`
  is left documented as a deliberate keeper (standalone embed doc,
  per-widget-type shape — a discriminated union isn't worth it).
- **`any-annotation` ratchet 328 → 325** from the `(m: any)` /
  `(p: any)` param removals.
- **`as-any` ratchet 135 → 112.** Converted `recommendations/
  page.tsx` (9, the biggest cluster — corrected to-one relation
  types + dropping casts on `Map<string, any>` values), `embed/
  [token]/route.ts` (6, typed widget-config shape), `recommendations/
  route.ts` (4), and `analytics/predictive` + `notifications/
  preferences` (2 each, redundant casts on already-typed rows).
- **`any-annotation` ratchet 330 → 328** by typing the
  `availableSkills` filter/map params in `recommendations/route.ts`.
- **`reports-select-coverage` extended** to `notification-audit/
  route.ts` and `lib/ai/recommendations.ts` — all the corrected-
  relation boundary casts are now guarded against select drift.
- **`as-any` ratchet 147 → 135.** Cleared API-route casts
  (discussions, feedback/responses, courses/[slug], enrollments
  prereq, marketplace/enroll, mentorship/profiles) and
  `lib/ai/recommendations.ts` (5, via corrected to-one relation
  types). `recommendations/page.tsx` left as a justified nested-join
  surface (blanket conversion broke the array-typed relation access).
- **`any-annotation-audit` 332 → 330** as a side effect of the
  `(e: any)` → `(e)` conversions.
- **`reports-select-coverage` test added** — pins that every column
  the report maps consume stays named in the query `.select(...)`,
  guarding the `as unknown as RowType[]` casts against silent select
  drift.
- **`as-any` ratchet 167 → 147.** Cleared 20 more casts:
  `enrollments/progress` (typed profile fields), `integrations/
  external/[id]` (config Json shape), `cron-alert-replay` (typed
  query rows), `lrs/[id]/sync` (xAPI union narrowing), and
  `lib/reports/generate.ts` (the 7 nested-join casts — defined
  corrected to-one relation types and used `as unknown as`).
- **`any-annotation-audit` added** — a count-only advisory ratchet
  over `: any` type annotations (332, ~120 files); count-capped
  rather than file-snapshotted since the surface is too broad for a
  useful diff. Detector + edge-case tests live alongside the `as
  any` one in `scan-casts`.
- **`as-any` ratchet 199 → 167.** Removed 32 `as any` casts by
  defining row types in `notification-audit/route.ts` (19) and
  dropping now-unnecessary casts in `cron/compliance-recurrence`
  (13) — both had explicit selects that supabase-js already types.
  Detector extracted to `src/lib/testing/scan-casts.ts` with a
  unit/smoke test (three-layer pattern); module self-match
  whitelisted.
- **`suppression-directives-audit` added.** Hard zero on
  `@ts-ignore` / `@ts-expect-error` (the codebase has none) plus an
  advisory snapshot of the 7 `eslint-disable` sites.
- **`src/types/README.md`** documents the hand-written-types
  strategy (no generated `Database` type) and the
  real-type → `as unknown as T` → `as any` boundary-cast preference.
- **`as-any-audit` advisory ratchet added.** Snapshots the 199
  `as any` casts (74 files) and caps the count so the type escape
  hatch can only shrink. `as unknown as T` double-casts aren't
  counted — they're the migration target. (Generating real Supabase
  `Database` types — the proper fix — isn't feasible here: the repo
  uses hand-written `types/database.ts` and there's no project ref
  to run the generator against.)
- **CI lint step guarded.** `eslint-config` now also asserts
  `conventions.yml` runs `npm run lint`, so the gate restored after
  the Next 16 upgrade can't be silently dropped.
- **Instructor ownership gates confirmed correct (no change).** The
  7 `role === "instructor"` checks (modules, courses, xr/content,
  microlearning) narrow behavior *for instructors* (own-content
  ownership); super_admin/admin/manager correctly bypass them, so
  they are not super_admin-omission bugs and stay as-is.
- **Cleared the 11 `exhaustive-deps` warnings; lint is now 0/0.**
  Memoized `useToast`'s return (stable `addToast`) so callers can
  list `toast` in deps without churn; hoisted a static map to
  module scope; wrapped `fetchData` / `saveToDB` / `stepMap` in
  `useCallback`/`useMemo`; dropped genuinely-unnecessary deps
  (`learnerName`/`learnerId` in scorm-player, `role` in reports).
- **`IMG_KEEPERS` snapshotted + `rules-of-hooks` smoke added.** The
  `eslint-config` guardrail now pins the `<img>` keeper list (so
  adding a file to dodge the `error` rule is a deliberate diff) and
  asserts a conditional-hook call is flagged as an error.
- **Tightened the evaluations `as any` casts.** Replaced the opaque
  `asAny` `any`-laundering helper in the three evaluations pages
  with explicit `as unknown as T[]` casts against the now-exported
  client prop types — the shape assertion is named at the boundary
  (Supabase's service client returns untyped rows).
- **`no-img-element` promoted to error with a documented keeper
  list.** Audited all `<img>` sites: none convert cleanly (DB/
  external/user-content URLs the `next-config` allowlist doesn't
  cover, plus local SVGs). The 12 known files are listed in
  `IMG_KEEPERS` in `eslint.config.mjs`; everywhere else a stray
  `<img>` now fails the gate.
- **Stale eslint-disable directives reconciled.** Enabled the
  rules the tree's inline disables actually depend on
  (`react-hooks/*`, `@typescript-eslint/no-require-imports`) and
  removed the ones for rules left intentionally off
  (`no-explicit-any` ×3, `no-bitwise` ×5). Added a scoped disable
  to the one lazy `require` (dompurify) that lacked one. Lint is
  down to 11 genuine `exhaustive-deps` warnings, 0 errors.
- **eslint-config guardrail gained a parser smoke test** — lints a
  `.tsx` fixture through the real config and asserts no fatal parse
  error, so a parser misconfiguration fails loudly.
- **`INEQUALITY_ROLE_RE` widened for reversed order** — now matches
  `role !== "super_admin" && role !== "admin"` too, closing the
  last documented reorder gap across the role-check regexes.
- **`no-html-link-for-pages` cleared and promoted to error.**
  Converted the 6 `<a href="/...">` page links (reports, dashboard,
  course-detail, mentorship detail, my-courses) to `next/link`; the
  embed page keeps a plain `<a>` (standalone HTML doc outside the
  app shell) with a scoped disable. Rule is now `error`.
- **`no-img-element` kept at `warn` by design.** Remaining `<img>`
  sites render dynamic / external / user-content images (tenant
  logos, content blocks, marketplace thumbnails); `next/image`
  would need hostnames the `next-config` guardrail deliberately
  locks to `*.supabase`, so they stay as `<img>`. Rationale recorded
  in `eslint.config.mjs`.
- **`eslint-config` guardrail added.** Pins the `lint` script to the
  `eslint` CLI (not the removed `next lint`) and asserts
  `eslint.config.mjs` registers the parser + plugins the tree's
  disable directives need — so a future Next bump can't silently
  re-break the gate. CI's lint step (`conventions.yml`) was the
  thing broken by the Next 16 upgrade; it now runs again unchanged.
- **ESLint restored after the Next 16 upgrade dropped `next lint`.**
  Added a flat `eslint.config.mjs` (next/core-web-vitals rules +
  `@typescript-eslint` parser/plugin + `react-hooks`), repointed the
  `lint` script at `eslint .`, and added the four devDeps. So
  `npm run check` / the pre-push hook run end-to-end again.
  `no-html-link-for-pages` and `no-img-element` are set to `warn`
  for now (real backlog that predates the gate being runnable);
  tighten to `error` once cleared.
- **Role-check regexes hardened against reordering + optional
  chaining.** `ADMIN_MANAGER_INCLUDES_RE` and
  `ADMIN_SUPER_ADMIN_INCLUDES_RE` now also match the reversed array
  order; `MANAGER_EQUALITY_OMISSION_RE` now matches the
  optional-chaining form (`user?.role === "admin" || ...`). Migrated
  the one client-side site (`global-search.tsx`) to
  `isManagerOrAbove`. Smoke tests updated.
- **super_admin short-circuit invariant pinned.** `authorize.test.ts`
  now asserts super_admin is authorized across a matrix of
  allowlists that don't name it — the behavior the whole
  omission-guardrail family depends on.
- **Bare-admin super_admin omission fully closed.** Migrated the
  remaining 11 `.role === "admin"` gates to `isAdmin(role)` —
  mentorship (sessions, sessions/[id], requests/[id] ×2, learn
  detail page), assessments (route + [id], where the flag gates
  the answer key), enrollments delete, feedback/responses,
  xapi/statements, analytics/alerts. `admin-equality-omission-audit`
  flipped from advisory ratchet to a hard `toEqual([])`;
  `audit-log/resolve-tenant.ts` stays whitelisted (deliberate
  admin/super_admin scope split). All five inline role-gate bug
  classes are now hard-enforced.
- **Tenant-management super_admin lockouts fixed; bare-admin
  surface put under an advisory ratchet.** The `/api/tenants`
  cluster (`route`, `[id]`, `[id]/branding`, `[id]/courses`,
  `[id]/members`, `[id]/invite`) used bare `auth.user.role !==
  "admin"` checks that forced a platform super_admin through the
  per-tenant membership path — migrated to `isAdmin(role)`. The
  remaining bare `.role === "admin"` sites (mentorship, assessments,
  xapi, analytics/alerts, etc.) are now snapshotted by the advisory
  `admin-equality-omission-audit` (ceiling 11); some differentiate
  admin from super_admin on purpose (`audit-log/resolve-tenant.ts`
  is whitelisted), so migration is per-site. Added
  `ADMIN_EQUALITY_OMISSION_RE` + smoke test. The auth README now
  carries a bug-class table covering all five inline role-gate
  shapes.
- **Two more super_admin-omission shapes closed + guardrailed.**
  The array form `["admin", "super_admin"].includes(role)` (1 site,
  `/admin/evaluations`) and the equality form
  `role === "admin" || role === "manager"` / the negated
  `role !== "admin" && role !== "manager"` (7 sites: observations
  ×3, shop/orders ×2, transcript, learn/observations) migrated to
  `isAdmin()` / `isManagerOrAbove()`. Two new hard-assertion
  guardrails — `admin-array-form-audit` and
  `manager-equality-omission-audit` — plus their regexes
  (`ADMIN_SUPER_ADMIN_INCLUDES_RE`, `MANAGER_EQUALITY_OMISSION_RE`)
  and smoke tests lock the shapes out. The equality form carried
  the same latent super_admin lockout the array form did.
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
- **`super-admin-omission-audit` retired at zero.** The remaining
  `["admin", "manager"].includes(role)` sites all migrated to
  `isManagerOrAbove(role)` (which includes super_admin): 5 admin
  pages (`analytics/predictive`, `feedback`, `feedback/[id]`,
  `mentorship`, `reports`), 2 manager pages (`team`, `analytics`),
  and the `/api/{certifications,gamification,certificates/generate}`
  + `/api/analytics/{alerts,engagement,predictions,snapshots}` +
  `/api/enrollments` (×4) routes. Ratchet flipped from a shrinking
  ceiling to a hard `toEqual([])`; the latent super_admin lockout
  is now closed and can't be reintroduced.
- **`ADMIN_MANAGER_INCLUDES_RE` smoke test** added to pin the
  array-includes detector behavior, mirroring the existing
  inequality-form smoke test.

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
