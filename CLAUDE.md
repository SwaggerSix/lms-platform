# Claude session notes

Project-specific guidance for AI assistants working on this repo.

## Working cadence

This branch evolved through an iterative "rounds of four" loop. The
expected pattern:

1. After each push, propose **four** concrete follow-up options as a
   numbered list. Each should be small enough to land in one commit
   and verifiable via `npm run test:conventions` + the full Vitest run.
2. The user replies with the ordering they want (`1 2 3 4`,
   `keep going in order`, or a custom permutation).
3. Execute the chosen options one after another in a single round,
   commit the whole batch as a single push, and recap what landed.
4. Propose the next four options.

Options that involve destructive actions (drop migrations, force
pushes, mass deletions) should be flagged in the proposal so the user
can withhold them.

## Branch + commit hygiene

- All work lands on `claude/update-lms-functionality-5aguU` per the
  repo's branch convention.
- Commit messages: short title, then bullets per option. End-of-batch
  recap goes in chat, not the commit.
- Never `git push --force` or amend a pushed commit without explicit
  request.

## Local check commands

- `npm test` — full Vitest suite.
- `npm run test:conventions` — convention bundle (~5s). Used by the
  pre-commit hook and the `conventions.yml` CI workflow.
- `npm run check` — `lint && test:conventions`. Quick pre-push gate
  that covers both ESLint and the convention suite.

## Guardrails to maintain

Each new convention follows the playbook in `CHANGELOG.md`'s
"Convention playbook" section. The active guardrail tests live under
`src/__tests__/` and bundle via `npm run test:conventions`:

- `get-cache-control-audit` — every GET handler classified.
- `mutation-no-store-convention` — every POST/PATCH/DELETE/PUT
  branch uses `jsonNoStore`.
- `audit-action-conventions` — every `logAudit({ action: ... })`
  literal matches the legacy or dotted-namespace shape.
- `no-compliance-requirements-queries` — the dropped table stays
  unreferenced.
- `supabase-pending-empty` — destructive migrations don't sit
  parked indefinitely.
- `audit-tenant-id-coverage` — every `logAudit` call site has
  consciously opted in or out of explicit `tenantId`.
- `dependencies-ratchet` — package additions/removals are visible
  in the diff.

When adding a new "every call site must do X" rule, follow the
playbook (scanner unit test → codebase-walk advisory → ratchet →
enforce). See `src/lib/audit-log/scan-action-literals.ts` and
`src/__tests__/lib/scan-action-literals.test.ts` for the template.

## Optional local pre-commit hook

Run `npm run install-hooks` once to point Git at `.githooks/`. The
`pre-commit` script runs `npm run test:conventions` (~5s) and blocks
the commit if a guardrail fires. The CI workflow runs the same
guardrails on every PR, so the local hook is purely for fast
feedback.

### Bypass policy

`git commit --no-verify` skips the hook. Use it when:

- A snapshot test is failing because the change is the new
  intentional snapshot. Bypass, then run `vitest -u` in the same
  commit (or the next one) and ship both edits together.
- The hook itself is broken (transient npm cache issue, system
  Node version mismatch). File a follow-up to fix the hook; don't
  leave the bypass habit lingering.

Don't bypass to silence a genuine guardrail failure. The guardrails
are the contract; if a convention no longer fits, change the
guardrail in the same PR. The CI check on the PR catches anything
the local bypass let through, so the worst case is a wasted CI run,
not a regression landing on main.

## Coding style

- Prefer `jsonCached` / `jsonNoStore` over hand-rolled `NextResponse.json`
  for new GET / mutation endpoints. Helpers live under
  `src/lib/api/`.
- Audit-log scoping flows through `resolveAuditLogTenant` +
  `buildAuditLogTenantFilter`. Don't inline `tenant_id.eq.X,tenant_id.is.null`.
- Required-training reads source from `getRequiredCourseSources`
  (canonical) or `getTenantScopedRequiredCourseSources` (with a
  tenant scope). The legacy `compliance_requirements` table is
  retired — runtime queries against it fail `npm run test:conventions`.
