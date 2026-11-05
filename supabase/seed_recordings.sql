-- ====================================================================
-- IMPARA LMS: SEED RECORDINGS, LESSON PROGRESS & BOOKMARKS
-- Migration / Seed: supabase/seed_recordings.sql
-- Safe to run multiple times without deleting or dropping existing data.
-- ====================================================================

-- 1. Ensure students can see both 'ready' and 'processing' recordings
--    (while 'hidden' recordings remain completely invisible).
DROP POLICY IF EXISTS "recordings_select_policy" ON public.recordings;

CREATE POLICY "recordings_select_policy" ON public.recordings
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
    OR (
      course_id IN (SELECT course_id FROM public.enrollments WHERE student_id = auth.uid())
      AND status IN ('ready', 'processing')
    )
  );

-- 2. Insert sample recordings, lesson progress, and bookmarks
DO $$
DECLARE
  -- Student Nixon
  v_student_id uuid;

  -- Courses
  v_course1_id uuid := '10000000-0000-0000-0000-000000000001'; -- Autonomous Systems & ML
  v_course2_id uuid := '10000000-0000-0000-0000-000000000002'; -- IoT & Smart Systems

  -- Topics
  v_topic_ai uuid := '20000000-0000-0000-0000-000000000001';
  v_topic_ml uuid := '20000000-0000-0000-0000-000000000002';
  v_topic_iot uuid := '20000000-0000-0000-0000-000000000003';

  -- Sessions
  v_sess1 uuid := '30000000-0000-0000-0000-000000000001';
  v_sess2 uuid := '30000000-0000-0000-0000-000000000002';
  v_sess3 uuid := '30000000-0000-0000-0000-000000000003';
  v_sess4 uuid := '30000000-0000-0000-0000-000000000004';
  v_sess5 uuid := '30000000-0000-0000-0000-000000000005';
  v_sess_extra uuid := '30000000-0000-0000-0000-000000000010';
  v_sess_proc uuid := '30000000-0000-0000-0000-000000000011';

  -- Recordings (6 ready + 1 processing)
  v_rec1 uuid := '40000000-0000-0000-0000-000000000001';
  v_rec2 uuid := '40000000-0000-0000-0000-000000000002';
  v_rec3 uuid := '40000000-0000-0000-0000-000000000003';
  v_rec4 uuid := '40000000-0000-0000-0000-000000000004';
  v_rec5 uuid := '40000000-0000-0000-0000-000000000005';
  v_rec6 uuid := '40000000-0000-0000-0000-000000000006';
  v_rec7_proc uuid := '40000000-0000-0000-0000-000000000007';

  -- Teacher 1
  v_teacher1_id uuid;

BEGIN
  -- Resolve Nixon Cruz student ID
  SELECT id INTO v_student_id
  FROM public.profiles
  WHERE full_name ILIKE '%Nixon%' OR id = 'c0000000-0000-0000-0000-000000000001'
  LIMIT 1;

  -- Fallback if Nixon ID not yet created
  IF v_student_id IS NULL THEN
    v_student_id := 'c0000000-0000-0000-0000-000000000001';
  END IF;

  -- Resolve Teacher 1 ID
  SELECT teacher_id INTO v_teacher1_id
  FROM public.courses
  WHERE id = v_course1_id
  LIMIT 1;

  IF v_teacher1_id IS NULL THEN
    v_teacher1_id := 'b0000000-0000-0000-0000-000000000001';
  END IF;

  -- Ensure supporting sessions exist for recordings 6 and 7
  INSERT INTO public.live_sessions (
    id, course_id, topic_id, teacher_id, title, scheduled_at, duration_minutes, status, livekit_room, started_at, ended_at
  ) VALUES 
    (v_sess_extra, v_course1_id, v_topic_ml, v_teacher1_id, 'Recurrent Networks & Long Short-Term Memory (LSTM)', now() - interval '2 days', 45, 'ended', 'room-ml-lstm', now() - interval '2 days', now() - interval '2 days' + interval '45 minutes'),
    (v_sess_proc, v_course1_id, v_topic_ml, v_teacher1_id, 'Deep Q-Networks & Policy Gradient Formulations', now() - interval '3 hours', 60, 'ended', 'room-ml-dqn', now() - interval '3 hours', now() - interval '2 hours')
  ON CONFLICT (id) DO NOTHING;

  -- 3. INSERT 6 READY RECORDINGS + 1 PROCESSING RECORDING
  INSERT INTO public.recordings (id, session_id, course_id, topic_id, storage_path, duration_seconds, status, created_at)
  VALUES 
    -- Topic: AI (Course 1)
    (v_rec1, v_sess1, v_course1_id, v_topic_ai, 'recordings/ai_heuristics_master.mp4', 3720, 'ready', now() - interval '14 days'),
    (v_rec2, v_sess2, v_course1_id, v_topic_ai, 'recordings/ai_perceptrons_master.mp4', 4440, 'ready', now() - interval '10 days'),

    -- Topic: ML (Course 1)
    (v_rec3, v_sess3, v_course1_id, v_topic_ml, 'recordings/ml_gradient_master.mp4', 5400, 'ready', now() - interval '7 days'),
    (v_rec4, v_sess4, v_course1_id, v_topic_ml, 'recordings/ml_cnn_architectures.mp4', 3480, 'ready', now() - interval '3 days'),
    (v_rec6, v_sess_extra, v_course1_id, v_topic_ml, 'recordings/ml_lstm_networks.mp4', 2700, 'ready', now() - interval '2 days'),

    -- Topic: IoT (Course 2)
    (v_rec5, v_sess5, v_course2_id, v_topic_iot, 'recordings/iot_hardware_protocols.mp4', 3660, 'ready', now() - interval '4 days'),

    -- Processing Recording: ML (Course 1)
    (v_rec7_proc, v_sess_proc, v_course1_id, v_topic_ml, 'recordings/ml_dqn_raw_feed.mp4', 3600, 'processing', now() - interval '2 hours')
  ON CONFLICT (id) DO UPDATE SET
    storage_path = EXCLUDED.storage_path,
    duration_seconds = EXCLUDED.duration_seconds,
    status = EXCLUDED.status;

  -- 4. INSERT LESSON PROGRESS FOR NIXON
  -- AI topic: Rec 1 and Rec 2 both completed -> 100% completed topic (Checked circle)
  -- ML topic: Rec 3 completed, Rec 4 partial, Rec 6 not started -> Partial completed (Half circle)
  INSERT INTO public.lesson_progress (user_id, recording_id, watched_seconds, watched_segments, completed, updated_at)
  VALUES 
    (v_student_id, v_rec1, 3720, '[[0, 3720]]'::jsonb, true, now() - interval '13 days'),
    (v_student_id, v_rec2, 4440, '[[0, 4440]]'::jsonb, true, now() - interval '9 days'),
    (v_student_id, v_rec3, 5400, '[[0, 5400]]'::jsonb, true, now() - interval '6 days'),
    (v_student_id, v_rec4, 1800, '[[0, 1800]]'::jsonb, false, now() - interval '1 day')
  ON CONFLICT (user_id, recording_id) DO UPDATE SET
    watched_seconds = EXCLUDED.watched_seconds,
    watched_segments = EXCLUDED.watched_segments,
    completed = EXCLUDED.completed,
    updated_at = EXCLUDED.updated_at;

  -- 5. INSERT 2 SAMPLE BOOKMARKS FOR NIXON
  INSERT INTO public.bookmarks (id, user_id, recording_id, position_seconds, note, created_at)
  VALUES 
    ('60000000-0000-0000-0000-000000000001', v_student_id, v_rec1, 1420, 'Proof of optimality for A* with admissible heuristic', now() - interval '12 days'),
    ('60000000-0000-0000-0000-000000000002', v_student_id, v_rec3, 2180, 'Vanishing gradients mathematical derivation', now() - interval '5 days')
  ON CONFLICT (id) DO UPDATE SET
    position_seconds = EXCLUDED.position_seconds,
    note = EXCLUDED.note;

END $$;
