-- ====================================================================
-- IMPARA LMS: ALLOW STUDENTS TO READ TEACHER PROFILES
-- Migration: 20261105000100_student_read_teachers.sql
-- Description:
--   Adds a recursion-proof helper function and a safe SELECT policy on
--   public.profiles so enrolled students can read the names of their teachers.
--   Does NOT drop any tables or delete any data.
-- ====================================================================

-- 1. Helper function: Returns true if p_teacher_id teaches a course
--    in which the authenticated user (student) is actively enrolled.
CREATE OR REPLACE FUNCTION public.is_teacher_of_current_student(p_teacher_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_teacher boolean;
BEGIN
  -- Disable row_security for this query to bypass RLS recursion
  PERFORM set_config('row_security', 'off', true);

  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.courses c ON c.id = e.course_id
    WHERE e.student_id = auth.uid()
      AND c.teacher_id = p_teacher_id
  ) INTO v_is_teacher;

  RETURN COALESCE(v_is_teacher, false);
END;
$$;

-- 2. Add SELECT policy for students reading their teachers' profiles
DROP POLICY IF EXISTS "profiles_student_read_teachers" ON public.profiles;

CREATE POLICY "profiles_student_read_teachers" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.is_teacher_of_current_student(id)
  );
