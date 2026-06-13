-- Supporting tables for storefront volume discounts, abandoned-cart recovery,
-- and Ecwid → new-store URL redirects.

-- ---------------------------------------------------------------------------
-- Volume discount tiers (#10). Built but OFF unless the storefront opts in via
-- storefronts.volume_discounts_enabled. A line item qualifies for the highest
-- tier whose min_seats it meets; the percentage comes off that line.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS volume_discount_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID NOT NULL REFERENCES storefronts(id) ON DELETE CASCADE,
  min_seats INT NOT NULL CHECK (min_seats >= 2),
  discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (storefront_id, min_seats)
);

CREATE INDEX IF NOT EXISTS idx_volume_tiers_storefront ON volume_discount_tiers(storefront_id);
ALTER TABLE volume_discount_tiers ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Abandoned carts (#11). The checkout form captures the client's email + cart
-- before payment; if no order follows, a recovery email can be sent. The
-- recovery_token lets the client restore their cart with one click.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS abandoned_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID NOT NULL REFERENCES storefronts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  customer_name TEXT,
  company_name TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  recovery_token TEXT NOT NULL UNIQUE,
  reminded_at TIMESTAMPTZ,
  recovered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (storefront_id, email)
);

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_storefront ON abandoned_carts(storefront_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_recovery ON abandoned_carts(reminded_at, recovered_at);
ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Storefront redirects (#6). Maps legacy Ecwid URL slugs (and product/category
-- numeric ids) to the new store so search traffic and bookmarks survive the
-- migration. Product-level redirects can resolve dynamically via external_id,
-- but explicit entries here cover category pages and renamed items.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS storefront_redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID NOT NULL REFERENCES storefronts(id) ON DELETE CASCADE,
  from_path TEXT NOT NULL,
  to_path TEXT NOT NULL,
  hits INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (storefront_id, from_path)
);

CREATE INDEX IF NOT EXISTS idx_storefront_redirects_from ON storefront_redirects(from_path);
ALTER TABLE storefront_redirects ENABLE ROW LEVEL SECURITY;
