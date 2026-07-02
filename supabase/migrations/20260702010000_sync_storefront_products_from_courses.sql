-- Keep the gC + GGS storefront catalogs (public "store" pages) in sync with the
-- LMS courses they are built from. The store renders the `products` table, whose
-- content fields (description, learning_objectives, methodology, duration_label,
-- category, NASBA) were empty. This migration:
--   1. Adds format_course_duration() to render estimated_duration (minutes) as a label.
--   2. Adds sync_products_from_course(course_id): copies the *course's* content onto
--      every product linked to that course OR to one of its consolidated source ids
--      (metadata.catalog_audit.source_course_ids), so the canonical audited course
--      drives products even when a storefront product links the duplicate id.
--   3. Installs triggers so any future LMS course edit (or new product) auto-syncs.
--   4. Backfills all existing products once.
-- Only *content* is synced. Price, discounts, images, logistics, sort order,
-- listed_in_storefront and other per-storefront fields are never touched. Curated
-- duration labels are preserved (only filled when empty).

-- 1. Duration label helper -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.format_course_duration(mins integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN mins IS NULL OR mins <= 0 THEN NULL
    WHEN mins % 480 = 0 THEN (mins / 480)::text || CASE WHEN mins / 480 = 1 THEN ' day' ELSE ' days' END
    WHEN mins % 60  = 0 THEN (mins / 60)::text  || CASE WHEN mins / 60  = 1 THEN ' hour' ELSE ' hours' END
    ELSE mins::text || ' minutes'
  END;
$$;

-- 2. Course -> products content sync -------------------------------------------
-- Copies content from the given course onto products linked to it or to any of its
-- consolidated source course ids. Content is course-authoritative; blank course
-- values never overwrite existing product content, and duration_label is only filled.
CREATE OR REPLACE FUNCTION public.sync_products_from_course(p_course_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE products p SET
    name = COALESCE(NULLIF(c.title, ''), p.name),
    description = COALESCE(NULLIF(c.description, ''), p.description),
    learning_objectives = CASE
      WHEN jsonb_array_length(COALESCE(c.metadata->'learning_outcomes', '[]'::jsonb)) > 0
      THEN ARRAY(SELECT jsonb_array_elements_text(c.metadata->'learning_outcomes'))
      ELSE p.learning_objectives END,
    methodology = COALESCE(NULLIF(c.metadata->>'methodology', ''), p.methodology),
    category = COALESCE(cat.name, p.category),
    categories = CASE WHEN cat.name IS NOT NULL THEN ARRAY[cat.name] ELSE p.categories END,
    duration_label = COALESCE(NULLIF(p.duration_label, ''), public.format_course_duration(c.estimated_duration)),
    nasba_certified = c.nasba_certified,
    nasba_cpe_credits = c.nasba_cpe_credits,
    nasba_field_of_study = c.nasba_field_of_study,
    nasba_knowledge_level = c.nasba_knowledge_level,
    nasba_prerequisites = c.nasba_prerequisites,
    nasba_advance_prep = c.nasba_advance_prep,
    nasba_delivery_method = c.nasba_delivery_method,
    updated_at = now()
  FROM courses c
  LEFT JOIN categories cat ON cat.id = c.category_id
  WHERE c.id = p_course_id
    AND (
      p.course_id = c.id
      OR (c.metadata->'catalog_audit'->'source_course_ids') ? p.course_id::text
    );
$$;

-- 3a. Trigger: course change -> re-sync its products ---------------------------
CREATE OR REPLACE FUNCTION public.trg_course_sync_products()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.sync_products_from_course(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS course_sync_products ON courses;
CREATE TRIGGER course_sync_products
AFTER INSERT OR UPDATE OF
  title, description, metadata, estimated_duration, category_id,
  nasba_certified, nasba_cpe_credits, nasba_field_of_study, nasba_knowledge_level,
  nasba_prerequisites, nasba_advance_prep, nasba_delivery_method
ON courses
FOR EACH ROW
EXECUTE FUNCTION public.trg_course_sync_products();

-- 3b. Trigger: new product -> fill content from its course ----------------------
CREATE OR REPLACE FUNCTION public.trg_product_fill_from_course()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  c courses%rowtype;
  cat_name text;
BEGIN
  IF NEW.course_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Resolve source course: prefer the audited canonical that lists this course id,
  -- otherwise the directly linked course.
  SELECT * INTO c FROM courses x
  WHERE x.id = NEW.course_id
     OR (x.metadata->'catalog_audit'->>'imported_at' IS NOT NULL
         AND (x.metadata->'catalog_audit'->'source_course_ids') ? NEW.course_id::text)
  ORDER BY (x.metadata->'catalog_audit'->>'imported_at' IS NOT NULL) DESC,
           (x.id = NEW.course_id) DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT name INTO cat_name FROM categories WHERE id = c.category_id;

  NEW.name := COALESCE(NULLIF(NEW.name, ''), NULLIF(c.title, ''), NEW.name);
  NEW.description := COALESCE(NULLIF(NEW.description, ''), NULLIF(c.description, ''));
  IF (NEW.learning_objectives IS NULL OR array_length(NEW.learning_objectives, 1) IS NULL)
     AND jsonb_array_length(COALESCE(c.metadata->'learning_outcomes', '[]'::jsonb)) > 0 THEN
    NEW.learning_objectives := ARRAY(SELECT jsonb_array_elements_text(c.metadata->'learning_outcomes'));
  END IF;
  NEW.methodology := COALESCE(NULLIF(NEW.methodology, ''), NULLIF(c.metadata->>'methodology', ''));
  NEW.category := COALESCE(NULLIF(NEW.category, ''), cat_name);
  IF (NEW.categories IS NULL OR array_length(NEW.categories, 1) IS NULL) AND cat_name IS NOT NULL THEN
    NEW.categories := ARRAY[cat_name];
  END IF;
  NEW.duration_label := COALESCE(NULLIF(NEW.duration_label, ''), public.format_course_duration(c.estimated_duration));
  NEW.nasba_certified := COALESCE(NEW.nasba_certified, c.nasba_certified);
  NEW.nasba_cpe_credits := COALESCE(NEW.nasba_cpe_credits, c.nasba_cpe_credits);
  NEW.nasba_field_of_study := COALESCE(NEW.nasba_field_of_study, c.nasba_field_of_study);
  NEW.nasba_knowledge_level := COALESCE(NEW.nasba_knowledge_level, c.nasba_knowledge_level);
  NEW.nasba_prerequisites := COALESCE(NEW.nasba_prerequisites, c.nasba_prerequisites);
  NEW.nasba_advance_prep := COALESCE(NEW.nasba_advance_prep, c.nasba_advance_prep);
  NEW.nasba_delivery_method := COALESCE(NEW.nasba_delivery_method, c.nasba_delivery_method);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_fill_from_course ON products;
CREATE TRIGGER product_fill_from_course
BEFORE INSERT ON products
FOR EACH ROW
EXECUTE FUNCTION public.trg_product_fill_from_course();

-- 4. One-time backfill ----------------------------------------------------------
-- Pass 1: every directly linked course drives its product (covers products whose
-- linked course was not part of the audit, and provides a baseline description).
-- Pass 2: audited canonical courses drive again, so canonical content wins for any
-- product that links a consolidated duplicate id.
DO $$
DECLARE
  r uuid;
BEGIN
  FOR r IN SELECT DISTINCT course_id FROM products WHERE course_id IS NOT NULL LOOP
    PERFORM public.sync_products_from_course(r);
  END LOOP;
  FOR r IN SELECT id FROM courses WHERE metadata->'catalog_audit'->>'imported_at' = '2026-07-02' LOOP
    PERFORM public.sync_products_from_course(r);
  END LOOP;
END;
$$;
