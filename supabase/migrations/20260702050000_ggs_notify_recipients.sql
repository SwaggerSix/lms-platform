-- Route GGS storefront notifications (pricing inquiries + new-order emails) to
-- the GGS team members. order_notify_email holds a comma-separated recipient
-- list, split in the app. gC keeps its contact_email fallback
-- (info@gothamculture.com) and both stores keep the supervisor CC.
UPDATE storefronts
SET order_notify_email = 'sabernathy@gothamgovernment.com, elizabeth@gothamgovernment.com'
WHERE slug = 'gothamgovernment';
