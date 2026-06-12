-- Public storefronts: branded, publicly browsable shops (one per website,
-- e.g. gothamculture.com and gothamgovernment.com) that sell products with
-- real payment processing and guest checkout.

CREATE TABLE IF NOT EXISTS storefronts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  logo_url TEXT,
  hero_image_url TEXT,
  -- branding: { "primary_color": "#1d4ed8", "accent_color": "#f59e0b" }
  branding JSONB NOT NULL DEFAULT '{}',
  currency TEXT NOT NULL DEFAULT 'USD',
  contact_email TEXT,
  support_url TEXT,
  announcement TEXT,
  custom_domain TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_storefronts_slug ON storefronts(slug);

-- Products can now belong to a storefront and exist without an LMS course
-- (e.g. catalog items imported from Ecwid that are delivered as ILT).
ALTER TABLE products ALTER COLUMN course_id DROP NOT NULL;
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS storefront_id UUID REFERENCES storefronts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_products_storefront_id ON products(storefront_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
-- Prevent duplicate imports of the same external (Ecwid/Shopify) product per store
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_storefront_external
  ON products(storefront_id, external_id) WHERE external_id IS NOT NULL;

-- Guest checkout: orders no longer require an LMS user
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS storefront_id UUID REFERENCES storefronts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_storefront_id ON orders(storefront_id);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session_id ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);

-- Order items may reference catalog-only products with no course
ALTER TABLE order_items ALTER COLUMN course_id DROP NOT NULL;

ALTER TABLE storefronts ENABLE ROW LEVEL SECURITY;

-- Anyone may read active storefronts (public shop pages use the anon key via
-- the service client today, but keep the policy correct regardless).
CREATE POLICY storefronts_public_read ON storefronts
  FOR SELECT USING (is_active = true);

-- Seed the two Gotham storefronts
INSERT INTO storefronts (slug, name, tagline, description, branding, contact_email)
VALUES
  (
    'gothamculture',
    'gothamCulture Training',
    'Courseware for high-performing organizations',
    'In-person and live-online training from gothamCulture, organized by theme: Conscious Leadership, Communication, Project Management, Presence, Influence, and Training Others.',
    '{"primary_color": "#0f172a", "accent_color": "#e11d48"}',
    'info@gothamculture.com'
  ),
  (
    'gothamgovernment',
    'Gotham Government Services Training',
    'Federal training & workforce development',
    'Commercial off-the-shelf training for federal agencies from Gotham Government Services, including Federal Acquisition & Contracting courses and 90-minute short duration training.',
    '{"primary_color": "#0c2340", "accent_color": "#b8860b"}',
    'thrive@gothamgovernment.com'
  )
ON CONFLICT (slug) DO NOTHING;

-- Seed a few sample catalog items per store so the shops are browsable
-- immediately. The real catalogs are imported from Ecwid CSV exports via
-- Admin -> Storefronts -> Import.
INSERT INTO products (storefront_id, name, description, category, price, status)
SELECT s.id, p.name, p.description, p.category, p.price, 'active'
FROM storefronts s
JOIN (VALUES
  ('gothamculture', 'Leading with Emotional Intelligence', 'Build self-awareness and relationship skills that drive team performance.', 'Conscious Leadership', 495.00),
  ('gothamculture', 'Difficult Conversations at Work', 'A practical framework for navigating high-stakes workplace conversations.', 'Communication', 395.00),
  ('gothamculture', 'Project Management Essentials', 'Plan, execute, and close projects with confidence — no PMP required.', 'Project Management', 595.00),
  ('gothamculture', 'Executive Presence', 'Command the room: presence, poise, and credibility for leaders.', 'Presence', 495.00),
  ('gothamculture', 'Influencing Without Authority', 'Move work forward when you do not control the resources or the people.', 'Influence', 395.00),
  ('gothamculture', 'Train the Trainer', 'Design and deliver engaging training sessions that stick.', 'Training Others', 695.00),
  ('gothamgovernment', 'Federal Acquisition Fundamentals', 'The context, processes, and analytical systems acquisition managers need to succeed.', 'Federal Acquisition & Contracting', 895.00),
  ('gothamgovernment', 'Contract Administration & Oversight', 'Post-award management for complex federal contracts, with current case studies.', 'Federal Acquisition & Contracting', 895.00),
  ('gothamgovernment', 'Your Leadership Legacy', 'A leadership development program for federal professionals.', 'Leadership Development', 595.00),
  ('gothamgovernment', 'Giving Effective Feedback (90-Minute)', 'Short-duration training: essential feedback skills without extended time away.', '90-Minute Short Duration Training', 149.00),
  ('gothamgovernment', 'Running Better Meetings (90-Minute)', 'Short-duration training: agendas, facilitation, and follow-through.', '90-Minute Short Duration Training', 149.00)
) AS p(store_slug, name, description, category, price)
  ON p.store_slug = s.slug
WHERE NOT EXISTS (
  SELECT 1 FROM products existing
  WHERE existing.storefront_id = s.id AND existing.name = p.name
);
