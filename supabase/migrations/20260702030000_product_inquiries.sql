-- Pricing & availability inquiries from the public storefront course pages.
-- The "Request pricing & availability" button used to be a bare mailto: link
-- (silently broken for visitors without a desktop mail client). It now posts
-- an inquiry which is stored here and emailed to the store team.
-- Written via the service role from /api/storefront/inquiry; RLS enabled with
-- no anon policies (same posture as abandoned_carts).

CREATE TABLE IF NOT EXISTS product_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID NOT NULL REFERENCES storefronts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT,
  phone TEXT,
  seats_estimate TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_inquiries_storefront ON product_inquiries(storefront_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_inquiries_status ON product_inquiries(status) WHERE status = 'new';
ALTER TABLE product_inquiries ENABLE ROW LEVEL SECURITY;
