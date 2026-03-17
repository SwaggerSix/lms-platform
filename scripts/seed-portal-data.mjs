/**
 * Seed portal feature tables (003 data).
 * Run: node scripts/seed-portal-data.mjs
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://aexpaugbycnaxbiyidmo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFleHBhdWdieWNuYXhiaXlpZG1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzcwMjYwMiwiZXhwIjoyMDg5Mjc4NjAyfQ.mBCm3sD3ohG5ta0XJ-UsOjYiOFxJEIH6-fflYRH6_Y0'
);

async function seed() {
  console.log('🌱 Seeding portal features...\n');
  const now = new Date();

  // Featured courses
  console.log('Featured courses...');
  await supabase.from('courses').update({ is_featured: true, featured_order: 1 }).eq('id', '20000000-0000-0000-0000-000000000009');
  await supabase.from('courses').update({ is_featured: true, featured_order: 2 }).eq('id', '20000000-0000-0000-0000-000000000002');
  await supabase.from('courses').update({ is_featured: true, featured_order: 3 }).eq('id', '20000000-0000-0000-0000-000000000007');
  console.log('  ✓ 3 courses marked as featured');

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
  console.log(kbCatErr ? `  ✗ ${kbCatErr.message}` : '  ✓ kb_categories: 6 rows');

  // Get KB category IDs
  const { data: kbCats } = await supabase.from('kb_categories').select('id, name');
  const cat = {};
  if (kbCats) kbCats.forEach(c => cat[c.name] = c.id);

  // KB Articles
  console.log('KB Articles...');
  const { error: kbArtErr } = await supabase.from('kb_articles').insert([
    { category_id: cat['Getting Started'], title: 'How to Access the Learning Portal', slug: 'how-to-access-portal', content: 'The learning portal can be accessed via your organization\'s unique URL. Simply navigate to the portal in your web browser.', excerpt: 'Learn how to access and log into the learning portal.', status: 'published', is_faq: true, is_pinned: true },
    { category_id: cat['Getting Started'], title: 'Navigating the Dashboard', slug: 'navigating-dashboard', content: 'Your dashboard is your home base. It shows your enrolled courses, upcoming deadlines, and recent achievements.', excerpt: 'A guide to your learning dashboard.', status: 'published', is_faq: true },
    { category_id: cat['Courses & Learning'], title: 'How to Enroll in a Course', slug: 'how-to-enroll', content: 'Browse the Course Catalog, click on a course, and click Enroll Now.', excerpt: 'Step-by-step guide to enrolling in courses.', status: 'published', is_faq: true },
    { category_id: cat['Courses & Learning'], title: 'Attending Instructor-Led Training (ILT)', slug: 'attending-ilt', content: 'ILT sessions have scheduled dates and times. Check the session schedule after enrolling.', excerpt: 'Everything you need to know about ILT sessions.', status: 'published', is_faq: true },
    { category_id: cat['Certifications'], title: 'Understanding Compliance Training Requirements', slug: 'compliance-training', content: 'Complete all required training before the deadline to maintain compliance.', excerpt: 'Learn about mandatory compliance training.', status: 'published', is_faq: true },
    { category_id: cat['Technical Support'], title: 'Supported File Types', slug: 'supported-file-types', content: 'The portal supports documents, spreadsheets, presentations, images, video, and audio. Max 100MB.', excerpt: 'List of supported file formats.', status: 'published', is_faq: true },
    { category_id: cat['Technical Support'], title: 'Browser Compatibility', slug: 'browser-compatibility', content: 'Works best with Chrome, Firefox, Safari, and Edge (latest 2 versions).', excerpt: 'Supported browsers and requirements.', status: 'published', is_faq: true },
    { category_id: cat['Policies & Procedures'], title: 'Training Request & Approval Process', slug: 'training-approval-process', content: 'Some courses require manager approval. Your manager can approve or reject the request.', excerpt: 'How the training approval workflow works.', status: 'published', is_faq: true },
  ]);
  console.log(kbArtErr ? `  ✗ ${kbArtErr.message}` : '  ✓ kb_articles: 8 rows');

  // Document Folders
  console.log('Document Folders...');
  const { error: dfErr } = await supabase.from('document_folders').insert([
    { name: 'Training Policies', description: 'Official training policies and guidelines', visibility: 'all', sort_order: 1 },
    { name: 'Procedure Documents', description: 'Standard operating procedures', visibility: 'all', sort_order: 2 },
    { name: 'Manager Resources', description: 'Resources for team managers', visibility: 'managers', sort_order: 3 },
    { name: 'Templates & Forms', description: 'Downloadable templates and forms', visibility: 'all', sort_order: 4 },
    { name: 'Compliance Documents', description: 'Regulatory and compliance documentation', visibility: 'all', sort_order: 5 },
  ]);
  console.log(dfErr ? `  ✗ ${dfErr.message}` : '  ✓ document_folders: 5 rows');

  const { data: folders } = await supabase.from('document_folders').select('id, name');
  const f = {};
  if (folders) folders.forEach(x => f[x.name] = x.id);

  // Documents
  console.log('Documents...');
  const { error: docErr } = await supabase.from('documents').insert([
    { folder_id: f['Training Policies'], title: 'Annual Training Requirements Policy', description: 'Outlines mandatory annual training requirements.', file_url: '/documents/annual-training-policy.pdf', file_name: 'annual-training-policy.pdf', file_type: 'pdf', file_size: 245000, is_policy: true, acknowledgment_required: true },
    { folder_id: f['Training Policies'], title: 'Professional Development Guidelines', description: 'Guidelines for professional development.', file_url: '/documents/pd-guidelines.pdf', file_name: 'pd-guidelines.pdf', file_type: 'pdf', file_size: 189000, is_policy: true },
    { folder_id: f['Procedure Documents'], title: 'Course Request SOP', description: 'Standard operating procedure for requesting new courses.', file_url: '/documents/course-request-sop.docx', file_name: 'course-request-sop.docx', file_type: 'docx', file_size: 52000 },
    { folder_id: f['Templates & Forms'], title: 'Training Completion Certificate Template', description: 'Template for generating training completion certificates.', file_url: '/documents/cert-template.pptx', file_name: 'cert-template.pptx', file_type: 'pptx', file_size: 340000 },
    { folder_id: f['Compliance Documents'], title: 'Data Security Training Requirements', description: 'Compliance requirements for annual data security training.', file_url: '/documents/data-security-requirements.pdf', file_name: 'data-security-requirements.pdf', file_type: 'pdf', file_size: 178000, is_policy: true, acknowledgment_required: true },
  ]);
  console.log(docErr ? `  ✗ ${docErr.message}` : '  ✓ documents: 5 rows');

  // ILT Sessions
  console.log('ILT Sessions...');
  const in7 = new Date(now.getTime() + 7*86400000).toISOString().split('T')[0];
  const in14 = new Date(now.getTime() + 14*86400000).toISOString().split('T')[0];
  const { error: iltErr } = await supabase.from('ilt_sessions').insert([
    { course_id: '20000000-0000-0000-0000-000000000009', title: 'Financial Management 101 - Session 1', description: 'Introduction to federal financial management principles', session_date: in7, start_time: '09:00', end_time: '12:00', location_type: 'virtual', location_details: 'Microsoft Teams', meeting_url: 'https://teams.microsoft.com/meeting/example1', max_capacity: 25, status: 'scheduled' },
    { course_id: '20000000-0000-0000-0000-000000000002', title: 'Leadership Development Workshop', description: 'Interactive leadership skills workshop', session_date: in14, start_time: '13:00', end_time: '17:00', location_type: 'in_person', location_details: 'Building A, Conference Room 301', max_capacity: 20, status: 'scheduled' },
  ]);
  console.log(iltErr ? `  ✗ ${iltErr.message}` : '  ✓ ilt_sessions: 2 rows');

  // Scheduled Reports
  console.log('Scheduled Reports...');
  const { error: srErr } = await supabase.from('scheduled_reports').insert([
    { name: 'Weekly Enrollment Summary', description: 'Shows new enrollments and completions from the past week', report_type: 'enrollment', schedule_frequency: 'weekly', schedule_day: 1, schedule_time: '09:00', delivery_method: 'email', recipients: ['admin@example.com'], format: 'pdf', is_active: true },
    { name: 'Monthly Compliance Status', description: 'Monthly compliance training status across all departments', report_type: 'compliance', schedule_frequency: 'monthly', schedule_day: 1, schedule_time: '08:00', delivery_method: 'both', recipients: ['admin@example.com','hr@example.com'], format: 'xlsx', is_active: true },
    { name: 'Quarterly Skills Gap Analysis', description: 'Quarterly review of organizational skill gaps', report_type: 'skills_gap', schedule_frequency: 'quarterly', schedule_day: 1, schedule_time: '09:00', delivery_method: 'email', recipients: ['admin@example.com'], format: 'pdf', is_active: true },
  ]);
  console.log(srErr ? `  ✗ ${srErr.message}` : '  ✓ scheduled_reports: 3 rows');

  // Final verification
  console.log('\n📊 Full Database Verification:');
  const tables = ['organizations','categories','courses','modules','lessons','skills','course_skills','learning_paths','learning_path_items','assessments','certifications','compliance_requirements','badges','competency_frameworks','kb_categories','kb_articles','document_folders','documents','ilt_sessions','scheduled_reports','enrollment_approvals','conversations','messages'];
  for (const t of tables) {
    const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`  ${t}: ${count ?? 0} rows`);
  }
  console.log('\n✅ All done! Database is fully seeded.');
}

seed().catch(console.error);
