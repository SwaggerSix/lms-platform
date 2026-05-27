-- =============================================================
-- Behavioral Nudges Feature (ported from coaching-platform)
-- Managers assign daily MicroActions to employees with a
-- morning-commit / evening-check-in nudge cycle over email + SMS,
-- plus multi-step campaigns. In-app commit/complete is also
-- supported. Token-based response pages allow employees to act
-- on a nudge straight from an email without logging in.
-- =============================================================

-- 1. Nudge Actions: reusable MicroAction library.
--    organization_id / created_by are NULLable so the platform can
--    ship a global seed library (NULL org = available to every org).
CREATE TABLE IF NOT EXISTS public.nudge_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General',
  estimated_minutes INTEGER NOT NULL DEFAULT 2,
  image_url TEXT DEFAULT '',
  quote TEXT DEFAULT '',
  quote_author TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nudge_actions_org ON public.nudge_actions(organization_id);
CREATE INDEX idx_nudge_actions_category ON public.nudge_actions(category);

-- 2. Nudge Assignments: a manager assigns an action to an employee.
--    assignee_id references the employee user; name/email/phone are
--    snapshotted so the cron sender and token pages work without a join.
CREATE TABLE IF NOT EXISTS public.nudge_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  nudge_action_id UUID NOT NULL REFERENCES public.nudge_actions(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assignee_name TEXT NOT NULL,
  assignee_email TEXT NOT NULL,
  assignee_phone TEXT DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed')) DEFAULT 'active',
  send_morning_email BOOLEAN NOT NULL DEFAULT true,
  send_morning_sms BOOLEAN NOT NULL DEFAULT false,
  send_evening_email BOOLEAN NOT NULL DEFAULT true,
  send_evening_sms BOOLEAN NOT NULL DEFAULT false,
  morning_send_time TIME NOT NULL DEFAULT '08:00',
  evening_send_time TIME NOT NULL DEFAULT '18:00',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  response_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  starts_on DATE NOT NULL DEFAULT CURRENT_DATE,
  ends_on DATE,
  campaign_id UUID,
  campaign_enrollment_id UUID,
  campaign_position INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX nudge_assignment_token_idx ON public.nudge_assignments(response_token);
CREATE INDEX idx_nudge_assignments_assignee ON public.nudge_assignments(assignee_id);
CREATE INDEX idx_nudge_assignments_assigned_by ON public.nudge_assignments(assigned_by);
CREATE INDEX idx_nudge_assignments_status ON public.nudge_assignments(status);
CREATE INDEX idx_nudge_assignments_campaign ON public.nudge_assignments(campaign_id);

-- 3. Nudge Daily Logs: one row per day per assignment.
CREATE TABLE IF NOT EXISTS public.nudge_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.nudge_assignments(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  morning_sent_at TIMESTAMPTZ,
  morning_channel TEXT,
  committed BOOLEAN,
  committed_at TIMESTAMPTZ,
  evening_sent_at TIMESTAMPTZ,
  evening_channel TEXT,
  completed BOOLEAN,
  completed_at TIMESTAMPTZ,
  reflection TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, log_date)
);
CREATE INDEX idx_nudge_daily_logs_assignment ON public.nudge_daily_logs(assignment_id);

-- 4. Nudge Streaks: one row per assignment tracking streak data.
CREATE TABLE IF NOT EXISTS public.nudge_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL UNIQUE REFERENCES public.nudge_assignments(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  total_committed INTEGER NOT NULL DEFAULT 0,
  total_completed INTEGER NOT NULL DEFAULT 0,
  last_completed_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Nudge Send Log: audit trail for every email/SMS sent.
CREATE TABLE IF NOT EXISTS public.nudge_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.nudge_assignments(id) ON DELETE CASCADE,
  daily_log_id UUID REFERENCES public.nudge_daily_logs(id) ON DELETE SET NULL,
  nudge_type TEXT NOT NULL CHECK (nudge_type IN ('morning', 'evening')),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  external_id TEXT DEFAULT '',
  error_message TEXT DEFAULT '',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nudge_send_log_assignment ON public.nudge_send_log(assignment_id);

-- 6. Nudge Activity Log: lightweight feed of commit/complete/swap/skip events.
CREATE TABLE IF NOT EXISTS public.nudge_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.nudge_assignments(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('committed', 'completed', 'skipped', 'swapped')),
  action_title TEXT DEFAULT '',
  reflection TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nudge_activity_assignment ON public.nudge_activity_log(assignment_id);

-- 7. Campaigns: named sequences of actions with per-employee enrollment.
CREATE TABLE IF NOT EXISTS public.nudge_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','every_other_day','weekdays','custom')),
  frequency_days INT,
  send_morning_email BOOLEAN NOT NULL DEFAULT TRUE,
  send_morning_sms BOOLEAN NOT NULL DEFAULT FALSE,
  send_evening_email BOOLEAN NOT NULL DEFAULT TRUE,
  send_evening_sms BOOLEAN NOT NULL DEFAULT FALSE,
  morning_send_time TEXT NOT NULL DEFAULT '08:00',
  evening_send_time TEXT NOT NULL DEFAULT '18:00',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed')),
  total_nudges INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nudge_campaigns_org ON public.nudge_campaigns(organization_id);

CREATE TABLE IF NOT EXISTS public.nudge_campaign_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.nudge_campaigns(id) ON DELETE CASCADE,
  nudge_action_id UUID NOT NULL REFERENCES public.nudge_actions(id) ON DELETE CASCADE,
  position INT NOT NULL,
  UNIQUE(campaign_id, position)
);

CREATE TABLE IF NOT EXISTS public.nudge_campaign_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.nudge_campaigns(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  assignee_name TEXT NOT NULL,
  assignee_email TEXT NOT NULL,
  assignee_phone TEXT DEFAULT '',
  current_position INT NOT NULL DEFAULT 1,
  current_assignment_id UUID,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nudge_campaign_enrollments_campaign ON public.nudge_campaign_enrollments(campaign_id);

-- Now that campaign tables exist, wire up the FKs from assignments.
ALTER TABLE public.nudge_assignments
  ADD CONSTRAINT nudge_assignments_campaign_fk
    FOREIGN KEY (campaign_id) REFERENCES public.nudge_campaigns(id) ON DELETE SET NULL,
  ADD CONSTRAINT nudge_assignments_campaign_enrollment_fk
    FOREIGN KEY (campaign_enrollment_id) REFERENCES public.nudge_campaign_enrollments(id) ON DELETE SET NULL;

-- =============================================================
-- Row Level Security
-- Server code uses the service-role client (bypasses RLS); these
-- policies are a defense-in-depth layer matching the platform's
-- current_user_id() / current_user_role() helpers.
-- =============================================================
ALTER TABLE public.nudge_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nudge_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nudge_daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nudge_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nudge_send_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nudge_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nudge_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nudge_campaign_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nudge_campaign_enrollments ENABLE ROW LEVEL SECURITY;

-- Actions: anyone can read active actions in their org or the global library;
-- managers/admins manage their own; admins manage all.
CREATE POLICY "Read nudge actions" ON public.nudge_actions FOR SELECT
  USING (is_active = true OR created_by = public.current_user_id() OR public.current_user_role() IN ('admin','super_admin'));
CREATE POLICY "Managers create nudge actions" ON public.nudge_actions FOR INSERT
  WITH CHECK (public.current_user_role() IN ('manager','admin','super_admin'));
CREATE POLICY "Managers update own nudge actions" ON public.nudge_actions FOR UPDATE
  USING (created_by = public.current_user_id() OR public.current_user_role() IN ('admin','super_admin'));
CREATE POLICY "Managers delete own nudge actions" ON public.nudge_actions FOR DELETE
  USING (created_by = public.current_user_id() OR public.current_user_role() IN ('admin','super_admin'));

-- Assignments: the assignee can read theirs; the assigning manager and admins manage them.
CREATE POLICY "Read own nudge assignments" ON public.nudge_assignments FOR SELECT
  USING (assignee_id = public.current_user_id() OR assigned_by = public.current_user_id() OR public.current_user_role() IN ('admin','super_admin'));
CREATE POLICY "Managers manage nudge assignments" ON public.nudge_assignments FOR ALL
  USING (assigned_by = public.current_user_id() OR public.current_user_role() IN ('admin','super_admin'))
  WITH CHECK (public.current_user_role() IN ('manager','admin','super_admin'));

-- Daily logs / streaks / send log / activity: readable by assignee, assigning manager, or admin.
CREATE POLICY "Read nudge daily logs" ON public.nudge_daily_logs FOR SELECT
  USING (assignment_id IN (SELECT id FROM public.nudge_assignments
    WHERE assignee_id = public.current_user_id() OR assigned_by = public.current_user_id())
    OR public.current_user_role() IN ('admin','super_admin'));
CREATE POLICY "Read nudge streaks" ON public.nudge_streaks FOR SELECT
  USING (assignment_id IN (SELECT id FROM public.nudge_assignments
    WHERE assignee_id = public.current_user_id() OR assigned_by = public.current_user_id())
    OR public.current_user_role() IN ('admin','super_admin'));
CREATE POLICY "Read nudge send log" ON public.nudge_send_log FOR SELECT
  USING (assignment_id IN (SELECT id FROM public.nudge_assignments
    WHERE assigned_by = public.current_user_id())
    OR public.current_user_role() IN ('admin','super_admin'));
CREATE POLICY "Read nudge activity" ON public.nudge_activity_log FOR SELECT
  USING (assignment_id IN (SELECT id FROM public.nudge_assignments
    WHERE assignee_id = public.current_user_id() OR assigned_by = public.current_user_id())
    OR public.current_user_role() IN ('admin','super_admin'));

-- Campaigns: managers manage their own, admins manage all.
CREATE POLICY "Manage nudge campaigns" ON public.nudge_campaigns FOR ALL
  USING (created_by = public.current_user_id() OR public.current_user_role() IN ('admin','super_admin'))
  WITH CHECK (public.current_user_role() IN ('manager','admin','super_admin'));
CREATE POLICY "Manage nudge campaign items" ON public.nudge_campaign_items FOR ALL
  USING (campaign_id IN (SELECT id FROM public.nudge_campaigns
    WHERE created_by = public.current_user_id()) OR public.current_user_role() IN ('admin','super_admin'));
CREATE POLICY "Manage nudge campaign enrollments" ON public.nudge_campaign_enrollments FOR ALL
  USING (campaign_id IN (SELECT id FROM public.nudge_campaigns
    WHERE created_by = public.current_user_id()) OR public.current_user_role() IN ('admin','super_admin'));

-- =============================================================
-- Storage bucket for nudge action images
-- =============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('nudge-images', 'nudge-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload nudge images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'nudge-images');
CREATE POLICY "Anyone can view nudge images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'nudge-images');
CREATE POLICY "Authenticated users can delete nudge images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'nudge-images');

-- =============================================================
-- Seed: global MicroAction library (organization_id / created_by NULL).
-- Categories mirror the coaching platform taxonomy.
-- =============================================================
INSERT INTO public.nudge_actions (title, description, category, estimated_minutes, quote) VALUES
  ('Clarify today''s top priority', 'Write down the single most important outcome you want to achieve today and why it matters.', 'Purpose', 3, 'The key is not to prioritize what''s on your schedule, but to schedule your priorities.'),
  ('Connect a task to the bigger picture', 'Pick one task on your list and note how it ladders up to your team or company goals.', 'Strategy', 3, ''),
  ('Live a core value out loud', 'Choose one of your team''s values and take one concrete action today that demonstrates it.', 'Values', 5, ''),
  ('Eliminate one time-waster', 'Identify a recurring task that adds little value and decide how to reduce, automate, or stop it.', 'Efficiency', 5, ''),
  ('Ask a customer-focused question', 'In your next interaction, ask one question that uncovers what the customer truly needs.', 'Customer', 2, ''),
  ('Offer help before being asked', 'Reach out to a colleague who looks stretched and offer specific, concrete support.', 'Collaboration', 5, ''),
  ('Delegate with trust', 'Hand off a task you''d normally keep, and give the person room to own the outcome.', 'Empowered Teams', 5, ''),
  ('Teach something you know', 'Share a tip, shortcut, or lesson with a teammate to build collective capability.', 'Capability Development', 5, ''),
  ('Learn something new for 10 minutes', 'Spend ten focused minutes on an article, video, or course relevant to your growth.', 'Learning', 10, 'Live as if you were to die tomorrow. Learn as if you were to live forever.'),
  ('Reframe a change as an opportunity', 'Pick a change you''re resisting and write one genuine upside it could create.', 'Change Ready', 5, ''),
  ('Anticipate a future need', 'Spend five minutes imagining what your team will need in three months and one step to prepare.', 'Future Focused', 5, ''),
  ('Strengthen a community tie', 'Reach out to someone in your broader network or community with a thoughtful note.', 'Community', 3, ''),
  ('Invite a dissenting view', 'In a discussion today, explicitly ask, "What might we be missing?" and listen fully.', 'Psychological Safety', 3, ''),
  ('Check your assumptions about others', 'Notice one assumption you''re making about a colleague and seek to understand their perspective.', 'DEIA', 5, ''),
  ('Take a real break', 'Step away from screens for five minutes: stretch, breathe, or walk. Protect your energy.', 'Wellbeing', 5, 'Almost everything will work again if you unplug it for a few minutes, including you.'),
  ('Reflect on one win', 'At the end of the day, write down one thing that went well and why.', 'General', 3, '');
