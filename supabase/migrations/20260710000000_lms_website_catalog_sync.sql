-- Make the LMS the source of truth for the gC + GGS online course catalogs.
--
-- Problem: the two public store catalogs (products) list the full 249-course
-- catalog, but the LMS course catalog showed almost none of it — the imported
-- catalog courses were all still `draft`, and product visibility was entirely
-- manual (course publish/unpublish/archive never touched the websites).
--
-- This migration:
--   1. Repoints every storefront product at the canonical audited course
--      (metadata.catalog_audit.source_course_ids), so purchases enroll into the
--      canonical course and one link drives both catalogs. Eight manually added
--      products (no Ecwid external_id) link draft courses the audit never
--      mapped; each has an exact-name twin product in the other store that does
--      resolve to a canonical, so they are repointed through that twin.
--   2. Publishes the canonical audited catalog courses so they appear in the
--      LMS catalog, and archives the consolidated duplicate courses (no
--      modules, no enrollments — verified before this migration).
--   3. Adds courses.listed_in_storefronts — an explicit "belongs on the public
--      gC + GGS websites" flag. Internal client-delivery courses stay false and
--      never leak onto the websites when published in the LMS.
--   4. Adds products.unlisted_by_course_sync so course-driven hiding can be
--      undone on republish without clobbering manually hidden (inactive)
--      products.
--   5. Installs sync_course_storefront_listing(course_id) + triggers:
--        - course published AND listed  -> a product exists in every active
--          storefront (created quote-only, price 0; content is filled by the
--          existing product_fill_from_course trigger) and products this sync
--          previously hid are re-activated.
--        - course unpublished/archived or unlisted -> its products are hidden
--          on both websites (status 'inactive', marked unlisted_by_course_sync).
--      Content edits already flow via course_sync_products (20260702010000);
--      course deletion already removes products via ON DELETE CASCADE.
--   6. Backfills: flags courses that have storefront products as listed, then
--      runs the sync once over every linked/listed course.

-- 0. Constraint fix --------------------------------------------------------------
-- products_course_id_unique (from 20260318100009_ecommerce.sql) predates
-- storefronts and enforces ONE product per course globally. Mirroring a course
-- into both websites requires one product per (storefront, course) — this
-- global constraint is exactly why the two stores ended up linking different
-- duplicate course ids for the same catalog item. Replace it with per-scope
-- uniqueness: one marketplace (storefront-less) product per course, and one
-- product per storefront per course.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_course_id_unique;
DROP INDEX IF EXISTS products_course_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS products_course_id_marketplace_unique
  ON products (course_id) WHERE storefront_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS products_storefront_course_unique
  ON products (storefront_id, course_id) WHERE storefront_id IS NOT NULL;

-- 1. Schema additions -----------------------------------------------------------
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS listed_in_storefronts boolean NOT NULL DEFAULT false;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS unlisted_by_course_sync boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN courses.listed_in_storefronts IS
  'Course belongs in the public gC/GGS website catalogs. While published, a product is kept active in every active storefront; otherwise its products are hidden.';
COMMENT ON COLUMN products.unlisted_by_course_sync IS
  'Product was hidden because its course is unpublished/unlisted; republish restores it. Manually hidden products (false) are never re-activated by the sync.';

-- 2. Data repair -----------------------------------------------------------------
-- 2a. Repoint products from consolidated duplicate course ids to the canonical
--     audited course. Guarded against creating a second product for the same
--     (storefront, canonical course) pair.
UPDATE products p
SET course_id = canon.id, updated_at = now()
FROM courses canon
WHERE (canon.metadata->'catalog_audit'->>'imported_at') IS NOT NULL
  AND canon.id <> p.course_id
  AND (canon.metadata->'catalog_audit'->'source_course_ids') ? p.course_id::text
  AND NOT EXISTS (
    SELECT 1 FROM products q
    WHERE q.storefront_id = p.storefront_id AND q.course_id = canon.id
  );

-- 2a-bis. Repoint the manually added products whose linked course the audit
--     never mapped. Each has exactly one exact-name twin product in the other
--     storefront whose course resolves to a canonical audited course (verified:
--     8 products, unique twin, no same-store collision).
WITH resolve AS (
  SELECT p.id, p.name, p.storefront_id,
         COALESCE(canon.id,
                  CASE WHEN (co.metadata->'catalog_audit'->>'imported_at') IS NOT NULL THEN co.id END
         ) AS canon_id
  FROM products p
  JOIN courses co ON co.id = p.course_id
  LEFT JOIN courses canon
    ON (canon.metadata->'catalog_audit'->>'imported_at') IS NOT NULL
   AND canon.id <> co.id
   AND (canon.metadata->'catalog_audit'->'source_course_ids') ? co.id::text
  WHERE p.storefront_id IS NOT NULL
)
UPDATE products p
SET course_id = twin.canon_id, updated_at = now()
FROM resolve o
JOIN LATERAL (
  SELECT t.canon_id FROM resolve t
  WHERE t.storefront_id <> o.storefront_id
    AND lower(t.name) = lower(o.name)
    AND t.canon_id IS NOT NULL
  GROUP BY t.canon_id
) twin ON true
WHERE p.id = o.id
  AND o.canon_id IS NULL
  -- exactly one candidate canonical, and the store must not already carry it
  AND (SELECT count(DISTINCT t2.canon_id) FROM resolve t2
       WHERE t2.storefront_id <> o.storefront_id
         AND lower(t2.name) = lower(o.name) AND t2.canon_id IS NOT NULL) = 1
  AND NOT EXISTS (
    SELECT 1 FROM resolve same
    WHERE same.storefront_id = o.storefront_id
      AND same.canon_id = twin.canon_id AND same.id <> o.id
  );

-- 2b. Publish the canonical audited catalog courses so they show in the LMS.
UPDATE courses
SET status = 'published',
    published_at = COALESCE(published_at, now()),
    updated_at = now()
WHERE status = 'draft'
  AND (metadata->'catalog_audit'->>'imported_at') IS NOT NULL;

-- 2c. Archive the consolidated duplicates (superseded by the canonical course).
UPDATE courses dup
SET status = 'archived', updated_at = now()
WHERE dup.status = 'draft'
  AND (dup.metadata->'catalog_audit'->>'imported_at') IS NULL
  AND EXISTS (
    SELECT 1 FROM courses canon
    WHERE (canon.metadata->'catalog_audit'->>'imported_at') IS NOT NULL
      AND canon.id <> dup.id
      AND (canon.metadata->'catalog_audit'->'source_course_ids') ? dup.id::text
  );

-- 2c-bis. Archive the orphan draft courses left behind by the twin repoint
--     (2a-bis): unaudited drafts sharing a canonical course's exact title that
--     now have no products, enrollments, or modules.
UPDATE courses orphan
SET status = 'archived', updated_at = now()
WHERE orphan.status = 'draft'
  AND (orphan.metadata->'catalog_audit'->>'imported_at') IS NULL
  AND EXISTS (
    SELECT 1 FROM courses canon
    WHERE (canon.metadata->'catalog_audit'->>'imported_at') IS NOT NULL
      AND lower(canon.title) = lower(orphan.title)
  )
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.course_id = orphan.id)
  AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = orphan.id)
  AND NOT EXISTS (SELECT 1 FROM modules m WHERE m.course_id = orphan.id);

-- 2d. Courses that already have a storefront product are, by definition, part
--     of the public website catalogs.
UPDATE courses c
SET listed_in_storefronts = true
WHERE EXISTS (
  SELECT 1 FROM products p
  WHERE p.course_id = c.id AND p.storefront_id IS NOT NULL
);

-- 3. Listing sync ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_course_storefront_listing(p_course_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  c courses%rowtype;
BEGIN
  SELECT * INTO c FROM courses WHERE id = p_course_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF c.status = 'published' AND c.listed_in_storefronts THEN
    -- Mirror the course into every active storefront it is missing from.
    -- Quote-only pricing (0) per the catalog convention; content is filled by
    -- the product_fill_from_course BEFORE INSERT trigger.
    INSERT INTO products (storefront_id, course_id, name, price, status, listed_in_storefront)
    SELECT s.id, c.id, c.title, 0, 'active', true
    FROM storefronts s
    WHERE s.is_active
      AND NOT EXISTS (
        SELECT 1 FROM products p
        WHERE p.storefront_id = s.id AND p.course_id = c.id
      );

    -- Restore products that THIS sync hid. Manually hidden products
    -- (unlisted_by_course_sync = false) are curation and stay hidden.
    UPDATE products
    SET status = 'active', unlisted_by_course_sync = false, updated_at = now()
    WHERE course_id = c.id
      AND storefront_id IS NOT NULL
      AND status = 'inactive'
      AND unlisted_by_course_sync;

    -- Clear stale markers (e.g. a product manually re-activated meanwhile).
    UPDATE products
    SET unlisted_by_course_sync = false
    WHERE course_id = c.id
      AND storefront_id IS NOT NULL
      AND unlisted_by_course_sync;
  ELSE
    -- Course left the public catalog: hide its products on both websites.
    UPDATE products
    SET status = 'inactive', unlisted_by_course_sync = true, updated_at = now()
    WHERE course_id = c.id
      AND storefront_id IS NOT NULL
      AND status = 'active';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_course_sync_storefront_listing()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.sync_course_storefront_listing(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS course_storefront_listing_sync_upd ON courses;
CREATE TRIGGER course_storefront_listing_sync_upd
AFTER UPDATE OF status, listed_in_storefronts ON courses
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status
   OR OLD.listed_in_storefronts IS DISTINCT FROM NEW.listed_in_storefronts)
EXECUTE FUNCTION public.trg_course_sync_storefront_listing();

DROP TRIGGER IF EXISTS course_storefront_listing_sync_ins ON courses;
CREATE TRIGGER course_storefront_listing_sync_ins
AFTER INSERT ON courses
FOR EACH ROW
WHEN (NEW.status = 'published' AND NEW.listed_in_storefronts)
EXECUTE FUNCTION public.trg_course_sync_storefront_listing();

-- 4. One-time consistency pass ---------------------------------------------------
DO $$
DECLARE
  r uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT course_id FROM products
    WHERE course_id IS NOT NULL AND storefront_id IS NOT NULL
    UNION
    SELECT id FROM courses WHERE listed_in_storefronts
  LOOP
    PERFORM public.sync_course_storefront_listing(r);
  END LOOP;
END;
$$;
