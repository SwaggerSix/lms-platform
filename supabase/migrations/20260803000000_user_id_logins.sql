-- User ID logins: lets a tenant invite users with an admin-assigned login ID
-- and a starter password instead of a real email address, so no PII is stored.
-- The login ID is mapped to a synthetic auth email under the reserved
-- "login.invalid" domain (RFC 2606 — never routable), which keeps the whole
-- Supabase email+password stack unchanged.

ALTER TABLE users ADD COLUMN IF NOT EXISTS login_id TEXT;

-- Login IDs sign in through a shared synthetic-email namespace, so they must
-- be unique platform-wide (case-insensitively), not just per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS users_login_id_unique
  ON users (lower(login_id))
  WHERE login_id IS NOT NULL;

COMMENT ON COLUMN users.login_id IS
  'Admin-assigned sign-in ID for pseudonymous (no-PII) accounts. Maps to the synthetic auth email <login_id>@login.invalid.';
