-- Security hardening (from security review):
-- 1. Enable RLS on mentorship tables that were left without it. All app access
--    goes through API routes using the service-role client, which bypasses RLS,
--    so no app-facing policies are needed — this closes direct PostgREST access
--    with the anon/authenticated keys.
-- 2. Replace always-true write policies on content_blocks / content_templates
--    (any signed-in user could insert/update/delete course content directly via
--    PostgREST). Writes now go only through the service role.
-- 3. Lock down SECURITY DEFINER helper functions exposed to anon, and pin
--    search_path on flagged functions.

-- ── 1. Mentorship tables: enable RLS (service role bypasses RLS) ──────────────
alter table public.mentorship_goals enable row level security;
alter table public.mentorship_messages enable row level security;
alter table public.mentorship_circles enable row level security;
alter table public.mentorship_circle_members enable row level security;

-- ── 2. content_blocks / content_templates: drop always-true write policies ────
drop policy if exists "content_blocks_insert" on public.content_blocks;
drop policy if exists "content_blocks_update" on public.content_blocks;
drop policy if exists "content_blocks_delete" on public.content_blocks;

drop policy if exists "content_templates_insert" on public.content_templates;
drop policy if exists "content_templates_update" on public.content_templates;
drop policy if exists "content_templates_delete" on public.content_templates;

-- Writes happen exclusively through API routes using the service role; no
-- replacement policies are required (RLS with no policy = deny for anon/auth).

drop policy if exists "System can insert assignments" on public.evaluation_assignments;
drop policy if exists "System insert audit logs" on public.audit_logs;
drop policy if exists "System insert cron runs" on public.cron_runs;

-- ── 3. SECURITY DEFINER helpers: remove anon execute, pin search_path ─────────
-- Note: EXECUTE is granted to PUBLIC by default, so revoking from anon alone
-- is not enough — revoke from PUBLIC too, then re-grant to authenticated
-- (RLS policies call these helpers) and service_role.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('current_user_id', 'current_user_role', 'get_my_id', 'get_my_role')
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
    execute format('alter function %s set search_path = public', r.sig);
  end loop;
end $$;

-- Pin search_path on trigger/helper functions flagged by the linter.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'update_updated_at',
        'update_updated_at_column',
        'check_course_completion',
        'get_user_points',
        'update_content_blocks_updated_at',
        'update_workflows_updated_at',
        'update_tenants_updated_at',
        'update_evaluation_templates_updated_at'
      )
  loop
    execute format('alter function %s set search_path = public', r.sig);
  end loop;
end $$;
