# scripts/

One-off helpers used outside the request path: seed data, ad-hoc
backfills, environment setup. Nothing here is imported by
`src/`; production code paths never reference these files.

## Policy

- The `scripts-footprint` convention test snapshots this
  directory's filenames. Adding a file shows up as a snapshot diff
  in the PR — make the case for it in the description.
- Justify a new script with a short comment header (what it does,
  who runs it, when). Bonus points if it's idempotent.
- One-off scripts that did their job and are now historical:
  delete them (the git history is the archive). Keep `scripts/`
  reserved for things still in active use.

## What's here

- `seed-data.mjs` — populate the database with demo data
  (courses, enrollments, users).
- `seed-database.mjs` / `seed-database-fix.mjs` — initial /
  remediation seed scripts; run once per environment.
- `seed-portal-data.mjs` — populate portal-specific tenant data.
- `seed-users.sh` — wrapper that creates auth users via the
  Supabase admin API before running the user-row seed.
