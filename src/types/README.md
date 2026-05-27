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

### Realistic floor for the ratchets

The `as-any-audit` and `any-annotation-audit` ratchets are advisory
shrinking caps, **not** assertions of zero. A meaningful share of the
remaining casts are genuinely hard to remove without the generated
types (or are inherently untypeable), so the floor is well above zero:

- **Polymorphic values** — e.g. `embed/[token]/page.tsx`'s
  `content`, whose shape varies by widget type. A discriminated
  union is possible but rarely worth it.
- **Intentionally-loose props** — some client components declare
  props as `any[]` (e.g. `FeedbackFormPage.questions`), so the
  feeding cast can't be narrower than the prop.
- **External-library boundaries** — passing a Json column to a
  third-party API typed for its own shape (e.g. the xAPI client in
  `lrs/[id]/sync`, Teams bot payloads).
- **Json columns** consumed structurally — `metadata`, `config`,
  `preferences` blobs; these get `as unknown as <shape>` where the
  shape is known, but stay loose where it genuinely varies.

Rule of thumb: drive the ratchets down by converting query-row and
nested-join casts (the bulk), and **stop** at the categories above —
each remaining cast should be defensible in review. Don't chase zero;
chase "every survivor is justified."

### `: any` annotation risk

A survey of the remaining `: any` annotations found **no exported
function or const that returns `any`** — i.e. no public contract
leaks `any`. The surface is almost entirely low-risk local
accumulators (`let rows: any[] = []`, later filled by a query) and
`.map`/`.filter` callback params over loosely-typed query results.
So the type-safety *risk* of the remaining `: any` is low; the
`any-annotation-audit` cap exists to prevent growth, not because the
current set is dangerous. Spend conversion effort where it buys real
safety (a shared shape, a reused helper), not on chasing the count.
