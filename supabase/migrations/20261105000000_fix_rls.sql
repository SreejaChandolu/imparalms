-- ====================================================================
-- IMPARA LMS: FIX ROW LEVEL SECURITY (RLS) RECURSION
-- Migration: 20261105000000_fix_rls.sql
-- Description:
--   Prevents infinite recursion in RLS policies by implementing
--   SECURITY DEFINER helper functions that execute with row_security = off.
--   Does NOT drop any tables, views, or delete any user data.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. RECURSION-PROOF SECURITY DEFINER HELPER FUNCTIONS
-- --------------------------------------------------------------------

-- Function: Get current authenticated user's role without triggering RLS
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_role text;
BEGIN
  -- Temporarily disable row_security for this query to bypass RLS recursion
  PERFORM set_config('row_security', 'off', true);
  
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN v_user_role;
END;
$$;

-- Function: Check if current authenticated user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.current_user_role() = 'admin', false);
$$;

-- Function: Check if current authenticated user is a teacher
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.current_user_role() = 'teacher', false);
$$;

-- Function: Check if current authenticated user is a student
CREATE OR REPLACE FUNCTION public.is_student()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.current_user_role() = 'student', false);
$$;

-- Function: Check if current student is enrolled in a specific course (no RLS recursion)
CREATE OR REPLACE FUNCTION public.is_enrolled_in_course(p_course_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_enrolled boolean;
BEGIN
  PERFORM set_config('row_security', 'off', true);
  
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE course_id = p_course_id AND student_id = auth.uid()
  ) INTO v_enrolled;
  
  RETURN COALESCE(v_enrolled, false);
END;
$$;

-- Function: Check if current teacher is the instructor of a specific course (no RLS recursion)
CREATE OR REPLACE FUNCTION public.is_course_teacher(p_course_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_teaches boolean;
BEGIN
  PERFORM set_config('row_security', 'off', true);
  
  SELECT EXISTS (
    SELECT 1 FROM public.courses
    WHERE id = p_course_id AND teacher_id = auth.uid()
  ) INTO v_teaches;
  
  RETURN COALESCE(v_teaches, false);
END;
$$;

-- Function: Check if current teacher instructs the given student in any course
CREATE OR REPLACE FUNCTION public.is_teacher_of_student(p_student_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_instructor boolean;
BEGIN
  PERFORM set_config('row_security', 'off', true);
  
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.courses c ON c.id = e.course_id
    WHERE e.student_id = p_student_id
      AND c.teacher_id = auth.uid()
  ) INTO v_is_instructor;
  
  RETURN COALESCE(v_is_instructor, false);
END;
$$;

-- --------------------------------------------------------------------
-- 2. FIX PROFILES RLS POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;

-- Users can always see their own profile first; admins see all; teachers see their enrolled students
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin()
    OR (public.is_teacher() AND public.is_teacher_of_student(id))
  );

CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (id = auth.uid() AND role = public.current_user_role())
  )
  WITH CHECK (
    public.is_admin()
    OR (id = auth.uid() AND role = public.current_user_role())
  );

CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "profiles_delete_policy" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- --------------------------------------------------------------------
-- 3. FIX COURSES & ENROLLMENTS RLS POLICIES (Breaks mutual recursion)
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "courses_select_policy" ON public.courses;
DROP POLICY IF EXISTS "courses_teacher_insert" ON public.courses;
DROP POLICY IF EXISTS "courses_teacher_update" ON public.courses;
DROP POLICY IF EXISTS "courses_delete_policy" ON public.courses;

CREATE POLICY "courses_select_policy" ON public.courses
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR teacher_id = auth.uid()
    OR public.is_enrolled_in_course(id)
  );

CREATE POLICY "courses_teacher_insert" ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (public.is_teacher() AND teacher_id = auth.uid()));

CREATE POLICY "courses_teacher_update" ON public.courses
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR (public.is_teacher() AND teacher_id = auth.uid()))
  WITH CHECK (public.is_admin() OR (public.is_teacher() AND teacher_id = auth.uid()));

CREATE POLICY "courses_delete_policy" ON public.courses
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Enrollments:
DROP POLICY IF EXISTS "enrollments_select_policy" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_admin_manage" ON public.enrollments;

CREATE POLICY "enrollments_select_policy" ON public.enrollments
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR student_id = auth.uid()
    OR public.is_course_teacher(course_id)
  );

CREATE POLICY "enrollments_admin_manage" ON public.enrollments
  FOR ALL TO authenticated
  USING (public.is_admin());

-- --------------------------------------------------------------------
-- 4. FIX TOPICS & SESSIONS RLS POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "topics_select_policy" ON public.topics;
DROP POLICY IF EXISTS "topics_manage_policy" ON public.topics;

CREATE POLICY "topics_select_policy" ON public.topics
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.is_course_teacher(course_id)
    OR public.is_enrolled_in_course(course_id)
  );

CREATE POLICY "topics_manage_policy" ON public.topics
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR public.is_course_teacher(course_id)
  );

DROP POLICY IF EXISTS "sessions_select_policy" ON public.live_sessions;
DROP POLICY IF EXISTS "sessions_manage_policy" ON public.live_sessions;

CREATE POLICY "sessions_select_policy" ON public.live_sessions
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR teacher_id = auth.uid()
    OR public.is_enrolled_in_course(course_id)
  );

CREATE POLICY "sessions_manage_policy" ON public.live_sessions
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR teacher_id = auth.uid()
  );

-- --------------------------------------------------------------------
-- 5. FIX RECORDINGS & PROGRESS RLS POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "recordings_select_policy" ON public.recordings;
DROP POLICY IF EXISTS "recordings_manage_policy" ON public.recordings;

CREATE POLICY "recordings_select_policy" ON public.recordings
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.is_course_teacher(course_id)
    OR (public.is_enrolled_in_course(course_id) AND status = 'ready')
  );

CREATE POLICY "recordings_manage_policy" ON public.recordings
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR public.is_course_teacher(course_id)
  );

DROP POLICY IF EXISTS "progress_select_policy" ON public.lesson_progress;
DROP POLICY IF EXISTS "progress_insert_update_student" ON public.lesson_progress;

CREATE POLICY "progress_select_policy" ON public.lesson_progress
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR public.is_course_teacher((SELECT course_id FROM public.recordings WHERE id = recording_id))
  );

CREATE POLICY "progress_insert_update_student" ON public.lesson_progress
  FOR ALL TO authenticated
  USING (public.is_admin() OR user_id = auth.uid())
  WITH CHECK (public.is_admin() OR user_id = auth.uid());

-- --------------------------------------------------------------------
-- 6. FIX ATTENDANCE & RATINGS RLS POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "attendance_select_policy" ON public.attendance;
DROP POLICY IF EXISTS "attendance_manage_policy" ON public.attendance;

CREATE POLICY "attendance_select_policy" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR public.is_course_teacher((SELECT course_id FROM public.live_sessions WHERE id = session_id))
  );

CREATE POLICY "attendance_manage_policy" ON public.attendance
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR public.is_course_teacher((SELECT course_id FROM public.live_sessions WHERE id = session_id))
  );

DROP POLICY IF EXISTS "ratings_select_policy" ON public.class_ratings;
DROP POLICY IF EXISTS "ratings_insert_update_student" ON public.class_ratings;

CREATE POLICY "ratings_select_policy" ON public.class_ratings
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR public.is_course_teacher((SELECT course_id FROM public.live_sessions WHERE id = session_id))
  );

CREATE POLICY "ratings_insert_update_student" ON public.class_ratings
  FOR ALL TO authenticated
  USING (public.is_admin() OR user_id = auth.uid())
  WITH CHECK (public.is_admin() OR user_id = auth.uid());

-- --------------------------------------------------------------------
-- 7. FIX ASSESSMENTS & QUESTIONS RLS POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "assessments_select_policy" ON public.assessments;
DROP POLICY IF EXISTS "assessments_manage_policy" ON public.assessments;

CREATE POLICY "assessments_select_policy" ON public.assessments
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.is_course_teacher(course_id)
    OR public.is_enrolled_in_course(course_id)
  );

CREATE POLICY "assessments_manage_policy" ON public.assessments
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR public.is_course_teacher(course_id)
  );

DROP POLICY IF EXISTS "questions_select_policy" ON public.assessment_questions;
DROP POLICY IF EXISTS "questions_manage_policy" ON public.assessment_questions;

CREATE POLICY "questions_select_policy" ON public.assessment_questions
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.is_course_teacher((SELECT course_id FROM public.assessments WHERE id = assessment_id))
    OR public.is_enrolled_in_course((SELECT course_id FROM public.assessments WHERE id = assessment_id))
  );

CREATE POLICY "questions_manage_policy" ON public.assessment_questions
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR public.is_course_teacher((SELECT course_id FROM public.assessments WHERE id = assessment_id))
  );

-- --------------------------------------------------------------------
-- 8. FIX IMPORTANT DATES RLS POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "dates_select_policy" ON public.important_dates;
DROP POLICY IF EXISTS "dates_manage_policy" ON public.important_dates;

CREATE POLICY "dates_select_policy" ON public.important_dates
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.is_course_teacher(course_id)
    OR public.is_enrolled_in_course(course_id)
  );

CREATE POLICY "dates_manage_policy" ON public.important_dates
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR public.is_course_teacher(course_id)
  );
