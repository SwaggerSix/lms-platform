-- Instructor professional certifications (e.g. NASBA/CPA), tracked as a
-- requirement. Each row is one credential held by an instructor, with issue and
-- expiry dates so expirations can be surfaced.

CREATE TABLE IF NOT EXISTS public.instructor_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  credential_type TEXT NOT NULL DEFAULT 'nasba'
    CHECK (credential_type IN ('nasba', 'cpa', 'other')),
  license_number TEXT,
  issuing_body TEXT,
  issuing_state TEXT,
  issued_date DATE,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'revoked', 'pending')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instructor_certs_user ON public.instructor_certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_instructor_certs_expiry ON public.instructor_certifications(expiry_date);

ALTER TABLE public.instructor_certifications ENABLE ROW LEVEL SECURITY;

-- Instructors manage their own certifications.
CREATE POLICY "Users manage own certifications" ON public.instructor_certifications
  FOR ALL
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());

-- Staff manage/read all (for the NASBA tracking requirement).
CREATE POLICY "Staff manage certifications" ON public.instructor_certifications
  FOR ALL
  USING (current_user_role() IN ('admin', 'super_admin', 'manager'))
  WITH CHECK (current_user_role() IN ('admin', 'super_admin', 'manager'));
