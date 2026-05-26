# `src/lib/auth/`

Auth helpers. Two layers:

- **Identity** — who is the request from?
- **Authorization** — what shape of role check are we doing?

## Modules

### `get-user.ts`

`getAuthUser()` — server-side helper that resolves the Supabase auth
user plus the `users` row (with organization joined). Uses the
service client to bypass the `users_select` RLS policy (which
references the `users` table itself and would otherwise recurse).
Returns `{ authUser, dbUser, supabase }`; both are nullable for the
unauthenticated case.

### `authorize.ts`

`authorize(...allowedRoles)` — gate helper for API routes. Resolves
the user, short-circuits with `super_admin` always allowed, then
checks the supplied role list. Returns a discriminated union
(`{ authorized: true, user, supabase }` or `{ authorized: false,
error, status }`) so callers can early-return the failure shape
directly.

Exports the `Role` type union as the canonical list of role
literals.

Because of the super_admin short-circuit, `authorize("admin",
"manager")` already admits super_admin — the omission bug that
bites inline `["admin", "manager"].includes(role)` checks does
not apply here. No need to add `"super_admin"` to the allowlist.

### `roles.ts`

Canonical role-membership predicates. Prefer these over inline
inequality / array-includes checks:

- `isAdmin(role)` — admin or super_admin.
- `isManagerOrAbove(role)` — admin, super_admin, or manager.

The docstring documents the three historical inline shapes the
helpers replace, plus the `super_admin` omission bug pattern the
audit catches.

### `role-check-patterns.ts`

Shared regex constants used by the role-check guardrails and their
smoke tests. Co-located so the live ratchets and the smoke tests
can't drift.

- `INEQUALITY_ROLE_RE` — matches the two-role
  `role !== "admin" && role !== "super_admin"` inequality.
  Banned: hard-failed by `isadmin-adoption-ratchet`.
- `ADMIN_MANAGER_INCLUDES_RE` — matches
  `["admin", "manager"].includes(...)`. Banned: hard-failed by
  `super-admin-omission-audit` (the super_admin-omitting form).

Both convention walks whitelist this file so the regex source
doesn't self-match.

## Route gates (`src/middleware.ts`)

Two role-gated path prefixes today:

- `/admin/*` — gated by `isAdmin(role)`. Non-admin/super_admin
  users are redirected to `/dashboard`.
- `/manager/*` — gated by `isManagerOrAbove(role)`. Non-manager
  users redirected to `/dashboard`.

Both gates pulled from the same helpers as the page-level / API
route checks, so policy is owned in one place. The
`middleware` convention test pins the matcher exclusions and the
gate-list to surface drift.

## Related

- `docs/conventions.md` — role-check helpers section + ratchet
  idiom that drove the migrations.
- `src/middleware.ts` — the `/admin` and `/manager` route gates
  built on these helpers.
