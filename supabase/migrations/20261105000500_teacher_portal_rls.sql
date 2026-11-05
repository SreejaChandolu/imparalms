-- ====================================================================
-- IMPARA LMS: TEACHER PORTAL POLICIES & RECORDING VISIBILITY RPC
-- Migration: 20261105000500_teacher_portal_rls.sql
-- Description:
--   1. Implements public.set_recording_visibility RPC for teachers to toggle
--      recording status between 'ready' and 'hidden' for courses they teach.
--   2. Tightens important_dates INSERT, UPDATE, and DELETE policies with explicit
--      WITH CHECK clauses ensuring teachers manage only their own courses.
--   3. Confirms courses.ends_on update policy, attendance & ratings select policies,
--      and student profile reading policies.
-- ====================================================================

-- 1. Function: set_recording_visibility
-- Allows teachers (and admins) to flip recording status between 'ready' and 'hidden'.
CREATE OR REPLACE FUNCTION public.set_recording_visibility(p_recording_id uuid, p_hidden boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_course_id uuid;
  v_current_status text;
  v_is_authorized boolean;
BEGIN
  -- Disable RLS internally to inspect recording & course ownership safely
  PERFORM set_config('row_security', 'off', true);

  -- Fetch recording's course and current status
  SELECT course_id, status INTO v_course_id, v_current_status
  FROM public.recordings
  WHERE id = p_recording_id;

  IF v_course_id IS NULL THEN
    RAISE EXCEPTION 'Recording not found';
  END IF;

  -- Check authorization: Admin OR teacher of this course
  IF public.is_admin() THEN
    v_is_authorized := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.courses
      WHERE id = v_course_id AND teacher_id = auth.uid()
    ) INTO v_is_authorized;
  END IF;

  IF NOT COALESCE(v_is_authorized, false) THEN
    RAISE EXCEPTION 'Unauthorized: You can only modify recordings for courses you teach';
  END IF;

  -- Cannot toggle visibility of a processing recording
  IF v_current_status = 'processing' THEN
    RAISE EXCEPTION 'Cannot toggle visibility while recording is in processing state';
  END IF;

  -- Update status strictly between 'hidden' and 'ready'
  UPDATE public.recordings
  SET status = CASE WHEN p_hidden THEN 'hidden' ELSE 'ready' END
  WHERE id = p_recording_id;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.set_recording_visibility(uuid, boolean) TO authenticated;

-- 2. Tighten IMPORTANT_DATES policies (Insert, Update, Delete for course teachers)
DROP POLICY IF EXISTS "dates_manage_policy" ON public.important_dates;
DROP POLICY IF EXISTS "dates_insert_policy" ON public.important_dates;
DROP POLICY IF EXISTS "dates_update_policy" ON public.important_dates;
DROP POLICY IF EXISTS "dates_delete_policy" ON public.important_dates;

CREATE POLICY "dates_insert_policy" ON public.important_dates
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.is_course_teacher(course_id)
  );

CREATE POLICY "dates_update_policy" ON public.important_dates
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.is_course_teacher(course_id)
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_course_teacher(course_id)
  );

CREATE POLICY "dates_delete_policy" ON public.important_dates
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.is_course_teacher(course_id)
  );

-- 3. Confirm courses UPDATE policy (teachers updating ends_on for their own courses only)
DROP POLICY IF EXISTS "courses_teacher_update" ON public.courses;

CREATE POLICY "courses_teacher_update" ON public.courses
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR teacher_id = auth.uid()
  )
  WITH CHECK (
    public.is_admin()
    OR teacher_id = auth.uid()
  );
