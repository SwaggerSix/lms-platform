# Migration playbook

How to retire a database table or table-column in this repo without
breaking deploys mid-flight. The pattern is the one used for
`compliance_requirements` (retired 2026-05) — capture here so the
next big retirement doesn't relearn it.

## Phases

Each phase ships independently. The codebase stays correct after
every phase; nothing waits for the next.

### 1. Add the canonical successor

Pick where the data lives going forward (a JSONB column on a
related table, a separate purpose-built table, derived state). Add
read helpers in `src/lib/` that source from the successor only:

```ts
// src/lib/courses/required-training.ts
export function getRequiredCourseSources(service) { /* ... */ }
```

Don't flip any callers yet — the helper just makes the successor
queryable.

### 2. Backfill

Migration that mirrors live rows from the old source into the new
shape. Idempotent: re-running on a partial state is a no-op.

```
supabase/migrations/<ts>_<table>_backfill.sql
```

Test by running against staging and diffing the read shapes.

### 3. Retire the old source

Mark the old table as retired without dropping anything. Two
useful patterns:

- **Add a `retired_at` timestamp column.** Existing reads filter
  `WHERE retired_at IS NULL`. New writes (if any) stop going to
  the old source.
- **Emit `Deprecation` + `Sunset` headers** on any API endpoint
  that wrote to the old source. RFC 8594 `Sunset` header signals
  the cutoff date to clients.

```
supabase/migrations/<ts>_<table>_retirement.sql
```

### 4. Flip the readers

For each consumer of the old source, swap to the canonical helper.
One PR per reader minimizes blast radius:

- `/admin/<feature>` page
- `/manager/<feature>` page
- `/learn/<feature>` page
- batch job / cron
- analytics / reports
- API endpoints

After each flip, the convention guard catches re-introductions:
`src/__tests__/conventions/no-<table>-queries.test.ts` (see
`no-compliance-requirements-queries.test.ts` for the template).

### 5. Return 410 from the legacy API

Once no caller is hitting the legacy POST/PATCH endpoints:

```ts
export async function POST() { return gone(); }
export async function PATCH() { return gone(); }
```

With RFC 8594 `Sunset` + `Link: <successor>; rel="successor-version"`
headers. Keep GET around briefly during the read-cutover window;
410 it once the readers are flipped.

### 6. Park the drop migration

Write the destructive migration with preconditions that abort if
the world hasn't reached the safe state yet:

```sql
DO $$
DECLARE non_retired_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO non_retired_count
  FROM <table> WHERE retired_at IS NULL;
  IF non_retired_count > 0 THEN
    RAISE EXCEPTION 'Refusing to drop: % non-retired rows', non_retired_count;
  END IF;
END $$;

DROP TABLE IF EXISTS <table> CASCADE;
```

Park it under `supabase/pending/` while preconditions are stabilizing
(the `supabase-pending-empty` guard catches anything left there
indefinitely). Move to `supabase/migrations/` once green to apply.

### 7. Drop and clean

Apply the drop migration. In the same PR:

- Delete now-orphaned helpers from `src/lib/`.
- Remove the convention guard's whitelist exception for the
  helper module.
- Tighten the convention guard from "no live queries" to "no
  references at all" if the table name shouldn't appear anywhere
  outside historical comments.

## Lessons from `compliance_requirements`

- Reader flips landed across ~6 PRs, one per consumer. Each kept
  the page working with the legacy source still queryable, so a
  rollback was always one revert away.
- The `Deprecation` + `Sunset` headers on POST went out 30 days
  before the table drop, which surfaced one straggling caller in
  logs that we hadn't grepped for.
- The drop migration's preconditions did fire once on staging
  (legacy QA rows that pre-dated the retirement) — exactly what
  they're for.
- Dropping the helper export (`getTenantScopedRequiredCourseSources`)
  in the same PR as the table drop turned out to be premature. We
  shipped the migration first; the helper sat unused for two
  weeks before getting dropped in a follow-up. That's fine: small
  PR, easy to revert.
