-- ============================================
-- SEED DATA for LearnHub LMS
-- ============================================

-- Organizations
INSERT INTO organizations (id, name, type, parent_id) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Acme Corporation', 'company', NULL),
  ('00000000-0000-0000-0000-000000000002', 'Engineering', 'department', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000003', 'Sales', 'department', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000004', 'Marketing', 'department', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000005', 'Human Resources', 'department', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000006', 'Finance', 'department', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000007', 'Frontend Team', 'team', '00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000008', 'Backend Team', 'team', '00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000009', 'DevOps Team', 'team', '00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000010', 'Enterprise Sales', 'team', '00000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000011', 'SMB Sales', 'team', '00000000-0000-0000-0000-000000000003');

-- Categories
INSERT INTO categories (id, name, slug, description) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Technology', 'technology', 'Technical skills and programming courses'),
  ('10000000-0000-0000-0000-000000000002', 'Leadership', 'leadership', 'Management and leadership development'),
  ('10000000-0000-0000-0000-000000000003', 'Compliance', 'compliance', 'Regulatory and compliance training'),
  ('10000000-0000-0000-0000-000000000004', 'Business Skills', 'business-skills', 'Professional and business skills'),
  ('10000000-0000-0000-0000-000000000005', 'Soft Skills', 'soft-skills', 'Communication and interpersonal skills'),
  ('10000000-0000-0000-0000-000000000006', 'Data & Analytics', 'data-analytics', 'Data science and analytics courses'),
  ('10000000-0000-0000-0000-000000000007', 'Design', 'design', 'UX/UI design and creative skills'),
  ('10000000-0000-0000-0000-000000000008', 'Sales', 'sales', 'Sales techniques and strategy');

-- Courses
INSERT INTO courses (id, title, slug, description, short_description, category_id, status, course_type, difficulty_level, estimated_duration, passing_score, enrollment_type, tags, published_at) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Introduction to Data Science', 'intro-data-science',
   'A comprehensive introduction to data science covering Python, statistics, machine learning, and data visualization. Learn to extract insights from data and build predictive models.',
   'Learn the fundamentals of data science with hands-on projects.',
   '10000000-0000-0000-0000-000000000006', 'published', 'self_paced', 'beginner', 480, 70, 'open',
   ARRAY['python', 'data-science', 'machine-learning'], now() - interval '30 days'),

  ('20000000-0000-0000-0000-000000000002', 'Leadership Essentials', 'leadership-essentials',
   'Develop core leadership competencies including strategic thinking, team management, decision-making, and effective communication for new and aspiring leaders.',
   'Build the leadership skills you need to manage and inspire teams.',
   '10000000-0000-0000-0000-000000000002', 'published', 'blended', 'intermediate', 360, 75, 'open',
   ARRAY['leadership', 'management', 'soft-skills'], now() - interval '60 days'),

  ('20000000-0000-0000-0000-000000000003', 'Workplace Safety Compliance', 'workplace-safety',
   'Mandatory workplace safety training covering OSHA regulations, emergency procedures, hazard identification, and incident reporting.',
   'Required annual safety training for all employees.',
   '10000000-0000-0000-0000-000000000003', 'published', 'self_paced', 'beginner', 120, 80, 'assigned',
   ARRAY['safety', 'osha', 'compliance'], now() - interval '90 days'),

  ('20000000-0000-0000-0000-000000000004', 'Advanced Python Programming', 'advanced-python',
   'Deep dive into advanced Python concepts including decorators, generators, metaclasses, concurrency, and design patterns for building production-grade applications.',
   'Master advanced Python techniques for production systems.',
   '10000000-0000-0000-0000-000000000001', 'published', 'self_paced', 'advanced', 600, 70, 'open',
   ARRAY['python', 'programming', 'advanced'], now() - interval '15 days'),

  ('20000000-0000-0000-0000-000000000005', 'Effective Communication Skills', 'effective-communication',
   'Master the art of professional communication including presentations, written communication, active listening, and conflict resolution.',
   'Improve your professional communication across all channels.',
   '10000000-0000-0000-0000-000000000005', 'published', 'instructor_led', 'beginner', 240, 70, 'open',
   ARRAY['communication', 'presentations', 'soft-skills'], now() - interval '45 days'),

  ('20000000-0000-0000-0000-000000000006', 'Project Management Professional', 'project-management',
   'Comprehensive project management training aligned with PMI standards covering planning, execution, monitoring, and closing projects successfully.',
   'Learn project management best practices aligned with PMI standards.',
   '10000000-0000-0000-0000-000000000004', 'published', 'self_paced', 'intermediate', 540, 75, 'open',
   ARRAY['project-management', 'pmi', 'agile'], now() - interval '20 days'),

  ('20000000-0000-0000-0000-000000000007', 'Cybersecurity Fundamentals', 'cybersecurity-fundamentals',
   'Essential cybersecurity training covering threat landscapes, security best practices, incident response, and data protection for all employees.',
   'Protect yourself and the organization from cyber threats.',
   '10000000-0000-0000-0000-000000000001', 'published', 'self_paced', 'beginner', 180, 80, 'assigned',
   ARRAY['cybersecurity', 'security', 'compliance'], now() - interval '75 days'),

  ('20000000-0000-0000-0000-000000000008', 'Design Thinking Workshop', 'design-thinking',
   'Learn the design thinking methodology to solve complex problems through empathy, ideation, prototyping, and testing.',
   'Apply design thinking to solve real business problems.',
   '10000000-0000-0000-0000-000000000007', 'published', 'instructor_led', 'intermediate', 300, 70, 'open',
   ARRAY['design-thinking', 'innovation', 'problem-solving'], now() - interval '10 days'),

  ('20000000-0000-0000-0000-000000000009', 'Financial Literacy for Managers', 'financial-literacy',
   'Understanding financial statements, budgeting, forecasting, and financial decision-making for non-finance managers.',
   'Make better financial decisions as a manager.',
   '10000000-0000-0000-0000-000000000004', 'published', 'self_paced', 'intermediate', 300, 70, 'open',
   ARRAY['finance', 'budgeting', 'management'], now() - interval '35 days'),

  ('20000000-0000-0000-0000-000000000010', 'Agile & Scrum Mastery', 'agile-scrum',
   'Master Agile methodologies and Scrum framework including sprint planning, daily standups, retrospectives, and product backlog management.',
   'Become proficient in Agile and Scrum practices.',
   '10000000-0000-0000-0000-000000000004', 'published', 'blended', 'intermediate', 360, 75, 'open',
   ARRAY['agile', 'scrum', 'project-management'], now() - interval '25 days'),

  ('20000000-0000-0000-0000-000000000011', 'DEI in the Workplace', 'dei-workplace',
   'Building an inclusive workplace through understanding diversity, equity, and inclusion principles, unconscious bias, and creating belonging.',
   'Foster a more inclusive and equitable workplace.',
   '10000000-0000-0000-0000-000000000003', 'published', 'self_paced', 'beginner', 90, 80, 'assigned',
   ARRAY['dei', 'inclusion', 'compliance'], now() - interval '120 days'),

  ('20000000-0000-0000-0000-000000000012', 'Cloud Architecture Fundamentals', 'cloud-architecture',
   'Learn cloud computing principles, AWS/Azure/GCP services, cloud architecture patterns, and best practices for building scalable cloud solutions.',
   'Build scalable applications on cloud platforms.',
   '10000000-0000-0000-0000-000000000001', 'published', 'self_paced', 'advanced', 540, 70, 'open',
   ARRAY['cloud', 'aws', 'architecture'], now() - interval '5 days');

-- Modules and Lessons for "Introduction to Data Science"
INSERT INTO modules (id, course_id, title, description, sequence_order) VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Python Fundamentals', 'Core Python programming for data science', 1),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Data Analysis with Pandas', 'Data manipulation and analysis', 2),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Machine Learning Basics', 'Introduction to ML algorithms', 3);

INSERT INTO lessons (id, module_id, title, content_type, duration, sequence_order) VALUES
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Setting Up Your Environment', 'video', 20, 1),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Python Data Types & Variables', 'video', 35, 2),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'Control Flow & Functions', 'video', 40, 3),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'Python Fundamentals Quiz', 'quiz', 15, 4),
  ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002', 'Introduction to Pandas', 'video', 30, 1),
  ('40000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000002', 'DataFrames & Series', 'video', 45, 2),
  ('40000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000002', 'Data Cleaning Techniques', 'document', 25, 3),
  ('40000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000003', 'Supervised Learning', 'video', 50, 1),
  ('40000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000003', 'Model Evaluation', 'video', 35, 2),
  ('40000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000003', 'Final Assessment', 'quiz', 30, 3);

-- Modules and Lessons for "Leadership Essentials"
INSERT INTO modules (id, course_id, title, description, sequence_order) VALUES
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'Foundations of Leadership', 'Core leadership principles', 1),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', 'Team Management', 'Building and managing teams', 2),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', 'Strategic Thinking', 'Developing strategic mindset', 3);

INSERT INTO lessons (id, module_id, title, content_type, duration, sequence_order) VALUES
  ('40000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000004', 'What Makes a Great Leader', 'video', 25, 1),
  ('40000000-0000-0000-0000-000000000012', '30000000-0000-0000-0000-000000000004', 'Leadership Styles Assessment', 'quiz', 15, 2),
  ('40000000-0000-0000-0000-000000000013', '30000000-0000-0000-0000-000000000004', 'Emotional Intelligence', 'video', 35, 3),
  ('40000000-0000-0000-0000-000000000014', '30000000-0000-0000-0000-000000000005', 'Building High-Performance Teams', 'video', 40, 1),
  ('40000000-0000-0000-0000-000000000015', '30000000-0000-0000-0000-000000000005', 'Delegation & Empowerment', 'document', 20, 2),
  ('40000000-0000-0000-0000-000000000016', '30000000-0000-0000-0000-000000000005', 'Conflict Resolution', 'video', 30, 3),
  ('40000000-0000-0000-0000-000000000017', '30000000-0000-0000-0000-000000000006', 'Strategic Planning Framework', 'video', 45, 1),
  ('40000000-0000-0000-0000-000000000018', '30000000-0000-0000-0000-000000000006', 'Decision Making Under Uncertainty', 'assignment', 30, 2);

-- Skills
INSERT INTO skills (id, name, category, description, parent_id) VALUES
  ('50000000-0000-0000-0000-000000000001', 'JavaScript', 'Technical', 'JavaScript programming language', NULL),
  ('50000000-0000-0000-0000-000000000002', 'Python', 'Technical', 'Python programming language', NULL),
  ('50000000-0000-0000-0000-000000000003', 'React', 'Technical', 'React frontend framework', NULL),
  ('50000000-0000-0000-0000-000000000004', 'SQL', 'Technical', 'Database query language', NULL),
  ('50000000-0000-0000-0000-000000000005', 'Cloud Computing', 'Technical', 'Cloud platforms and services', NULL),
  ('50000000-0000-0000-0000-000000000006', 'Data Analysis', 'Technical', 'Data analysis and visualization', NULL),
  ('50000000-0000-0000-0000-000000000007', 'Machine Learning', 'Technical', 'ML algorithms and models', NULL),
  ('50000000-0000-0000-0000-000000000008', 'Communication', 'Soft Skills', 'Professional communication', NULL),
  ('50000000-0000-0000-0000-000000000009', 'Leadership', 'Soft Skills', 'Leadership and management', NULL),
  ('50000000-0000-0000-0000-000000000010', 'Problem Solving', 'Soft Skills', 'Analytical problem solving', NULL),
  ('50000000-0000-0000-0000-000000000011', 'Project Management', 'Business', 'Project planning and execution', NULL),
  ('50000000-0000-0000-0000-000000000012', 'Strategic Planning', 'Business', 'Business strategy development', NULL),
  ('50000000-0000-0000-0000-000000000013', 'Data Science', 'Technical', 'End-to-end data science', NULL),
  ('50000000-0000-0000-0000-000000000014', 'Cybersecurity', 'Technical', 'Security principles and practices', NULL),
  ('50000000-0000-0000-0000-000000000015', 'Agile', 'Business', 'Agile methodologies', NULL);

-- Course-Skill mappings
INSERT INTO course_skills (course_id, skill_id, proficiency_gained) VALUES
  ('20000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', 3),
  ('20000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000006', 3),
  ('20000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000007', 2),
  ('20000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000013', 3),
  ('20000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000009', 3),
  ('20000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000008', 2),
  ('20000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002', 5),
  ('20000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000011', 4),
  ('20000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000015', 3),
  ('20000000-0000-0000-0000-000000000007', '50000000-0000-0000-0000-000000000014', 3),
  ('20000000-0000-0000-0000-000000000010', '50000000-0000-0000-0000-000000000015', 4),
  ('20000000-0000-0000-0000-000000000012', '50000000-0000-0000-0000-000000000005', 4);

-- Learning Paths
INSERT INTO learning_paths (id, title, slug, description, status, estimated_duration, is_sequential, tags) VALUES
  ('60000000-0000-0000-0000-000000000001', 'Data Science Career Path', 'data-science-career',
   'A comprehensive learning path to launch your data science career, from Python basics to machine learning.',
   'published', 1620, true, ARRAY['data-science', 'career']),
  ('60000000-0000-0000-0000-000000000002', 'Leadership Development Program', 'leadership-development',
   'Develop the skills needed to become an effective leader and manager.',
   'published', 900, true, ARRAY['leadership', 'management']),
  ('60000000-0000-0000-0000-000000000003', 'New Employee Onboarding', 'new-employee-onboarding',
   'Essential training for all new employees covering safety, compliance, and company culture.',
   'published', 390, false, ARRAY['onboarding', 'compliance']),
  ('60000000-0000-0000-0000-000000000004', 'Full Stack Developer Track', 'fullstack-developer',
   'Build comprehensive web development skills from frontend to backend to cloud deployment.',
   'published', 1620, true, ARRAY['development', 'web', 'fullstack']),
  ('60000000-0000-0000-0000-000000000005', 'Compliance Essentials Bundle', 'compliance-essentials',
   'All required compliance training courses bundled together for convenience.',
   'published', 390, false, ARRAY['compliance', 'mandatory']);

INSERT INTO learning_path_items (path_id, course_id, sequence_order, is_required) VALUES
  ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, true),
  ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 2, true),
  ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000006', 3, false),
  ('60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 1, true),
  ('60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000005', 2, true),
  ('60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000009', 3, true),
  ('60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 1, true),
  ('60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000007', 2, true),
  ('60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000011', 3, true),
  ('60000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', 1, true),
  ('60000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000007', 2, true),
  ('60000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000011', 3, true);

-- Assessments
INSERT INTO assessments (id, course_id, title, description, passing_score, time_limit, max_attempts, randomize_questions, show_correct_answers) VALUES
  ('70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Data Science Fundamentals Quiz', 'Test your understanding of data science basics', 70, 30, 3, true, true),
  ('70000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Leadership Assessment', 'Evaluate your leadership knowledge', 75, 25, 2, false, true),
  ('70000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'Safety Compliance Exam', 'Annual safety compliance certification exam', 80, 45, 3, true, false),
  ('70000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000007', 'Cybersecurity Awareness Quiz', 'Test your cybersecurity knowledge', 80, 20, 3, true, true),
  ('70000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000010', 'Agile Methodology Exam', 'Comprehensive Agile and Scrum assessment', 75, 40, 2, true, true),
  ('70000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000011', 'DEI Knowledge Check', 'Assess understanding of DEI principles', 80, 15, 3, false, true);

-- Questions for Data Science Quiz
INSERT INTO questions (assessment_id, question_text, question_type, points, explanation, sequence_order, options) VALUES
  ('70000000-0000-0000-0000-000000000001', 'What is the primary purpose of exploratory data analysis (EDA)?', 'multiple_choice', 1,
   'EDA helps us understand patterns, spot anomalies, and test hypotheses before formal modeling.',
   1, '[{"text":"To build production ML models","is_correct":false},{"text":"To understand data patterns and distributions","is_correct":true},{"text":"To deploy data pipelines","is_correct":false},{"text":"To create databases","is_correct":false}]'),
  ('70000000-0000-0000-0000-000000000001', 'Which Python library is primarily used for data manipulation?', 'multiple_choice', 1,
   'Pandas is the standard library for data manipulation and analysis in Python.',
   2, '[{"text":"NumPy","is_correct":false},{"text":"Matplotlib","is_correct":false},{"text":"Pandas","is_correct":true},{"text":"Scikit-learn","is_correct":false}]'),
  ('70000000-0000-0000-0000-000000000001', 'What is overfitting in machine learning?', 'multiple_choice', 1,
   'Overfitting occurs when a model learns noise in training data rather than the underlying pattern.',
   3, '[{"text":"Model performs well on both training and test data","is_correct":false},{"text":"Model performs well on training data but poorly on unseen data","is_correct":true},{"text":"Model performs poorly on all data","is_correct":false},{"text":"Model takes too long to train","is_correct":false}]'),
  ('70000000-0000-0000-0000-000000000001', 'Select all supervised learning algorithms:', 'multi_select', 2,
   'Linear Regression, Decision Trees, and Random Forest are all supervised learning algorithms.',
   4, '[{"text":"Linear Regression","is_correct":true},{"text":"K-Means Clustering","is_correct":false},{"text":"Decision Trees","is_correct":true},{"text":"Random Forest","is_correct":true},{"text":"PCA","is_correct":false}]'),
  ('70000000-0000-0000-0000-000000000001', 'A DataFrame in Pandas is a one-dimensional data structure.', 'true_false', 1,
   'A DataFrame is a two-dimensional tabular data structure with rows and columns.',
   5, '[{"text":"True","is_correct":false},{"text":"False","is_correct":true}]'),
  ('70000000-0000-0000-0000-000000000001', 'What metric would you use to evaluate a classification model?', 'multiple_choice', 1,
   'Accuracy, precision, recall, and F1-score are common classification metrics.',
   6, '[{"text":"Mean Squared Error","is_correct":false},{"text":"R-squared","is_correct":false},{"text":"F1-Score","is_correct":true},{"text":"Mean Absolute Error","is_correct":false}]'),
  ('70000000-0000-0000-0000-000000000001', 'What is the purpose of cross-validation?', 'multiple_choice', 1,
   'Cross-validation provides a robust estimate of model performance by testing on multiple data splits.',
   7, '[{"text":"To speed up training","is_correct":false},{"text":"To reliably estimate model performance","is_correct":true},{"text":"To reduce model size","is_correct":false},{"text":"To visualize data","is_correct":false}]'),
  ('70000000-0000-0000-0000-000000000001', 'Which technique is used to handle missing data?', 'multi_select', 2,
   'Imputation and deletion are common strategies for handling missing data.',
   8, '[{"text":"Mean imputation","is_correct":true},{"text":"Dropping rows with missing values","is_correct":true},{"text":"Forward fill","is_correct":true},{"text":"Ignoring them completely","is_correct":false}]'),
  ('70000000-0000-0000-0000-000000000001', 'What does the term "feature engineering" refer to?', 'multiple_choice', 1,
   'Feature engineering is the process of creating new input features from existing data to improve model performance.',
   9, '[{"text":"Building software features","is_correct":false},{"text":"Creating new input variables from existing data","is_correct":true},{"text":"Selecting the best algorithm","is_correct":false},{"text":"Tuning hyperparameters","is_correct":false}]'),
  ('70000000-0000-0000-0000-000000000001', 'The bias-variance tradeoff describes the balance between model complexity and generalization.', 'true_false', 1,
   'The bias-variance tradeoff is a fundamental concept: simpler models have high bias, complex models have high variance.',
   10, '[{"text":"True","is_correct":true},{"text":"False","is_correct":false}]');

-- Certifications
INSERT INTO certifications (id, name, description, validity_months, recertification_course_id) VALUES
  ('80000000-0000-0000-0000-000000000001', 'Workplace Safety Certified', 'Certification for completing annual workplace safety training', 12, '20000000-0000-0000-0000-000000000003'),
  ('80000000-0000-0000-0000-000000000002', 'Data Privacy Certified', 'Certification for data privacy and GDPR compliance', 12, NULL),
  ('80000000-0000-0000-0000-000000000003', 'Leadership Fundamentals', 'Certification in core leadership competencies', 24, '20000000-0000-0000-0000-000000000002'),
  ('80000000-0000-0000-0000-000000000004', 'Cybersecurity Awareness', 'Annual cybersecurity awareness certification', 12, '20000000-0000-0000-0000-000000000007');

-- Compliance Requirements
INSERT INTO compliance_requirements (id, name, description, regulation, course_id, frequency_months, applicable_roles, is_mandatory) VALUES
  ('90000000-0000-0000-0000-000000000001', 'Annual Safety Training', 'OSHA-mandated workplace safety training', 'OSHA', '20000000-0000-0000-0000-000000000003', 12, ARRAY['learner','instructor','manager','admin','super_admin'], true),
  ('90000000-0000-0000-0000-000000000002', 'Cybersecurity Awareness', 'Annual cybersecurity awareness training', 'SOC2', '20000000-0000-0000-0000-000000000007', 12, ARRAY['learner','instructor','manager','admin','super_admin'], true),
  ('90000000-0000-0000-0000-000000000003', 'DEI Training', 'Annual diversity, equity, and inclusion training', 'Corporate', '20000000-0000-0000-0000-000000000011', 12, ARRAY['learner','instructor','manager','admin','super_admin'], true),
  ('90000000-0000-0000-0000-000000000004', 'Anti-Harassment Training', 'Preventing workplace harassment', 'Corporate', NULL, 12, ARRAY['learner','instructor','manager','admin','super_admin'], true),
  ('90000000-0000-0000-0000-000000000005', 'Data Privacy (GDPR)', 'GDPR compliance for data handlers', 'GDPR', NULL, 12, ARRAY['admin','super_admin','manager'], true);

-- Badges
INSERT INTO badges (id, name, description, image_url, criteria, category) VALUES
  ('A0000000-0000-0000-0000-000000000001', 'First Steps', 'Complete your first course', NULL, '{"type":"courses_completed","threshold":1}', 'milestone'),
  ('A0000000-0000-0000-0000-000000000002', 'Quick Learner', 'Complete 5 courses', NULL, '{"type":"courses_completed","threshold":5}', 'milestone'),
  ('A0000000-0000-0000-0000-000000000003', 'Quiz Master', 'Score 100% on any assessment', NULL, '{"type":"perfect_score","threshold":1}', 'achievement'),
  ('A0000000-0000-0000-0000-000000000004', 'Social Butterfly', 'Post 10 discussion comments', NULL, '{"type":"discussions_posted","threshold":10}', 'social'),
  ('A0000000-0000-0000-0000-000000000005', 'Streak Champion', 'Maintain a 7-day learning streak', NULL, '{"type":"streak_days","threshold":7}', 'streak'),
  ('A0000000-0000-0000-0000-000000000006', 'Completionist', 'Complete an entire learning path', NULL, '{"type":"paths_completed","threshold":1}', 'milestone'),
  ('A0000000-0000-0000-0000-000000000007', 'Top Scorer', 'Earn over 1000 points', NULL, '{"type":"total_points","threshold":1000}', 'achievement'),
  ('A0000000-0000-0000-0000-000000000008', 'Mentor', 'Have a discussion answer marked as best answer', NULL, '{"type":"best_answers","threshold":1}', 'social'),
  ('A0000000-0000-0000-0000-000000000009', 'Knowledge Seeker', 'Enroll in 10 courses', NULL, '{"type":"enrollments","threshold":10}', 'milestone'),
  ('A0000000-0000-0000-0000-000000000010', 'Safety Star', 'Complete all compliance training', NULL, '{"type":"compliance_complete","threshold":1}', 'compliance'),
  ('A0000000-0000-0000-0000-000000000011', 'Speed Runner', 'Complete a course in under half the estimated time', NULL, '{"type":"speed_completion","threshold":1}', 'achievement'),
  ('A0000000-0000-0000-0000-000000000012', 'Certified Pro', 'Earn 3 certifications', NULL, '{"type":"certifications_earned","threshold":3}', 'milestone');

-- Competency Frameworks
INSERT INTO competency_frameworks (id, name, description, applicable_roles, skills) VALUES
  ('B0000000-0000-0000-0000-000000000001', 'Software Engineer Competencies', 'Required skills for software engineering roles',
   ARRAY['learner'], '[{"skill_id":"50000000-0000-0000-0000-000000000001","target_proficiency":4},{"skill_id":"50000000-0000-0000-0000-000000000002","target_proficiency":3},{"skill_id":"50000000-0000-0000-0000-000000000003","target_proficiency":4},{"skill_id":"50000000-0000-0000-0000-000000000004","target_proficiency":3},{"skill_id":"50000000-0000-0000-0000-000000000005","target_proficiency":3}]'),
  ('B0000000-0000-0000-0000-000000000002', 'Team Lead Competencies', 'Required skills for team lead roles',
   ARRAY['manager'], '[{"skill_id":"50000000-0000-0000-0000-000000000009","target_proficiency":4},{"skill_id":"50000000-0000-0000-0000-000000000008","target_proficiency":4},{"skill_id":"50000000-0000-0000-0000-000000000011","target_proficiency":3},{"skill_id":"50000000-0000-0000-0000-000000000010","target_proficiency":4}]'),
  ('B0000000-0000-0000-0000-000000000003', 'Data Analyst Competencies', 'Required skills for data analyst roles',
   ARRAY['learner'], '[{"skill_id":"50000000-0000-0000-0000-000000000002","target_proficiency":4},{"skill_id":"50000000-0000-0000-0000-000000000004","target_proficiency":4},{"skill_id":"50000000-0000-0000-0000-000000000006","target_proficiency":4},{"skill_id":"50000000-0000-0000-0000-000000000013","target_proficiency":3}]');
