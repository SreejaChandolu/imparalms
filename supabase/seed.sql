-- ====================================================================
-- IMPARA LMS: SEED DATA SCRIPT
-- Default test password for all seed accounts: Password123!
-- ====================================================================

-- 1. SEED AUTH USERS AND PROFILES
-- IDs are fixed UUIDs for consistent relational seeding
DO $$
DECLARE
  v_admin_id uuid := 'a0000000-0000-0000-0000-000000000001';
  v_teacher1_id uuid := 'b0000000-0000-0000-0000-000000000001';
  v_teacher2_id uuid := 'b0000000-0000-0000-0000-000000000002';
  v_student1_id uuid := 'c0000000-0000-0000-0000-000000000001'; -- Nixon
  v_student2_id uuid := 'c0000000-0000-0000-0000-000000000002'; -- Elena Rostova
  v_student3_id uuid := 'c0000000-0000-0000-0000-000000000003'; -- Kai Takahashi

  -- Courses
  v_course1_id uuid := '10000000-0000-0000-0000-000000000001'; -- AI & ML Mastery
  v_course2_id uuid := '10000000-0000-0000-0000-000000000002'; -- IoT & Smart Systems

  -- Topics
  v_topic_ai uuid := '20000000-0000-0000-0000-000000000001'; -- AI
  v_topic_ml uuid := '20000000-0000-0000-0000-000000000002'; -- ML
  v_topic_iot uuid := '20000000-0000-0000-0000-000000000003'; -- IoT

  -- Sessions (8 sessions: 5 ended past, 1 live now, 2 scheduled upcoming)
  v_sess1 uuid := '30000000-0000-0000-0000-000000000001';
  v_sess2 uuid := '30000000-0000-0000-0000-000000000002';
  v_sess3 uuid := '30000000-0000-0000-0000-000000000003';
  v_sess4 uuid := '30000000-0000-0000-0000-000000000004';
  v_sess5 uuid := '30000000-0000-0000-0000-000000000005';
  v_sess6 uuid := '30000000-0000-0000-0000-000000000006'; -- live
  v_sess7 uuid := '30000000-0000-0000-0000-000000000007'; -- scheduled
  v_sess8 uuid := '30000000-0000-0000-0000-000000000008'; -- scheduled

  -- Recordings
  v_rec1 uuid := '40000000-0000-0000-0000-000000000001';
  v_rec2 uuid := '40000000-0000-0000-0000-000000000002';
  v_rec3 uuid := '40000000-0000-0000-0000-000000000003';

  -- Assessment
  v_assess1 uuid := '50000000-0000-0000-0000-000000000001';

BEGIN
  -- Insert Auth Users (Password: Password123!)
  -- 1 Admin
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    v_admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'admin@impara.internal', crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Dr. Marcus Aurelius"}'::jsonb, now(), now()
  ) ON CONFLICT (id) DO NOTHING;

  -- 2 Teachers
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    v_teacher1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'sarah.connor@impara.internal', crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Prof. Sarah Connor"}'::jsonb, now(), now()
  ), (
    v_teacher2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'alan.turing@impara.internal', crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Prof. Alan Turing"}'::jsonb, now(), now()
  ) ON CONFLICT (id) DO NOTHING;

  -- 3 Students (one named Nixon)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    v_student1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'nixon@impara.internal', crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Nixon Cruz"}'::jsonb, now(), now()
  ), (
    v_student2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'elena@impara.internal', crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Elena Rostova"}'::jsonb, now(), now()
  ), (
    v_student3_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'kai@impara.internal', crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Kai Takahashi"}'::jsonb, now(), now()
  ) ON CONFLICT (id) DO NOTHING;

  -- Sync Profiles with exact assigned roles
  INSERT INTO public.profiles (id, full_name, role, student_id)
  VALUES 
    (v_admin_id, 'Dr. Marcus Aurelius', 'admin', NULL),
    (v_teacher1_id, 'Prof. Sarah Connor', 'teacher', NULL),
    (v_teacher2_id, 'Prof. Alan Turing', 'teacher', NULL),
    (v_student1_id, 'Nixon Cruz', 'student', 'STU-10001'),
    (v_student2_id, 'Elena Rostova', 'student', 'STU-10002'),
    (v_student3_id, 'Kai Takahashi', 'student', 'STU-10003')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    student_id = EXCLUDED.student_id;

  -- 2. COURSES (2 courses)
  INSERT INTO public.courses (id, title, description, teacher_id, starts_on, ends_on)
  VALUES 
    (v_course1_id, 'Autonomous Systems & Machine Learning', 'Comprehensive study of deep learning neural architectures, reinforcement learning, and production ML pipelines.', v_teacher1_id, CURRENT_DATE - 30, CURRENT_DATE + 60),
    (v_course2_id, 'Applied Internet of Things (IoT) & Embedded Edge', 'Practical micro-controller architectures, MQTT telemetries, and distributed edge intelligence networks.', v_teacher2_id, CURRENT_DATE - 20, CURRENT_DATE + 70)
  ON CONFLICT (id) DO NOTHING;

  -- 3. TOPICS (AI, ML, IoT)
  INSERT INTO public.topics (id, course_id, title, position)
  VALUES 
    (v_topic_ai, v_course1_id, 'AI', 1),
    (v_topic_ml, v_course1_id, 'ML', 2),
    (v_topic_iot, v_course2_id, 'IoT', 1)
  ON CONFLICT (id) DO NOTHING;

  -- 4. ENROLLMENTS
  -- Nixon and Elena in Course 1; Nixon and Kai in Course 2
  INSERT INTO public.enrollments (course_id, student_id)
  VALUES 
    (v_course1_id, v_student1_id),
    (v_course1_id, v_student2_id),
    (v_course2_id, v_student1_id),
    (v_course2_id, v_student3_id)
  ON CONFLICT (course_id, student_id) DO NOTHING;

  -- 5. LIVE SESSIONS (8 sessions: 5 ended past, 1 live, 2 scheduled upcoming)
  INSERT INTO public.live_sessions (
    id, course_id, topic_id, teacher_id, title, scheduled_at, duration_minutes, status, livekit_room, started_at, ended_at
  ) VALUES 
    -- Past Ended Sessions
    (v_sess1, v_course1_id, v_topic_ai, v_teacher1_id, 'Foundations of Heuristic Search & Alpha-Beta Pruning', now() - interval '14 days', 60, 'ended', 'room-ai-heuristics', now() - interval '14 days', now() - interval '14 days' + interval '62 minutes'),
    (v_sess2, v_course1_id, v_topic_ai, v_teacher1_id, 'Neural Perceptrons to Deep Multi-Layer Networks', now() - interval '10 days', 75, 'ended', 'room-ai-perceptrons', now() - interval '10 days', now() - interval '10 days' + interval '74 minutes'),
    (v_sess3, v_course1_id, v_topic_ml, v_teacher1_id, 'Gradient Descent Optimization & Backpropagation', now() - interval '7 days', 90, 'ended', 'room-ml-gradient', now() - interval '7 days', now() - interval '7 days' + interval '90 minutes'),
    (v_sess4, v_course1_id, v_topic_ml, v_teacher1_id, 'Convolutional Feature Extractors & Computer Vision', now() - interval '3 days', 60, 'ended', 'room-ml-cnn', now() - interval '3 days', now() - interval '3 days' + interval '58 minutes'),
    (v_sess5, v_course2_id, v_topic_iot, v_teacher2_id, 'Embedded Protocols: SPI, I2C, UART and Hardware Interfaces', now() - interval '4 days', 60, 'ended', 'room-iot-protocols', now() - interval '4 days', now() - interval '4 days' + interval '61 minutes'),
    -- Active Live Session
    (v_sess6, v_course1_id, v_topic_ml, v_teacher1_id, 'Transformer Self-Attention & Large Language Models', now() - interval '15 minutes', 90, 'live', 'room-ml-transformers', now() - interval '15 minutes', NULL),
    -- Upcoming Scheduled Sessions
    (v_sess7, v_course1_id, v_topic_ml, v_teacher1_id, 'Reinforcement Learning: Markov Decision Processes & Q-Learning', now() + interval '3 days', 90, 'scheduled', 'room-ml-rl-mdp', NULL, NULL),
    (v_sess8, v_course2_id, v_topic_iot, v_teacher2_id, 'Edge AI Inference on ESP32 & Coral Micro Acceleration', now() + interval '5 days', 60, 'scheduled', 'room-iot-edge-coral', NULL, NULL)
  ON CONFLICT (id) DO NOTHING;

  -- 6. RECORDINGS (For ended sessions)
  INSERT INTO public.recordings (id, session_id, course_id, topic_id, storage_path, duration_seconds, status)
  VALUES 
    (v_rec1, v_sess1, v_course1_id, v_topic_ai, 'recordings/ai_heuristics_master.mp4', 3720, 'ready'),
    (v_rec2, v_sess2, v_course1_id, v_topic_ai, 'recordings/ai_perceptrons_master.mp4', 4440, 'ready'),
    (v_rec3, v_sess3, v_course1_id, v_topic_ml, 'recordings/ml_gradient_master.mp4', 5400, 'ready')
  ON CONFLICT (id) DO NOTHING;

  -- 7. ATTENDANCE (Testing the 75% rule)
  -- Nixon attended Session 1 for 3400s (out of 3720s -> ~91%, PRESENT)
  -- Nixon attended Session 2 for 3600s (out of 4440s -> ~81%, PRESENT)
  -- Elena attended Session 1 for 1200s (out of 3720s -> ~32%, ABSENT / NOT >= 75%)
  -- Kai attended Session 5 for 3000s (out of 3660s -> ~82%, PRESENT)
  INSERT INTO public.attendance (session_id, user_id, joined_at, left_at, total_seconds)
  VALUES 
    (v_sess1, v_student1_id, now() - interval '14 days', now() - interval '14 days' + interval '56 minutes', 3400),
    (v_sess2, v_student1_id, now() - interval '10 days', now() - interval '10 days' + interval '60 minutes', 3600),
    (v_sess1, v_student2_id, now() - interval '14 days', now() - interval '14 days' + interval '20 minutes', 1200),
    (v_sess5, v_student3_id, now() - interval '4 days', now() - interval '4 days' + interval '50 minutes', 3000)
  ON CONFLICT DO NOTHING;

  -- 8. CLASS RATINGS (1 to 5 stars, 1 per user per session)
  INSERT INTO public.class_ratings (session_id, user_id, stars, comment)
  VALUES 
    (v_sess1, v_student1_id, 5, 'Super clear breakdown of state-space pruning algorithms!'),
    (v_sess2, v_student1_id, 5, 'The visual intuition for multi-layer backpropagation was fantastic.'),
    (v_sess1, v_student2_id, 4, 'Great session, but pace picked up quickly towards the end.')
  ON CONFLICT (session_id, user_id) DO NOTHING;

  -- 9. BOOKMARKS
  INSERT INTO public.bookmarks (user_id, recording_id, position_seconds, note)
  VALUES 
    (v_student1_id, v_rec1, 1420, 'Proof of optimality for A* with admissible heuristic'),
    (v_student1_id, v_rec2, 2180, 'Vanishing gradients mathematical derivation')
  ON CONFLICT DO NOTHING;

  -- 10. IMPORTANT DATES (2 dates)
  INSERT INTO public.important_dates (course_id, title, date, kind)
  VALUES 
    (v_course1_id, 'Midterm Comprehensive Assessment: Heuristics & Neural Architectures', CURRENT_DATE + 14, 'exam'),
    (v_course2_id, 'Edge Hardware Prototype Submission Deadline', CURRENT_DATE + 28, 'deadline')
  ON CONFLICT DO NOTHING;

  -- 11. ASSESSMENTS & 5 QUESTIONS (1 assessment with 5 questions)
  INSERT INTO public.assessments (id, course_id, title, due_date)
  VALUES (v_assess1, v_course1_id, 'Neural Foundations & Backpropagation Diagnostic', now() + interval '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.assessment_questions (assessment_id, question, options, correct_index)
  VALUES 
    (
      v_assess1,
      'Which activation function is most susceptible to the vanishing gradient problem during deep network backpropagation?',
      '["Rectified Linear Unit (ReLU)", "Sigmoid", "Leaky ReLU", "Exponential Linear Unit (ELU)"]'::jsonb,
      1
    ),
    (
      v_assess1,
      'In the Raft consensus algorithm, what must a Candidate node receive to become the new Leader?',
      '["Unanimous consent from all cluster nodes", "A simple majority (⌊n/2⌋ + 1) of cluster votes", "Confirmation from the previous term leader", "At least 2/3 of active heartbeats"]'::jsonb,
      1
    ),
    (
      v_assess1,
      'What condition guarantees that the A* pathfinding algorithm returns an optimal shortest path?',
      '["Heuristic function h(n) is admissible and never overestimates the true cost", "The graph contains no cycles", "Edge weights are uniform unit costs", "Depth-first frontier expansion is prioritized"]'::jsonb,
      0
    ),
    (
      v_assess1,
      'Which matrix operation transforms inputs in multi-head attention before scaled dot-product computation?',
      '["Singular Value Decomposition (SVD)", "Linear projection into Query, Key, and Value spaces", "Convolutional max-pooling", "Batch normalization across hidden channels"]'::jsonb,
      1
    ),
    (
      v_assess1,
      'In convolutional neural networks, what is the primary consequence of increasing stride from 1 to 2?',
      '["Doubles the channel depth", "Halves the spatial dimensions of the activation map without explicit pooling", "Prevents all over-fitting", "Eliminates non-linear activations"]'::jsonb,
      1
    )
  ON CONFLICT DO NOTHING;

  -- 12. SAMPLE HELP TICKET
  INSERT INTO public.help_tickets (user_id, subject, message, status, reply)
  VALUES (
    v_student1_id,
    'GPU acceleration question for Assignment 2',
    'Hello Prof, can we submit CUDA kernels in PyTorch or are pure NumPy implementations required?',
    'answered',
    'PyTorch with CUDA tensors is fully supported. Check module 3 for the benchmark requirements.'
  ) ON CONFLICT DO NOTHING;

END $$;
