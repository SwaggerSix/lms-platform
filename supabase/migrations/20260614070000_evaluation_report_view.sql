-- Reporting view that flattens each evaluation response with the dimensions
-- needed for marketing/insight reports: course, domain (category), instructor
-- (the cohort instructor the learner studied under), client (tenant), period.
--
-- Instructor is derived from the learner's most recent class participation for
-- that course; client from the learner's tenant membership. Both are
-- best-effort (LEFT JOIN), so responses without a class/tenant still appear.

CREATE OR REPLACE VIEW public.evaluation_report_rows AS
SELECT
  er.id               AS response_id,
  er.submitted_at     AS submitted_at,
  er.answers          AS answers,
  ea.user_id          AS user_id,
  ea.course_id        AS course_id,
  c.title             AS course_title,
  c.category_id       AS category_id,
  cat.name            AS category_name,
  ea.template_id      AS template_id,
  et.name             AS template_name,
  et.level            AS level,
  cls.instructor_id   AS instructor_id,
  NULLIF(TRIM(COALESCE(iu.first_name, '') || ' ' || COALESCE(iu.last_name, '')), '') AS instructor_name,
  tmm.tenant_id       AS tenant_id,
  t.name              AS client_name
FROM public.evaluation_responses er
JOIN public.evaluation_assignments ea ON ea.id = er.assignment_id
JOIN public.courses c ON c.id = ea.course_id
LEFT JOIN public.categories cat ON cat.id = c.category_id
LEFT JOIN public.evaluation_templates et ON et.id = ea.template_id
LEFT JOIN LATERAL (
  SELECT cl.instructor_id
  FROM public.class_participants cp
  JOIN public.classes cl ON cl.id = cp.class_id
  WHERE cp.user_id = ea.user_id AND cl.course_id = ea.course_id
  ORDER BY cp.enrolled_at DESC
  LIMIT 1
) cls ON true
LEFT JOIN public.users iu ON iu.id = cls.instructor_id
LEFT JOIN LATERAL (
  SELECT tm.tenant_id
  FROM public.tenant_memberships tm
  WHERE tm.user_id = ea.user_id
  LIMIT 1
) tmm ON true
LEFT JOIN public.tenants t ON t.id = tmm.tenant_id;
