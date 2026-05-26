# Archived docs

Historical reference material that's preserved but no longer the
active spec. Pieces have shipped and evolved; the snapshot stays
for context (what we planned, what we deferred, what the original
shape looked like).

## Policy

- Each archived doc opens with a one-line **Historical** banner
  that points at the current docs (`../conventions.md`,
  `../migrations.md`, `../../CHANGELOG.md`).
- Files move here via `git mv`, never copy. The
  `docs-footprint` convention test asserts the top-level and
  archived sets are disjoint — a double-listed file fails CI.
- Resurrection is fine: if archived material becomes relevant
  again, move it back out and rewrite the banner to point
  forward instead of backward.

## What's here

- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — original
  LMS implementation plan. Most of it shipped; the parts that
  evolved (e.g. `compliance_requirements`) link to the active
  successor docs.
