# `src/types/`

## Type-safety strategy

This project does **not** use Supabase-generated `Database` types.
`database.ts` is a **hand-maintained** set of interfaces
(`User`, `Organization`, `Course`, …) plus the string-literal enums
(`UserRole`, `EnrollmentStatus`, …). The Supabase clients in
`src/lib/supabase/` are constructed **without** the `<Database>`
generic, so query results are loosely typed (`any` rows).

Why hand-written rather than generated:

- there is no committed Supabase project ref to run the generator
  against (`supabase/` holds only `migrations/` + `pending/`);
- the generator needs a live database connection, which CI and
  local dev here don't have.

### Boundary-cast convention

Because query rows are loosely typed, code that hands query results
to a typed consumer (a client component prop, a typed map) asserts
the shape **at the boundary**. Prefer, in order:

1. **A real type** — when the query columns map cleanly to an
   interface, cast the array to it: `(data ?? []) as RowType[]`.
   (Works because the source is `any`.)
2. **`as unknown as T`** — when supabase-js mis-types the shape
   (e.g. to-one embedded relations typed as arrays, or nested
   joins), name the asserted shape with the double-cast. This is
   the sanctioned narrowing form.
3. **`as any`** — last resort, and tracked: the `as-any-audit`
   convention test (see [docs/conventions.md](../../docs/conventions.md))
   caps the count as a shrinking ratchet. New `as any` should be
   rare and is expected to be migrated toward (1) or (2).

If the project ever adopts generated `Database` types, most of the
boundary casts here become unnecessary and the ratchet can be driven
to zero.
