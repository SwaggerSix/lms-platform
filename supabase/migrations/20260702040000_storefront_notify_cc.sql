-- Per-store CC for internal storefront notifications (pricing inquiries and
-- new-order emails). Routing becomes: to = order_notify_email || contact_email,
-- cc = notify_cc_email. Each store's own inbox is the primary recipient and a
-- supervisor can be CC'd on everything across stores.

ALTER TABLE storefronts
  ADD COLUMN IF NOT EXISTS notify_cc_email TEXT;

-- gC + GGS: notifications go to each store's contact inbox
-- (info@gothamculture.com / thrive@gothamgovernment.com via the contact_email
-- fallback), with chris.cancialosi@gothamculture.com CC'd on both.
UPDATE storefronts
SET notify_cc_email = 'chris.cancialosi@gothamculture.com',
    order_notify_email = NULL
WHERE slug IN ('gothamculture', 'gothamgovernment');
