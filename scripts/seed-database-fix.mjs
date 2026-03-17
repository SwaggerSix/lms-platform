/**
 * Fix: Seed courses and dependent tables (without featured columns).
 * Run: node scripts/seed-database-fix.mjs
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://aexpaugbycnaxbiyidmo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFleHBhdWdieWNuYXhiaXlpZG1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzcwMjYwMiwiZXhwIjoyMDg5Mjc4NjAyfQ.mBCm3sD3ohG5ta0XJ-UsOjYiOFxJEIH6-fflYRH6_Y0'
);

const now = new Date();
const daysAgo = (d) => new Date(now - d * 86400000).toISOString();

async function seed() {
  console.log('🔧 Fixing seed data...\n');

  // Courses (without is_featured/featured_order - those columns don't exist yet)
  console.log('Courses...');
  const { error: cErr } = await supabase.from('courses').upsert([
    { id: '20000000-0000-0000-0000-000000000001', title: 'Introduction to Data Science', slug: 'intro-data-science', description: 'A comprehensive introduction to data science covering Python, statistics, machine learning, and data visualization.', short_description: 'Learn the fundamentals of data science with hands-on projects.', category_id: '10000000-0000-0000-0000-000000000006', status: 'published', course_type: 'self_paced', difficulty_level: 'beginner', estimated_duration: 480, passing_score: 70, enrollment_type: 'open', tags: ['python','data-science','machine-learning'], published_at: daysAgo(30) },
    { id: '20000000-0000-0000-0000-000000000002', title: 'Leadership Essentials', slug: 'leadership-essentials', description: 'Develop core leadership competencies including strategic thinking, team management, decision-making, and effective communication.', short_description: 'Build the leadership skills you need to manage and inspire teams.', category_id: '10000000-0000-0000-0000-000000000002', status: 'published', course_type: 'blended', difficulty_level: 'intermediate', estimated_duration: 360, passing_score: 75, enrollment_type: 'open', tags: ['leadership','management','soft-skills'], published_at: daysAgo(60) },
    { id: '20000000-0000-0000-0000-000000000003', title: 'Workplace Safety Compliance', slug: 'workplace-safety', description: 'Mandatory workplace safety training covering OSHA regulations, emergency procedures, hazard identification, and incident reporting.', short_description: 'Required annual safety training for all employees.', category_id: '10000000-0000-0000-0000-000000000003', status: 'published', course_type: 'self_paced', difficulty_level: 'beginner', estimated_duration: 120, passing_score: 80, enrollment_type: 'assigned', tags: ['safety','osha','compliance'], published_at: daysAgo(90) },
    { id: '20000000-0000-0000-0000-000000000004', title: 'Advanced Python Programming', slug: 'advanced-python', description: 'Deep dive into advanced Python concepts including decorators, generators, metaclasses, concurrency, and design patterns.', short_description: 'Master advanced Python techniques for production systems.', category_id: '10000000-0000-0000-0000-000000000001', status: 'published', course_type: 'self_paced', difficulty_level: 'advanced', estimated_duration: 600, passing_score: 70, enrollment_type: 'open', tags: ['python','programming','advanced'], published_at: daysAgo(15) },
    { id: '20000000-0000-0000-0000-000000000005', title: 'Effective Communication Skills', slug: 'effective-communication', description: 'Master the art of professional communication including presentations, written communication, active listening, and conflict resolution.', short_description: 'Improve your professional communication across all channels.', category_id: '10000000-0000-0000-0000-000000000005', status: 'published', course_type: 'instructor_led', difficulty_level: 'beginner', estimated_duration: 240, passing_score: 70, enrollment_type: 'open', tags: ['communication','presentations','soft-skills'], published_at: daysAgo(45) },
    { id: '20000000-0000-0000-0000-000000000006', title: 'Project Management Professional', slug: 'project-management', description: 'Comprehensive project management training aligned with PMI standards.', short_description: 'Learn project management best practices aligned with PMI standards.', category_id: '10000000-0000-0000-0000-000000000004', status: 'published', course_type: 'self_paced', difficulty_level: 'intermediate', estimated_duration: 540, passing_score: 75, enrollment_type: 'open', tags: ['project-management','pmi','agile'], published_at: daysAgo(20) },
    { id: '20000000-0000-0000-0000-000000000007', title: 'Cybersecurity Fundamentals', slug: 'cybersecurity-fundamentals', description: 'Essential cybersecurity training covering threat landscapes, security best practices, incident response, and data protection.', short_description: 'Protect yourself and the organization from cyber threats.', category_id: '10000000-0000-0000-0000-000000000001', status: 'published', course_type: 'self_paced', difficulty_level: 'beginner', estimated_duration: 180, passing_score: 80, enrollment_type: 'assigned', tags: ['cybersecurity','security','compliance'], published_at: daysAgo(75) },
    { id: '20000000-0000-0000-0000-000000000008', title: 'Design Thinking Workshop', slug: 'design-thinking', description: 'Learn the design thinking methodology to solve complex problems through empathy, ideation, prototyping, and testing.', short_description: 'Apply design thinking to solve real business problems.', category_id: '10000000-0000-0000-0000-000000000007', status: 'published', course_type: 'instructor_led', difficulty_level: 'intermediate', estimated_duration: 300, passing_score: 70, enrollment_type: 'open', tags: ['design-thinking','innovation','problem-solving'], published_at: daysAgo(10) },
    { id: '20000000-0000-0000-0000-000000000009', title: 'Financial Literacy for Managers', slug: 'financial-literacy', description: 'Understanding financial statements, budgeting, forecasting, and financial decision-making for non-finance managers.', short_description: 'Make better financial decisions as a manager.', category_id: '10000000-0000-0000-0000-000000000004', status: 'published', course_type: 'self_paced', difficulty_level: 'intermediate', estimated_duration: 300, passing_score: 70, enrollment_type: 'open', tags: ['finance','budgeting','management'], published_at: daysAgo(35) },
    { id: '20000000-0000-0000-0000-000000000010', title: 'Agile & Scrum Mastery', slug: 'agile-scrum', description: 'Master Agile methodologies and Scrum framework including sprint planning, daily standups, retrospectives, and product backlog management.', short_description: 'Become proficient in Agile and Scrum practices.', category_id: '10000000-0000-0000-0000-000000000004', status: 'published', course_type: 'blended', difficulty_level: 'intermediate', estimated_duration: 360, passing_score: 75, enrollment_type: 'open', tags: ['agile','scrum','project-management'], published_at: daysAgo(25) },
    { id: '20000000-0000-0000-0000-000000000011', title: 'DEI in the Workplace', slug: 'dei-workplace', description: 'Building an inclusive workplace through understanding diversity, equity, and inclusion principles, unconscious bias, and creating belonging.', short_description: 'Foster a more inclusive and equitable workplace.', category_id: '10000000-0000-0000-0000-000000000003', status: 'published', course_type: 'self_paced', difficulty_level: 'beginner', estimated_duration: 90, passing_score: 80, enrollment_type: 'assigned', tags: ['dei','inclusion','compliance'], published_at: daysAgo(120) },
    { id: '20000000-0000-0000-0000-000000000012', title: 'Cloud Architecture Fundamentals', slug: 'cloud-architecture', description: 'Learn cloud computing principles, AWS/Azure/GCP services, cloud architecture patterns, and best practices for building scalable cloud solutions.', short_description: 'Build scalable applications on cloud platforms.', category_id: '10000000-0000-0000-0000-000000000001', status: 'published', course_type: 'self_paced', difficulty_level: 'advanced', estimated_duration: 540, passing_score: 70, enrollment_type: 'open', tags: ['cloud','aws','architecture'], published_at: daysAgo(5) },
  ], { onConflict: 'id' });
  console.log(cErr ? `  ✗ ${cErr.message}` : '  ✓ courses: 12 rows');

  // Modules
  console.log('Modules...');
  const { error: mErr } = await supabase.from('modules').upsert([
    { id: '30000000-0000-0000-0000-000000000001', course_id: '20000000-0000-0000-0000-000000000001', title: 'Python Fundamentals', description: 'Core Python programming for data science', sequence_order: 1 },
    { id: '30000000-0000-0000-0000-000000000002', course_id: '20000000-0000-0000-0000-000000000001', title: 'Data Analysis with Pandas', description: 'Data manipulation and analysis', sequence_order: 2 },
    { id: '30000000-0000-0000-0000-000000000003', course_id: '20000000-0000-0000-0000-000000000001', title: 'Machine Learning Basics', description: 'Introduction to ML algorithms', sequence_order: 3 },
    { id: '30000000-0000-0000-0000-000000000004', course_id: '20000000-0000-0000-0000-000000000002', title: 'Foundations of Leadership', description: 'Core leadership principles', sequence_order: 1 },
    { id: '30000000-0000-0000-0000-000000000005', course_id: '20000000-0000-0000-0000-000000000002', title: 'Team Management', description: 'Building and managing teams', sequence_order: 2 },
    { id: '30000000-0000-0000-0000-000000000006', course_id: '20000000-0000-0000-0000-000000000002', title: 'Strategic Thinking', description: 'Developing strategic mindset', sequence_order: 3 },
  ], { onConflict: 'id' });
  console.log(mErr ? `  ✗ ${mErr.message}` : '  ✓ modules: 6 rows');

  // Lessons
  console.log('Lessons...');
  const { error: lErr } = await supabase.from('lessons').upsert([
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
  ], { onConflict: 'id' });
  console.log(lErr ? `  ✗ ${lErr.message}` : '  ✓ lessons: 18 rows');

  // Course Skills
  console.log('Course Skills...');
  const { error: csErr } = await supabase.from('course_skills').upsert([
    { course_id: '20000000-0000-0000-0000-000000000001', skill_id: '50000000-0000-0000-0000-000000000002', proficiency_gained: 3 },
    { course_id: '20000000-0000-0000-0000-000000000001', skill_id: '50000000-0000-0000-0000-000000000006', proficiency_gained: 3 },
    { course_id: '20000000-0000-0000-0000-000000000001', skill_id: '50000000-0000-0000-0000-000000000007', proficiency_gained: 2 },
    { course_id: '20000000-0000-0000-0000-000000000001', skill_id: '50000000-0000-0000-0000-000000000013', proficiency_gained: 3 },
    { course_id: '20000000-0000-0000-0000-000000000002', skill_id: '50000000-0000-0000-0000-000000000009', proficiency_gained: 3 },
    { course_id: '20000000-0000-0000-0000-000000000002', skill_id: '50000000-0000-0000-0000-000000000008', proficiency_gained: 2 },
    { course_id: '20000000-0000-0000-0000-000000000004', skill_id: '50000000-0000-0000-0000-000000000002', proficiency_gained: 5 },
    { course_id: '20000000-0000-0000-0000-000000000006', skill_id: '50000000-0000-0000-0000-000000000011', proficiency_gained: 4 },
    { course_id: '20000000-0000-0000-0000-000000000006', skill_id: '50000000-0000-0000-0000-000000000015', proficiency_gained: 3 },
    { course_id: '20000000-0000-0000-0000-000000000007', skill_id: '50000000-0000-0000-0000-000000000014', proficiency_gained: 3 },
    { course_id: '20000000-0000-0000-0000-000000000010', skill_id: '50000000-0000-0000-0000-000000000015', proficiency_gained: 4 },
    { course_id: '20000000-0000-0000-0000-000000000012', skill_id: '50000000-0000-0000-0000-000000000005', proficiency_gained: 4 },
  ], { onConflict: 'course_id,skill_id' });
  console.log(csErr ? `  ✗ ${csErr.message}` : '  ✓ course_skills: 12 rows');

  // Learning Path Items
  console.log('Learning Path Items...');
  const { error: lpiErr } = await supabase.from('learning_path_items').insert([
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
  console.log(lpiErr ? `  ✗ ${lpiErr.message}` : '  ✓ learning_path_items: 12 rows');

  // Assessments
  console.log('Assessments...');
  const { error: aErr } = await supabase.from('assessments').upsert([
    { id: '70000000-0000-0000-0000-000000000001', course_id: '20000000-0000-0000-0000-000000000001', title: 'Data Science Fundamentals Quiz', description: 'Test your understanding of data science basics', passing_score: 70, time_limit: 30, max_attempts: 3, randomize_questions: true, show_correct_answers: true },
    { id: '70000000-0000-0000-0000-000000000002', course_id: '20000000-0000-0000-0000-000000000002', title: 'Leadership Assessment', description: 'Evaluate your leadership knowledge', passing_score: 75, time_limit: 25, max_attempts: 2, randomize_questions: false, show_correct_answers: true },
    { id: '70000000-0000-0000-0000-000000000003', course_id: '20000000-0000-0000-0000-000000000003', title: 'Safety Compliance Exam', description: 'Annual safety compliance certification exam', passing_score: 80, time_limit: 45, max_attempts: 3, randomize_questions: true, show_correct_answers: false },
    { id: '70000000-0000-0000-0000-000000000004', course_id: '20000000-0000-0000-0000-000000000007', title: 'Cybersecurity Awareness Quiz', description: 'Test your cybersecurity knowledge', passing_score: 80, time_limit: 20, max_attempts: 3, randomize_questions: true, show_correct_answers: true },
    { id: '70000000-0000-0000-0000-000000000005', course_id: '20000000-0000-0000-0000-000000000010', title: 'Agile Methodology Exam', description: 'Comprehensive Agile and Scrum assessment', passing_score: 75, time_limit: 40, max_attempts: 2, randomize_questions: true, show_correct_answers: true },
    { id: '70000000-0000-0000-0000-000000000006', course_id: '20000000-0000-0000-0000-000000000011', title: 'DEI Knowledge Check', description: 'Assess understanding of DEI principles', passing_score: 80, time_limit: 15, max_attempts: 3, randomize_questions: false, show_correct_answers: true },
  ], { onConflict: 'id' });
  console.log(aErr ? `  ✗ ${aErr.message}` : '  ✓ assessments: 6 rows');

  // Certifications
  console.log('Certifications...');
  const { error: certErr } = await supabase.from('certifications').upsert([
    { id: '80000000-0000-0000-0000-000000000001', name: 'Workplace Safety Certified', description: 'Certification for completing annual workplace safety training', validity_months: 12, recertification_course_id: '20000000-0000-0000-0000-000000000003' },
    { id: '80000000-0000-0000-0000-000000000002', name: 'Data Privacy Certified', description: 'Certification for data privacy and GDPR compliance', validity_months: 12 },
    { id: '80000000-0000-0000-0000-000000000003', name: 'Leadership Fundamentals', description: 'Certification in core leadership competencies', validity_months: 24, recertification_course_id: '20000000-0000-0000-0000-000000000002' },
    { id: '80000000-0000-0000-0000-000000000004', name: 'Cybersecurity Awareness', description: 'Annual cybersecurity awareness certification', validity_months: 12, recertification_course_id: '20000000-0000-0000-0000-000000000007' },
  ], { onConflict: 'id' });
  console.log(certErr ? `  ✗ ${certErr.message}` : '  ✓ certifications: 4 rows');

  // Compliance
  console.log('Compliance Requirements...');
  const { error: compErr } = await supabase.from('compliance_requirements').upsert([
    { id: '90000000-0000-0000-0000-000000000001', name: 'Annual Safety Training', description: 'OSHA-mandated workplace safety training', regulation: 'OSHA', course_id: '20000000-0000-0000-0000-000000000003', frequency_months: 12, applicable_roles: ['learner','instructor','manager','admin','super_admin'], is_mandatory: true },
    { id: '90000000-0000-0000-0000-000000000002', name: 'Cybersecurity Awareness', description: 'Annual cybersecurity awareness training', regulation: 'SOC2', course_id: '20000000-0000-0000-0000-000000000007', frequency_months: 12, applicable_roles: ['learner','instructor','manager','admin','super_admin'], is_mandatory: true },
    { id: '90000000-0000-0000-0000-000000000003', name: 'DEI Training', description: 'Annual diversity, equity, and inclusion training', regulation: 'Corporate', course_id: '20000000-0000-0000-0000-000000000011', frequency_months: 12, applicable_roles: ['learner','instructor','manager','admin','super_admin'], is_mandatory: true },
    { id: '90000000-0000-0000-0000-000000000004', name: 'Anti-Harassment Training', description: 'Preventing workplace harassment', regulation: 'Corporate', frequency_months: 12, applicable_roles: ['learner','instructor','manager','admin','super_admin'], is_mandatory: true },
    { id: '90000000-0000-0000-0000-000000000005', name: 'Data Privacy (GDPR)', description: 'GDPR compliance for data handlers', regulation: 'GDPR', frequency_months: 12, applicable_roles: ['admin','super_admin','manager'], is_mandatory: true },
  ], { onConflict: 'id' });
  console.log(compErr ? `  ✗ ${compErr.message}` : '  ✓ compliance_requirements: 5 rows');

  // ── Verify ──
  console.log('\n📊 Verification:');
  const tables = ['organizations','categories','courses','modules','lessons','skills','course_skills','learning_paths','learning_path_items','assessments','certifications','compliance_requirements','badges','competency_frameworks'];
  for (const t of tables) {
    const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`  ${t}: ${count ?? 0} rows`);
  }
  console.log('\n✅ Core data seeding complete!');
}

seed().catch(console.error);
