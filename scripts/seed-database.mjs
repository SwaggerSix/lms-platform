/**
 * Seed the Supabase database with LMS data via the REST API.
 * Run: node scripts/seed-database.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://aexpaugbycnaxbiyidmo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFleHBhdWdieWNuYXhiaXlpZG1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzcwMjYwMiwiZXhwIjoyMDg5Mjc4NjAyfQ.mBCm3sD3ohG5ta0XJ-UsOjYiOFxJEIH6-fflYRH6_Y0'
);

async function insert(table, data) {
  const { error } = await supabase.from(table).upsert(data, { onConflict: 'id' });
  if (error) {
    console.error(`  ✗ ${table}: ${error.message}`);
    return false;
  }
  console.log(`  ✓ ${table}: ${Array.isArray(data) ? data.length : 1} rows`);
  return true;
}

async function seed() {
  console.log('🌱 Seeding LearnHub LMS database...\n');

  // ── Organizations ──
  console.log('Organizations...');
  await insert('organizations', [
    { id: '00000000-0000-0000-0000-000000000001', name: 'Acme Corporation', type: 'company', parent_id: null },
    { id: '00000000-0000-0000-0000-000000000002', name: 'Engineering', type: 'department', parent_id: '00000000-0000-0000-0000-000000000001' },
    { id: '00000000-0000-0000-0000-000000000003', name: 'Sales', type: 'department', parent_id: '00000000-0000-0000-0000-000000000001' },
    { id: '00000000-0000-0000-0000-000000000004', name: 'Marketing', type: 'department', parent_id: '00000000-0000-0000-0000-000000000001' },
    { id: '00000000-0000-0000-0000-000000000005', name: 'Human Resources', type: 'department', parent_id: '00000000-0000-0000-0000-000000000001' },
    { id: '00000000-0000-0000-0000-000000000006', name: 'Finance', type: 'department', parent_id: '00000000-0000-0000-0000-000000000001' },
    { id: '00000000-0000-0000-0000-000000000007', name: 'Frontend Team', type: 'team', parent_id: '00000000-0000-0000-0000-000000000002' },
    { id: '00000000-0000-0000-0000-000000000008', name: 'Backend Team', type: 'team', parent_id: '00000000-0000-0000-0000-000000000002' },
    { id: '00000000-0000-0000-0000-000000000009', name: 'DevOps Team', type: 'team', parent_id: '00000000-0000-0000-0000-000000000002' },
    { id: '00000000-0000-0000-0000-000000000010', name: 'Enterprise Sales', type: 'team', parent_id: '00000000-0000-0000-0000-000000000003' },
    { id: '00000000-0000-0000-0000-000000000011', name: 'SMB Sales', type: 'team', parent_id: '00000000-0000-0000-0000-000000000003' },
  ]);

  // ── Categories ──
  console.log('Categories...');
  await insert('categories', [
    { id: '10000000-0000-0000-0000-000000000001', name: 'Technology', slug: 'technology', description: 'Technical skills and programming courses' },
    { id: '10000000-0000-0000-0000-000000000002', name: 'Leadership', slug: 'leadership', description: 'Management and leadership development' },
    { id: '10000000-0000-0000-0000-000000000003', name: 'Compliance', slug: 'compliance', description: 'Regulatory and compliance training' },
    { id: '10000000-0000-0000-0000-000000000004', name: 'Business Skills', slug: 'business-skills', description: 'Professional and business skills' },
    { id: '10000000-0000-0000-0000-000000000005', name: 'Soft Skills', slug: 'soft-skills', description: 'Communication and interpersonal skills' },
    { id: '10000000-0000-0000-0000-000000000006', name: 'Data & Analytics', slug: 'data-analytics', description: 'Data science and analytics courses' },
    { id: '10000000-0000-0000-0000-000000000007', name: 'Design', slug: 'design', description: 'UX/UI design and creative skills' },
    { id: '10000000-0000-0000-0000-000000000008', name: 'Sales', slug: 'sales', description: 'Sales techniques and strategy' },
  ]);

  // ── Courses ──
  console.log('Courses...');
  const now = new Date();
  const daysAgo = (d) => new Date(now - d * 86400000).toISOString();
  await insert('courses', [
    { id: '20000000-0000-0000-0000-000000000001', title: 'Introduction to Data Science', slug: 'intro-data-science', description: 'A comprehensive introduction to data science covering Python, statistics, machine learning, and data visualization.', short_description: 'Learn the fundamentals of data science with hands-on projects.', category_id: '10000000-0000-0000-0000-000000000006', status: 'published', course_type: 'self_paced', difficulty_level: 'beginner', estimated_duration: 480, passing_score: 70, enrollment_type: 'open', tags: ['python','data-science','machine-learning'], published_at: daysAgo(30) },
    { id: '20000000-0000-0000-0000-000000000002', title: 'Leadership Essentials', slug: 'leadership-essentials', description: 'Develop core leadership competencies including strategic thinking, team management, decision-making, and effective communication.', short_description: 'Build the leadership skills you need to manage and inspire teams.', category_id: '10000000-0000-0000-0000-000000000002', status: 'published', course_type: 'blended', difficulty_level: 'intermediate', estimated_duration: 360, passing_score: 75, enrollment_type: 'open', tags: ['leadership','management','soft-skills'], published_at: daysAgo(60) },
    { id: '20000000-0000-0000-0000-000000000003', title: 'Workplace Safety Compliance', slug: 'workplace-safety', description: 'Mandatory workplace safety training covering OSHA regulations, emergency procedures, hazard identification, and incident reporting.', short_description: 'Required annual safety training for all employees.', category_id: '10000000-0000-0000-0000-000000000003', status: 'published', course_type: 'self_paced', difficulty_level: 'beginner', estimated_duration: 120, passing_score: 80, enrollment_type: 'assigned', tags: ['safety','osha','compliance'], published_at: daysAgo(90) },
    { id: '20000000-0000-0000-0000-000000000004', title: 'Advanced Python Programming', slug: 'advanced-python', description: 'Deep dive into advanced Python concepts including decorators, generators, metaclasses, concurrency, and design patterns.', short_description: 'Master advanced Python techniques for production systems.', category_id: '10000000-0000-0000-0000-000000000001', status: 'published', course_type: 'self_paced', difficulty_level: 'advanced', estimated_duration: 600, passing_score: 70, enrollment_type: 'open', tags: ['python','programming','advanced'], published_at: daysAgo(15) },
    { id: '20000000-0000-0000-0000-000000000005', title: 'Effective Communication Skills', slug: 'effective-communication', description: 'Master the art of professional communication including presentations, written communication, active listening, and conflict resolution.', short_description: 'Improve your professional communication across all channels.', category_id: '10000000-0000-0000-0000-000000000005', status: 'published', course_type: 'instructor_led', difficulty_level: 'beginner', estimated_duration: 240, passing_score: 70, enrollment_type: 'open', tags: ['communication','presentations','soft-skills'], published_at: daysAgo(45) },
    { id: '20000000-0000-0000-0000-000000000006', title: 'Project Management Professional', slug: 'project-management', description: 'Comprehensive project management training aligned with PMI standards.', short_description: 'Learn project management best practices aligned with PMI standards.', category_id: '10000000-0000-0000-0000-000000000004', status: 'published', course_type: 'self_paced', difficulty_level: 'intermediate', estimated_duration: 540, passing_score: 75, enrollment_type: 'open', tags: ['project-management','pmi','agile'], published_at: daysAgo(20) },
    { id: '20000000-0000-0000-0000-000000000007', title: 'Cybersecurity Fundamentals', slug: 'cybersecurity-fundamentals', description: 'Essential cybersecurity training covering threat landscapes, security best practices, incident response, and data protection.', short_description: 'Protect yourself and the organization from cyber threats.', category_id: '10000000-0000-0000-0000-000000000001', status: 'published', course_type: 'self_paced', difficulty_level: 'beginner', estimated_duration: 180, passing_score: 80, enrollment_type: 'assigned', tags: ['cybersecurity','security','compliance'], published_at: daysAgo(75), is_featured: true, featured_order: 3 },
    { id: '20000000-0000-0000-0000-000000000008', title: 'Design Thinking Workshop', slug: 'design-thinking', description: 'Learn the design thinking methodology to solve complex problems through empathy, ideation, prototyping, and testing.', short_description: 'Apply design thinking to solve real business problems.', category_id: '10000000-0000-0000-0000-000000000007', status: 'published', course_type: 'instructor_led', difficulty_level: 'intermediate', estimated_duration: 300, passing_score: 70, enrollment_type: 'open', tags: ['design-thinking','innovation','problem-solving'], published_at: daysAgo(10) },
    { id: '20000000-0000-0000-0000-000000000009', title: 'Financial Literacy for Managers', slug: 'financial-literacy', description: 'Understanding financial statements, budgeting, forecasting, and financial decision-making for non-finance managers.', short_description: 'Make better financial decisions as a manager.', category_id: '10000000-0000-0000-0000-000000000004', status: 'published', course_type: 'self_paced', difficulty_level: 'intermediate', estimated_duration: 300, passing_score: 70, enrollment_type: 'open', tags: ['finance','budgeting','management'], published_at: daysAgo(35), is_featured: true, featured_order: 1 },
    { id: '20000000-0000-0000-0000-000000000010', title: 'Agile & Scrum Mastery', slug: 'agile-scrum', description: 'Master Agile methodologies and Scrum framework including sprint planning, daily standups, retrospectives, and product backlog management.', short_description: 'Become proficient in Agile and Scrum practices.', category_id: '10000000-0000-0000-0000-000000000004', status: 'published', course_type: 'blended', difficulty_level: 'intermediate', estimated_duration: 360, passing_score: 75, enrollment_type: 'open', tags: ['agile','scrum','project-management'], published_at: daysAgo(25) },
    { id: '20000000-0000-0000-0000-000000000011', title: 'DEI in the Workplace', slug: 'dei-workplace', description: 'Building an inclusive workplace through understanding diversity, equity, and inclusion principles, unconscious bias, and creating belonging.', short_description: 'Foster a more inclusive and equitable workplace.', category_id: '10000000-0000-0000-0000-000000000003', status: 'published', course_type: 'self_paced', difficulty_level: 'beginner', estimated_duration: 90, passing_score: 80, enrollment_type: 'assigned', tags: ['dei','inclusion','compliance'], published_at: daysAgo(120) },
    { id: '20000000-0000-0000-0000-000000000012', title: 'Cloud Architecture Fundamentals', slug: 'cloud-architecture', description: 'Learn cloud computing principles, AWS/Azure/GCP services, cloud architecture patterns, and best practices for building scalable cloud solutions.', short_description: 'Build scalable applications on cloud platforms.', category_id: '10000000-0000-0000-0000-000000000001', status: 'published', course_type: 'self_paced', difficulty_level: 'advanced', estimated_duration: 540, passing_score: 70, enrollment_type: 'open', tags: ['cloud','aws','architecture'], published_at: daysAgo(5), is_featured: true, featured_order: 2 },
  ]);

  // ── Modules ──
  console.log('Modules...');
  await insert('modules', [
    { id: '30000000-0000-0000-0000-000000000001', course_id: '20000000-0000-0000-0000-000000000001', title: 'Python Fundamentals', description: 'Core Python programming for data science', sequence_order: 1 },
    { id: '30000000-0000-0000-0000-000000000002', course_id: '20000000-0000-0000-0000-000000000001', title: 'Data Analysis with Pandas', description: 'Data manipulation and analysis', sequence_order: 2 },
    { id: '30000000-0000-0000-0000-000000000003', course_id: '20000000-0000-0000-0000-000000000001', title: 'Machine Learning Basics', description: 'Introduction to ML algorithms', sequence_order: 3 },
    { id: '30000000-0000-0000-0000-000000000004', course_id: '20000000-0000-0000-0000-000000000002', title: 'Foundations of Leadership', description: 'Core leadership principles', sequence_order: 1 },
    { id: '30000000-0000-0000-0000-000000000005', course_id: '20000000-0000-0000-0000-000000000002', title: 'Team Management', description: 'Building and managing teams', sequence_order: 2 },
    { id: '30000000-0000-0000-0000-000000000006', course_id: '20000000-0000-0000-0000-000000000002', title: 'Strategic Thinking', description: 'Developing strategic mindset', sequence_order: 3 },
  ]);

  // ── Lessons ──
  console.log('Lessons...');
  await insert('lessons', [
    { id: '40000000-0000-0000-0000-000000000001', module_id: '30000000-0000-0000-0000-000000000001', title: 'Setting Up Your Environment', content_type: 'video', duration: 20, sequence_order: 1 },
    { id: '40000000-0000-0000-0000-000000000002', module_id: '30000000-0000-0000-0000-000000000001', title: 'Python Data Types & Variables', content_type: 'video', duration: 35, sequence_order: 2 },
    { id: '40000000-0000-0000-0000-000000000003', module_id: '30000000-0000-0000-0000-000000000001', title: 'Control Flow & Functions', content_type: 'video', duration: 40, sequence_order: 3 },
    { id: '40000000-0000-0000-0000-000000000004', module_id: '30000000-0000-0000-0000-000000000001', title: 'Python Fundamentals Quiz', content_type: 'quiz', duration: 15, sequence_order: 4 },
    { id: '40000000-0000-0000-0000-000000000005', module_id: '30000000-0000-0000-0000-000000000002', title: 'Introduction to Pandas', content_type: 'video', duration: 30, sequence_order: 1 },
    { id: '40000000-0000-0000-0000-000000000006', module_id: '30000000-0000-0000-0000-000000000002', title: 'DataFrames & Series', content_type: 'video', duration: 45, sequence_order: 2 },
    { id: '40000000-0000-0000-0000-000000000007', module_id: '30000000-0000-0000-0000-000000000002', title: 'Data Cleaning Techniques', content_type: 'document', duration: 25, sequence_order: 3 },
    { id: '40000000-0000-0000-0000-000000000008', module_id: '30000000-0000-0000-0000-000000000003', title: 'Supervised Learning', content_type: 'video', duration: 50, sequence_order: 1 },
    { id: '40000000-0000-0000-0000-000000000009', module_id: '30000000-0000-0000-0000-000000000003', title: 'Model Evaluation', content_type: 'video', duration: 35, sequence_order: 2 },
    { id: '40000000-0000-0000-0000-000000000010', module_id: '30000000-0000-0000-0000-000000000003', title: 'Final Assessment', content_type: 'quiz', duration: 30, sequence_order: 3 },
    { id: '40000000-0000-0000-0000-000000000011', module_id: '30000000-0000-0000-0000-000000000004', title: 'What Makes a Great Leader', content_type: 'video', duration: 25, sequence_order: 1 },
    { id: '40000000-0000-0000-0000-000000000012', module_id: '30000000-0000-0000-0000-000000000004', title: 'Leadership Styles Assessment', content_type: 'quiz', duration: 15, sequence_order: 2 },
    { id: '40000000-0000-0000-0000-000000000013', module_id: '30000000-0000-0000-0000-000000000004', title: 'Emotional Intelligence', content_type: 'video', duration: 35, sequence_order: 3 },
    { id: '40000000-0000-0000-0000-000000000014', module_id: '30000000-0000-0000-0000-000000000005', title: 'Building High-Performance Teams', content_type: 'video', duration: 40, sequence_order: 1 },
    { id: '40000000-0000-0000-0000-000000000015', module_id: '30000000-0000-0000-0000-000000000005', title: 'Delegation & Empowerment', content_type: 'document', duration: 20, sequence_order: 2 },
    { id: '40000000-0000-0000-0000-000000000016', module_id: '30000000-0000-0000-0000-000000000005', title: 'Conflict Resolution', content_type: 'video', duration: 30, sequence_order: 3 },
    { id: '40000000-0000-0000-0000-000000000017', module_id: '30000000-0000-0000-0000-000000000006', title: 'Strategic Planning Framework', content_type: 'video', duration: 45, sequence_order: 1 },
    { id: '40000000-0000-0000-0000-000000000018', module_id: '30000000-0000-0000-0000-000000000006', title: 'Decision Making Under Uncertainty', content_type: 'assignment', duration: 30, sequence_order: 2 },
  ]);

  // ── Skills ──
  console.log('Skills...');
  await insert('skills', [
    { id: '50000000-0000-0000-0000-000000000001', name: 'JavaScript', category: 'Technical', description: 'JavaScript programming language' },
    { id: '50000000-0000-0000-0000-000000000002', name: 'Python', category: 'Technical', description: 'Python programming language' },
    { id: '50000000-0000-0000-0000-000000000003', name: 'React', category: 'Technical', description: 'React frontend framework' },
    { id: '50000000-0000-0000-0000-000000000004', name: 'SQL', category: 'Technical', description: 'Database query language' },
    { id: '50000000-0000-0000-0000-000000000005', name: 'Cloud Computing', category: 'Technical', description: 'Cloud platforms and services' },
    { id: '50000000-0000-0000-0000-000000000006', name: 'Data Analysis', category: 'Technical', description: 'Data analysis and visualization' },
    { id: '50000000-0000-0000-0000-000000000007', name: 'Machine Learning', category: 'Technical', description: 'ML algorithms and models' },
    { id: '50000000-0000-0000-0000-000000000008', name: 'Communication', category: 'Soft Skills', description: 'Professional communication' },
    { id: '50000000-0000-0000-0000-000000000009', name: 'Leadership', category: 'Soft Skills', description: 'Leadership and management' },
    { id: '50000000-0000-0000-0000-000000000010', name: 'Problem Solving', category: 'Soft Skills', description: 'Analytical problem solving' },
    { id: '50000000-0000-0000-0000-000000000011', name: 'Project Management', category: 'Business', description: 'Project planning and execution' },
    { id: '50000000-0000-0000-0000-000000000012', name: 'Strategic Planning', category: 'Business', description: 'Business strategy development' },
    { id: '50000000-0000-0000-0000-000000000013', name: 'Data Science', category: 'Technical', description: 'End-to-end data science' },
    { id: '50000000-0000-0000-0000-000000000014', name: 'Cybersecurity', category: 'Technical', description: 'Security principles and practices' },
    { id: '50000000-0000-0000-0000-000000000015', name: 'Agile', category: 'Business', description: 'Agile methodologies' },
  ]);

  // ── Course Skills ──
  console.log('Course Skills...');
  const csData = [
    ['20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002',3],
    ['20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000006',3],
    ['20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000007',2],
    ['20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000013',3],
    ['20000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000009',3],
    ['20000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000008',2],
    ['20000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000002',5],
    ['20000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000011',4],
    ['20000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000015',3],
    ['20000000-0000-0000-0000-000000000007','50000000-0000-0000-0000-000000000014',3],
    ['20000000-0000-0000-0000-000000000010','50000000-0000-0000-0000-000000000015',4],
    ['20000000-0000-0000-0000-000000000012','50000000-0000-0000-0000-000000000005',4],
  ];
  const { error: csErr } = await supabase.from('course_skills').upsert(
    csData.map(([course_id, skill_id, proficiency_gained]) => ({ course_id, skill_id, proficiency_gained })),
    { onConflict: 'course_id,skill_id' }
  );
  if (csErr) console.error('  ✗ course_skills:', csErr.message);
  else console.log('  ✓ course_skills: 12 rows');

  // ── Learning Paths ──
  console.log('Learning Paths...');
  await insert('learning_paths', [
    { id: '60000000-0000-0000-0000-000000000001', title: 'Data Science Career Path', slug: 'data-science-career', description: 'A comprehensive learning path to launch your data science career.', status: 'published', estimated_duration: 1620, is_sequential: true, tags: ['data-science','career'] },
    { id: '60000000-0000-0000-0000-000000000002', title: 'Leadership Development Program', slug: 'leadership-development', description: 'Develop the skills needed to become an effective leader.', status: 'published', estimated_duration: 900, is_sequential: true, tags: ['leadership','management'] },
    { id: '60000000-0000-0000-0000-000000000003', title: 'New Employee Onboarding', slug: 'new-employee-onboarding', description: 'Essential training for all new employees.', status: 'published', estimated_duration: 390, is_sequential: false, tags: ['onboarding','compliance'] },
    { id: '60000000-0000-0000-0000-000000000004', title: 'Full Stack Developer Track', slug: 'fullstack-developer', description: 'Build comprehensive web development skills.', status: 'published', estimated_duration: 1620, is_sequential: true, tags: ['development','web','fullstack'] },
    { id: '60000000-0000-0000-0000-000000000005', title: 'Compliance Essentials Bundle', slug: 'compliance-essentials', description: 'All required compliance training courses bundled together.', status: 'published', estimated_duration: 390, is_sequential: false, tags: ['compliance','mandatory'] },
  ]);

  // ── Learning Path Items ──
  console.log('Learning Path Items...');
  const { error: lpiErr } = await supabase.from('learning_path_items').upsert([
    { path_id: '60000000-0000-0000-0000-000000000001', course_id: '20000000-0000-0000-0000-000000000001', sequence_order: 1, is_required: true },
    { path_id: '60000000-0000-0000-0000-000000000001', course_id: '20000000-0000-0000-0000-000000000004', sequence_order: 2, is_required: true },
    { path_id: '60000000-0000-0000-0000-000000000001', course_id: '20000000-0000-0000-0000-000000000006', sequence_order: 3, is_required: false },
    { path_id: '60000000-0000-0000-0000-000000000002', course_id: '20000000-0000-0000-0000-000000000002', sequence_order: 1, is_required: true },
    { path_id: '60000000-0000-0000-0000-000000000002', course_id: '20000000-0000-0000-0000-000000000005', sequence_order: 2, is_required: true },
    { path_id: '60000000-0000-0000-0000-000000000002', course_id: '20000000-0000-0000-0000-000000000009', sequence_order: 3, is_required: true },
    { path_id: '60000000-0000-0000-0000-000000000003', course_id: '20000000-0000-0000-0000-000000000003', sequence_order: 1, is_required: true },
    { path_id: '60000000-0000-0000-0000-000000000003', course_id: '20000000-0000-0000-0000-000000000007', sequence_order: 2, is_required: true },
    { path_id: '60000000-0000-0000-0000-000000000003', course_id: '20000000-0000-0000-0000-000000000011', sequence_order: 3, is_required: true },
    { path_id: '60000000-0000-0000-0000-000000000005', course_id: '20000000-0000-0000-0000-000000000003', sequence_order: 1, is_required: true },
    { path_id: '60000000-0000-0000-0000-000000000005', course_id: '20000000-0000-0000-0000-000000000007', sequence_order: 2, is_required: true },
    { path_id: '60000000-0000-0000-0000-000000000005', course_id: '20000000-0000-0000-0000-000000000011', sequence_order: 3, is_required: true },
  ]);
  if (lpiErr) console.error('  ✗ learning_path_items:', lpiErr.message);
  else console.log('  ✓ learning_path_items: 12 rows');

  // ── Assessments ──
  console.log('Assessments...');
  await insert('assessments', [
    { id: '70000000-0000-0000-0000-000000000001', course_id: '20000000-0000-0000-0000-000000000001', title: 'Data Science Fundamentals Quiz', description: 'Test your understanding of data science basics', passing_score: 70, time_limit: 30, max_attempts: 3, randomize_questions: true, show_correct_answers: true },
    { id: '70000000-0000-0000-0000-000000000002', course_id: '20000000-0000-0000-0000-000000000002', title: 'Leadership Assessment', description: 'Evaluate your leadership knowledge', passing_score: 75, time_limit: 25, max_attempts: 2, randomize_questions: false, show_correct_answers: true },
    { id: '70000000-0000-0000-0000-000000000003', course_id: '20000000-0000-0000-0000-000000000003', title: 'Safety Compliance Exam', description: 'Annual safety compliance certification exam', passing_score: 80, time_limit: 45, max_attempts: 3, randomize_questions: true, show_correct_answers: false },
    { id: '70000000-0000-0000-0000-000000000004', course_id: '20000000-0000-0000-0000-000000000007', title: 'Cybersecurity Awareness Quiz', description: 'Test your cybersecurity knowledge', passing_score: 80, time_limit: 20, max_attempts: 3, randomize_questions: true, show_correct_answers: true },
    { id: '70000000-0000-0000-0000-000000000005', course_id: '20000000-0000-0000-0000-000000000010', title: 'Agile Methodology Exam', description: 'Comprehensive Agile and Scrum assessment', passing_score: 75, time_limit: 40, max_attempts: 2, randomize_questions: true, show_correct_answers: true },
    { id: '70000000-0000-0000-0000-000000000006', course_id: '20000000-0000-0000-0000-000000000011', title: 'DEI Knowledge Check', description: 'Assess understanding of DEI principles', passing_score: 80, time_limit: 15, max_attempts: 3, randomize_questions: false, show_correct_answers: true },
  ]);

  // ── Certifications ──
  console.log('Certifications...');
  await insert('certifications', [
    { id: '80000000-0000-0000-0000-000000000001', name: 'Workplace Safety Certified', description: 'Certification for completing annual workplace safety training', validity_months: 12, recertification_course_id: '20000000-0000-0000-0000-000000000003' },
    { id: '80000000-0000-0000-0000-000000000002', name: 'Data Privacy Certified', description: 'Certification for data privacy and GDPR compliance', validity_months: 12 },
    { id: '80000000-0000-0000-0000-000000000003', name: 'Leadership Fundamentals', description: 'Certification in core leadership competencies', validity_months: 24, recertification_course_id: '20000000-0000-0000-0000-000000000002' },
    { id: '80000000-0000-0000-0000-000000000004', name: 'Cybersecurity Awareness', description: 'Annual cybersecurity awareness certification', validity_months: 12, recertification_course_id: '20000000-0000-0000-0000-000000000007' },
  ]);

  // ── Compliance Requirements ──
  console.log('Compliance Requirements...');
  await insert('compliance_requirements', [
    { id: '90000000-0000-0000-0000-000000000001', name: 'Annual Safety Training', description: 'OSHA-mandated workplace safety training', regulation: 'OSHA', course_id: '20000000-0000-0000-0000-000000000003', frequency_months: 12, applicable_roles: ['learner','instructor','manager','admin','super_admin'], is_mandatory: true },
    { id: '90000000-0000-0000-0000-000000000002', name: 'Cybersecurity Awareness', description: 'Annual cybersecurity awareness training', regulation: 'SOC2', course_id: '20000000-0000-0000-0000-000000000007', frequency_months: 12, applicable_roles: ['learner','instructor','manager','admin','super_admin'], is_mandatory: true },
    { id: '90000000-0000-0000-0000-000000000003', name: 'DEI Training', description: 'Annual diversity, equity, and inclusion training', regulation: 'Corporate', course_id: '20000000-0000-0000-0000-000000000011', frequency_months: 12, applicable_roles: ['learner','instructor','manager','admin','super_admin'], is_mandatory: true },
    { id: '90000000-0000-0000-0000-000000000004', name: 'Anti-Harassment Training', description: 'Preventing workplace harassment', regulation: 'Corporate', frequency_months: 12, applicable_roles: ['learner','instructor','manager','admin','super_admin'], is_mandatory: true },
    { id: '90000000-0000-0000-0000-000000000005', name: 'Data Privacy (GDPR)', description: 'GDPR compliance for data handlers', regulation: 'GDPR', frequency_months: 12, applicable_roles: ['admin','super_admin','manager'], is_mandatory: true },
  ]);

  // ── Badges ──
  console.log('Badges...');
  await insert('badges', [
    { id: 'a0000000-0000-0000-0000-000000000001', name: 'First Steps', description: 'Complete your first course', criteria: {type:'courses_completed',threshold:1}, category: 'milestone' },
    { id: 'a0000000-0000-0000-0000-000000000002', name: 'Quick Learner', description: 'Complete 5 courses', criteria: {type:'courses_completed',threshold:5}, category: 'milestone' },
    { id: 'a0000000-0000-0000-0000-000000000003', name: 'Quiz Master', description: 'Score 100% on any assessment', criteria: {type:'perfect_score',threshold:1}, category: 'achievement' },
    { id: 'a0000000-0000-0000-0000-000000000004', name: 'Social Butterfly', description: 'Post 10 discussion comments', criteria: {type:'discussions_posted',threshold:10}, category: 'social' },
    { id: 'a0000000-0000-0000-0000-000000000005', name: 'Streak Champion', description: 'Maintain a 7-day learning streak', criteria: {type:'streak_days',threshold:7}, category: 'streak' },
    { id: 'a0000000-0000-0000-0000-000000000006', name: 'Completionist', description: 'Complete an entire learning path', criteria: {type:'paths_completed',threshold:1}, category: 'milestone' },
    { id: 'a0000000-0000-0000-0000-000000000007', name: 'Top Scorer', description: 'Earn over 1000 points', criteria: {type:'total_points',threshold:1000}, category: 'achievement' },
    { id: 'a0000000-0000-0000-0000-000000000008', name: 'Mentor', description: 'Have a discussion answer marked as best answer', criteria: {type:'best_answers',threshold:1}, category: 'social' },
    { id: 'a0000000-0000-0000-0000-000000000009', name: 'Knowledge Seeker', description: 'Enroll in 10 courses', criteria: {type:'enrollments',threshold:10}, category: 'milestone' },
    { id: 'a0000000-0000-0000-0000-000000000010', name: 'Safety Star', description: 'Complete all compliance training', criteria: {type:'compliance_complete',threshold:1}, category: 'compliance' },
    { id: 'a0000000-0000-0000-0000-000000000011', name: 'Speed Runner', description: 'Complete a course in under half the estimated time', criteria: {type:'speed_completion',threshold:1}, category: 'achievement' },
    { id: 'a0000000-0000-0000-0000-000000000012', name: 'Certified Pro', description: 'Earn 3 certifications', criteria: {type:'certifications_earned',threshold:3}, category: 'milestone' },
  ]);

  // ── Competency Frameworks ──
  console.log('Competency Frameworks...');
  await insert('competency_frameworks', [
    { id: 'b0000000-0000-0000-0000-000000000001', name: 'Software Engineer Competencies', description: 'Required skills for software engineering roles', applicable_roles: ['learner'], skills: [{skill_id:'50000000-0000-0000-0000-000000000001',target_proficiency:4},{skill_id:'50000000-0000-0000-0000-000000000002',target_proficiency:3},{skill_id:'50000000-0000-0000-0000-000000000003',target_proficiency:4},{skill_id:'50000000-0000-0000-0000-000000000004',target_proficiency:3},{skill_id:'50000000-0000-0000-0000-000000000005',target_proficiency:3}] },
    { id: 'b0000000-0000-0000-0000-000000000002', name: 'Team Lead Competencies', description: 'Required skills for team lead roles', applicable_roles: ['manager'], skills: [{skill_id:'50000000-0000-0000-0000-000000000009',target_proficiency:4},{skill_id:'50000000-0000-0000-0000-000000000008',target_proficiency:4},{skill_id:'50000000-0000-0000-0000-000000000011',target_proficiency:3},{skill_id:'50000000-0000-0000-0000-000000000010',target_proficiency:4}] },
    { id: 'b0000000-0000-0000-0000-000000000003', name: 'Data Analyst Competencies', description: 'Required skills for data analyst roles', applicable_roles: ['learner'], skills: [{skill_id:'50000000-0000-0000-0000-000000000002',target_proficiency:4},{skill_id:'50000000-0000-0000-0000-000000000004',target_proficiency:4},{skill_id:'50000000-0000-0000-0000-000000000006',target_proficiency:4},{skill_id:'50000000-0000-0000-0000-000000000013',target_proficiency:3}] },
  ]);

  // ── 003 Portal Features Seed Data ──

  // KB Categories
  console.log('KB Categories...');
  const { error: kbCatErr } = await supabase.from('kb_categories').insert([
    { name: 'Getting Started', description: 'New to the platform? Start here.', icon: 'rocket', sort_order: 1 },
    { name: 'Courses & Learning', description: 'How to find, enroll, and complete courses.', icon: 'book-open', sort_order: 2 },
    { name: 'Certifications', description: 'Information about certifications and compliance.', icon: 'award', sort_order: 3 },
    { name: 'Technical Support', description: 'Troubleshooting and technical help.', icon: 'wrench', sort_order: 4 },
    { name: 'Policies & Procedures', description: 'Training policies and organizational procedures.', icon: 'file-text', sort_order: 5 },
    { name: 'Account & Profile', description: 'Managing your account settings.', icon: 'user', sort_order: 6 },
  ]);
  if (kbCatErr) console.error('  ✗ kb_categories:', kbCatErr.message);
  else console.log('  ✓ kb_categories: 6 rows');

  // Get KB category IDs
  const { data: kbCats } = await supabase.from('kb_categories').select('id, name');
  const kbCatMap = {};
  if (kbCats) kbCats.forEach(c => kbCatMap[c.name] = c.id);

  // KB Articles
  console.log('KB Articles...');
  const { error: kbArtErr } = await supabase.from('kb_articles').insert([
    { category_id: kbCatMap['Getting Started'], title: 'How to Access the Learning Portal', slug: 'how-to-access-portal', content: 'The learning portal can be accessed via your organization\'s unique URL. Simply navigate to the portal in your web browser.', excerpt: 'Learn how to access and log into the learning portal.', status: 'published', is_faq: true, is_pinned: true },
    { category_id: kbCatMap['Getting Started'], title: 'Navigating the Dashboard', slug: 'navigating-dashboard', content: 'Your dashboard is your home base. It shows your enrolled courses, upcoming deadlines, recommended training, and recent achievements.', excerpt: 'A guide to your learning dashboard.', status: 'published', is_faq: true },
    { category_id: kbCatMap['Courses & Learning'], title: 'How to Enroll in a Course', slug: 'how-to-enroll', content: 'To enroll in a course: Browse the Course Catalog, click on a course, and click Enroll Now.', excerpt: 'Step-by-step guide to enrolling in courses.', status: 'published', is_faq: true },
    { category_id: kbCatMap['Courses & Learning'], title: 'Attending Instructor-Led Training (ILT)', slug: 'attending-ilt', content: 'Instructor-Led Training sessions have scheduled dates and times. After enrolling, check the session schedule.', excerpt: 'Everything you need to know about ILT sessions.', status: 'published', is_faq: true },
    { category_id: kbCatMap['Certifications'], title: 'Understanding Compliance Training Requirements', slug: 'compliance-training', content: 'Your organization may have mandatory compliance training requirements. Complete all required training before the deadline.', excerpt: 'Learn about mandatory compliance training.', status: 'published', is_faq: true },
    { category_id: kbCatMap['Technical Support'], title: 'Supported File Types', slug: 'supported-file-types', content: 'The portal supports documents, spreadsheets, presentations, images, video, and audio files. Maximum file size is 100MB.', excerpt: 'List of supported file formats.', status: 'published', is_faq: true },
    { category_id: kbCatMap['Technical Support'], title: 'Browser Compatibility', slug: 'browser-compatibility', content: 'The learning portal works best with Chrome, Firefox, Safari, and Microsoft Edge (latest 2 versions).', excerpt: 'Supported browsers and requirements.', status: 'published', is_faq: true },
    { category_id: kbCatMap['Policies & Procedures'], title: 'Training Request & Approval Process', slug: 'training-approval-process', content: 'Some courses require manager approval. Your manager receives a notification and can approve or reject the request.', excerpt: 'How the training approval workflow works.', status: 'published', is_faq: true },
  ]);
  if (kbArtErr) console.error('  ✗ kb_articles:', kbArtErr.message);
  else console.log('  ✓ kb_articles: 8 rows');

  // Document Folders
  console.log('Document Folders...');
  const { error: dfErr } = await supabase.from('document_folders').insert([
    { name: 'Training Policies', description: 'Official training policies and guidelines', visibility: 'all', sort_order: 1 },
    { name: 'Procedure Documents', description: 'Standard operating procedures', visibility: 'all', sort_order: 2 },
    { name: 'Manager Resources', description: 'Resources for team managers', visibility: 'managers', sort_order: 3 },
    { name: 'Templates & Forms', description: 'Downloadable templates and forms', visibility: 'all', sort_order: 4 },
    { name: 'Compliance Documents', description: 'Regulatory and compliance documentation', visibility: 'all', sort_order: 5 },
  ]);
  if (dfErr) console.error('  ✗ document_folders:', dfErr.message);
  else console.log('  ✓ document_folders: 5 rows');

  // Get folder IDs for documents
  const { data: folders } = await supabase.from('document_folders').select('id, name');
  const folderMap = {};
  if (folders) folders.forEach(f => folderMap[f.name] = f.id);

  // Documents
  console.log('Documents...');
  const { error: docErr } = await supabase.from('documents').insert([
    { folder_id: folderMap['Training Policies'], title: 'Annual Training Requirements Policy', description: 'Outlines mandatory annual training requirements.', file_url: '/documents/annual-training-policy.pdf', file_name: 'annual-training-policy.pdf', file_type: 'pdf', file_size: 245000, is_policy: true, acknowledgment_required: true },
    { folder_id: folderMap['Training Policies'], title: 'Professional Development Guidelines', description: 'Guidelines for professional development.', file_url: '/documents/pd-guidelines.pdf', file_name: 'pd-guidelines.pdf', file_type: 'pdf', file_size: 189000, is_policy: true, acknowledgment_required: false },
    { folder_id: folderMap['Procedure Documents'], title: 'Course Request SOP', description: 'Standard operating procedure for requesting new courses.', file_url: '/documents/course-request-sop.docx', file_name: 'course-request-sop.docx', file_type: 'docx', file_size: 52000, is_policy: false, acknowledgment_required: false },
    { folder_id: folderMap['Templates & Forms'], title: 'Training Completion Certificate Template', description: 'Template for generating training completion certificates.', file_url: '/documents/cert-template.pptx', file_name: 'cert-template.pptx', file_type: 'pptx', file_size: 340000, is_policy: false, acknowledgment_required: false },
    { folder_id: folderMap['Compliance Documents'], title: 'Data Security Training Requirements', description: 'Compliance requirements for annual data security training.', file_url: '/documents/data-security-requirements.pdf', file_name: 'data-security-requirements.pdf', file_type: 'pdf', file_size: 178000, is_policy: true, acknowledgment_required: true },
  ]);
  if (docErr) console.error('  ✗ documents:', docErr.message);
  else console.log('  ✓ documents: 5 rows');

  // ILT Sessions
  console.log('ILT Sessions...');
  const in7days = new Date(now.getTime() + 7*86400000).toISOString().split('T')[0];
  const in14days = new Date(now.getTime() + 14*86400000).toISOString().split('T')[0];
  const { error: iltErr } = await supabase.from('ilt_sessions').insert([
    { course_id: '20000000-0000-0000-0000-000000000009', title: 'Financial Management 101 - Session 1', description: 'Introduction to federal financial management principles', session_date: in7days, start_time: '09:00', end_time: '12:00', location_type: 'virtual', location_details: 'Microsoft Teams', meeting_url: 'https://teams.microsoft.com/meeting/example1', max_capacity: 25, status: 'scheduled' },
    { course_id: '20000000-0000-0000-0000-000000000002', title: 'Leadership Development Workshop', description: 'Interactive leadership skills workshop', session_date: in14days, start_time: '13:00', end_time: '17:00', location_type: 'in_person', location_details: 'Building A, Conference Room 301', max_capacity: 20, status: 'scheduled' },
  ]);
  if (iltErr) console.error('  ✗ ilt_sessions:', iltErr.message);
  else console.log('  ✓ ilt_sessions: 2 rows');

  // Scheduled Reports
  console.log('Scheduled Reports...');
  const { error: srErr } = await supabase.from('scheduled_reports').insert([
    { name: 'Weekly Enrollment Summary', description: 'Shows new enrollments and completions from the past week', report_type: 'enrollment', schedule_frequency: 'weekly', schedule_day: 1, schedule_time: '09:00', delivery_method: 'email', recipients: ['admin@example.com'], format: 'pdf', is_active: true },
    { name: 'Monthly Compliance Status', description: 'Monthly compliance training status across all departments', report_type: 'compliance', schedule_frequency: 'monthly', schedule_day: 1, schedule_time: '08:00', delivery_method: 'both', recipients: ['admin@example.com','hr@example.com'], format: 'xlsx', is_active: true },
    { name: 'Quarterly Skills Gap Analysis', description: 'Quarterly review of organizational skill gaps', report_type: 'skills_gap', schedule_frequency: 'quarterly', schedule_day: 1, schedule_time: '09:00', delivery_method: 'email', recipients: ['admin@example.com'], format: 'pdf', is_active: true },
  ]);
  if (srErr) console.error('  ✗ scheduled_reports:', srErr.message);
  else console.log('  ✓ scheduled_reports: 3 rows');

  // ── Verify ──
  console.log('\n📊 Verification:');
  const tables = ['organizations','categories','courses','modules','lessons','skills','learning_paths','assessments','certifications','badges','kb_categories','kb_articles','document_folders','documents','ilt_sessions','scheduled_reports'];
  for (const t of tables) {
    const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`  ${t}: ${count ?? 0} rows`);
  }

  console.log('\n✅ Database seeding complete!');
}

seed().catch(console.error);
