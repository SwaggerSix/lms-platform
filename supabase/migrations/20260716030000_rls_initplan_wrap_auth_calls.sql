-- DB1 (multi-role QA audit): remediate the `auth_rls_initplan` performance lint.
--
-- These RLS policies called auth.uid() / auth.role() directly, so Postgres
-- re-evaluated the function for EVERY row scanned. Wrapping the call in a
-- scalar subquery — (select auth.uid()) — turns it into a one-time InitPlan
-- evaluated once per query. This is the fix Supabase recommends and it is
-- semantics-preserving: auth.uid()/auth.role() are STABLE and the subquery
-- returns the identical value, so row visibility is unchanged — only the
-- per-row re-evaluation cost is removed. The benefit grows with table size.
--
-- Each policy is dropped and recreated with its definition otherwise byte-for-
-- byte identical (same role, command, USING/WITH CHECK). The set was generated
-- from the live schema; only auth.uid()/auth.role() were rewritten (helper
-- functions like get_my_role()/get_my_id() are intentionally left untouched).

DROP POLICY IF EXISTS "Users can update own alerts" ON public.analytics_alerts;
CREATE POLICY "Users can update own alerts" ON public.analytics_alerts AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can view own alerts" ON public.analytics_alerts;
CREATE POLICY "Users can view own alerts" ON public.analytics_alerts AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS attempts_insert ON public.assessment_attempts;
CREATE POLICY attempts_insert ON public.assessment_attempts AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id IN ( SELECT users.id
   FROM users
  WHERE (users.auth_id = (select auth.uid())))));

DROP POLICY IF EXISTS attempts_select ON public.assessment_attempts;
CREATE POLICY attempts_select ON public.assessment_attempts AS PERMISSIVE FOR SELECT TO public
  USING (((user_id IN ( SELECT users.id
   FROM users
  WHERE (users.auth_id = (select auth.uid())))) OR (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.auth_id = (select auth.uid())) AND (u.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))))));

DROP POLICY IF EXISTS "Admins manage calendar events" ON public.calendar_events;
CREATE POLICY "Admins manage calendar events" ON public.calendar_events AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));

DROP POLICY IF EXISTS "Users manage own calendar events" ON public.calendar_events;
CREATE POLICY "Users manage own calendar events" ON public.calendar_events AS PERMISSIVE FOR ALL TO public
  USING ((user_id = ( SELECT users.id
   FROM users
  WHERE (users.auth_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Admins manage certificate templates" ON public.certificate_templates;
CREATE POLICY "Admins manage certificate templates" ON public.certificate_templates AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));

DROP POLICY IF EXISTS "Authenticated read class assessments" ON public.class_assessments;
CREATE POLICY "Authenticated read class assessments" ON public.class_assessments AS PERMISSIVE FOR SELECT TO public
  USING (((select auth.uid()) IS NOT NULL));

DROP POLICY IF EXISTS "Authenticated can read classes" ON public.classes;
CREATE POLICY "Authenticated can read classes" ON public.classes AS PERMISSIVE FOR SELECT TO public
  USING (((select auth.uid()) IS NOT NULL));

DROP POLICY IF EXISTS "Admins manage prerequisites" ON public.course_prerequisites;
CREATE POLICY "Admins manage prerequisites" ON public.course_prerequisites AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));

DROP POLICY IF EXISTS "Authenticated can read course resources" ON public.course_resources;
CREATE POLICY "Authenticated can read course resources" ON public.course_resources AS PERMISSIVE FOR SELECT TO public
  USING (((select auth.uid()) IS NOT NULL));

DROP POLICY IF EXISTS course_translations_delete ON public.course_translations;
CREATE POLICY course_translations_delete ON public.course_translations AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text, 'instructor'::text]))))));

DROP POLICY IF EXISTS course_translations_insert ON public.course_translations;
CREATE POLICY course_translations_insert ON public.course_translations AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text, 'instructor'::text]))))));

DROP POLICY IF EXISTS course_translations_update ON public.course_translations;
CREATE POLICY course_translations_update ON public.course_translations AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text, 'instructor'::text]))))));

DROP POLICY IF EXISTS discussions_insert ON public.discussions;
CREATE POLICY discussions_insert ON public.discussions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id IN ( SELECT users.id
   FROM users
  WHERE (users.auth_id = (select auth.uid())))));

DROP POLICY IF EXISTS discussions_update ON public.discussions;
CREATE POLICY discussions_update ON public.discussions AS PERMISSIVE FOR UPDATE TO public
  USING (((user_id IN ( SELECT users.id
   FROM users
  WHERE (users.auth_id = (select auth.uid())))) OR (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.auth_id = (select auth.uid())) AND (u.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))))));

DROP POLICY IF EXISTS "Admins manage embed widgets" ON public.embed_widgets;
CREATE POLICY "Admins manage embed widgets" ON public.embed_widgets AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));

DROP POLICY IF EXISTS "Admins view enrollment rule logs" ON public.enrollment_rule_logs;
CREATE POLICY "Admins view enrollment rule logs" ON public.enrollment_rule_logs AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));

DROP POLICY IF EXISTS "Admins manage enrollment rules" ON public.enrollment_rules;
CREATE POLICY "Admins manage enrollment rules" ON public.enrollment_rules AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));

DROP POLICY IF EXISTS "Admins manage error logs" ON public.error_logs;
CREATE POLICY "Admins manage error logs" ON public.error_logs AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));

DROP POLICY IF EXISTS "Admins view error logs" ON public.error_logs;
CREATE POLICY "Admins view error logs" ON public.error_logs AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));

DROP POLICY IF EXISTS "Admins see all assignments" ON public.evaluation_assignments;
CREATE POLICY "Admins see all assignments" ON public.evaluation_assignments AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text, 'manager'::text]))))));

DROP POLICY IF EXISTS "Users see their own assignments" ON public.evaluation_assignments;
CREATE POLICY "Users see their own assignments" ON public.evaluation_assignments AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Admins can view all responses" ON public.evaluation_responses;
CREATE POLICY "Admins can view all responses" ON public.evaluation_responses AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text, 'manager'::text]))))));

DROP POLICY IF EXISTS "Users manage their own responses" ON public.evaluation_responses;
CREATE POLICY "Users manage their own responses" ON public.evaluation_responses AS PERMISSIVE FOR ALL TO authenticated
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Admins manage evaluation templates" ON public.evaluation_templates;
CREATE POLICY "Admins manage evaluation templates" ON public.evaluation_templates AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));

DROP POLICY IF EXISTS "Admins manage evaluation triggers" ON public.evaluation_triggers;
CREATE POLICY "Admins manage evaluation triggers" ON public.evaluation_triggers AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));

DROP POLICY IF EXISTS "Admins can view sync logs" ON public.integration_sync_logs;
CREATE POLICY "Admins can view sync logs" ON public.integration_sync_logs AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Users can view own snapshots" ON public.learning_analytics_snapshots;
CREATE POLICY "Users can view own snapshots" ON public.learning_analytics_snapshots AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users manage own learning events" ON public.learning_events;
CREATE POLICY "Users manage own learning events" ON public.learning_events AS PERMISSIVE FOR ALL TO public
  USING ((user_id = ( SELECT users.id
   FROM users
  WHERE (users.auth_id = (select auth.uid())))));

DROP POLICY IF EXISTS lesson_progress_all ON public.lesson_progress;
CREATE POLICY lesson_progress_all ON public.lesson_progress AS PERMISSIVE FOR ALL TO public
  USING ((user_id IN ( SELECT users.id
   FROM users
  WHERE (users.auth_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Admins can manage lrs configurations" ON public.lrs_configurations;
CREATE POLICY "Admins can manage lrs configurations" ON public.lrs_configurations AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Service role can manage lrs configurations" ON public.lrs_configurations;
CREATE POLICY "Service role can manage lrs configurations" ON public.lrs_configurations AS PERMISSIVE FOR ALL TO public
  USING (((select auth.role()) = 'service_role'::text));

DROP POLICY IF EXISTS "Admins manage marketplace courses" ON public.marketplace_courses;
CREATE POLICY "Admins manage marketplace courses" ON public.marketplace_courses AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));

DROP POLICY IF EXISTS "Users manage own marketplace enrollments" ON public.marketplace_enrollments;
CREATE POLICY "Users manage own marketplace enrollments" ON public.marketplace_enrollments AS PERMISSIVE FOR ALL TO public
  USING ((user_id = ( SELECT users.id
   FROM users
  WHERE (users.auth_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Admins manage marketplace providers" ON public.marketplace_providers;
CREATE POLICY "Admins manage marketplace providers" ON public.marketplace_providers AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));

DROP POLICY IF EXISTS "Anyone can view active providers" ON public.marketplace_providers;
CREATE POLICY "Anyone can view active providers" ON public.marketplace_providers AS PERMISSIVE FOR SELECT TO public
  USING (((is_active = true) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))))));

DROP POLICY IF EXISTS "Admins manage nuggets" ON public.microlearning_nuggets;
CREATE POLICY "Admins manage nuggets" ON public.microlearning_nuggets AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));

DROP POLICY IF EXISTS "Anyone can view active nuggets" ON public.microlearning_nuggets;
CREATE POLICY "Anyone can view active nuggets" ON public.microlearning_nuggets AS PERMISSIVE FOR SELECT TO public
  USING (((is_active = true) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))))));

DROP POLICY IF EXISTS "Users manage own microlearning progress" ON public.microlearning_progress;
CREATE POLICY "Users manage own microlearning progress" ON public.microlearning_progress AS PERMISSIVE FOR ALL TO public
  USING ((user_id = ( SELECT users.id
   FROM users
  WHERE (users.auth_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Users manage own microlearning schedules" ON public.microlearning_schedules;
CREATE POLICY "Users manage own microlearning schedules" ON public.microlearning_schedules AS PERMISSIVE FOR ALL TO public
  USING ((user_id = ( SELECT users.id
   FROM users
  WHERE (users.auth_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Users can view own risk predictions" ON public.risk_predictions;
CREATE POLICY "Users can view own risk predictions" ON public.risk_predictions AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Admins manage SSO" ON public.sso_providers;
CREATE POLICY "Admins manage SSO" ON public.sso_providers AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));

DROP POLICY IF EXISTS tenant_courses_select ON public.tenant_courses;
CREATE POLICY tenant_courses_select ON public.tenant_courses AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM (tenant_memberships tm
     JOIN users u ON ((u.id = tm.user_id)))
  WHERE ((tm.tenant_id = tenant_courses.tenant_id) AND (u.auth_id = (select auth.uid()))))));

DROP POLICY IF EXISTS tenant_invitations_select ON public.tenant_invitations;
CREATE POLICY tenant_invitations_select ON public.tenant_invitations AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM (tenant_memberships tm
     JOIN users u ON ((u.id = tm.user_id)))
  WHERE ((tm.tenant_id = tenant_invitations.tenant_id) AND (u.auth_id = (select auth.uid())) AND (tm.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

DROP POLICY IF EXISTS tenant_memberships_select ON public.tenant_memberships;
CREATE POLICY tenant_memberships_select ON public.tenant_memberships AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM (tenant_memberships tm
     JOIN users u ON ((u.id = tm.user_id)))
  WHERE ((tm.tenant_id = tenant_memberships.tenant_id) AND (u.auth_id = (select auth.uid()))))));

DROP POLICY IF EXISTS tenants_select ON public.tenants;
CREATE POLICY tenants_select ON public.tenants AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM (tenant_memberships tm
     JOIN users u ON ((u.id = tm.user_id)))
  WHERE ((tm.tenant_id = tenants.id) AND (u.auth_id = (select auth.uid()))))));

DROP POLICY IF EXISTS user_certs_select ON public.user_certifications;
CREATE POLICY user_certs_select ON public.user_certifications AS PERMISSIVE FOR SELECT TO public
  USING (((user_id IN ( SELECT users.id
   FROM users
  WHERE (users.auth_id = (select auth.uid())))) OR (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.auth_id = (select auth.uid())) AND (u.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))))));

DROP POLICY IF EXISTS "Users manage own preferences" ON public.user_learning_preferences;
CREATE POLICY "Users manage own preferences" ON public.user_learning_preferences AS PERMISSIVE FOR ALL TO public
  USING ((user_id = ( SELECT users.id
   FROM users
  WHERE (users.auth_id = (select auth.uid())))));

DROP POLICY IF EXISTS users_select ON public.users;
CREATE POLICY users_select ON public.users AS PERMISSIVE FOR SELECT TO public
  USING ((((select auth.uid()) = auth_id) OR (get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text])) OR ((get_my_role() = 'manager'::text) AND (manager_id = get_my_id()))));

DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_update ON public.users AS PERMISSIVE FOR UPDATE TO public
  USING ((((select auth.uid()) = auth_id) OR (get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]))));

DROP POLICY IF EXISTS "Admins manage VC integrations" ON public.vc_integrations;
CREATE POLICY "Admins manage VC integrations" ON public.vc_integrations AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));

DROP POLICY IF EXISTS "Admin full access on workflow_runs" ON public.workflow_runs;
CREATE POLICY "Admin full access on workflow_runs" ON public.workflow_runs AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Admin full access on workflow_step_logs" ON public.workflow_step_logs;
CREATE POLICY "Admin full access on workflow_step_logs" ON public.workflow_step_logs AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Admin full access on workflow_steps" ON public.workflow_steps;
CREATE POLICY "Admin full access on workflow_steps" ON public.workflow_steps AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Admin full access on workflows" ON public.workflows;
CREATE POLICY "Admin full access on workflows" ON public.workflows AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Authenticated users can read activity profiles" ON public.xapi_activity_profile;
CREATE POLICY "Authenticated users can read activity profiles" ON public.xapi_activity_profile AS PERMISSIVE FOR SELECT TO public
  USING (((select auth.role()) = 'authenticated'::text));

DROP POLICY IF EXISTS "Service role can manage activity profiles" ON public.xapi_activity_profile;
CREATE POLICY "Service role can manage activity profiles" ON public.xapi_activity_profile AS PERMISSIVE FOR ALL TO public
  USING (((select auth.role()) = 'service_role'::text));

DROP POLICY IF EXISTS "Service role can manage activity state" ON public.xapi_activity_state;
CREATE POLICY "Service role can manage activity state" ON public.xapi_activity_state AS PERMISSIVE FOR ALL TO public
  USING (((select auth.role()) = 'service_role'::text));

DROP POLICY IF EXISTS "Users can manage own activity state" ON public.xapi_activity_state;
CREATE POLICY "Users can manage own activity state" ON public.xapi_activity_state AS PERMISSIVE FOR ALL TO public
  USING ((agent_id = ( SELECT users.id
   FROM users
  WHERE (users.auth_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Admins can view all xapi statements" ON public.xapi_statements;
CREATE POLICY "Admins can view all xapi statements" ON public.xapi_statements AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Service role can manage xapi statements" ON public.xapi_statements;
CREATE POLICY "Service role can manage xapi statements" ON public.xapi_statements AS PERMISSIVE FOR ALL TO public
  USING (((select auth.role()) = 'service_role'::text));

DROP POLICY IF EXISTS "Users can view own xapi statements" ON public.xapi_statements;
CREATE POLICY "Users can view own xapi statements" ON public.xapi_statements AS PERMISSIVE FOR SELECT TO public
  USING ((actor_id = ( SELECT users.id
   FROM users
  WHERE (users.auth_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Admins manage XR content" ON public.xr_content;
CREATE POLICY "Admins manage XR content" ON public.xr_content AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = (select auth.uid())) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));

DROP POLICY IF EXISTS "Authenticated users can view XR content" ON public.xr_content;
CREATE POLICY "Authenticated users can view XR content" ON public.xr_content AS PERMISSIVE FOR SELECT TO public
  USING (((select auth.uid()) IS NOT NULL));

DROP POLICY IF EXISTS "Users manage own XR sessions" ON public.xr_sessions;
CREATE POLICY "Users manage own XR sessions" ON public.xr_sessions AS PERMISSIVE FOR ALL TO public
  USING ((user_id = ( SELECT users.id
   FROM users
  WHERE (users.auth_id = (select auth.uid())))));
