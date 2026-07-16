-- DB1 (multi-role QA audit): add covering indexes for foreign keys that lacked
-- one. Unindexed FKs force sequential scans on joins and on cascade
-- delete/update of the parent row, which worsens as data grows. Each statement
-- is idempotent (IF NOT EXISTS) and additive — indexes only affect performance,
-- never correctness — so this migration is safe to re-run and safe to roll back
-- by dropping the indexes.
--
-- The exact set was derived from the live schema: every public FK whose columns
-- are not the leading columns of an existing index. Index *drops* (unused_index)
-- and the RLS initplan / duplicate-policy lints are intentionally NOT included
-- here — those carry correctness/behaviour risk and warrant separate review.

CREATE INDEX IF NOT EXISTS idx_analytics_alerts_course_id ON public.analytics_alerts (course_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_graded_by ON public.assessment_attempts (graded_by);
CREATE INDEX IF NOT EXISTS idx_cart_items_coupon_id ON public.cart_items (coupon_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_certificate_templates_created_by ON public.certificate_templates (created_by);
CREATE INDEX IF NOT EXISTS idx_certifications_recertification_course_id ON public.certifications (recertification_course_id);
CREATE INDEX IF NOT EXISTS idx_certifications_recertification_path_id ON public.certifications (recertification_path_id);
CREATE INDEX IF NOT EXISTS idx_certifications_template_id ON public.certifications (template_id);
CREATE INDEX IF NOT EXISTS idx_class_assessments_assessment_id ON public.class_assessments (assessment_id);
CREATE INDEX IF NOT EXISTS idx_class_assessments_created_by ON public.class_assessments (created_by);
CREATE INDEX IF NOT EXISTS idx_class_invitations_accepted_by ON public.class_invitations (accepted_by);
CREATE INDEX IF NOT EXISTS idx_class_invitations_invited_by ON public.class_invitations (invited_by);
CREATE INDEX IF NOT EXISTS idx_class_participants_invited_by ON public.class_participants (invited_by);
CREATE INDEX IF NOT EXISTS idx_classes_created_by ON public.classes (created_by);
CREATE INDEX IF NOT EXISTS idx_classes_instructor_id ON public.classes (instructor_id);
CREATE INDEX IF NOT EXISTS idx_compliance_requirements_course_id ON public.compliance_requirements (course_id);
CREATE INDEX IF NOT EXISTS idx_compliance_requirements_path_id ON public.compliance_requirements (path_id);
CREATE INDEX IF NOT EXISTS idx_content_templates_created_by ON public.content_templates (created_by);
CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON public.conversations (created_by);
CREATE INDEX IF NOT EXISTS idx_coupons_created_by ON public.coupons (created_by);
CREATE INDEX IF NOT EXISTS idx_course_instructors_assigned_by ON public.course_instructors (assigned_by);
CREATE INDEX IF NOT EXISTS idx_course_ratings_session_id ON public.course_ratings (session_id);
CREATE INDEX IF NOT EXISTS idx_course_ratings_user_id ON public.course_ratings (user_id);
CREATE INDEX IF NOT EXISTS idx_course_resources_uploaded_by ON public.course_resources (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_course_similarity_similar_course_id ON public.course_similarity (similar_course_id);
CREATE INDEX IF NOT EXISTS idx_course_skills_skill_id ON public.course_skills (skill_id);
CREATE INDEX IF NOT EXISTS idx_document_acknowledgments_user_id ON public.document_acknowledgments (user_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_created_by ON public.document_folders (created_by);
CREATE INDEX IF NOT EXISTS idx_documents_course_id ON public.documents (course_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_embed_widgets_created_by ON public.embed_widgets (created_by);
CREATE INDEX IF NOT EXISTS idx_enrollment_approvals_enrollment_id ON public.enrollment_approvals (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_rules_created_by ON public.enrollment_rules (created_by);
CREATE INDEX IF NOT EXISTS idx_enrollments_assigned_by ON public.enrollments (assigned_by);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved_by ON public.error_logs (resolved_by);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_assignments_enrollment_id ON public.evaluation_assignments (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_assignments_template_id ON public.evaluation_assignments (template_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_templates_created_by ON public.evaluation_templates (created_by);
CREATE INDEX IF NOT EXISTS idx_evaluation_triggers_created_by ON public.evaluation_triggers (created_by);
CREATE INDEX IF NOT EXISTS idx_feedback_nominations_nominated_by ON public.feedback_nominations (nominated_by);
CREATE INDEX IF NOT EXISTS idx_ilt_sessions_external_integration_id ON public.ilt_sessions (external_integration_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_author_id ON public.kb_articles (author_id);
CREATE INDEX IF NOT EXISTS idx_kb_categories_parent_id ON public.kb_categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_learning_path_enrollments_path_id ON public.learning_path_enrollments (path_id);
CREATE INDEX IF NOT EXISTS idx_learning_path_items_course_id ON public.learning_path_items (course_id);
CREATE INDEX IF NOT EXISTS idx_learning_paths_created_by ON public.learning_paths (created_by);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson_id ON public.lesson_progress (lesson_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_providers_created_by ON public.marketplace_providers (created_by);
CREATE INDEX IF NOT EXISTS idx_mentor_reviews_reviewer_id ON public.mentor_reviews (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_goals_created_by ON public.mentorship_goals (created_by);
CREATE INDEX IF NOT EXISTS idx_mentorship_messages_sender_id ON public.mentorship_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_nudge_actions_created_by ON public.nudge_actions (created_by);
CREATE INDEX IF NOT EXISTS idx_nudge_assignments_campaign_enrollment_id ON public.nudge_assignments (campaign_enrollment_id);
CREATE INDEX IF NOT EXISTS idx_nudge_assignments_nudge_action_id ON public.nudge_assignments (nudge_action_id);
CREATE INDEX IF NOT EXISTS idx_nudge_assignments_organization_id ON public.nudge_assignments (organization_id);
CREATE INDEX IF NOT EXISTS idx_nudge_campaign_enrollments_assignee_id ON public.nudge_campaign_enrollments (assignee_id);
CREATE INDEX IF NOT EXISTS idx_nudge_campaign_items_nudge_action_id ON public.nudge_campaign_items (nudge_action_id);
CREATE INDEX IF NOT EXISTS idx_nudge_campaigns_created_by ON public.nudge_campaigns (created_by);
CREATE INDEX IF NOT EXISTS idx_nudge_send_log_daily_log_id ON public.nudge_send_log (daily_log_id);
CREATE INDEX IF NOT EXISTS idx_observation_attachments_uploaded_by ON public.observation_attachments (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_observations_sign_off_by ON public.observations (sign_off_by);
CREATE INDEX IF NOT EXISTS idx_product_inquiries_product_id ON public.product_inquiries (product_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_created_by ON public.scheduled_reports (created_by);
CREATE INDEX IF NOT EXISTS idx_shared_webinar_optins_opted_in_by ON public.shared_webinar_optins (opted_in_by);
CREATE INDEX IF NOT EXISTS idx_skills_parent_id ON public.skills (parent_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_invited_by ON public.tenant_invitations (invited_by);
CREATE INDEX IF NOT EXISTS idx_transcript_exports_requested_by ON public.transcript_exports (requested_by);
CREATE INDEX IF NOT EXISTS idx_transcript_exports_user_id ON public.transcript_exports (user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON public.user_badges (badge_id);
CREATE INDEX IF NOT EXISTS idx_user_certifications_certification_id ON public.user_certifications (certification_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_skill_id ON public.user_skills (skill_id);
CREATE INDEX IF NOT EXISTS idx_users_external_integration_id ON public.users (external_integration_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_false_step_id ON public.workflow_steps (false_step_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_next_step_id ON public.workflow_steps (next_step_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_true_step_id ON public.workflow_steps (true_step_id);
