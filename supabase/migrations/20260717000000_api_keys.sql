-- L3 (multi-role QA audit): real, server-side API keys. Previously keys were
-- generated client-side with crypto.randomUUID() and only the name was stored,
-- so there was no secret and nothing to validate against. This table stores a
-- SHA-256 hash of a server-generated secret (never the secret itself) plus a
-- display prefix/suffix, so a key can be issued once and later verified.

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,        -- SHA-256 hex of the full secret
  key_prefix TEXT NOT NULL,      -- leading chars, shown in the UI (e.g. lms_ab12cd34)
  last_four TEXT NOT NULL,       -- trailing chars, shown in the UI
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);

-- Access is via the service-role admin API; enable RLS with an admin-manage
-- policy so the table isn't unprotected and direct user reads stay locked down.
-- auth.uid() is wrapped in a scalar subquery (no initplan lint).
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage api keys" ON api_keys;
CREATE POLICY "Admins manage api keys" ON api_keys
  FOR ALL TO public
  USING (EXISTS ( SELECT 1
    FROM users
    WHERE (users.auth_id = (select auth.uid()))
      AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))));
