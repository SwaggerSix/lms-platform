-- Fill products.delivery_formats from the LMS course so the storefront
-- "At a glance" panel always shows a Delivery style. Curated formats are
-- preserved (only filled when empty). "Live online" methodologies take
-- precedence over the coarser course_type mapping. Also re-syncs products
-- when a course's course_type changes.

CREATE OR REPLACE FUNCTION public.course_delivery_formats(c courses)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN c.metadata->>'methodology' ILIKE 'live online%' THEN ARRAY['Live online']
    WHEN c.course_type = 'instructor_led' THEN ARRAY['Instructor-led']
    WHEN c.course_type = 'self_paced' THEN ARRAY['Self-paced']
    WHEN c.course_type = 'blended' THEN ARRAY['Blended']
    ELSE NULL
  END;
$$;

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
    delivery_formats = CASE
      WHEN array_length(p.delivery_formats, 1) > 0 THEN p.delivery_formats
      ELSE COALESCE(public.course_delivery_formats(c), p.delivery_formats) END,
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

-- Re-create the course trigger so course_type changes also re-sync products.
DROP TRIGGER IF EXISTS course_sync_products ON courses;
CREATE TRIGGER course_sync_products
AFTER INSERT OR UPDATE OF
  title, description, metadata, estimated_duration, category_id, course_type,
  nasba_certified, nasba_cpe_credits, nasba_field_of_study, nasba_knowledge_level,
  nasba_prerequisites, nasba_advance_prep, nasba_delivery_method
ON courses
FOR EACH ROW
EXECUTE FUNCTION public.trg_course_sync_products();

-- New products also pick up a delivery format from their course.
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
  IF NEW.delivery_formats IS NULL OR array_length(NEW.delivery_formats, 1) IS NULL THEN
    NEW.delivery_formats := COALESCE(public.course_delivery_formats(c), NEW.delivery_formats);
  END IF;
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

-- Backfill. delivery_formats fills only where empty, so canonical audited
-- courses run FIRST: their methodology drives the "Live online" detection for
-- duplicate-linked rows before the duplicate course's coarser course_type
-- mapping can claim the slot. Directly linked courses then cover the rest.
DO $$
DECLARE
  r uuid;
BEGIN
  FOR r IN SELECT id FROM courses WHERE metadata->'catalog_audit'->>'imported_at' = '2026-07-02' LOOP
    PERFORM public.sync_products_from_course(r);
  END LOOP;
  FOR r IN SELECT DISTINCT course_id FROM products WHERE course_id IS NOT NULL LOOP
    PERFORM public.sync_products_from_course(r);
  END LOOP;
END;
$$;
