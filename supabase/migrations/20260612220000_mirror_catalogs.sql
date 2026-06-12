-- Mirror the two storefront catalogs across both stores: every active course
-- in the gothamCulture store also appears in the Gotham Government store and
-- vice versa (the underlying Ecwid shop is shared between both brands).
INSERT INTO products (storefront_id, name, description, category, price, status)
SELECT target.id, p.name, p.description, p.category, p.price, 'active'
FROM products p
JOIN storefronts source ON source.id = p.storefront_id
JOIN storefronts target
  ON target.slug IN ('gothamculture', 'gothamgovernment')
 AND target.id <> source.id
WHERE p.status = 'active'
  AND source.slug IN ('gothamculture', 'gothamgovernment')
  AND NOT EXISTS (
    SELECT 1 FROM products existing
    WHERE existing.storefront_id = target.id
      AND existing.name = p.name
      AND existing.status = 'active'
  );
