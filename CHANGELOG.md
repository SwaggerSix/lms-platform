# Changelog

Notable changes worth surfacing during PR review. Not every commit
needs an entry — focus on conventions, infrastructure choices, and
removals that affect future work.

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
