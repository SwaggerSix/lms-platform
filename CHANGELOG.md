# Changelog

[![Conventions](https://github.com/swaggersix/lms-platform/actions/workflows/conventions.yml/badge.svg)](https://github.com/swaggersix/lms-platform/actions/workflows/conventions.yml) [![Tests](https://github.com/swaggersix/lms-platform/actions/workflows/tests.yml/badge.svg)](https://github.com/swaggersix/lms-platform/actions/workflows/tests.yml) [![Build](https://github.com/swaggersix/lms-platform/actions/workflows/build.yml/badge.svg)](https://github.com/swaggersix/lms-platform/actions/workflows/build.yml)

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

## Convention playbook

When introducing a new "every callsite must do X" rule, the established
pattern in this repo:

1. **Pick the call-site shape** the convention applies to (every GET
   handler, every `logAudit({...})` call, etc.) and write a scanner
   that finds them. Extract the regex + brace-walker into
   `src/lib/...` so a unit test can pin the detection logic against
   crafted in-memory sources (see
   `src/lib/audit-log/scan-action-literals.ts` for the template).
2. **Land a codebase-walking test** under `src/__tests__/`. Start in
   advisory mode: `toMatchInlineSnapshot` of the current set of
   offenders. New offenders land in the diff first, which forces
   the contributor to either fix them or update the snapshot.
3. **Add a ratchet** (see the now-retired `audit-ratchet.json` for the
   pattern) when the backlog is too large to fix in one PR.
   Decrement on each cleanup; once it hits zero, flip the test to
   `toEqual([])` and delete the ratchet file.
4. **Add the test path to `npm run test:conventions`** so the whole
   convention bundle runs together (~5s) and surfaces via
   `.github/workflows/conventions.yml` on every PR.
5. **Document the convention** on the entry point itself (helper
   function, route, or migration) so a future contributor reading
   the implementation finds the rule there too — not only in the
   test that enforces it. `src/lib/audit.ts`'s docstring is an
   example.

Why three layers (scanner unit test + codebase walk + smoke test):
the scanner test pins the detection logic, the codebase walk asserts
the live tree is clean, and the smoke test
(`src/__tests__/lib/convention-smoke.test.ts`) proves the guardrails
actually fire on synthetic broken sources — the codebase walk alone
can only prove the current tree, not that a regression would be caught.
