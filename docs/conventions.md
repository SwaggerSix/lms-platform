# Conventions

How the repo enforces its "every call site must do X" rules, and
how to add a new one.

## Active guardrails

All bundled into `npm run test:conventions` (~5s) and `npm run check`.
They live under `src/__tests__/conventions/`; the `test:conventions`
glob auto-picks up new files in that directory.

| Guardrail | What it pins |
|-----------|--------------|
| `get-cache-control-audit` | Every GET handler in `src/app/api/` is classified via `jsonCached`, `jsonNoStore`, or an explicit `Cache-Control` header. |
| `mutation-no-store-convention` | Every `POST/PATCH/DELETE/PUT` branch uses `jsonNoStore` (carve-outs documented in the test). |
| `audit-action-conventions` | Every `logAudit({ action: ... })` literal matches the legacy or dotted-namespace shape. |
| `audit-tenant-id-coverage` | Every `logAudit` call site has consciously opted in or out of explicit `tenantId:`. |
| `no-compliance-requirements-queries` | The dropped `compliance_requirements` table stays unreferenced. |
| `no-inline-tenant-or-filter` | The `tenant_id.eq.X,tenant_id.is.null` filter goes through `buildAuditLogTenantFilter` — no inline literals. |
| `supabase-pending-empty` | Destructive migrations don't park in `supabase/pending/` indefinitely. |
| `supabase-migrations` | Snapshots the migration filename set so a rebase can't silently re-number or drop a migration. |
| `supabase-tree` | Snapshots top-level entries under `supabase/`; a new sibling directory (e.g. `functions/`) surfaces. |
| `testing-helpers-scope` | Production code must not import from `src/lib/testing/`. |
| `docs-footprint` | Top-level `.md`, `docs/`, and `docs/archived/` listings are snapshotted; active and archived sets must be disjoint. |
| `scripts-footprint` | `scripts/` directory listing is snapshotted so ad-hoc helpers surface in PR review. |
| `scripts-headers` | Every script under `scripts/` opens with a JSDoc header containing a `Run:` / `Run with:` / `Usage:` invocation. |
| `env-example` | Snapshots variable names declared in `.env.local.example`; a new env read should ship with an example entry. |
| `setup-contents` | Snapshots `src/__tests__/setup.ts`; changes affect every test so they surface in PR review. |
| `dependencies-ratchet` | Package + script additions/removals are visible in the diff. |
| `dependency-footprint` | Soft cap on dep count + banned-package denylist + no-second-date-lib rule. |
| `gitignore` | Snapshots non-comment entries; catches silent removal of `.env.local` or new entries that hide files from review. |
| `tsconfig` | Snapshots `compilerOptions` keys; strict flags (`strict`, `noEmit`, `isolatedModules`) pinned by value. |
| `next-config` | Pins the security header set + CSP `object-src 'none'`; image remote hostnames locked to `*.supabase.{co,in}`. |
| `vercel-crons` | Snapshots the cron path → schedule map in `vercel.json`; schedule changes land as a deliberate diff. |
| `vercel-config` | Snapshots non-cron `vercel.json` keys; pins `framework=nextjs` and `regions=["iad1"]`. |
| `header-parity` | `next.config.ts` is the sole owner of security + cache headers; `vercel.json` must not duplicate them or set a blanket `Cache-Control` on `/api/(.*)`. |
| `middleware` | Pins `src/middleware.ts` matcher exclusions and the `/admin` + `/manager` role-gate lists. |
| `isadmin-adoption-ratchet` | Caps remaining `role !== "admin"` inequality-form checks; monotonically decreasing as touched code migrates to `isAdmin()`. |
| `badge-urls` | All markdown files: workflow badges point at workflow files that actually exist; repo paths anchor to `swaggersix/lms-platform`. |
| `workflows` | `.github/workflows/*.yml` summaries (filename, display name, trigger keys) are snapshotted. |
| `prod-gate-warnings` | Snapshot of `console.warn/error` calls under `src/lib/` gated behind `NODE_ENV !== "production"`. Surfaces both new gates and removed ones. |
| `check-script`, `git-hooks`, `install-hooks`, `lefthook-parity` | Wiring of the local pre-commit / pre-push hooks. |

## Snapshot-gating candidates

The repo's "snapshot the file, force a diff" pattern works well
for configuration that affects many things at once. Active
snapshot-gated files:

- `package.json` scripts + dependencies
- `tsconfig.json` (compilerOptions keys + strict flag values)
- `next.config.ts` (security headers + image hostnames)
- `vercel.json` (crons, framework, regions; rejects `headers`)
- `.gitignore` (non-comment entries)
- `.env.local.example` (variable names)
- `src/__tests__/setup.ts` (full contents)
- `supabase/migrations/` (filename set)
- top-level + `docs/` + `docs/archived/` + `scripts/` listings

Candidates not yet gated (open them with the same pattern if
they start churning):

- `postcss.config.*`, `tailwind.config.*` — UI-affecting config
  that ships globally.
- `eslint.config.*` / `.eslintrc.*` — rule changes affect every
  file's diagnostics.
- `middleware.ts` — runs on every request; behavior changes
  worth surfacing.

## When to add a NODE_ENV gate

The `prod-gate-warnings` snapshot tracks the small set of
`console.warn` / `console.error` calls wrapped in
`if (process.env.NODE_ENV !== "production") { ... }`. Rule of
thumb for choosing whether to gate:

- **Diagnostic warning** (a contract violation that doesn't break
  the request) → gate. Example: `logAudit` warns when an action
  string doesn't match the convention; the insert still happens.
  Prod logs shouldn't drown if the regression hits at scale.
- **Real error** (something went wrong, operators need to see it)
  → leave ungated. Example: cron failures, email send errors,
  integration timeouts. Prod observability depends on these.
- **Stub / TODO** (intentional dev-time placeholder) → gate.
  No reason to spam prod with "not yet implemented" lines.

A new gate lands as a +1 entry in the snapshot; removing a gate
lands as a -1. Both diffs are deliberate signals during review.

## The ratchet idiom

When a convention can't be applied across the whole codebase in
one PR (too many touch sites, scattered owners), the **ratchet**
pattern lets the rule land incrementally without backsliding:

1. **Snapshot the offender count** today. Add a convention test
   asserting `count <= CURRENT_MAX`.
2. Each PR that touches an offender migrates it AND drops the
   ceiling by 1 (or more). The number is monotonically decreasing.
3. **Failure message tells the contributor what to do** — list the
   offenders, the ceiling, and the migration path.
4. When the count hits zero, **flip to a hard assertion**
   (`toEqual([])`) and delete the ceiling.

Two live examples:

- **`isadmin-adoption-ratchet`** — caps remaining
  `role !== "admin" && (...)role !== "super_admin"` inequality
  checks at 14. Each migration to `isAdmin()` lowers it.
- **`get-cache-control-audit`** — was a ratchet from 87 down to
  zero; flipped to `toEqual([])` on 2026-05-23.

The pattern works because the ceiling is in code (not a separate
TODO doc) and changes show up in PR diffs, so the count can't
silently grow.

## Migrating role checks to `isAdmin()`

`src/lib/auth/roles.ts` is the canonical home for role-membership
checks: `isAdmin(role)` (admin / super_admin) and
`isManagerOrAbove(role)` (admin / super_admin / manager).

About 20 pages still use the inequality form
`role !== "admin" && role !== "super_admin"`. The
`isadmin-adoption-ratchet` test caps the remaining count and
forces it to decrease as PRs touch the surrounding code.

**Rule of thumb for when to migrate a site:**

- **Yes**, migrate when your PR is already editing the function
  containing the check. The helper is a one-line swap.
- **Yes**, migrate when adding a NEW role check — never write the
  inequality form for new code.
- **No, leave it alone** if your PR doesn't otherwise touch the
  surrounding code. Mass-rewriting all 20 sites in one go would
  produce a huge diff that's mostly noise; incremental migration
  pairs each change with a code-review pass.
- **Lower the ratchet ceiling** in the same PR as the migration so
  the count is monotonically decreasing.

## Related playbooks

- [docs/migrations.md](migrations.md) — seven-phase retirement
  playbook for dropping a database table or column (successor →
  backfill → retire → flip readers → 410 API → park drop →
  drop + clean). Captures the lessons from the
  `compliance_requirements` retirement.

## Adding a new convention

Established pattern, three layers from inside out:

1. **Scanner unit test.** Extract the detection logic (regex + brace
   walker) into a small `src/lib/...` module and unit-test it
   against crafted in-memory sources. Template:
   `src/lib/audit-log/scan-action-literals.ts` +
   `src/__tests__/lib/scan-action-literals.test.ts`.

2. **Codebase walker.** Land the codebase-walking test under
   `src/__tests__/conventions/`. Start in advisory mode:
   `toMatchInlineSnapshot` of the current offender set. New
   offenders land in the diff first.

3. **Ratchet → enforce.** When the backlog is too large to fix in
   one PR, add a numeric ceiling (see the retired
   `audit-ratchet.json` for the pattern). Decrement on each
   cleanup; once the count hits zero, flip the test to
   `toEqual([])` and delete the ratchet.

Three-layer reasoning:

- Scanner test pins the detection.
- Codebase walk pins the live tree is clean.
- Smoke test (`src/__tests__/lib/convention-smoke.test.ts`) proves
  the guardrail actually fires on synthetic broken sources — the
  codebase walk alone can only prove the current tree, not that a
  regression would be caught.

## Shared helpers

Convention tests that walk the source tree use `walkFiles` from
`@/lib/testing/walk`:

```ts
import { walkFiles } from "@/lib/testing/walk";
const files = walkFiles(join(process.cwd(), "src/app/api"));
```

Don't roll a new recursive walker inside an individual test — the
shared helper standardizes the exclusion semantics (skip
`node_modules` + dotfiles by default) and accepts an `extensions`
override for `.tsx`-inclusive scans.

## Local install paths

Two equivalent ways to wire the hooks; both invoke the same
underlying `npm run` commands.

- **Native (no devDep)**: `npm run install-hooks` points
  `core.hooksPath` at `.githooks/`. `pre-commit` runs
  `npm run test:conventions`; `pre-push` runs `npm run check`
  (lint + tsc + conventions).
- **Lefthook**: `npx lefthook install` reads `lefthook.yml`. Same
  two hooks wired up. Useful if lefthook is already on your path.

CI runs the same guardrails on every PR via
`.github/workflows/conventions.yml`, so the local hooks are purely
for fast feedback.

The pre-push hook skips when the local branch matches `scratch/*`
or `wip/*` — scratch experiments don't need to clear the gate.
Push to any other branch (including the standard `claude/...` /
feature branches) still runs `npm run check`.

## Bypass policy

`git commit --no-verify` skips the local hook. Legit uses:

- A snapshot test is failing because the change is the new
  intentional snapshot. Bypass, then run `vitest -u` in the same
  commit (or the next one) and ship both edits together.
- The hook itself is broken (transient npm cache issue, system
  Node version mismatch). File a follow-up to fix the hook.

Don't bypass to silence a genuine guardrail failure. The CI check
on the PR catches anything the local bypass let through — worst
case is a wasted CI run, not a regression landing on main. If a
convention no longer fits, change the guardrail in the same PR.

For the snapshot-update flow specifically,
`scripts/safe-bypass.sh "commit message"` stashes unstaged
changes, runs `git commit --no-verify` on the staged tree, then
restores the stash on success (preserves the stash on commit
failure so recovery is one `git stash pop` away).
