#!/usr/bin/env bash
# Apply supabase/migrations files that prod has not recorded yet.
#
# Tracking is BY NAME, not by version: this database's migration history was
# applied via the Supabase MCP, which stamps its own timestamps into
# supabase_migrations.schema_migrations, so ledger versions do not match repo
# filenames (which is also why plain `supabase db push` cannot be used — it
# would try to replay the entire history). Files before the BASELINE are
# assumed applied: prod state was verified equal to the repo at that point
# (2026-07-18, when the July 16-18 stack was applied and verified), and the
# pre-baseline gap includes schema that reached prod by other means (see the
# ledger's backfill_missing_repo_schema entry).
#
# Each migration runs in a single transaction (none of our migrations use
# CREATE INDEX CONCURRENTLY / ALTER TYPE ... ADD VALUE, which cannot). On
# success its repo version+name is recorded in the ledger; a version conflict
# fails loudly rather than silently skipping the record.
#
# Requires: DATABASE_URL — the project's direct Postgres connection string
# (Dashboard → Settings → Database). In CI this comes from the
# SUPABASE_DB_URL repository secret.
set -euo pipefail

BASELINE="20260716000000"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set (add the SUPABASE_DB_URL repo secret)." >&2
  exit 1
fi

applied=$(psql "$DATABASE_URL" -tAc "select name from supabase_migrations.schema_migrations")

count=0
for f in supabase/migrations/*.sql; do
  base=$(basename "$f" .sql)
  version="${base%%_*}"
  name="${base#*_}"
  if [[ "$version" < "$BASELINE" ]]; then
    continue
  fi
  if grep -qxF "$name" <<< "$applied"; then
    continue
  fi
  echo ">> applying $base"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f "$f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
    "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name')"
  count=$((count + 1))
done

echo "Applied $count migration(s)."
