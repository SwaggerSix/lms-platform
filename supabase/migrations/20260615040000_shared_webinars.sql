-- Free, shareable webinars. is_free marks a no-cost session; is_shared offers it
-- to all client instances (tenants), which each opt in via shared_webinar_optins.

ALTER TABLE public.ilt_sessions
  ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ilt_sessions_shared ON public.ilt_sessions(is_shared) WHERE is_shared;

-- A client instance opts in to a shared webinar to show it to its learners.
CREATE TABLE IF NOT EXISTS public.shared_webinar_optins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ilt_sessions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opted_in BOOLEAN NOT NULL DEFAULT true,
  opted_in_at TIMESTAMPTZ DEFAULT now(),
  opted_in_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_shared_optins_tenant ON public.shared_webinar_optins(tenant_id) WHERE opted_in;
CREATE INDEX IF NOT EXISTS idx_shared_optins_session ON public.shared_webinar_optins(session_id);

ALTER TABLE public.shared_webinar_optins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage webinar optins" ON public.shared_webinar_optins
  FOR ALL
  USING (current_user_role() IN ('admin', 'super_admin', 'manager', 'instructor'))
  WITH CHECK (current_user_role() IN ('admin', 'super_admin', 'manager', 'instructor'));
