-- B2B storefront model: clients (organizations) order seats in courses for
-- their employees — they are not individual self-registrations. This migration
-- brings the storefront order schema up to Ecwid parity and adds the data
-- needed for seat limits, order management, multi-category browsing, richer
-- product pages, volume discounts, tax, and analytics.

-- ---------------------------------------------------------------------------
-- Products: per-course seat limits, image gallery, multi-category, duration,
-- and class logistics (delivery formats, lead times, coordinator contact).
-- ---------------------------------------------------------------------------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS min_participants INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_participants INT,
  ADD COLUMN IF NOT EXISTS image_urls JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS duration_label TEXT,
  ADD COLUMN IF NOT EXISTS delivery_formats TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS logistics JSONB NOT NULL DEFAULT '{}';

ALTER TABLE products
  ADD CONSTRAINT products_participants_chk
  CHECK (min_participants >= 1 AND (max_participants IS NULL OR max_participants >= min_participants));

-- Seed the multi-category array from the existing single category so the new
-- multi-category filter works immediately for the catalogs already imported.
UPDATE products
SET categories = ARRAY[category]
WHERE category IS NOT NULL AND categories = '{}';

CREATE INDEX IF NOT EXISTS idx_products_categories ON products USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_products_duration_label ON products(duration_label);

-- ---------------------------------------------------------------------------
-- Orders: full B2B client order information (Ecwid parity) + management fields.
-- ---------------------------------------------------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS billing_address JSONB,
  ADD COLUMN IF NOT EXISTS po_number TEXT,
  ADD COLUMN IF NOT EXISTS order_notes TEXT,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status_history JSONB NOT NULL DEFAULT '[]';

-- Expand the order status set to support cancellation and partial refunds.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','completed','refunded','partially_refunded','cancelled','failed'));

-- ---------------------------------------------------------------------------
-- Order items: snapshot the product name/category so order history is stable
-- even after the catalog is edited. quantity = number of employee seats.
-- ---------------------------------------------------------------------------
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS product_category TEXT;

COMMENT ON COLUMN order_items.quantity IS 'Number of employee seats the client is purchasing for this course.';

-- ---------------------------------------------------------------------------
-- Storefronts: feature switches for volume discounts, tax, and analytics.
-- ---------------------------------------------------------------------------
ALTER TABLE storefronts
  ADD COLUMN IF NOT EXISTS volume_discounts_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_label TEXT NOT NULL DEFAULT 'Tax',
  ADD COLUMN IF NOT EXISTS analytics_measurement_id TEXT,
  ADD COLUMN IF NOT EXISTS order_notify_email TEXT;
