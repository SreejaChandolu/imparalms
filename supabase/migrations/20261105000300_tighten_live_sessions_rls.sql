-- ====================================================================
-- IMPARA LMS: STRICT TEACHER LIVE SESSIONS RLS POLICIES
-- Migration: 20261105000300_tighten_live_sessions_rls.sql
-- Description:
--   Enforces that teachers can only INSERT, UPDATE, and DELETE live_sessions
--   where teacher_id = auth.uid() AND course_id is a course they teach.
--   Admins retain full access.
-- ====================================================================

-- 1. Drop existing loose manage policy
DROP POLICY IF EXISTS "sessions_manage_policy" ON public.live_sessions;
DROP POLICY IF EXISTS "sessions_insert_policy" ON public.live_sessions;
DROP POLICY IF EXISTS "sessions_update_policy" ON public.live_sessions;
DROP POLICY IF EXISTS "sessions_delete_policy" ON public.live_sessions;

-- 2. INSERT Policy: Admin OR (teacher_id = auth.uid() AND course taught by auth.uid())
CREATE POLICY "sessions_insert_policy" ON public.live_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      teacher_id = auth.uid()
      AND public.is_course_teacher(course_id)
    )
  );

-- 3. UPDATE Policy: Admin OR (teacher_id = auth.uid() AND course taught by auth.uid())
CREATE POLICY "sessions_update_policy" ON public.live_sessions
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      teacher_id = auth.uid()
      AND public.is_course_teacher(course_id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      teacher_id = auth.uid()
      AND public.is_course_teacher(course_id)
    )
  );

-- 4. DELETE Policy: Admin OR (teacher_id = auth.uid() AND course taught by auth.uid())
CREATE POLICY "sessions_delete_policy" ON public.live_sessions
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (
      teacher_id = auth.uid()
      AND public.is_course_teacher(course_id)
    )
  );
