-- =============================================================================
-- UniMate — demonstration data
--
-- Creates one signed-in-able demo student, Dana Hamad, with a coherent
-- academic history: strong in programming and digital-systems courses, weaker
-- in pure maths. Every row is flagged is_demo = true so the UI can label it as
-- demonstration data rather than real university records.
--
-- Demo sign-in:  dana.hamad@demo.unimate.app  /  UniMateDemo2026!
--
-- Dates are anchored to current_date so the data still reads as a live
-- semester whenever you seed it.
-- Safe to re-run: it deletes the demo user first.
-- =============================================================================

do $$
declare
  v_user   uuid := '4f6d1a52-9c8e-4c0b-9a1e-0b7c2d5e8f31';
  v_today  date := current_date;
  -- Semester started a little over two weeks ago.
  v_start  date := v_today - 17;

  c_ce301 uuid; c_ce315 uuid; c_math201 uuid; c_ce340 uuid; c_engl220 uuid;
  s_ce301 uuid; s_math201 uuid;
  e_ce301_mid uuid; e_math_mid1 uuid;
  ss1 uuid; ss2 uuid;
begin
  -- Clean slate ------------------------------------------------------------
  delete from auth.users where id = v_user;

  -- Demo auth user ---------------------------------------------------------
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated',
    'dana.hamad@demo.unimate.app',
    extensions.crypt('UniMateDemo2026!', extensions.gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Dana Hamad","preferred_language":"en"}'::jsonb,
    now() - interval '8 months', now(),
    '', '', '', ''
  );

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_user::text, v_user,
    jsonb_build_object('sub', v_user::text, 'email', 'dana.hamad@demo.unimate.app', 'email_verified', true),
    'email', now(), now() - interval '8 months', now()
  );

  -- The on_auth_user_created trigger already made the profile and the default
  -- 4.0 grade scale; fill in the rest of Dana's details.
  update public.profiles set
    full_name            = 'Dana Hamad',
    university           = 'Kuwait University',
    major                = 'Computer Engineering',
    academic_year        = 'Year 3',
    preferred_language   = 'en',
    target_gpa           = 3.50,
    preferred_study_minutes = 45,
    study_availability   = 'Weekday evenings 19:00–22:00, Saturday mornings',
    onboarding_completed = true,
    -- The demo account shows its name on the streak board so the board
    -- demonstrates itself. A real student appears anonymously until they
    -- choose otherwise in Settings.
    leaderboard_opt_in   = true,
    leaderboard_show_name = true,
    is_demo              = true
  where user_id = v_user;

  -- ===========================================================================
  -- Completed courses — the academic history the Analyst reasons over
  -- ===========================================================================
  insert into public.courses
    (user_id, course_code, course_name, instructor, credits, semester, difficulty,
     status, final_grade, final_points, is_demo)
  values
    (v_user,'CHEM101','General Chemistry',        'Dr. Hessa Al-Otaibi',  4,'Fall 2025',  3,'completed','B',  3.00,true),
    (v_user,'MATH102','Calculus II',              'Dr. Fatima Al-Ajmi',   3,'Fall 2025',  5,'completed','C+', 2.33,true),
    (v_user,'PHYS102','Physics II',               'Dr. Bader Al-Enezi',   4,'Fall 2025',  4,'completed','B',  3.00,true),
    (v_user,'ENGR200','Engineering Ethics',       'Dr. Latifa Al-Failakawi',2,'Fall 2025',2,'completed','B+', 3.33,true),
    (v_user,'CE201',  'Digital Logic Design',     'Dr. Mohammed Al-Sabah',3,'Spring 2026',3,'completed','A',  4.00,true),
    (v_user,'CE210',  'Data Structures',          'Dr. Yousef Al-Rashid', 3,'Spring 2026',4,'completed','A-', 3.67,true),
    (v_user,'CE250',  'Programming Languages',    'Dr. Abdullah Al-Kandari',3,'Spring 2026',3,'completed','A',4.00,true),
    (v_user,'MATH203','Linear Algebra',           'Dr. Fatima Al-Ajmi',   3,'Spring 2026',4,'completed','B-', 2.67,true);

  -- ===========================================================================
  -- Active courses — the current semester
  -- ===========================================================================
  insert into public.courses
    (user_id, course_code, course_name, instructor, credits, semester, difficulty,
     days, start_time, end_time, room, color, status, target_grade, is_demo)
  values
    (v_user,'CE301','Digital Signal Processing','Dr. Yousef Al-Rashid',3,'Fall 2026',4,
     array['sunday','tuesday'],'10:00','11:15','Room 204','violet','active','A-',true)
  returning id into c_ce301;

  insert into public.courses
    (user_id, course_code, course_name, instructor, credits, semester, difficulty,
     days, start_time, end_time, room, color, status, target_grade, is_demo)
  values
    (v_user,'CE315','Computer Architecture','Dr. Mohammed Al-Sabah',3,'Fall 2026',4,
     array['monday','wednesday'],'08:30','09:45','Room 112','blue','active','A',true)
  returning id into c_ce315;

  insert into public.courses
    (user_id, course_code, course_name, instructor, credits, semester, difficulty,
     days, start_time, end_time, room, color, status, target_grade, is_demo)
  values
    (v_user,'MATH201','Differential Equations','Dr. Fatima Al-Ajmi',3,'Fall 2026',5,
     array['sunday','tuesday'],'12:00','13:15','Room 301','amber','active','B',true)
  returning id into c_math201;

  insert into public.courses
    (user_id, course_code, course_name, instructor, credits, semester, difficulty,
     days, start_time, end_time, room, color, status, target_grade, is_demo)
  values
    (v_user,'CE340','Embedded Systems Laboratory','Eng. Noura Al-Hajri',1,'Fall 2026',3,
     array['wednesday'],'14:00','16:30','Lab B2','teal','active','A',true)
  returning id into c_ce340;

  insert into public.courses
    (user_id, course_code, course_name, instructor, credits, semester, difficulty,
     days, start_time, end_time, room, color, status, target_grade, is_demo)
  values
    (v_user,'ENGL220','Technical Writing','Dr. Sara Al-Mutairi',2,'Fall 2026',2,
     array['thursday'],'09:00','10:30','Room 145','rose','active','A-',true)
  returning id into c_engl220;

  -- ===========================================================================
  -- Assessments — weights total 100% per course
  -- ===========================================================================
  insert into public.grades
    (user_id, course_id, assessment_name, assessment_type, weight, score, max_score, due_date, is_demo)
  values
    -- CE301 Digital Signal Processing
    (v_user,c_ce301,'Quiz 1 — Sampling & Aliasing','quiz',      10,  8.0, 10, v_start + 9,  true),
    (v_user,c_ce301,'Assignment 1 — Convolution',  'assignment',10,  9.0, 10, v_start + 14, true),
    (v_user,c_ce301,'Midterm Exam',                'midterm',   25, null,100, v_today + 33, true),
    (v_user,c_ce301,'DSP Filter Project',          'project',   15, null,100, v_today + 68, true),
    (v_user,c_ce301,'Final Exam',                  'final',     40, null,100, v_today + 86, true),
    -- CE315 Computer Architecture
    (v_user,c_ce315,'Assignment 1 — ISA Design',   'assignment',10, 17.0, 20, v_start + 12, true),
    (v_user,c_ce315,'Midterm Exam',                'midterm',   30, null,100, v_today + 31, true),
    (v_user,c_ce315,'Pipeline Simulator Project',  'project',   20, null,100, v_today + 60, true),
    (v_user,c_ce315,'Final Exam',                  'final',     40, null,100, v_today + 89, true),
    -- MATH201 Differential Equations
    (v_user,c_math201,'Homework 1',                'assignment', 5,  7.0, 10, v_start + 8,  true),
    (v_user,c_math201,'Quiz 1 — First Order ODEs', 'quiz',      10,  6.5, 10, v_start + 15, true),
    (v_user,c_math201,'Midterm 1',                 'midterm',   20, null,100, v_today + 24, true),
    (v_user,c_math201,'Midterm 2',                 'midterm',   20, null,100, v_today + 59, true),
    (v_user,c_math201,'Final Exam',                'final',     45, null,100, v_today + 88, true),
    -- CE340 Embedded Systems Laboratory
    (v_user,c_ce340,'Lab Report 1 — GPIO',         'lab',       15, 18.0, 20, v_start + 13, true),
    (v_user,c_ce340,'Lab Report 2 — Interrupts',   'lab',       15, null, 20, v_today + 11, true),
    (v_user,c_ce340,'Practical Exam',              'final',     30, null,100, v_today + 52, true),
    (v_user,c_ce340,'Final Lab Project',           'project',   40, null,100, v_today + 80, true),
    -- ENGL220 Technical Writing
    (v_user,c_engl220,'Essay 1 — Technical Report','assignment',20, 85.0,100, v_start + 16, true),
    (v_user,c_engl220,'Oral Presentation',         'presentation',20,null,100, v_today + 27, true),
    (v_user,c_engl220,'Writing Portfolio',         'assignment',25, null,100, v_today + 63, true),
    (v_user,c_engl220,'Final Exam',                'final',     35, null,100, v_today + 84, true);

  -- ===========================================================================
  -- Syllabi and the events pulled out of them
  -- ===========================================================================
  insert into public.syllabi
    (user_id, course_id, file_name, file_type, processing_status, instructor, office_hours,
     required_material, policies, topics, summary, is_demo)
  values (
    v_user, c_ce301, 'CE301-syllabus-fall2026.pdf', 'application/pdf', 'completed',
    'Dr. Yousef Al-Rashid', 'Sunday & Tuesday 13:00–14:30, Office E-317',
    'Oppenheim & Schafer, Discrete-Time Signal Processing (3rd ed.); MATLAB licence',
    'Late submissions lose 10% per day. Two unexcused absences are permitted.',
    array['Sampling and aliasing','Discrete-time signals','Z-transform','DFT and FFT',
          'FIR filter design','IIR filter design','Spectral analysis'],
    'Fourteen-week DSP course assessed by two quizzes, one midterm, a filter-design project and a final exam.',
    true
  ) returning id into s_ce301;

  insert into public.syllabi
    (user_id, course_id, file_name, file_type, processing_status, instructor, office_hours,
     required_material, policies, topics, summary, is_demo)
  values (
    v_user, c_math201, 'MATH201-outline.pdf', 'application/pdf', 'completed',
    'Dr. Fatima Al-Ajmi', 'Monday 10:00–12:00, Office M-204',
    'Boyce & DiPrima, Elementary Differential Equations (11th ed.)',
    'Calculators permitted in quizzes but not in the final exam.',
    array['First order ODEs','Separable equations','Linear second order ODEs',
          'Laplace transforms','Series solutions','Systems of ODEs'],
    'Differential equations course with weekly homework, two midterms and a comprehensive final.',
    true
  ) returning id into s_math201;

  insert into public.syllabus_events
    (user_id, syllabus_id, course_id, title, event_type, event_date, weight, description, is_demo)
  values
    (v_user,s_ce301,c_ce301,'Midterm Exam','midterm', v_today + 33, 25,'Covers chapters 1–5: sampling through the Z-transform.',true),
    (v_user,s_ce301,c_ce301,'DSP Filter Project due','project', v_today + 68, 15,'MATLAB FIR/IIR filter design report.',true),
    (v_user,s_ce301,c_ce301,'Final Exam','final', v_today + 86, 40,'Comprehensive, covers the full syllabus.',true),
    (v_user,s_math201,c_math201,'Midterm 1','midterm', v_today + 24, 20,'First order ODEs and applications.',true),
    (v_user,s_math201,c_math201,'Midterm 2','midterm', v_today + 59, 20,'Laplace transforms and second order ODEs.',true),
    (v_user,s_math201,c_math201,'Final Exam','final', v_today + 88, 45,'Comprehensive.',true);

  select id into e_ce301_mid from public.syllabus_events
    where course_id = c_ce301 and event_type = 'midterm' limit 1;
  select id into e_math_mid1 from public.syllabus_events
    where course_id = c_math201 and title = 'Midterm 1' limit 1;

  -- ===========================================================================
  -- Tasks
  -- ===========================================================================
  insert into public.tasks
    (user_id, course_id, title, description, priority, due_date, estimated_minutes, status, source, is_demo, completed_at)
  values
    (v_user,c_math201,'Rework Quiz 1 mistakes','Redo the three separable-equation problems that lost marks.','high', v_today + 1, 60,'todo','ai',true,null),
    (v_user,c_ce301,'Read Chapter 4 — Z-transform',null,'high', v_today + 2, 50,'in_progress','manual',true,null),
    (v_user,c_ce340,'Write Lab Report 2 — Interrupts','Include the oscilloscope traces from this week''s session.','high', v_today + 11, 120,'todo','manual',true,null),
    (v_user,c_ce315,'Practice ISA encoding problems',null,'medium', v_today + 4, 45,'todo','ai',true,null),
    (v_user,c_engl220,'Draft presentation outline',null,'medium', v_today + 9, 40,'todo','manual',true,null),
    (v_user,c_ce301,'Complete 10 DSP practice questions','Focus on aliasing — weakest topic so far.','medium', v_today + 3, 30,'todo','ai',true,null),
    (v_user,c_math201,'Attend Dr. Fatima''s office hours','Bring the Laplace transform questions.','low', v_today + 6, 30,'todo','manual',true,null),
    (v_user,c_ce315,'Submit Assignment 1',null,'high', v_start + 12, 90,'completed','manual',true, now() - interval '5 days'),
    (v_user,c_ce301,'Submit Assignment 1 — Convolution',null,'high', v_start + 14, 90,'completed','manual',true, now() - interval '3 days');

  -- ===========================================================================
  -- Study reminders generated ahead of the two nearest exams
  -- ===========================================================================
  insert into public.reminders
    (user_id, course_id, event_id, title, body, remind_on, status, source, is_demo)
  values
    (v_user,c_math201,e_math_mid1,'Start MATH201 revision','Begin with first order ODEs — the topic that cost marks in Quiz 1.', v_today + 10,'scheduled','ai',true),
    (v_user,c_math201,e_math_mid1,'MATH201 — practice set','Work through 15 mixed problems under timed conditions.', v_today + 15,'scheduled','ai',true),
    (v_user,c_math201,e_math_mid1,'MATH201 — weak topic review','Re-read the integrating factor method.', v_today + 20,'scheduled','ai',true),
    (v_user,c_math201,e_math_mid1,'MATH201 — final review','Light review only. Sleep early.', v_today + 23,'scheduled','ai',true),
    (v_user,c_ce301,e_ce301_mid,'Start CE301 revision','Chapters 1–3 first, then the Z-transform.', v_today + 19,'scheduled','ai',true),
    (v_user,c_ce301,e_ce301_mid,'CE301 — practice questions','Twenty questions across sampling and the DFT.', v_today + 26,'scheduled','ai',true),
    (v_user,c_ce301,e_ce301_mid,'CE301 — final review',null, v_today + 32,'scheduled','ai',true);

  -- ===========================================================================
  -- Study history — shows the adaptive agent has something to learn from
  -- ===========================================================================
  insert into public.study_sessions
    (user_id, course_id, topic, mode, duration_minutes, score, total_questions, correct_answers, is_demo, started_at, completed_at)
  values (v_user,c_math201,'First order ODEs','quick_5',18,60.00,5,3,true, now() - interval '6 days', now() - interval '6 days' + interval '18 min')
  returning id into ss1;

  insert into public.study_sessions
    (user_id, course_id, topic, mode, duration_minutes, score, total_questions, correct_answers, is_demo, started_at, completed_at)
  values (v_user,c_ce301,'Sampling and aliasing','standard_10',34,80.00,10,8,true, now() - interval '2 days', now() - interval '2 days' + interval '34 min')
  returning id into ss2;

  insert into public.study_sessions
    (user_id, course_id, topic, mode, duration_minutes, score, total_questions, correct_answers, is_demo, started_at, completed_at)
  values
    (v_user,c_ce315,'Instruction set architecture','quick_5',15,100.00,5,5,true, now() - interval '9 days', now() - interval '9 days' + interval '15 min'),
    (v_user,c_math201,'Integrating factors','standard_10',41,50.00,10,5,true, now() - interval '13 days', now() - interval '13 days' + interval '41 min');

  insert into public.questions
    (user_id, course_id, session_id, topic, difficulty, question_type, question_text, options, answer, explanation, is_demo)
  values
    (v_user,c_math201,ss1,'First order ODEs','medium','multiple_choice',
     'Which method solves dy/dx + 2y = 6 most directly?',
     '["Separation of variables","Integrating factor","Laplace transform","Euler''s method"]'::jsonb,
     'Integrating factor',
     'The equation is linear and first order in the form y'' + P(x)y = Q(x), so multiplying through by e^(∫2 dx) = e^(2x) makes the left side an exact derivative.',
     true),
    (v_user,c_math201,ss1,'First order ODEs','easy','true_false',
     'A separable differential equation can always be written as g(y) dy = f(x) dx.',
     '["True","False"]'::jsonb,'True',
     'That rearrangement is the definition of separability — it is what lets you integrate each side independently.',
     true),
    (v_user,c_ce301,ss2,'Sampling and aliasing','medium','calculation',
     'A signal contains frequencies up to 4 kHz. What is the minimum sampling rate that avoids aliasing?',
     null,'8 kHz',
     'The Nyquist rate is twice the highest frequency component: 2 × 4 kHz = 8 kHz. Sampling below this folds high frequencies back into the baseband.',
     true),
    (v_user,c_ce301,ss2,'Sampling and aliasing','hard','conceptual',
     'Explain why an anti-aliasing filter is applied before sampling rather than after.',
     null,'Because aliasing is irreversible once it has occurred.',
     'Sampling folds any content above Nyquist into the baseband, where it becomes indistinguishable from genuine low-frequency content. Filtering afterwards cannot separate the two, so the filter must come first.',
     true);

  insert into public.question_attempts (user_id, question_id, session_id, given_answer, is_correct, answered_at)
  select v_user, q.id, q.session_id,
         case when q.difficulty = 'hard' then 'Not sure' else q.answer end,
         q.difficulty <> 'hard',
         now() - interval '2 days'
  from public.questions q where q.user_id = v_user;

  -- ===========================================================================
  -- Automated runs — nothing runs without a row here
  -- ===========================================================================
  insert into public.ai_runs
    (user_id, agent_name, trigger_type, workflow, status, input_summary, output_summary, duration_ms, started_at, completed_at)
  values
    (v_user,'Syllabus Analyst','syllabus_uploaded','workflow_b_syllabus_processing','completed',
     'CE301-syllabus-fall2026.pdf (412 KB)','7 assessment events extracted, 7 topics stored',4820,
     now() - interval '11 days', now() - interval '11 days' + interval '4.8 sec'),
    (v_user,'Setup Scanner','timetable_uploaded','workflow_a_schedule_scan','completed',
     'Timetable photo, 1 image','5 courses detected, 5 confirmed by student',6310,
     now() - interval '16 days', now() - interval '16 days' + interval '6.3 sec'),
    (v_user,'Study Question Generator','user_requested','workflow_e_study_questions','completed',
     'CE301 · standard_10 · adaptive','10 questions generated across 3 topics',5140,
     now() - interval '2 days', now() - interval '2 days' + interval '5.1 sec'),
    (v_user,'Grade Coach','grade_entered','workflow_c_grade_analysis','completed',
     'MATH201 Quiz 1 recorded (6.5/10)','Current weighted grade 67.0%; target B needs 84.2% of remaining weight',1890,
     now() - interval '4 days', now() - interval '4 days' + interval '1.9 sec'),
    (v_user,'Study Reminder Agent','exam_approaching','workflow_d_upcoming_exam','completed',
     'MATH201 Midterm 1 in 24 days','4 study reminders created',2450,
     now() - interval '1 day', now() - interval '1 day' + interval '2.4 sec'),
    (v_user,'Academic Analyst','user_requested','analyst_on_demand','completed',
     '8 completed courses, 25 credits','3 patterns identified across programming and maths courses',7020,
     now() - interval '3 days', now() - interval '3 days' + interval '7 sec'),
    (v_user,'Syllabus Analyst','syllabus_uploaded','workflow_b_syllabus_processing','failed',
     'CE315-syllabus.docx (2.1 MB)',null,1220,
     now() - interval '7 days', now() - interval '7 days' + interval '1.2 sec');

  update public.ai_runs
     set error_message = 'The document had no extractable text layer. Re-upload it as a PDF or a clear photo.'
   where user_id = v_user and status = 'failed';

  -- ===========================================================================
  -- Cleaning decisions taken while importing the timetable and syllabi
  -- ===========================================================================
  insert into public.cleaning_log
    (user_id, table_name, record_id, field_name, original_value, cleaned_value, reason, created_at)
  values
    (v_user,'courses',c_ce301,  'course_code','CE 301','CE301','Removed inconsistent spacing from the course code.', now() - interval '16 days'),
    (v_user,'courses',c_math201,'course_code','math 201','MATH201','Normalised course code to uppercase and removed spacing.', now() - interval '16 days'),
    (v_user,'courses',c_ce301,  'start_time','10.00 AM','10:00','Converted the scanned time to 24-hour format.', now() - interval '16 days'),
    (v_user,'courses',c_ce340,  'room','lab b2','Lab B2','Standardised room label capitalisation.', now() - interval '16 days'),
    (v_user,'courses',c_ce315,  'instructor','dr. mohammed al-sabah','Dr. Mohammed Al-Sabah','Applied title case to the instructor name.', now() - interval '16 days'),
    (v_user,'grades',null,      'weight','25 %','25','Stripped the percent sign so the weight stores as a number.', now() - interval '11 days'),
    (v_user,'courses',c_engl220,'credits','2 cr','2','Extracted the numeric credit value from the scanned text.', now() - interval '16 days');

  raise notice 'UniMate demo data seeded for dana.hamad@demo.unimate.app';
end $$;

-- =============================================================================
-- Demo momentum history for Dana Hamad.
--
-- A believable term rather than a perfect one: a live 6-day run, an 11-day
-- best earlier in the semester, and real gaps where life got in the way.
-- Anchored to current_date so it stays current whenever it is seeded.
-- =============================================================================
do $$
declare
  v_user uuid := '4f6d1a52-9c8e-4c0b-9a1e-0b7c2d5e8f31';
  -- Days ago that were active. The first six are the run still going.
  v_active int[] := array[
    0,1,2,3,4,5,
    7,8,9,
    12,13,14,15,
    17,18,
    20,21,22,23,24,25,26,27,28,29,30,
    33,34,35,36,
    38,39,40,
    45,46,47,48,
    51,52,
    55,56,57
  ];
  d int;
  v_day date;
  v_xp int;
  v_tasks int;
  v_sets int;
  v_questions int;
  v_focus int;
begin
  delete from public.activity_days where user_id = v_user;
  delete from public.achievements  where user_id = v_user;

  foreach d in array v_active loop
    v_day := current_date - d;

    -- Deterministic but uneven, so the heatmap reads like a real term.
    v_tasks     := (d * 7) % 3;
    v_sets      := case when (d * 5) % 4 = 0 then 1 else 0 end;
    v_questions := v_sets * (5 + ((d * 3) % 6));
    v_focus     := case
                     when d = 4  then 135          -- the day deep work was earned
                     when (d * 11) % 5 = 0 then 50
                     when (d * 11) % 3 = 0 then 25
                     else 0
                   end;

    v_xp := least(
      150,
      v_tasks * 12 + v_sets * 15 + v_questions * 2 + (v_focus / 10) * 6
    );
    -- Every listed day must actually count toward the streak.
    if v_xp < 10 then
      v_xp := 10 + ((d * 13) % 25);
      if v_tasks = 0 and v_sets = 0 and v_focus = 0 then v_tasks := 1; end if;
    end if;

    insert into public.activity_days
      (user_id, day, tasks_completed, practice_sessions, questions_answered,
       focus_minutes, grades_logged, xp, is_demo)
    values (v_user, v_day, v_tasks, v_sets, v_questions, v_focus, 0, v_xp, true);
  end loop;

  -- Achievements the seeded history genuinely supports.
  insert into public.achievements (user_id, code, evidence, is_demo, unlocked_at) values
    (v_user,'first_task',      'First task completed',              true, now() - interval '56 days'),
    (v_user,'first_practice',  'First practice set finished',       true, now() - interval '55 days'),
    (v_user,'first_syllabus',  '2 syllabi uploaded',                true, now() - interval '16 days'),
    (v_user,'streak_3',        '11 day streak',                     true, now() - interval '48 days'),
    (v_user,'streak_7',        '11 day streak',                     true, now() - interval '25 days'),
    (v_user,'deep_work',       '135 focus minutes in one day',      true, now() - interval '4 days'),
    (v_user,'full_house',      '5 courses with every weight entered', true, now() - interval '11 days'),
    (v_user,'early_bird',      'A task finished before 09:00',      true, now() - interval '9 days')
  on conflict (user_id, code) do nothing;
end $$;

-- =============================================================================
-- Demo flashcards.
--
-- Spread across boxes and due dates on purpose: a deck where everything is due
-- at once, or nothing is, shows neither the queue nor the distribution. This
-- gives the demo a handful due today and the rest scheduled ahead.
-- =============================================================================
do $$
declare
  v_user     uuid := '4f6d1a52-9c8e-4c0b-9a1e-0b7c2d5e8f31';
  v_today    date := current_date;
  c_ce301    uuid;
  c_ce315    uuid;
  c_math201  uuid;
begin
  select id into c_ce301   from public.courses where user_id = v_user and course_code = 'CE301';
  select id into c_ce315   from public.courses where user_id = v_user and course_code = 'CE315';
  select id into c_math201 from public.courses where user_id = v_user and course_code = 'MATH201';

  delete from public.flashcards where user_id = v_user and is_demo;

  insert into public.flashcards
    (user_id, course_id, front, back, topic, source, box, due_on, reviews, lapses, is_demo)
  values
    -- Due today: the queue the student lands on.
    (v_user, c_ce301, 'What does the convolution theorem let you replace?',
     'Convolution in the time domain with multiplication in the frequency domain — and the other way round.',
     'Fourier transforms', 'manual', 1, v_today, 2, 1, true),
    (v_user, c_ce301, 'State the Nyquist–Shannon sampling condition.',
     'Sample at more than twice the highest frequency present, or the spectrum folds back on itself and the signal cannot be recovered.',
     'Sampling', 'manual', 2, v_today, 4, 1, true),
    (v_user, c_ce315, 'Why is an FIR filter always stable?',
     'It has no feedback path, so the impulse response is finite and no pole can sit outside the unit circle.',
     'Filters', 'manual', 1, v_today, 1, 0, true),
    (v_user, c_math201, 'When is a first-order ODE exact?',
     'When ∂M/∂y = ∂N/∂x for M dx + N dy = 0 — then a potential function exists.',
     'Exact equations', 'manual', 1, v_today, 3, 2, true),
    (v_user, c_math201, 'What does the Wronskian being non-zero tell you?',
     'The solutions are linearly independent, so together they span the solution space.',
     'Linear independence', 'manual', 2, v_today, 2, 0, true),

    -- Scheduled ahead: these fill out the box distribution.
    (v_user, c_ce301, 'What is aliasing, in one sentence?',
     'A frequency above half the sampling rate reappearing as a lower one, indistinguishable from a real signal at that frequency.',
     'Sampling', 'manual', 3, v_today + 2, 6, 1, true),
    (v_user, c_ce301, 'What does the region of convergence of a z-transform decide?',
     'Whether the system is causal, stable, or neither — the transform alone does not say.',
     'z-transform', 'manual', 3, v_today + 3, 5, 0, true),
    (v_user, c_ce315, 'What is the point of a pipeline in a processor?',
     'Throughput, not latency: one instruction still takes the same time, but one finishes every cycle.',
     'Pipelining', 'manual', 4, v_today + 6, 8, 1, true),
    (v_user, c_ce315, 'What causes a structural hazard?',
     'Two instructions needing the same hardware in the same cycle.',
     'Hazards', 'manual', 4, v_today + 8, 7, 0, true),
    (v_user, c_ce315, 'Write the formula for average memory access time.',
     'Hit time + miss rate × miss penalty.',
     'Caches', 'manual', 5, v_today + 15, 11, 0, true),
    (v_user, c_math201, 'What does the Laplace transform turn differentiation into?',
     'Multiplication by s, minus the initial conditions — which is why it turns an ODE into algebra.',
     'Laplace transforms', 'manual', 5, v_today + 19, 12, 1, true),
    (v_user, c_math201, 'When does the method of undetermined coefficients fail?',
     'When the guess already solves the homogeneous equation — multiply by t until it does not.',
     'Non-homogeneous equations', 'manual', 2, v_today + 1, 3, 1, true);

  raise notice 'Demo flashcards seeded: % cards',
    (select count(*) from public.flashcards where user_id = v_user and is_demo);
end $$;

-- =============================================================================
-- Demo hub links.
--
-- Real destinations, so the page demonstrates itself rather than showing
-- placeholder rows that go nowhere.
-- =============================================================================
do $$
declare v_user uuid := '4f6d1a52-9c8e-4c0b-9a1e-0b7c2d5e8f31';
begin
  delete from public.hub_links where user_id = v_user and is_demo;

  insert into public.hub_links (user_id, title, url, description, kind, position, is_pinned, is_demo)
  values
    (v_user, 'UniMate', 'https://unimate-pied.vercel.app',
     'This app, live.', 'project', 1, true, true),
    (v_user, 'Plana — Digital Planner Studio', 'https://github.com/ghlyahalajmi/plana-digital-planner-studio',
     null, 'project', 2, false, true),
    (v_user, 'Day 6', 'https://github.com/ghlyahalajmi/day6', null, 'project', 3, false, true),
    (v_user, 'Day 5', 'https://github.com/ghlyahalajmi/day5', null, 'project', 4, false, true),

    (v_user, 'Kuwait University', 'https://kuweb.ku.edu.kw',
     'Registration, transcripts and the academic calendar.', 'university', 1, true, true),
    (v_user, 'College of Engineering', 'https://eng.ku.edu.kw',
     'Department pages and announcements.', 'university', 2, false, true),

    (v_user, 'Supabase dashboard', 'https://supabase.com/dashboard',
     'The database behind this app.', 'resource', 1, false, true),
    -- Shown on the Student Hub page. A preview URL, so it will need updating
    -- when the class hub gets a production domain.
    (v_user, 'Class hub',
     'https://myport-git-claude-upbeat-bohr-312ris-t021551-3544.vercel.app/hub',
     'The hub the class published.', 'class', 1, true, true),
    (v_user, 'uniMate repository', 'https://github.com/ghlyahalajmi/uniMate',
     'Where the team works: issues, branches and pull requests.', 'class', 2, false, true),
    (v_user, 'Pull requests', 'https://github.com/ghlyahalajmi/uniMate/pulls',
     'What is waiting for review.', 'class', 3, false, true),
    (v_user, 'CI runs', 'https://github.com/ghlyahalajmi/uniMate/actions',
     'Whether the last push is green.', 'class', 4, false, true);

  raise notice 'Demo hub links seeded: %',
    (select count(*) from public.hub_links where user_id = v_user and is_demo);
end $$;

-- =============================================================================
-- Demo notes for Dana Hamad: the quick checklist she keeps outside her course
-- work, with a couple of lines already ticked off and two reminders set.
-- =============================================================================
do $$
declare
  v_user uuid := '4f6d1a52-9c8e-4c0b-9a1e-0b7c2d5e8f31';
  n_week uuid;
  n_life uuid;
begin
  insert into public.notes (user_id, title, position, is_demo)
  values (v_user, 'Before Sunday', 0, true) returning id into n_week;

  insert into public.notes (user_id, title, position, is_demo)
  values (v_user, 'Shopping', 1, true) returning id into n_life;

  insert into public.note_items
    (user_id, note_id, content, is_done, completed_at, remind_at, position, is_demo)
  values
    (v_user, n_week, 'Email Dr. Al-Sabah about the CE315 syllabus', true,
     now() - interval '2 days', null, 0, true),
    (v_user, n_week, 'Return the library books', false, null,
     date_trunc('hour', now()) + interval '5 hours', 1, true),
    (v_user, n_week, 'Print the CE340 lab report', false, null,
     date_trunc('day', now()) + interval '1 day 9 hours', 2, true),
    (v_user, n_week, 'Ask Layla for her MATH201 notes', false, null, null, 3, true),
    (v_user, n_life, 'Notebook and highlighters', true,
     now() - interval '1 day', null, 0, true),
    (v_user, n_life, 'Coffee', false, null, null, 1, true);

  raise notice 'UniMate demo notes seeded';
end $$;

-- =============================================================================
-- Demo study plan for Dana: a revision plan for the maths midterm she is
-- behind on. Courses and assessments are looked up rather than hard-coded, so
-- this block stays correct if the data above is edited.
-- =============================================================================
do $$
declare
  v_user     uuid := '4f6d1a52-9c8e-4c0b-9a1e-0b7c2d5e8f31';
  v_today    date := current_date;
  c_math201  uuid;
  a_math_mid uuid;
  p_math     uuid;
begin
  select id into c_math201 from public.courses
   where user_id = v_user and course_code = 'MATH201';

  select id into a_math_mid from public.grades
   where user_id = v_user and course_id = c_math201
     and assessment_type = 'midterm'
   order by due_date
   limit 1;

  insert into public.study_plans
    (user_id, course_id, assessment_id, title, goal, status,
     starts_on, ends_on, total_minutes, source, is_demo)
  values
    (v_user, c_math201, a_math_mid,
     'MATH201 Midterm 1 revision',
     'Lift the weakest three topics before the midterm, 45 minutes at a time.',
     'active', v_today - 6, v_today + 18, 540, 'ai', true)
  returning id into p_math;

  insert into public.study_plan_items
    (user_id, plan_id, topic, scheduled_on, minutes, position, completed_at, is_demo)
  values
    (v_user, p_math, 'Limits and continuity',       v_today - 6,  45, 1, now() - interval '6 days', true),
    (v_user, p_math, 'Derivative rules',            v_today - 4,  45, 2, now() - interval '4 days', true),
    (v_user, p_math, 'Implicit differentiation',    v_today - 1,  60, 3, now() - interval '1 day',  true),
    (v_user, p_math, 'Related rates',               v_today + 2,  60, 4, null, true),
    (v_user, p_math, 'Optimisation problems',       v_today + 5,  60, 5, null, true),
    (v_user, p_math, 'Integration by substitution', v_today + 9,  90, 6, null, true),
    (v_user, p_math, 'Mixed past-paper practice',   v_today + 14, 90, 7, null, true),
    (v_user, p_math, 'Full timed past paper',       v_today + 17, 90, 8, null, true);

  raise notice 'UniMate demo study plan seeded';
end $$;

-- =============================================================================
-- Demo coach state.
--
-- Milestones are derived from the real seeded history rather than asserted:
-- the counts below are read back from the tables the earlier blocks filled, so
-- the demo cannot show a milestone its own data does not support.
-- =============================================================================
do $$
declare
  v_user     uuid := '4f6d1a52-9c8e-4c0b-9a1e-0b7c2d5e8f31';
  v_tasks    int;
  v_sessions int;
  v_streak   int;
begin
  select count(*) into v_tasks
    from public.tasks where user_id = v_user and status = 'completed';
  select count(*) into v_sessions
    from public.study_sessions where user_id = v_user and total_questions > 0;
  select coalesce(current_streak, 0) into v_streak
    from public.streaks where user_id = v_user;

  update public.profiles set degree_credits = 120 where user_id = v_user;

  insert into public.milestones (user_id, code, target, current_progress, status, completed_at, celebrated_at, is_demo)
  values
    (v_user, 'first_task',    1,  least(v_tasks, 1),    case when v_tasks    >= 1 then 'completed' else 'active' end::public.milestone_status,
     case when v_tasks    >= 1 then now() - interval '56 days' else null end,
     case when v_tasks    >= 1 then now() - interval '56 days' else null end, true),
    (v_user, 'first_session', 1,  least(v_sessions, 1), case when v_sessions >= 1 then 'completed' else 'active' end::public.milestone_status,
     case when v_sessions >= 1 then now() - interval '55 days' else null end,
     case when v_sessions >= 1 then now() - interval '55 days' else null end, true),
    (v_user, 'tasks_10',      10, least(v_tasks, 10),   case when v_tasks    >= 10 then 'completed' else 'active' end::public.milestone_status,
     case when v_tasks    >= 10 then now() - interval '20 days' else null end,
     case when v_tasks    >= 10 then now() - interval '20 days' else null end, true),
    (v_user, 'streak_7',      7,  least(v_streak, 7),   case when v_streak   >= 7 then 'completed' else 'active' end::public.milestone_status,
     case when v_streak   >= 7 then now() - interval '25 days' else null end,
     case when v_streak   >= 7 then now() - interval '25 days' else null end, true)
  on conflict (user_id, code) do nothing;

  insert into public.motivation_logs (user_id, message, trigger, tone, context, from_ai, is_demo, created_at)
  values
    (v_user, 'A strong week: tasks completed and steady study time. Keep the momentum going.',
     'daily_coach', 'positive',
     jsonb_build_object('tasksLast7', v_tasks, 'streak', v_streak), false, true, now() - interval '2 days'),
    (v_user, 'Your quiz average improved. That is real progress — keep going.',
     'daily_coach', 'positive',
     jsonb_build_object('sessions', v_sessions), false, true, now() - interval '1 day'),
    (v_user, 'Your MATH201 assessment is coming up. Let us focus on the highest-impact topics first.',
     'daily_coach', 'steady',
     jsonb_build_object('course', 'MATH201'), false, true, now() - interval '4 hours');

  raise notice 'UniMate demo coach state seeded (% tasks, % sessions, % day streak)',
    v_tasks, v_sessions, v_streak;
end $$;
