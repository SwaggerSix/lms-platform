# lms-platform

[![Conventions](https://github.com/swaggersix/lms-platform/actions/workflows/conventions.yml/badge.svg)](https://github.com/swaggersix/lms-platform/actions/workflows/conventions.yml) [![Tests](https://github.com/swaggersix/lms-platform/actions/workflows/tests.yml/badge.svg)](https://github.com/swaggersix/lms-platform/actions/workflows/tests.yml) [![Build](https://github.com/swaggersix/lms-platform/actions/workflows/build.yml/badge.svg)](https://github.com/swaggersix/lms-platform/actions/workflows/build.yml)

Next.js / Supabase LMS with admin, manager, and learner workflows
(courses, required training, compliance, audit log, marketplace,
mentorship, observations, evaluations, …).

## Local commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the Next.js dev server. |
| `npm run build` | Production build (Next.js). |
| `npm test` | Full Vitest suite (~30s). |
| `npm run test:conventions` | Convention guardrails only (~5s). |
| `npm run check` | `lint && tsc --noEmit && test:conventions`. Pre-push gate. |
| `npm run install-hooks` | Wire `.githooks/` into `core.hooksPath`. |

## Repo layout

- `src/app/api/` — route handlers (every GET classified per the
  cache-control convention; mutations use `jsonNoStore`).
- `src/lib/` — domain helpers (audit-log scoping, required-training,
  validation, response shorthands, role-membership checks via
  `auth/roles.ts`).
- `src/__tests__/` — Vitest suite. `conventions/` holds the
  guardrails that run via `npm run test:conventions`.
- `supabase/migrations/` — database migrations.

## Further reading

- [docs/](docs/README.md) — guardrails, migration playbook,
  tenant-schema audit, archived reference material.
- [DEPLOYMENT.md](DEPLOYMENT.md) — production deploy + env vars +
  cron + Supabase setup.
- [CHANGELOG.md](CHANGELOG.md) — notable convention / infrastructure
  changes worth surfacing during PR review.
- [CLAUDE.md](CLAUDE.md) — guidance for AI assistants working on
  this branch.
