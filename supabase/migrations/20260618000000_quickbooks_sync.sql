-- QuickBooks Desktop sync (receivables side).
--
-- The LMS captures financial events (completed orders, refunds, instructor
-- payouts) and enqueues normalized "post to QuickBooks" jobs. A separate
-- QB Bridge (Web Connector / qbXML service, lives in gc-partner-portal)
-- consumes `qb_sync_queue` and writes back the resulting QuickBooks object
-- ids. This migration only adds the LMS-side capture tables and the
-- per-record sync-state columns. Nothing here calls QuickBooks directly.

-- ---------------------------------------------------------------------------
-- Per-record sync state. Lets the UI show whether a given order / payout has
-- been posted to QuickBooks, and records the resulting QB object reference.
-- ---------------------------------------------------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS qb_sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (qb_sync_status IN ('pending','queued','synced','error','skipped')),
  ADD COLUMN IF NOT EXISTS qb_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qb_object_id TEXT,
  ADD COLUMN IF NOT EXISTS qb_object_type TEXT,
  ADD COLUMN IF NOT EXISTS qb_error TEXT;

ALTER TABLE instructor_payouts
  ADD COLUMN IF NOT EXISTS qb_sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (qb_sync_status IN ('pending','queued','synced','error','skipped')),
  ADD COLUMN IF NOT EXISTS qb_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qb_object_id TEXT,
  ADD COLUMN IF NOT EXISTS qb_object_type TEXT,
  ADD COLUMN IF NOT EXISTS qb_error TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_qb_sync_status ON orders(qb_sync_status);
CREATE INDEX IF NOT EXISTS idx_instructor_payouts_qb_sync_status
  ON instructor_payouts(qb_sync_status);

-- ---------------------------------------------------------------------------
-- The work queue the QB Bridge polls. Each row is one normalized financial
-- event. `idempotency_key` is stable per (entity, event) so re-running the
-- enqueue path (Stripe webhook retries, replays) never double-posts.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qb_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sales_receipt',      -- order completed -> Customer upsert + Sales Receipt
    'refund_receipt',     -- order refund    -> Credit Memo / Refund Receipt
    'vendor_bill'         -- instructor payout -> Vendor + Bill (AP)
  )),
  payload JSONB NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','done','error')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_qb_sync_queue_status ON qb_sync_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_qb_sync_queue_event_type ON qb_sync_queue(event_type);

-- ---------------------------------------------------------------------------
-- Maps LMS records to their QuickBooks counterparts so the Bridge (and the
-- LMS) can dedupe Customers / Vendors and look up existing transactions.
-- qb_listid = QuickBooks list reference (Customer/Vendor); qb_txnid =
-- transaction reference (Sales Receipt/Bill/Credit Memo).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qb_entity_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_type TEXT NOT NULL,   -- 'customer','vendor','order','refund','payout'
  local_id TEXT NOT NULL,     -- email/company for customers, uuid for txns, etc.
  qb_type TEXT NOT NULL,      -- 'Customer','Vendor','SalesReceipt','Bill','CreditMemo'
  qb_listid TEXT,
  qb_txnid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (local_type, local_id)
);

CREATE INDEX IF NOT EXISTS idx_qb_entity_map_qb_listid ON qb_entity_map(qb_listid);
CREATE INDEX IF NOT EXISTS idx_qb_entity_map_qb_txnid ON qb_entity_map(qb_txnid);

-- ---------------------------------------------------------------------------
-- RLS. These tables hold finance/integration data; only admins may read or
-- manage them. The enqueue path and the Bridge both use the service-role
-- client, which bypasses RLS — matching the existing storefront convention.
-- ---------------------------------------------------------------------------
ALTER TABLE qb_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_entity_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage qb sync queue" ON qb_sync_queue
  FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "Admins manage qb entity map" ON qb_entity_map
  FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));
