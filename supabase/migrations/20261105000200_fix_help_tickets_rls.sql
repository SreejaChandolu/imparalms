-- ====================================================================
-- IMPARA LMS: STRICT HELP TICKETS RLS POLICIES
-- Migration: 20261105000200_fix_help_tickets_rls.sql
-- Description:
--   Ensures a student can only INSERT a ticket for themselves with
--   user_id = auth.uid(), status = 'open', and reply = NULL.
--   Ensures students can SELECT only their own tickets (admins see all).
--   Does NOT drop any tables or delete any data.
-- ====================================================================

-- 1. Tighten INSERT policy on help_tickets
DROP POLICY IF EXISTS "tickets_insert_policy" ON public.help_tickets;

CREATE POLICY "tickets_insert_policy" ON public.help_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      user_id = auth.uid()
      AND status = 'open'
      AND reply IS NULL
    )
  );

-- 2. Confirm SELECT policy on help_tickets (students only see their own tickets)
DROP POLICY IF EXISTS "tickets_select_policy" ON public.help_tickets;

CREATE POLICY "tickets_select_policy" ON public.help_tickets
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
  );
