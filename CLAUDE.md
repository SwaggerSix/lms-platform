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
- `npm run check` — `lint && tsc --noEmit && test:conventions`.
  Quick pre-push gate covering ESLint, types, and the convention
  suite. Matches what the `pre-push` hook runs locally and what CI
  runs on every PR.

## Guardrails and conventions

See [docs/conventions.md](docs/conventions.md) for the full list of
guardrails, how to add a new one, install paths for local hooks,
bypass policy, and the `walkFiles` convention for new tests.

## Further reading

- [README.md](README.md) — project description, badges, local
  commands table, repo layout.
- [docs/conventions.md](docs/conventions.md) — guardrail catalog,
  how to add a new convention, install paths for local hooks,
  bypass policy.
- [CHANGELOG.md](CHANGELOG.md) — notable convention / infrastructure
  changes worth surfacing during PR review.

## Coding style

- Prefer `jsonCached` / `jsonNoStore` over hand-rolled `NextResponse.json`
  for new GET / mutation endpoints. Helpers live under
  `src/lib/api/`.
- Audit-log scoping flows through `resolveAuditLogTenant` +
  `buildAuditLogTenantFilter`. Don't inline `tenant_id.eq.X,tenant_id.is.null`.
- Required-training reads source from `getRequiredCourseSources`.
  The legacy `compliance_requirements` table is retired — runtime
  queries against it fail `npm run test:conventions`.
