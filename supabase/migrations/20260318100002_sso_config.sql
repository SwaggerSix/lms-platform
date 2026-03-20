-- SSO provider configurations (app-level metadata, actual SAML config lives in Supabase Auth)
CREATE TABLE IF NOT EXISTS sso_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL DEFAULT 'saml' CHECK (provider_type IN ('saml', 'oidc')),
  entity_id TEXT, -- SAML Entity ID / Issuer
  metadata_url TEXT, -- SAML metadata URL
  domain TEXT, -- email domain for auto-routing (e.g., "acme.com")
  is_active BOOLEAN DEFAULT false,
  auto_provision_users BOOLEAN DEFAULT true,
  default_role TEXT DEFAULT 'learner',
  attribute_mapping JSONB DEFAULT '{}', -- maps SAML attributes to user fields
  scim_enabled BOOLEAN DEFAULT false,
  scim_token_hash TEXT, -- hashed SCIM bearer token
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sso_domain ON sso_providers(domain);
