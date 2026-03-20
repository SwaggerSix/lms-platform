-- =============================================================
-- Seed demo data for all feature areas
-- =============================================================
-- User reference IDs:
--   super_admin: 15c13083-5558-4b42-a461-9547957fde23 (Chris Cancialosi)
--   admin:       3c73f299-242f-4e69-9f3d-9f6bdd729a23 (Sarah Mitchell)
--   manager1:    020a29ac-0d4e-4903-9867-005692ab2636 (David Chen)
--   manager2:    73906523-5e9b-42f3-87a2-be1a118d7f24 (Maria Rodriguez)
--   instructor1: 6712b2b7-8bcb-48bd-bb7f-0716b53f834c (James Wilson)
--   instructor2: 9dd5b27e-2686-4034-a918-0e4591da6cda (Emily Patel)
--   learner1:    f161432a-82fd-40b0-adb2-34b4165f1d51 (Sophia Wright)
--   learner2:    a35e52a0-2b20-4bfc-8d31-1d997f556541 (Marcus Brown)
--   learner3:    ab05e484-d78f-4f1b-93e2-c25077992547 (Alex Kumar)
--   learner4:    b4006311-fc93-4f9c-ae71-c33ec4ad4fa4 (Jessica Lee)
--   learner5:    4909cbc7-cb19-4535-8661-6163cf03220d (Ryan Garcia)
--   learner6:    62e65e2e-396b-47ef-9eb8-a567aef74e7c (Nina Jackson)
--   learner7:    c9c45bd2-bba7-44e5-b353-4f3ff32264c1 (Tom Baker)

-- =============================================================
-- ENROLLMENTS (users in courses)
-- =============================================================
INSERT INTO enrollments (user_id, course_id, status, enrolled_at, started_at, completed_at, score, time_spent) VALUES
  ('f161432a-82fd-40b0-adb2-34b4165f1d51', '20000000-0000-0000-0000-000000000001', 'completed', now() - interval '45 days', now() - interval '44 days', now() - interval '10 days', 88, 420),
  ('f161432a-82fd-40b0-adb2-34b4165f1d51', '20000000-0000-0000-0000-000000000002', 'in_progress', now() - interval '20 days', now() - interval '19 days', NULL, NULL, 180),
  ('a35e52a0-2b20-4bfc-8d31-1d997f556541', '20000000-0000-0000-0000-000000000003', 'completed', now() - interval '60 days', now() - interval '59 days', now() - interval '30 days', 92, 110),
  ('a35e52a0-2b20-4bfc-8d31-1d997f556541', '20000000-0000-0000-0000-000000000004', 'in_progress', now() - interval '15 days', now() - interval '14 days', NULL, NULL, 240),
  ('ab05e484-d78f-4f1b-93e2-c25077992547', '20000000-0000-0000-0000-000000000005', 'completed', now() - interval '30 days', now() - interval '29 days', now() - interval '5 days', 95, 300),
  ('ab05e484-d78f-4f1b-93e2-c25077992547', '20000000-0000-0000-0000-000000000001', 'in_progress', now() - interval '10 days', now() - interval '9 days', NULL, NULL, 120),
  ('b4006311-fc93-4f9c-ae71-c33ec4ad4fa4', '20000000-0000-0000-0000-000000000006', 'in_progress', now() - interval '25 days', now() - interval '24 days', NULL, NULL, 90),
  ('4909cbc7-cb19-4535-8661-6163cf03220d', '20000000-0000-0000-0000-000000000002', 'completed', now() - interval '40 days', now() - interval '39 days', now() - interval '15 days', 85, 340),
  ('62e65e2e-396b-47ef-9eb8-a567aef74e7c', '20000000-0000-0000-0000-000000000007', 'in_progress', now() - interval '12 days', now() - interval '11 days', NULL, NULL, 60),
  ('c9c45bd2-bba7-44e5-b353-4f3ff32264c1', '20000000-0000-0000-0000-000000000008', 'completed', now() - interval '50 days', now() - interval '49 days', now() - interval '20 days', 78, 200)
ON CONFLICT DO NOTHING;

-- =============================================================
-- USER CERTIFICATIONS
-- =============================================================
INSERT INTO user_certifications (user_id, certification_id, issued_at, expires_at, status, verification_code) VALUES
  ('f161432a-82fd-40b0-adb2-34b4165f1d51', '80000000-0000-0000-0000-000000000001', now() - interval '10 days', now() + interval '355 days', 'active', 'CERT-SW-2026-001'),
  ('a35e52a0-2b20-4bfc-8d31-1d997f556541', '80000000-0000-0000-0000-000000000002', now() - interval '30 days', now() + interval '335 days', 'active', 'CERT-MB-2026-002'),
  ('ab05e484-d78f-4f1b-93e2-c25077992547', '80000000-0000-0000-0000-000000000001', now() - interval '60 days', now() + interval '305 days', 'active', 'CERT-AK-2026-003'),
  ('4909cbc7-cb19-4535-8661-6163cf03220d', '80000000-0000-0000-0000-000000000003', now() - interval '300 days', now() + interval '65 days', 'active', 'CERT-RG-2025-004')
ON CONFLICT DO NOTHING;

-- =============================================================
-- USER SKILLS
-- =============================================================
INSERT INTO user_skills (user_id, skill_id, proficiency_level, source) VALUES
  ('f161432a-82fd-40b0-adb2-34b4165f1d51', '50000000-0000-0000-0000-000000000001', 3, 'course_completion'),
  ('f161432a-82fd-40b0-adb2-34b4165f1d51', '50000000-0000-0000-0000-000000000002', 2, 'course_completion'),
  ('a35e52a0-2b20-4bfc-8d31-1d997f556541', '50000000-0000-0000-0000-000000000003', 4, 'assessment'),
  ('a35e52a0-2b20-4bfc-8d31-1d997f556541', '50000000-0000-0000-0000-000000000004', 3, 'course_completion'),
  ('ab05e484-d78f-4f1b-93e2-c25077992547', '50000000-0000-0000-0000-000000000001', 5, 'assessment'),
  ('ab05e484-d78f-4f1b-93e2-c25077992547', '50000000-0000-0000-0000-000000000005', 2, 'course_completion'),
  ('b4006311-fc93-4f9c-ae71-c33ec4ad4fa4', '50000000-0000-0000-0000-000000000002', 3, 'course_completion'),
  ('4909cbc7-cb19-4535-8661-6163cf03220d', '50000000-0000-0000-0000-000000000006', 4, 'assessment'),
  ('62e65e2e-396b-47ef-9eb8-a567aef74e7c', '50000000-0000-0000-0000-000000000003', 2, 'course_completion'),
  ('c9c45bd2-bba7-44e5-b353-4f3ff32264c1', '50000000-0000-0000-0000-000000000004', 3, 'course_completion')
ON CONFLICT DO NOTHING;

-- =============================================================
-- ECOMMERCE: Products, Orders, Order Items
-- =============================================================
INSERT INTO products (id, course_id, price, currency, discount_price, is_featured, sales_count, status) VALUES
  ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 49.99, 'USD', 39.99, true, 24, 'active'),
  ('60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000004', 79.99, 'USD', NULL, true, 18, 'active'),
  ('60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000005', 59.99, 'USD', 44.99, false, 12, 'active'),
  ('60000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000006', 99.99, 'USD', NULL, true, 8, 'active'),
  ('60000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000012', 34.99, 'USD', 29.99, false, 31, 'active')
ON CONFLICT DO NOTHING;

INSERT INTO orders (id, user_id, order_number, status, subtotal, discount_amount, tax_amount, total, currency, payment_method, created_at) VALUES
  ('61000000-0000-0000-0000-000000000001', 'f161432a-82fd-40b0-adb2-34b4165f1d51', 'ORD-2026-0001', 'completed', 49.99, 10.00, 3.60, 43.59, 'USD', 'card', now() - interval '20 days'),
  ('61000000-0000-0000-0000-000000000002', 'a35e52a0-2b20-4bfc-8d31-1d997f556541', 'ORD-2026-0002', 'completed', 139.98, 0.00, 11.20, 151.18, 'USD', 'card', now() - interval '15 days'),
  ('61000000-0000-0000-0000-000000000003', 'ab05e484-d78f-4f1b-93e2-c25077992547', 'ORD-2026-0003', 'pending', 59.99, 15.00, 4.05, 49.04, 'USD', 'card', now() - interval '2 days')
ON CONFLICT DO NOTHING;

INSERT INTO order_items (order_id, product_id, course_id, price, quantity) VALUES
  ('61000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 49.99, 1),
  ('61000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000004', 79.99, 1),
  ('61000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000005', 59.99, 1),
  ('61000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000005', 59.99, 1)
ON CONFLICT DO NOTHING;

-- =============================================================
-- DISCUSSIONS
-- =============================================================
INSERT INTO discussions (id, course_id, user_id, parent_id, title, body, is_pinned, upvotes, created_at) VALUES
  ('62000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'f161432a-82fd-40b0-adb2-34b4165f1d51', NULL, 'Tips for the final project?', 'I''m working on the capstone data science project. Any tips on choosing a good dataset? I''m thinking of using something from Kaggle.', true, 5, now() - interval '14 days'),
  ('62000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'a35e52a0-2b20-4bfc-8d31-1d997f556541', NULL, 'Python virtual environments confusion', 'Can someone explain the difference between venv, conda, and pipenv? I keep running into dependency conflicts.', false, 3, now() - interval '10 days'),
  ('62000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004', 'ab05e484-d78f-4f1b-93e2-c25077992547', NULL, 'Best practices for async/await', 'What are the common pitfalls when using async/await in Python? I find myself getting confused about when to use it.', false, 7, now() - interval '7 days'),
  -- Replies
  ('62000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '6712b2b7-8bcb-48bd-bb7f-0716b53f834c', '62000000-0000-0000-0000-000000000001', NULL, 'Great question! I recommend starting with a smaller dataset first to prototype your pipeline. The NYC Taxi dataset is excellent for learning.', false, 2, now() - interval '13 days'),
  ('62000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'b4006311-fc93-4f9c-ae71-c33ec4ad4fa4', '62000000-0000-0000-0000-000000000001', NULL, 'I used the Airbnb dataset for my project and it went really well. Lots of features to explore!', false, 1, now() - interval '12 days'),
  ('62000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', '9dd5b27e-2686-4034-a918-0e4591da6cda', '62000000-0000-0000-0000-000000000002', NULL, 'Use venv for simple projects, conda for data science (it manages non-Python deps too), and pipenv is being replaced by Poetry these days.', false, 4, now() - interval '9 days'),
  ('62000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000004', '6712b2b7-8bcb-48bd-bb7f-0716b53f834c', '62000000-0000-0000-0000-000000000003', NULL, 'The biggest pitfall is forgetting that async functions need to be awaited. Always remember: if you call an async function without await, you get a coroutine object, not the result.', false, 6, now() - interval '6 days'),
  ('62000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000004', '4909cbc7-cb19-4535-8661-6163cf03220d', '62000000-0000-0000-0000-000000000003', NULL, 'Also watch out for blocking calls inside async code. Use aiohttp instead of requests, and asyncpg instead of psycopg2.', false, 3, now() - interval '5 days')
ON CONFLICT DO NOTHING;

-- =============================================================
-- CONVERSATIONS & MESSAGES
-- =============================================================
INSERT INTO conversations (id, type, title, created_by, created_at) VALUES
  ('63000000-0000-0000-0000-000000000001', 'direct', NULL, 'f161432a-82fd-40b0-adb2-34b4165f1d51', now() - interval '7 days'),
  ('63000000-0000-0000-0000-000000000002', 'group', 'Study Group: Data Science', 'a35e52a0-2b20-4bfc-8d31-1d997f556541', now() - interval '5 days')
ON CONFLICT DO NOTHING;

INSERT INTO conversation_participants (conversation_id, user_id, joined_at) VALUES
  ('63000000-0000-0000-0000-000000000001', 'f161432a-82fd-40b0-adb2-34b4165f1d51', now() - interval '7 days'),
  ('63000000-0000-0000-0000-000000000001', '6712b2b7-8bcb-48bd-bb7f-0716b53f834c', now() - interval '7 days'),
  ('63000000-0000-0000-0000-000000000002', 'a35e52a0-2b20-4bfc-8d31-1d997f556541', now() - interval '5 days'),
  ('63000000-0000-0000-0000-000000000002', 'ab05e484-d78f-4f1b-93e2-c25077992547', now() - interval '5 days'),
  ('63000000-0000-0000-0000-000000000002', 'f161432a-82fd-40b0-adb2-34b4165f1d51', now() - interval '5 days')
ON CONFLICT DO NOTHING;

INSERT INTO messages (id, conversation_id, sender_id, content, message_type, created_at) VALUES
  ('64000000-0000-0000-0000-000000000001', '63000000-0000-0000-0000-000000000001', 'f161432a-82fd-40b0-adb2-34b4165f1d51', 'Hi Professor Wilson! I had a question about the machine learning module.', 'text', now() - interval '7 days'),
  ('64000000-0000-0000-0000-000000000002', '63000000-0000-0000-0000-000000000001', '6712b2b7-8bcb-48bd-bb7f-0716b53f834c', 'Of course, Sophia! What would you like to know?', 'text', now() - interval '6 days' + interval '2 hours'),
  ('64000000-0000-0000-0000-000000000003', '63000000-0000-0000-0000-000000000001', 'f161432a-82fd-40b0-adb2-34b4165f1d51', 'I''m struggling with gradient descent. Could you explain the learning rate concept?', 'text', now() - interval '6 days' + interval '4 hours'),
  ('64000000-0000-0000-0000-000000000004', '63000000-0000-0000-0000-000000000002', 'a35e52a0-2b20-4bfc-8d31-1d997f556541', 'Hey everyone! Created this group so we can study together for the data science course.', 'text', now() - interval '5 days'),
  ('64000000-0000-0000-0000-000000000005', '63000000-0000-0000-0000-000000000002', 'ab05e484-d78f-4f1b-93e2-c25077992547', 'Great idea Marcus! I''m in. When should we meet?', 'text', now() - interval '4 days' + interval '3 hours')
ON CONFLICT DO NOTHING;

-- =============================================================
-- MENTORSHIP
-- =============================================================
INSERT INTO mentor_profiles (user_id, expertise_areas, availability, max_mentees, current_mentee_count, bio, years_experience, timezone, rating, total_reviews, is_active) VALUES
  ('6712b2b7-8bcb-48bd-bb7f-0716b53f834c', '["Python", "Machine Learning", "Cloud Architecture"]', 'available', 3, 1, 'Senior software engineer with 12 years of experience. Passionate about mentoring the next generation of developers.', 12, 'America/New_York', 4.8, 5, true),
  ('9dd5b27e-2686-4034-a918-0e4591da6cda', '["Leadership", "Project Management", "Agile"]', 'available', 2, 1, 'Engineering manager and certified Scrum Master. I help people grow into leadership roles.', 8, 'America/Chicago', 4.6, 3, true),
  ('020a29ac-0d4e-4903-9867-005692ab2636', '["Team Management", "Career Development", "Technical Strategy"]', 'limited', 2, 0, 'VP of Engineering. I enjoy helping engineers navigate their career paths.', 15, 'America/Los_Angeles', 4.9, 7, true)
ON CONFLICT DO NOTHING;

INSERT INTO mentorship_requests (id, mentee_id, mentor_id, status, goals, preferred_areas, match_score, matched_at, created_at) VALUES
  ('65000000-0000-0000-0000-000000000001', 'f161432a-82fd-40b0-adb2-34b4165f1d51', '6712b2b7-8bcb-48bd-bb7f-0716b53f834c', 'active', 'Improve my Python skills and learn ML fundamentals', '["Python", "Machine Learning"]', 92.5, now() - interval '20 days', now() - interval '25 days'),
  ('65000000-0000-0000-0000-000000000002', 'a35e52a0-2b20-4bfc-8d31-1d997f556541', '9dd5b27e-2686-4034-a918-0e4591da6cda', 'active', 'Transition from IC to engineering manager', '["Leadership", "Project Management"]', 88.0, now() - interval '15 days', now() - interval '18 days'),
  ('65000000-0000-0000-0000-000000000003', 'ab05e484-d78f-4f1b-93e2-c25077992547', '6712b2b7-8bcb-48bd-bb7f-0716b53f834c', 'pending', 'Learn cloud architecture best practices', '["Cloud Architecture"]', NULL, NULL, now() - interval '3 days')
ON CONFLICT DO NOTHING;

-- =============================================================
-- 360 FEEDBACK
-- =============================================================
INSERT INTO feedback_competencies (id, name, description, category, is_active) VALUES
  ('66000000-0000-0000-0000-000000000001', 'Communication', 'Ability to clearly convey ideas and information', 'Soft Skills', true),
  ('66000000-0000-0000-0000-000000000002', 'Technical Excellence', 'Depth and breadth of technical knowledge', 'Technical', true),
  ('66000000-0000-0000-0000-000000000003', 'Collaboration', 'Works effectively with team members', 'Soft Skills', true),
  ('66000000-0000-0000-0000-000000000004', 'Problem Solving', 'Approaches challenges with creativity and rigor', 'Technical', true),
  ('66000000-0000-0000-0000-000000000005', 'Leadership', 'Inspires and guides others toward goals', 'Leadership', true)
ON CONFLICT DO NOTHING;

INSERT INTO feedback_cycles (id, name, description, status, cycle_type, start_date, end_date, anonymous, created_by, created_at) VALUES
  ('67000000-0000-0000-0000-000000000001', 'Q1 2026 Performance Review', 'Quarterly peer feedback cycle for Q1', 'active', '360', now() - interval '30 days', now() + interval '30 days', true, '3c73f299-242f-4e69-9f3d-9f6bdd729a23', now() - interval '35 days'),
  ('67000000-0000-0000-0000-000000000002', 'Q4 2025 Performance Review', 'Quarterly peer feedback for Q4 2025', 'closed', '360', now() - interval '120 days', now() - interval '60 days', true, '3c73f299-242f-4e69-9f3d-9f6bdd729a23', now() - interval '125 days')
ON CONFLICT DO NOTHING;

INSERT INTO feedback_nominations (cycle_id, subject_id, reviewer_id, relationship, status, nominated_by) VALUES
  ('67000000-0000-0000-0000-000000000001', 'f161432a-82fd-40b0-adb2-34b4165f1d51', 'a35e52a0-2b20-4bfc-8d31-1d997f556541', 'peer', 'pending', '020a29ac-0d4e-4903-9867-005692ab2636'),
  ('67000000-0000-0000-0000-000000000001', 'f161432a-82fd-40b0-adb2-34b4165f1d51', '020a29ac-0d4e-4903-9867-005692ab2636', 'manager', 'in_progress', '020a29ac-0d4e-4903-9867-005692ab2636'),
  ('67000000-0000-0000-0000-000000000001', 'a35e52a0-2b20-4bfc-8d31-1d997f556541', 'f161432a-82fd-40b0-adb2-34b4165f1d51', 'peer', 'pending', '020a29ac-0d4e-4903-9867-005692ab2636'),
  ('67000000-0000-0000-0000-000000000001', 'a35e52a0-2b20-4bfc-8d31-1d997f556541', '6712b2b7-8bcb-48bd-bb7f-0716b53f834c', 'peer', 'completed', '020a29ac-0d4e-4903-9867-005692ab2636')
ON CONFLICT DO NOTHING;

-- =============================================================
-- MICROLEARNING
-- =============================================================
INSERT INTO microlearning_nuggets (id, title, content_type, content, tags, difficulty, estimated_seconds, is_active, view_count, created_at) VALUES
  ('68000000-0000-0000-0000-000000000001', 'Python List Comprehension', 'tip', '{"text": "List comprehensions provide a concise way to create lists."}', '["python", "programming"]', 'beginner', 60, true, 45, now() - interval '20 days'),
  ('68000000-0000-0000-0000-000000000002', 'SQL JOIN Types', 'flashcard', '{"front": "INNER JOIN vs LEFT JOIN?", "back": "INNER returns matching rows. LEFT returns all left rows."}', '["sql", "databases"]', 'beginner', 45, true, 38, now() - interval '18 days'),
  ('68000000-0000-0000-0000-000000000003', 'Agile Estimation', 'quiz', '{"question": "Which technique uses Fibonacci?", "options": ["T-shirt sizing", "Planning Poker", "Dot voting"], "correct": 1}', '["agile", "project-management"]', 'intermediate', 30, true, 52, now() - interval '15 days'),
  ('68000000-0000-0000-0000-000000000004', 'Git Branch Strategy', 'tip', '{"text": "Trunk-based development recommends short-lived feature branches."}', '["git", "devops"]', 'intermediate', 45, true, 29, now() - interval '12 days'),
  ('68000000-0000-0000-0000-000000000005', 'OSHA Workplace Safety', 'flashcard', '{"front": "What is the OSHA General Duty Clause?", "back": "Employers must provide a workplace free from recognized hazards."}', '["compliance", "safety"]', 'beginner', 30, true, 67, now() - interval '10 days'),
  ('68000000-0000-0000-0000-000000000006', 'Leadership Communication', 'tip', '{"text": "The SBI feedback model: Situation, Behavior, Impact."}', '["leadership", "communication"]', 'intermediate', 60, true, 41, now() - interval '8 days')
ON CONFLICT DO NOTHING;

-- =============================================================
-- OBSERVATIONS
-- =============================================================
INSERT INTO observation_templates (id, name, description, category, items, passing_score, is_active, created_by) VALUES
  ('69000000-0000-0000-0000-000000000001', 'Customer Service Skills Assessment', 'Evaluate customer-facing communication and problem-solving skills', 'Soft Skills', '[{"label": "Greeting and introduction", "max_score": 5}, {"label": "Active listening demonstrated", "max_score": 5}, {"label": "Problem identification", "max_score": 5}, {"label": "Solution presentation", "max_score": 5}, {"label": "Professional closing", "max_score": 5}]', 80.00, true, '3c73f299-242f-4e69-9f3d-9f6bdd729a23'),
  ('69000000-0000-0000-0000-000000000002', 'Technical Presentation Review', 'Assess presentation skills for technical topics', 'Technical', '[{"label": "Content accuracy", "max_score": 5}, {"label": "Slide design and clarity", "max_score": 5}, {"label": "Audience engagement", "max_score": 5}, {"label": "Q&A handling", "max_score": 5}, {"label": "Time management", "max_score": 5}]', 75.00, true, '9dd5b27e-2686-4034-a918-0e4591da6cda')
ON CONFLICT DO NOTHING;

INSERT INTO observations (id, template_id, observer_id, subject_id, course_id, status, scheduled_at, completed_at, notes, overall_score, responses) VALUES
  ('6a000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000001', '020a29ac-0d4e-4903-9867-005692ab2636', 'f161432a-82fd-40b0-adb2-34b4165f1d51', NULL, 'completed', now() - interval '10 days', now() - interval '9 days', 'Excellent customer interaction. Sophia showed strong empathy and problem-solving skills.', 92.00, '{"scores": [5, 4, 5, 5, 4]}'),
  ('6a000000-0000-0000-0000-000000000002', '69000000-0000-0000-0000-000000000002', '9dd5b27e-2686-4034-a918-0e4591da6cda', 'a35e52a0-2b20-4bfc-8d31-1d997f556541', '20000000-0000-0000-0000-000000000004', 'in_progress', now() - interval '2 days', NULL, NULL, NULL, '{}'),
  ('6a000000-0000-0000-0000-000000000003', '69000000-0000-0000-0000-000000000001', '73906523-5e9b-42f3-87a2-be1a118d7f24', 'b4006311-fc93-4f9c-ae71-c33ec4ad4fa4', NULL, 'draft', now() + interval '5 days', NULL, NULL, NULL, '{}')
ON CONFLICT DO NOTHING;

-- =============================================================
-- PREDICTIVE ANALYTICS
-- =============================================================
INSERT INTO risk_predictions (user_id, course_id, risk_level, risk_score, factors, recommended_actions, prediction_model, computed_at) VALUES
  ('b4006311-fc93-4f9c-ae71-c33ec4ad4fa4', '20000000-0000-0000-0000-000000000006', 'high', 0.82, '{"low_engagement": true, "no_login_7_days": true, "behind_schedule": true}', '["Send engagement reminder", "Assign peer buddy", "Schedule check-in with manager"]', 'gradient_boost_v2', now() - interval '1 day'),
  ('62e65e2e-396b-47ef-9eb8-a567aef74e7c', '20000000-0000-0000-0000-000000000007', 'medium', 0.55, '{"slow_progress": true, "low_quiz_scores": true}', '["Recommend prerequisite review", "Offer tutoring session"]', 'gradient_boost_v2', now() - interval '1 day'),
  ('f161432a-82fd-40b0-adb2-34b4165f1d51', '20000000-0000-0000-0000-000000000002', 'low', 0.15, '{"consistent_progress": true}', '["Continue current pace"]', 'gradient_boost_v2', now() - interval '1 day'),
  ('a35e52a0-2b20-4bfc-8d31-1d997f556541', '20000000-0000-0000-0000-000000000004', 'medium', 0.48, '{"declining_engagement": true}', '["Send motivational content", "Check workload balance"]', 'gradient_boost_v2', now() - interval '1 day')
ON CONFLICT DO NOTHING;

INSERT INTO learning_analytics_snapshots (user_id, snapshot_date, courses_enrolled, courses_completed, avg_progress, avg_score, login_streak, total_time_minutes, engagement_score) VALUES
  ('f161432a-82fd-40b0-adb2-34b4165f1d51', CURRENT_DATE - 1, 2, 1, 75.0, 88.0, 7, 600, 85.0),
  ('a35e52a0-2b20-4bfc-8d31-1d997f556541', CURRENT_DATE - 1, 2, 1, 60.0, 92.0, 3, 350, 72.0),
  ('ab05e484-d78f-4f1b-93e2-c25077992547', CURRENT_DATE - 1, 2, 1, 80.0, 95.0, 12, 420, 90.0),
  ('b4006311-fc93-4f9c-ae71-c33ec4ad4fa4', CURRENT_DATE - 1, 1, 0, 25.0, NULL, 1, 90, 30.0),
  ('4909cbc7-cb19-4535-8661-6163cf03220d', CURRENT_DATE - 1, 1, 1, 100.0, 85.0, 5, 340, 78.0),
  ('62e65e2e-396b-47ef-9eb8-a567aef74e7c', CURRENT_DATE - 1, 1, 0, 35.0, NULL, 2, 60, 40.0)
ON CONFLICT DO NOTHING;

-- =============================================================
-- AUDIT LOGS
-- =============================================================
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, created_at) VALUES
  ('3c73f299-242f-4e69-9f3d-9f6bdd729a23', 'create', 'course_completion', '20000000-0000-0000-0000-000000000001', '192.168.1.10', now() - interval '30 days'),
  ('3c73f299-242f-4e69-9f3d-9f6bdd729a23', 'update', 'course_completion', '20000000-0000-0000-0000-000000000001', '192.168.1.10', now() - interval '29 days'),
  ('6712b2b7-8bcb-48bd-bb7f-0716b53f834c', 'create', 'assessment', '40000000-0000-0000-0000-000000000001', '10.0.0.5', now() - interval '25 days'),
  ('020a29ac-0d4e-4903-9867-005692ab2636', 'update', 'user', 'f161432a-82fd-40b0-adb2-34b4165f1d51', '172.16.0.1', now() - interval '20 days'),
  ('3c73f299-242f-4e69-9f3d-9f6bdd729a23', 'create', 'product', '60000000-0000-0000-0000-000000000001', '192.168.1.10', now() - interval '15 days'),
  ('15c13083-5558-4b42-a461-9547957fde23', 'update', 'settings', NULL, '10.10.10.1', now() - interval '10 days'),
  ('3c73f299-242f-4e69-9f3d-9f6bdd729a23', 'delete', 'enrollment', NULL, '192.168.1.10', now() - interval '5 days')
ON CONFLICT DO NOTHING;
