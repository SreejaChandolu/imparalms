DROP POLICY IF EXISTS "sessions_delete_policy" ON public.live_sessions;
CREATE POLICY "sessions_delete_policy" ON public.live_sessions
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (
      teacher_id = auth.uid()
      AND public.is_course_teacher(course_id)
      AND status = 'scheduled'
    )
  );
