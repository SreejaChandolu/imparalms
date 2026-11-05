-- ====================================================================
-- IMPARA LMS: INITIAL DATABASE SCHEMA & ROW LEVEL SECURITY POLICIES
-- ====================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------------------
-- 1. PROFILES TABLE (Linked directly to auth.users)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
  student_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for role lookup
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- --------------------------------------------------------------------
-- 2. COURSES TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  starts_on date,
  ends_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_teacher ON public.courses(teacher_id);

-- --------------------------------------------------------------------
-- 3. TOPICS TABLE (e.g. AI, IoT, ML within a Course)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_topics_course ON public.topics(course_id);

-- --------------------------------------------------------------------
-- 4. ENROLLMENTS TABLE (Students enrolled in Courses)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments(course_id);

-- --------------------------------------------------------------------
-- 5. LIVE_SESSIONS TABLE (WebRTC Live Classes)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended')),
  livekit_room text UNIQUE NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_course ON public.live_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_sessions_teacher ON public.live_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_sessions_scheduled ON public.live_sessions(scheduled_at);

-- --------------------------------------------------------------------
-- 6. RECORDINGS TABLE (Archived sessions stored in Supabase Storage)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('processing', 'ready', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recordings_course ON public.recordings(course_id);
CREATE INDEX IF NOT EXISTS idx_recordings_session ON public.recordings(session_id);

-- --------------------------------------------------------------------
-- 7. LESSON_PROGRESS TABLE (Granular video playback tracking)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recording_id uuid NOT NULL REFERENCES public.recordings(id) ON DELETE CASCADE,
  watched_seconds integer NOT NULL DEFAULT 0,
  watched_segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, recording_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON public.lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_recording ON public.lesson_progress(recording_id);

-- --------------------------------------------------------------------
-- 8. ATTENDANCE TABLE (Live session presence logs)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  total_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_session ON public.attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON public.attendance(user_id);

-- --------------------------------------------------------------------
-- 9. ATTENDANCE PERCENTAGE SQL VIEW
-- Rule: Student is present if total_seconds >= 75% of session length.
-- --------------------------------------------------------------------
CREATE OR REPLACE VIEW public.course_attendance_percentage AS
WITH session_durations AS (
  SELECT 
    id AS session_id,
    course_id,
    CASE 
      WHEN started_at IS NOT NULL AND ended_at IS NOT NULL AND ended_at > started_at 
        THEN EXTRACT(EPOCH FROM (ended_at - started_at))::integer
      ELSE duration_minutes * 60
    END AS effective_duration_seconds
  FROM public.live_sessions
  WHERE status = 'ended'
),
student_session_attendance AS (
  SELECT 
    sd.course_id,
    sd.session_id,
    e.student_id,
    COALESCE(SUM(a.total_seconds), 0) AS total_attended_seconds,
    sd.effective_duration_seconds,
    CASE 
      WHEN sd.effective_duration_seconds > 0 
           AND COALESCE(SUM(a.total_seconds), 0) >= (0.75 * sd.effective_duration_seconds)
        THEN 1
      ELSE 0
    END AS is_present
  FROM public.enrollments e
  JOIN session_durations sd ON sd.course_id = e.course_id
  LEFT JOIN public.attendance a 
    ON a.session_id = sd.session_id 
   AND a.user_id = e.student_id
  GROUP BY sd.course_id, sd.session_id, e.student_id, sd.effective_duration_seconds
),
course_summary AS (
  SELECT 
    ssa.course_id,
    ssa.student_id,
    p.full_name AS student_name,
    p.student_id AS student_code,
    c.title AS course_title,
    COUNT(DISTINCT ssa.session_id) AS total_ended_sessions,
    COALESCE(SUM(ssa.is_present), 0) AS sessions_attended,
    CASE 
      WHEN COUNT(DISTINCT ssa.session_id) > 0 
        THEN ROUND((COALESCE(SUM(ssa.is_present), 0)::numeric / COUNT(DISTINCT ssa.session_id)::numeric) * 100, 2)
      ELSE 0.00
    END AS attendance_percentage
  FROM student_session_attendance ssa
  JOIN public.profiles p ON p.id = ssa.student_id
  JOIN public.courses c ON c.id = ssa.course_id
  GROUP BY ssa.course_id, ssa.student_id, p.full_name, p.student_id, c.title
)
SELECT * FROM course_summary;

-- --------------------------------------------------------------------
-- 10. CLASS_RATINGS TABLE (1 rating per user per session)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stars integer NOT NULL CHECK (stars >= 1 AND stars <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_session ON public.class_ratings(session_id);

-- --------------------------------------------------------------------
-- 11. BOOKMARKS TABLE (Video timestamps and student notes)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recording_id uuid NOT NULL REFERENCES public.recordings(id) ON DELETE CASCADE,
  position_seconds integer NOT NULL DEFAULT 0,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON public.bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_recording ON public.bookmarks(recording_id);

-- --------------------------------------------------------------------
-- 12. IMPORTANT_DATES TABLE (Deadlines, exams, holidays)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.important_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  date date NOT NULL,
  kind text NOT NULL DEFAULT 'other' CHECK (kind IN ('exam', 'deadline', 'holiday', 'other')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dates_course ON public.important_dates(course_id);

-- --------------------------------------------------------------------
-- 13. ASSESSMENTS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_date timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessments_course ON public.assessments(course_id);

-- --------------------------------------------------------------------
-- 14. ASSESSMENT_QUESTIONS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL,
  correct_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_assessment ON public.assessment_questions(assessment_id);

-- --------------------------------------------------------------------
-- 15. ASSESSMENT_ATTEMPTS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  score numeric(5, 2) NOT NULL DEFAULT 0.00,
  taken_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attempts_assessment ON public.assessment_attempts(assessment_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON public.assessment_attempts(user_id);

-- --------------------------------------------------------------------
-- 16. HELP_TICKETS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.help_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
  reply text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_user ON public.help_tickets(user_id);

-- --------------------------------------------------------------------
-- 17. SECURITY_EVENTS TABLE (Audit and anti-leak tracking)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_user ON public.security_events(user_id);

-- ====================================================================
-- RLS SECURITY DEFINER HELPER FUNCTIONS
-- ====================================================================
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
  PERFORM set_config('row_security', 'off', true);
  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
  RETURN v_user_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.current_user_role() = 'admin', false);
$$;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.current_user_role() = 'teacher', false);
$$;

CREATE OR REPLACE FUNCTION public.is_student()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.current_user_role() = 'student', false);
$$;

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
    SELECT 1 FROM public.enrollments e
    JOIN public.courses c ON c.id = e.course_id
    WHERE e.student_id = p_student_id AND c.teacher_id = auth.uid()
  ) INTO v_is_instructor;
  RETURN COALESCE(v_is_instructor, false);
END;
$$;

-- ====================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER (AUTH.USERS -> PROFILES)
-- Students sign up themselves. Always defaults role to 'student'.
-- ====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gen_student_id text;
BEGIN
  -- Generate formatted student ID: STU-XXXXX
  gen_student_id := 'STU-' || lpad(floor(random() * 90000 + 10000)::text, 5, '0');
  
  INSERT INTO public.profiles (id, full_name, role, student_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    'student', -- ALWAYS student. Teacher and admin must be created by admin only.
    gen_student_id
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

-- 1. PROFILES RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

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


-- 2. COURSES RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

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


-- 3. TOPICS RLS
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

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


-- 4. ENROLLMENTS RLS
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

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


-- 5. LIVE_SESSIONS RLS
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

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


-- 6. RECORDINGS RLS
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recordings_select_policy" ON public.recordings
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
    OR (
      course_id IN (SELECT course_id FROM public.enrollments WHERE student_id = auth.uid())
      AND status = 'ready'
    )
  );

CREATE POLICY "recordings_manage_policy" ON public.recordings
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
  );


-- 7. LESSON_PROGRESS RLS
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "progress_select_policy" ON public.lesson_progress
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR recording_id IN (
      SELECT r.id FROM public.recordings r
      JOIN public.courses c ON c.id = r.course_id
      WHERE c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "progress_insert_update_student" ON public.lesson_progress
  FOR ALL TO authenticated
  USING (public.is_admin() OR user_id = auth.uid())
  WITH CHECK (public.is_admin() OR user_id = auth.uid());


-- 8. ATTENDANCE RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_select_policy" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR session_id IN (
      SELECT s.id FROM public.live_sessions s
      JOIN public.courses c ON c.id = s.course_id
      WHERE c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "attendance_manage_policy" ON public.attendance
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR session_id IN (
      SELECT s.id FROM public.live_sessions s
      JOIN public.courses c ON c.id = s.course_id
      WHERE c.teacher_id = auth.uid()
    )
  );


-- 9. CLASS_RATINGS RLS
ALTER TABLE public.class_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ratings_select_policy" ON public.class_ratings
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR session_id IN (
      SELECT s.id FROM public.live_sessions s
      JOIN public.courses c ON c.id = s.course_id
      WHERE c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "ratings_insert_update_student" ON public.class_ratings
  FOR ALL TO authenticated
  USING (public.is_admin() OR user_id = auth.uid())
  WITH CHECK (public.is_admin() OR user_id = auth.uid());


-- 10. BOOKMARKS RLS
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookmarks_policy" ON public.bookmarks
  FOR ALL TO authenticated
  USING (public.is_admin() OR user_id = auth.uid())
  WITH CHECK (public.is_admin() OR user_id = auth.uid());


-- 11. IMPORTANT_DATES RLS
ALTER TABLE public.important_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dates_select_policy" ON public.important_dates
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
    OR course_id IN (SELECT course_id FROM public.enrollments WHERE student_id = auth.uid())
  );

CREATE POLICY "dates_manage_policy" ON public.important_dates
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
  );


-- 12. ASSESSMENTS RLS
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assessments_select_policy" ON public.assessments
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
    OR course_id IN (SELECT course_id FROM public.enrollments WHERE student_id = auth.uid())
  );

CREATE POLICY "assessments_manage_policy" ON public.assessments
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
  );


-- 13. ASSESSMENT_QUESTIONS RLS
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "questions_select_policy" ON public.assessment_questions
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR assessment_id IN (
      SELECT a.id FROM public.assessments a
      JOIN public.courses c ON c.id = a.course_id
      WHERE c.teacher_id = auth.uid()
    )
    OR assessment_id IN (
      SELECT a.id FROM public.assessments a
      JOIN public.enrollments e ON e.course_id = a.course_id
      WHERE e.student_id = auth.uid()
    )
  );

CREATE POLICY "questions_manage_policy" ON public.assessment_questions
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR assessment_id IN (
      SELECT a.id FROM public.assessments a
      JOIN public.courses c ON c.id = a.course_id
      WHERE c.teacher_id = auth.uid()
    )
  );


-- 14. ASSESSMENT_ATTEMPTS RLS
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attempts_select_policy" ON public.assessment_attempts
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR assessment_id IN (
      SELECT a.id FROM public.assessments a
      JOIN public.courses c ON c.id = a.course_id
      WHERE c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "attempts_student_insert" ON public.assessment_attempts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR user_id = auth.uid());


-- 15. HELP_TICKETS RLS
ALTER TABLE public.help_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_select_policy" ON public.help_tickets
  FOR SELECT TO authenticated
  USING (public.is_admin() OR user_id = auth.uid());

CREATE POLICY "tickets_insert_policy" ON public.help_tickets
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR user_id = auth.uid());

CREATE POLICY "tickets_admin_update" ON public.help_tickets
  FOR UPDATE TO authenticated
  USING (public.is_admin());


-- 16. SECURITY_EVENTS RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_select_policy" ON public.security_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "security_insert_policy" ON public.security_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR user_id = auth.uid() OR auth.uid() IS NULL);
