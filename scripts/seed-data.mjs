#!/usr/bin/env node
/**
 * Comprehensive seed script to populate all user-related data in the LMS platform.
 * Uses exact column names from the database schema.
 * Run with: node scripts/seed-data.mjs
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const API = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function supabaseGet(path) {
  const res = await fetch(`${API}/rest/v1/${path}`, {
    headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
  });
  return res.ok ? res.json() : null;
}

async function insert(table, data) {
  const res = await fetch(`${API}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': KEY, 'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json', 'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`  ✗ ${table}: ${text}`);
    return null;
  }
  const result = text ? JSON.parse(text) : [];
  console.log(`  ✓ ${table}: ${Array.isArray(result) ? result.length : 1} rows`);
  return result;
}

async function patch(table, filter, data) {
  await fetch(`${API}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      'apikey': KEY, 'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString(); }
function daysFromNow(n) { return new Date(Date.now() + n * 86400000).toISOString(); }

// ===================== CONSTANTS =====================
const C = { // Courses
  ds: '20000000-0000-0000-0000-000000000001',
  lead: '20000000-0000-0000-0000-000000000002',
  safety: '20000000-0000-0000-0000-000000000003',
  python: '20000000-0000-0000-0000-000000000004',
  comm: '20000000-0000-0000-0000-000000000005',
  pm: '20000000-0000-0000-0000-000000000006',
  cyber: '20000000-0000-0000-0000-000000000007',
  design: '20000000-0000-0000-0000-000000000008',
  finance: '20000000-0000-0000-0000-000000000009',
  agile: '20000000-0000-0000-0000-000000000010',
  dei: '20000000-0000-0000-0000-000000000011',
  cloud: '20000000-0000-0000-0000-000000000012',
};

// Data Science lessons (module 1: 01-04, module 2: 05-07, module 3: 08-10)
const DSL = Array.from({length:10}, (_,i) => `40000000-0000-0000-0000-0000000000${(i+1).toString().padStart(2,'0')}`);
// Leadership lessons (module 4: 11-13, module 5: 14-16, module 6: 17-18)
const LL = Array.from({length:8}, (_,i) => `40000000-0000-0000-0000-0000000000${(i+11).toString().padStart(2,'0')}`);

const A = { // Assessments
  ds: '70000000-0000-0000-0000-000000000001',
  lead: '70000000-0000-0000-0000-000000000002',
  safety: '70000000-0000-0000-0000-000000000003',
  cyber: '70000000-0000-0000-0000-000000000004',
  agile: '70000000-0000-0000-0000-000000000005',
  dei: '70000000-0000-0000-0000-000000000006',
};

const CERT = {
  safety: '80000000-0000-0000-0000-000000000001',
  privacy: '80000000-0000-0000-0000-000000000002',
  lead: '80000000-0000-0000-0000-000000000003',
  cyber: '80000000-0000-0000-0000-000000000004',
};

const B = Array.from({length:12}, (_,i) => `a0000000-0000-0000-0000-0000000000${(i+1).toString().padStart(2,'0')}`);
// B[0]=First Steps, B[1]=Quick Learner, B[2]=Quiz Master, B[3]=Social Butterfly, B[4]=Streak Champion
// B[5]=Completionist, B[6]=Top Scorer, B[7]=Mentor, B[8]=Knowledge Seeker, B[9]=Safety Star, B[10]=Speed Runner, B[11]=Certified Pro

const SK = Array.from({length:15}, (_,i) => `50000000-0000-0000-0000-0000000000${(i+1).toString().padStart(2,'0')}`);
// SK: 0=JS, 1=Python, 2=React, 3=SQL, 4=Cloud, 5=DataAnalysis, 6=ML, 7=Communication, 8=Leadership,
// 9=ProblemSolving, 10=PM, 11=StratPlanning, 12=DataScience, 13=Cybersecurity, 14=Agile

const ILT = ['1d779c7a-9921-4fb8-8445-4349b6bfbcdb', '4448f720-c047-4c6d-8ea6-746f331c06e6'];

async function main() {
  console.log('🌱 Starting comprehensive data seed...\n');

  // Load users
  const users = await supabaseGet('users?select=id,email,role');
  const U = {};
  for (const u of users) U[u.email.split('@')[0].replace(/\./g, '_')] = u.id;
  console.log(`Loaded ${users.length} users\n`);

  const chris = U.chris_cancialosi;
  const admin = U.admin;
  const mgr1 = U.mgr_engineering;
  const mgr2 = U.mgr_sales;
  const inst1 = U.instructor_tech;
  const inst2 = U.instructor_lead;
  const l1 = U.alex_kumar;
  const l2 = U.jessica_lee;
  const l3 = U.ryan_garcia;
  const l4 = U.nina_jackson;
  const l5 = U.tom_baker;
  const l6 = U.sophia_wright;
  const l7 = U.marcus_brown;

  // ===================== 1. ENROLLMENTS =====================
  // Schema: user_id, course_id, status (enrolled|in_progress|completed|failed|expired),
  //         enrolled_at, started_at, completed_at, due_date, assigned_by, score, time_spent, certificate_issued
  console.log('📚 Enrollments...');
  const enrollments = [
    // Chris
    { user_id: chris, course_id: C.ds, status: 'completed', enrolled_at: daysAgo(90), started_at: daysAgo(88), completed_at: daysAgo(30), time_spent: 2400, score: 92, certificate_issued: true },
    { user_id: chris, course_id: C.lead, status: 'in_progress', enrolled_at: daysAgo(14), started_at: daysAgo(12), time_spent: 900 },
    { user_id: chris, course_id: C.cyber, status: 'completed', enrolled_at: daysAgo(60), started_at: daysAgo(58), completed_at: daysAgo(20), time_spent: 1800, score: 88, certificate_issued: true },
    // Alex (frontend dev)
    { user_id: l1, course_id: C.ds, status: 'in_progress', enrolled_at: daysAgo(30), started_at: daysAgo(28), time_spent: 1200 },
    { user_id: l1, course_id: C.python, status: 'completed', enrolled_at: daysAgo(60), started_at: daysAgo(58), completed_at: daysAgo(15), time_spent: 3000, score: 85 },
    { user_id: l1, course_id: C.safety, status: 'completed', enrolled_at: daysAgo(45), started_at: daysAgo(43), completed_at: daysAgo(10), time_spent: 1800, score: 90, certificate_issued: true },
    { user_id: l1, course_id: C.agile, status: 'in_progress', enrolled_at: daysAgo(7), started_at: daysAgo(6), time_spent: 600 },
    // Jessica (backend dev)
    { user_id: l2, course_id: C.python, status: 'in_progress', enrolled_at: daysAgo(20), started_at: daysAgo(18), time_spent: 1800 },
    { user_id: l2, course_id: C.cyber, status: 'completed', enrolled_at: daysAgo(50), started_at: daysAgo(48), completed_at: daysAgo(12), time_spent: 2100, score: 95, certificate_issued: true },
    { user_id: l2, course_id: C.cloud, status: 'in_progress', enrolled_at: daysAgo(10), started_at: daysAgo(8), time_spent: 900 },
    { user_id: l2, course_id: C.dei, status: 'completed', enrolled_at: daysAgo(40), started_at: daysAgo(38), completed_at: daysAgo(25), time_spent: 1500, score: 88 },
    // Ryan (devops)
    { user_id: l3, course_id: C.cloud, status: 'completed', enrolled_at: daysAgo(35), started_at: daysAgo(33), completed_at: daysAgo(5), time_spent: 2700, score: 91 },
    { user_id: l3, course_id: C.cyber, status: 'in_progress', enrolled_at: daysAgo(15), started_at: daysAgo(13), time_spent: 1200 },
    { user_id: l3, course_id: C.agile, status: 'completed', enrolled_at: daysAgo(50), started_at: daysAgo(48), completed_at: daysAgo(20), time_spent: 2400, score: 87 },
    // Nina (sales)
    { user_id: l4, course_id: C.comm, status: 'completed', enrolled_at: daysAgo(40), started_at: daysAgo(38), completed_at: daysAgo(10), time_spent: 2100, score: 82 },
    { user_id: l4, course_id: C.pm, status: 'in_progress', enrolled_at: daysAgo(12), started_at: daysAgo(10), time_spent: 1500 },
    { user_id: l4, course_id: C.safety, status: 'completed', enrolled_at: daysAgo(55), started_at: daysAgo(53), completed_at: daysAgo(30), time_spent: 1800, score: 78, certificate_issued: true },
    // Tom (sales rep)
    { user_id: l5, course_id: C.comm, status: 'in_progress', enrolled_at: daysAgo(8), started_at: daysAgo(6), time_spent: 600 },
    { user_id: l5, course_id: C.finance, status: 'in_progress', enrolled_at: daysAgo(15), started_at: daysAgo(13), time_spent: 900 },
    { user_id: l5, course_id: C.dei, status: 'completed', enrolled_at: daysAgo(45), started_at: daysAgo(43), completed_at: daysAgo(20), time_spent: 1500, score: 80 },
    // Sophia (marketing)
    { user_id: l6, course_id: C.design, status: 'completed', enrolled_at: daysAgo(30), started_at: daysAgo(28), completed_at: daysAgo(8), time_spent: 2400, score: 94 },
    { user_id: l6, course_id: C.comm, status: 'completed', enrolled_at: daysAgo(50), started_at: daysAgo(48), completed_at: daysAgo(25), time_spent: 1800, score: 90 },
    { user_id: l6, course_id: C.lead, status: 'in_progress', enrolled_at: daysAgo(5), started_at: daysAgo(4), time_spent: 300 },
    // Marcus (HR)
    { user_id: l7, course_id: C.dei, status: 'completed', enrolled_at: daysAgo(35), started_at: daysAgo(33), completed_at: daysAgo(10), time_spent: 1500, score: 95 },
    { user_id: l7, course_id: C.safety, status: 'completed', enrolled_at: daysAgo(60), started_at: daysAgo(58), completed_at: daysAgo(30), time_spent: 1800, score: 92, certificate_issued: true },
    { user_id: l7, course_id: C.lead, status: 'in_progress', enrolled_at: daysAgo(20), started_at: daysAgo(18), time_spent: 1200 },
    { user_id: l7, course_id: C.comm, status: 'in_progress', enrolled_at: daysAgo(3), started_at: daysAgo(2), time_spent: 200 },
    // David Chen (manager)
    { user_id: mgr1, course_id: C.lead, status: 'completed', enrolled_at: daysAgo(80), started_at: daysAgo(78), completed_at: daysAgo(40), time_spent: 3600, score: 96, certificate_issued: true },
    { user_id: mgr1, course_id: C.pm, status: 'completed', enrolled_at: daysAgo(70), started_at: daysAgo(68), completed_at: daysAgo(35), time_spent: 2700, score: 88 },
    { user_id: mgr1, course_id: C.agile, status: 'in_progress', enrolled_at: daysAgo(10), started_at: daysAgo(8), time_spent: 900 },
    // Maria Rodriguez (manager)
    { user_id: mgr2, course_id: C.finance, status: 'completed', enrolled_at: daysAgo(60), started_at: daysAgo(58), completed_at: daysAgo(20), time_spent: 2400, score: 85 },
    { user_id: mgr2, course_id: C.comm, status: 'completed', enrolled_at: daysAgo(90), started_at: daysAgo(88), completed_at: daysAgo(50), time_spent: 2100, score: 91 },
    { user_id: mgr2, course_id: C.lead, status: 'in_progress', enrolled_at: daysAgo(14), started_at: daysAgo(12), time_spent: 600 },
    // Instructors
    { user_id: inst1, course_id: C.python, status: 'completed', enrolled_at: daysAgo(100), started_at: daysAgo(98), completed_at: daysAgo(80), time_spent: 3600, score: 98 },
    { user_id: inst1, course_id: C.cyber, status: 'completed', enrolled_at: daysAgo(90), started_at: daysAgo(88), completed_at: daysAgo(60), time_spent: 3000, score: 97, certificate_issued: true },
    { user_id: inst2, course_id: C.lead, status: 'completed', enrolled_at: daysAgo(100), started_at: daysAgo(98), completed_at: daysAgo(70), time_spent: 3600, score: 99, certificate_issued: true },
    { user_id: inst2, course_id: C.comm, status: 'completed', enrolled_at: daysAgo(80), started_at: daysAgo(78), completed_at: daysAgo(50), time_spent: 2700, score: 95 },
  ];

  const enrollResult = await insert('enrollments', enrollments);

  // Build enrollment lookup: {`${user_id}:${course_id}` => enrollment_id}
  const EL = {};
  if (enrollResult) {
    for (const e of enrollResult) EL[`${e.user_id}:${e.course_id}`] = e.id;
  }

  // ===================== 2. LESSON PROGRESS =====================
  // Schema: user_id, lesson_id, enrollment_id (NOT NULL), status, score, time_spent, attempts, bookmark_data, started_at, completed_at
  console.log('📝 Lesson progress...');
  const lp = [];

  function addLP(userId, courseId, lessonId, status, spent, dBack) {
    const eid = EL[`${userId}:${courseId}`];
    if (!eid) return;
    lp.push({
      user_id: userId, lesson_id: lessonId, enrollment_id: eid,
      status, time_spent: spent, attempts: status === 'completed' ? 1 : 0,
      started_at: daysAgo(dBack + 1),
      completed_at: status === 'completed' ? daysAgo(dBack) : null,
    });
  }

  // Chris: all DS lessons completed
  DSL.forEach((lid, i) => addLP(chris, C.ds, lid, 'completed', 200 + Math.floor(Math.random()*120), 30 + (9-i)*3));
  // Chris: first 4 leadership lessons
  LL.slice(0,3).forEach((lid, i) => addLP(chris, C.lead, lid, 'completed', 200, 10 - i*2));
  addLP(chris, C.lead, LL[3], 'in_progress', 100, 1);

  // Alex: first 6 DS lessons
  DSL.slice(0,5).forEach((lid, i) => addLP(l1, C.ds, lid, 'completed', 200, 25 - i*3));
  addLP(l1, C.ds, DSL[5], 'in_progress', 100, 2);

  // Jessica: first 4 DS lessons (python course uses DS lessons conceptually - skip, no DS enrollment mapping needed for python)
  // She has python enrollment, but python course doesn't have lesson IDs we know. Skip lesson progress for courses without known lessons.

  // David Chen: all leadership lessons completed
  LL.forEach((lid, i) => addLP(mgr1, C.lead, lid, 'completed', 200 + Math.floor(Math.random()*100), 40 + (7-i)*3));

  // Sophia: first 2 leadership lessons
  addLP(l6, C.lead, LL[0], 'completed', 180, 3);
  addLP(l6, C.lead, LL[1], 'in_progress', 80, 1);

  // Marcus: first 5 leadership lessons
  LL.slice(0,4).forEach((lid, i) => addLP(l7, C.lead, lid, 'completed', 220, 18 - i*3));
  addLP(l7, C.lead, LL[4], 'in_progress', 100, 1);

  // Maria: first 2 leadership lessons
  addLP(mgr2, C.lead, LL[0], 'completed', 200, 10);
  addLP(mgr2, C.lead, LL[1], 'in_progress', 80, 2);

  // Inst2: all leadership completed
  LL.forEach((lid, i) => addLP(inst2, C.lead, lid, 'completed', 180, 70 + (7-i)*2));

  if (lp.length > 0) await insert('lesson_progress', lp);

  // ===================== 3. QUESTIONS =====================
  // Schema: assessment_id, question_text, question_type, points, explanation, sequence_order, options (JSONB), created_at
  console.log('❓ Questions...');
  const questions = [];
  let seq = 0;

  function addQ(aid, text, type, pts, opts, explanation) {
    questions.push({ assessment_id: aid, question_text: text, question_type: type, points: pts, options: opts || [], explanation: explanation || null, sequence_order: ++seq });
    seq = seq % 100 === 0 ? 0 : seq; // reset per assessment
  }

  // Data Science
  seq = 0;
  addQ(A.ds, 'What is a DataFrame in pandas?', 'multiple_choice', 10, [
    {text:'A 2D labeled data structure',is_correct:true},{text:'A type of database',is_correct:false},{text:'A Python built-in type',is_correct:false},{text:'A file format',is_correct:false}
  ], 'A DataFrame is the primary two-dimensional data structure in pandas.');
  addQ(A.ds, 'Which library is commonly used for machine learning in Python?', 'multiple_choice', 10, [
    {text:'scikit-learn',is_correct:true},{text:'Beautiful Soup',is_correct:false},{text:'Flask',is_correct:false},{text:'Django',is_correct:false}
  ]);
  addQ(A.ds, 'What does .describe() return in pandas?', 'multiple_choice', 10, [
    {text:'Summary statistics of numerical columns',is_correct:true},{text:'Column names',is_correct:false},{text:'Data types',is_correct:false},{text:'First 5 rows',is_correct:false}
  ]);
  addQ(A.ds, 'Explain the difference between supervised and unsupervised learning.', 'essay', 20);
  addQ(A.ds, 'A confusion matrix evaluates classification models.', 'true_false', 10, [{text:'True',is_correct:true},{text:'False',is_correct:false}]);

  // Leadership
  seq = 0;
  addQ(A.lead, 'Which leadership style involves shared decision-making?', 'multiple_choice', 10, [
    {text:'Democratic',is_correct:true},{text:'Autocratic',is_correct:false},{text:'Laissez-faire',is_correct:false},{text:'Transactional',is_correct:false}
  ]);
  addQ(A.lead, 'Emotional intelligence is key to effective leadership.', 'true_false', 10, [{text:'True',is_correct:true},{text:'False',is_correct:false}]);
  addQ(A.lead, 'Describe when transformational leadership is most effective.', 'essay', 20);
  addQ(A.lead, 'What is the primary focus of servant leadership?', 'multiple_choice', 10, [
    {text:'Serving team members\' needs',is_correct:true},{text:'Maximizing profits',is_correct:false},{text:'Following hierarchies',is_correct:false},{text:'Micromanaging',is_correct:false}
  ]);

  // Safety
  seq = 0;
  addQ(A.safety, 'What does OSHA stand for?', 'multiple_choice', 10, [
    {text:'Occupational Safety and Health Administration',is_correct:true},{text:'Office of Safety and Health Awareness',is_correct:false},{text:'Organization for Safe Activities',is_correct:false},{text:'Occupational Standards for Hazards',is_correct:false}
  ]);
  addQ(A.safety, 'All workplace injuries must be reported within 24 hours.', 'true_false', 10, [{text:'True',is_correct:true},{text:'False',is_correct:false}]);
  addQ(A.safety, 'List three common workplace hazards and mitigations.', 'essay', 20);

  // Cybersecurity
  seq = 0;
  addQ(A.cyber, 'What is phishing?', 'multiple_choice', 10, [
    {text:'A social engineering attack using deceptive emails',is_correct:true},{text:'A type of firewall',is_correct:false},{text:'A network scanner',is_correct:false},{text:'An encryption algorithm',is_correct:false}
  ]);
  addQ(A.cyber, 'Multi-factor authentication adds extra security.', 'true_false', 10, [{text:'True',is_correct:true},{text:'False',is_correct:false}]);
  addQ(A.cyber, 'What should you do with a suspicious email?', 'multiple_choice', 10, [
    {text:'Report to IT, don\'t click links',is_correct:true},{text:'Forward to colleagues',is_correct:false},{text:'Reply to verify sender',is_correct:false},{text:'Delete and forget',is_correct:false}
  ]);

  // Agile
  seq = 0;
  addQ(A.agile, 'What is a Sprint in Scrum?', 'multiple_choice', 10, [
    {text:'A time-boxed iteration',is_correct:true},{text:'A stakeholder meeting',is_correct:false},{text:'A documentation phase',is_correct:false},{text:'A testing period',is_correct:false}
  ]);
  addQ(A.agile, 'The Product Owner owns the Sprint backlog.', 'true_false', 10, [{text:'False',is_correct:true},{text:'True',is_correct:false}]);
  addQ(A.agile, 'Explain the difference between Scrum and Kanban.', 'essay', 20);

  // DEI
  seq = 0;
  addQ(A.dei, 'What does DEI stand for?', 'multiple_choice', 10, [
    {text:'Diversity, Equity, and Inclusion',is_correct:true},{text:'Department of Equal Integration',is_correct:false},{text:'Diverse Educational Institution',is_correct:false},{text:'Direct Employee Involvement',is_correct:false}
  ]);
  addQ(A.dei, 'Unconscious bias can affect hiring decisions.', 'true_false', 10, [{text:'True',is_correct:true},{text:'False',is_correct:false}]);

  await insert('questions', questions);

  // ===================== 4. ASSESSMENT ATTEMPTS =====================
  // Schema: user_id, assessment_id, score, passed, answers (JSONB), started_at, completed_at, time_spent
  console.log('📊 Assessment attempts...');
  await insert('assessment_attempts', [
    { user_id: chris, assessment_id: A.ds, score: 52, passed: true, answers: [], started_at: daysAgo(32), completed_at: daysAgo(32), time_spent: 1200 },
    { user_id: chris, assessment_id: A.cyber, score: 27, passed: true, answers: [], started_at: daysAgo(22), completed_at: daysAgo(22), time_spent: 900 },
    { user_id: l1, assessment_id: A.safety, score: 35, passed: true, answers: [], started_at: daysAgo(12), completed_at: daysAgo(12), time_spent: 1100 },
    { user_id: l2, assessment_id: A.cyber, score: 30, passed: true, answers: [], started_at: daysAgo(14), completed_at: daysAgo(14), time_spent: 800 },
    { user_id: l2, assessment_id: A.dei, score: 18, passed: true, answers: [], started_at: daysAgo(28), completed_at: daysAgo(28), time_spent: 600 },
    { user_id: l3, assessment_id: A.agile, score: 36, passed: true, answers: [], started_at: daysAgo(22), completed_at: daysAgo(22), time_spent: 1000 },
    { user_id: l4, assessment_id: A.safety, score: 32, passed: true, answers: [], started_at: daysAgo(32), completed_at: daysAgo(32), time_spent: 1200 },
    { user_id: l5, assessment_id: A.dei, score: 20, passed: true, answers: [], started_at: daysAgo(22), completed_at: daysAgo(22), time_spent: 500 },
    { user_id: l7, assessment_id: A.dei, score: 20, passed: true, answers: [], started_at: daysAgo(12), completed_at: daysAgo(12), time_spent: 450 },
    { user_id: l7, assessment_id: A.safety, score: 38, passed: true, answers: [], started_at: daysAgo(32), completed_at: daysAgo(32), time_spent: 1100 },
    { user_id: mgr1, assessment_id: A.lead, score: 48, passed: true, answers: [], started_at: daysAgo(42), completed_at: daysAgo(42), time_spent: 1300 },
    { user_id: mgr2, assessment_id: A.lead, score: 42, passed: true, answers: [], started_at: daysAgo(55), completed_at: daysAgo(55), time_spent: 1400 },
  ]);

  // ===================== 5. DISCUSSIONS (already inserted earlier, skip if re-running) =====================
  console.log('💬 Discussions...');
  // Check if any exist already
  const existingDisc = await supabaseGet('discussions?select=id&limit=1');
  if (!existingDisc || existingDisc.length === 0) {
    const d1 = randomUUID(), d2 = randomUUID(), d3 = randomUUID();
    await insert('discussions', [
      { id: d1, course_id: C.ds, user_id: l1, title: 'Best resources for learning pandas?', body: 'Looking for additional resources beyond the course material to practice pandas. Any recommendations?', upvotes: 5, created_at: daysAgo(20) },
      { id: randomUUID(), course_id: C.ds, user_id: l2, body: 'I\'d recommend Kaggle datasets! They have great beginner-friendly notebooks.', parent_id: d1, upvotes: 3, created_at: daysAgo(19) },
      { id: randomUUID(), course_id: C.ds, user_id: chris, body: 'The official pandas documentation has excellent tutorials too.', parent_id: d1, upvotes: 4, created_at: daysAgo(18) },
      { id: d2, course_id: C.lead, user_id: mgr1, title: 'How do you handle difficult conversations?', body: 'I\'d love strategies for approaching performance-related conversations. What frameworks have worked?', upvotes: 8, created_at: daysAgo(25) },
      { id: randomUUID(), course_id: C.lead, user_id: inst2, body: 'The SBI framework has been incredibly effective in my coaching sessions.', parent_id: d2, upvotes: 6, created_at: daysAgo(24) },
      { id: randomUUID(), course_id: C.lead, user_id: mgr2, body: 'I always start with asking questions rather than making statements.', parent_id: d2, upvotes: 4, created_at: daysAgo(23) },
      { id: randomUUID(), course_id: C.lead, user_id: l7, body: 'From HR perspective, documenting these conversations is critical.', parent_id: d2, upvotes: 3, created_at: daysAgo(22) },
      { id: d3, course_id: C.cyber, user_id: l3, title: 'Tips for a home security lab?', body: 'I want to practice cybersecurity skills at home. What tools and VMs do you recommend?', upvotes: 6, created_at: daysAgo(12) },
      { id: randomUUID(), course_id: C.cyber, user_id: inst1, body: 'VirtualBox + Kali Linux is a great starting point. Also set up Metasploitable.', parent_id: d3, upvotes: 5, created_at: daysAgo(11) },
      { id: randomUUID(), course_id: C.agile, user_id: l1, title: 'Scrum vs Kanban?', body: 'Our team is debating between Scrum and Kanban. Those with experience in both, what are practical differences?', upvotes: 4, created_at: daysAgo(5) },
    ]);
  } else {
    console.log('  (skipped - discussions already exist)');
  }

  // ===================== 6. CONVERSATIONS & MESSAGES =====================
  // conversations: id, type (direct|group), title, created_by (NOT NULL), created_at, updated_at
  // messages: conversation_id, sender_id, content (not body), message_type, created_at
  console.log('✉️ Conversations & messages...');
  const cv1 = randomUUID(), cv2 = randomUUID(), cv3 = randomUUID();

  await insert('conversations', [
    { id: cv1, type: 'direct', created_by: l1, created_at: daysAgo(15) },
    { id: cv2, type: 'group', title: 'Engineering Team Updates', created_by: mgr1, created_at: daysAgo(10) },
    { id: cv3, type: 'direct', created_by: admin, created_at: daysAgo(5) },
  ]);

  await insert('conversation_participants', [
    { conversation_id: cv1, user_id: l1 },
    { conversation_id: cv1, user_id: mgr1 },
    { conversation_id: cv2, user_id: mgr1 },
    { conversation_id: cv2, user_id: l1 },
    { conversation_id: cv2, user_id: l2 },
    { conversation_id: cv2, user_id: l3 },
    { conversation_id: cv3, user_id: chris },
    { conversation_id: cv3, user_id: admin },
  ]);

  await insert('messages', [
    { conversation_id: cv1, sender_id: l1, content: 'Hi David, I had a question about the Python course deadline. Is there flexibility?', message_type: 'text', created_at: daysAgo(15) },
    { conversation_id: cv1, sender_id: mgr1, content: 'Hi Alex! Yes, you have until end of month. Focus on quality over speed.', message_type: 'text', created_at: daysAgo(14) },
    { conversation_id: cv1, sender_id: l1, content: 'Thanks! I\'ll complete the final assessment by then.', message_type: 'text', created_at: daysAgo(14) },
    { conversation_id: cv2, sender_id: mgr1, content: 'Team, please complete Workplace Safety by end of this week. It\'s a compliance requirement.', message_type: 'text', created_at: daysAgo(10) },
    { conversation_id: cv2, sender_id: l2, content: 'Got it! I\'m almost done with it.', message_type: 'text', created_at: daysAgo(9) },
    { conversation_id: cv2, sender_id: l3, content: 'Will do. Has anyone started Cloud Architecture? Would love to discuss.', message_type: 'text', created_at: daysAgo(9) },
    { conversation_id: cv2, sender_id: l1, content: 'I haven\'t yet but it\'s on my list after finishing Agile.', message_type: 'text', created_at: daysAgo(8) },
    { conversation_id: cv3, sender_id: admin, content: 'Hi Chris, should we enable gamification features for all departments?', message_type: 'text', created_at: daysAgo(5) },
    { conversation_id: cv3, sender_id: chris, content: 'Yes, let\'s enable it company-wide. The pilot with Engineering went well.', message_type: 'text', created_at: daysAgo(4) },
    { conversation_id: cv3, sender_id: admin, content: 'Perfect, I\'ll roll it out today and set up badges for compliance courses.', message_type: 'text', created_at: daysAgo(4) },
  ]);

  // ===================== 7. NOTIFICATIONS =====================
  // Schema: user_id, type (enrollment|reminder|completion|certification|announcement|mention), title, body, link, is_read, channel, created_at
  console.log('🔔 Notifications...');
  await insert('notifications', [
    { user_id: chris, type: 'completion', title: 'Course Completed', body: 'Congratulations! You completed "Introduction to Data Science"', is_read: true, created_at: daysAgo(30) },
    { user_id: chris, type: 'enrollment', title: 'New Course Available', body: '"Cloud Architecture Fundamentals" has been added to the catalog', is_read: false, created_at: daysAgo(2) },
    { user_id: chris, type: 'reminder', title: 'Compliance Reminder', body: 'Your DEI Training is due in 30 days', is_read: false, created_at: daysAgo(1) },
    { user_id: l1, type: 'enrollment', title: 'Course Enrolled', body: 'You have been enrolled in "Agile & Scrum Mastery"', is_read: true, created_at: daysAgo(7) },
    { user_id: l1, type: 'completion', title: 'Badge Earned!', body: 'You earned the "Quick Learner" badge!', is_read: false, created_at: daysAgo(3) },
    { user_id: l2, type: 'reminder', title: 'Assessment Due', body: 'Python Programming assessment is due in 5 days', is_read: false, created_at: daysAgo(1) },
    { user_id: l2, type: 'completion', title: 'Course Completed', body: 'Congratulations! You completed "DEI in the Workplace"', is_read: true, created_at: daysAgo(25) },
    { user_id: mgr1, type: 'mention', title: 'Team Update', body: 'Alex Kumar completed "Advanced Python Programming"', is_read: true, created_at: daysAgo(15) },
    { user_id: mgr1, type: 'reminder', title: 'Approval Required', body: 'Nina Jackson has requested enrollment in "Project Management Professional"', is_read: false, created_at: daysAgo(2) },
    { user_id: mgr2, type: 'reminder', title: 'Compliance Alert', body: '2 team members have overdue compliance training', is_read: false, created_at: daysAgo(1) },
    { user_id: l4, type: 'completion', title: 'Course Completed', body: 'You completed "Effective Communication Skills"', is_read: true, created_at: daysAgo(10) },
    { user_id: l6, type: 'enrollment', title: 'New Learning Path', body: 'You\'ve been recommended the "Leadership Development Program"', is_read: false, created_at: daysAgo(4) },
    { user_id: l7, type: 'certification', title: 'Certificate Issued', body: 'Your "Workplace Safety Certified" certificate is ready', is_read: true, created_at: daysAgo(8) },
    { user_id: admin, type: 'announcement', title: 'System Update', body: 'Platform maintenance scheduled for this weekend', is_read: true, created_at: daysAgo(3) },
    { user_id: admin, type: 'announcement', title: 'New User Registered', body: 'A new user has registered and needs role assignment', is_read: false, created_at: daysAgo(1) },
  ]);

  // ===================== 8. USER BADGES =====================
  // Schema: user_id, badge_id, awarded_at (composite PK)
  console.log('🏅 User badges...');
  await insert('user_badges', [
    { user_id: chris, badge_id: B[0], awarded_at: daysAgo(85) },
    { user_id: chris, badge_id: B[5], awarded_at: daysAgo(30) },
    { user_id: chris, badge_id: B[9], awarded_at: daysAgo(20) },
    { user_id: l1, badge_id: B[0], awarded_at: daysAgo(55) },
    { user_id: l1, badge_id: B[1], awarded_at: daysAgo(40) },
    { user_id: l1, badge_id: B[10], awarded_at: daysAgo(15) },
    { user_id: l2, badge_id: B[0], awarded_at: daysAgo(45) },
    { user_id: l2, badge_id: B[6], awarded_at: daysAgo(14) },
    { user_id: l3, badge_id: B[0], awarded_at: daysAgo(48) },
    { user_id: l3, badge_id: B[5], awarded_at: daysAgo(5) },
    { user_id: l4, badge_id: B[0], awarded_at: daysAgo(50) },
    { user_id: l4, badge_id: B[3], awarded_at: daysAgo(10) },
    { user_id: l5, badge_id: B[0], awarded_at: daysAgo(40) },
    { user_id: l6, badge_id: B[0], awarded_at: daysAgo(45) },
    { user_id: l6, badge_id: B[5], awarded_at: daysAgo(8) },
    { user_id: l7, badge_id: B[0], awarded_at: daysAgo(55) },
    { user_id: l7, badge_id: B[9], awarded_at: daysAgo(30) },
    { user_id: l7, badge_id: B[11], awarded_at: daysAgo(10) },
    { user_id: mgr1, badge_id: B[0], awarded_at: daysAgo(75) },
    { user_id: mgr1, badge_id: B[5], awarded_at: daysAgo(40) },
    { user_id: mgr1, badge_id: B[7], awarded_at: daysAgo(30) },
    { user_id: mgr2, badge_id: B[0], awarded_at: daysAgo(85) },
    { user_id: mgr2, badge_id: B[5], awarded_at: daysAgo(20) },
    { user_id: inst1, badge_id: B[0], awarded_at: daysAgo(95) },
    { user_id: inst1, badge_id: B[7], awarded_at: daysAgo(60) },
    { user_id: inst2, badge_id: B[0], awarded_at: daysAgo(95) },
    { user_id: inst2, badge_id: B[7], awarded_at: daysAgo(50) },
  ]);

  // ===================== 9. POINTS LEDGER =====================
  // Schema: user_id, action_type, points, reference_type, reference_id, created_at
  console.log('⭐ Points ledger...');
  const pts = [];
  const actions = ['course_complete', 'lesson_complete', 'assessment_pass', 'badge_earned', 'discussion_post'];
  const pv = { course_complete: 100, lesson_complete: 10, assessment_pass: 50, badge_earned: 25, discussion_post: 5 };

  function addPts(uid, count, maxDays) {
    for (let i = 0; i < count; i++) {
      const a = actions[Math.floor(Math.random() * actions.length)];
      pts.push({ user_id: uid, action_type: a, points: pv[a], created_at: daysAgo(Math.floor(Math.random() * maxDays)) });
    }
  }

  addPts(chris, 15, 90); addPts(l1, 20, 55); addPts(l2, 18, 50);
  addPts(l3, 16, 48); addPts(l4, 12, 50); addPts(l5, 10, 40);
  addPts(l6, 14, 45); addPts(l7, 16, 55); addPts(mgr1, 20, 80);
  addPts(mgr2, 15, 60); addPts(inst1, 12, 95); addPts(inst2, 12, 95);

  await insert('points_ledger', pts);

  // ===================== 10. USER SKILLS =====================
  // Schema: user_id, skill_id (composite PK), proficiency_level (1-5), source, assessed_at
  console.log('🎯 User skills...');
  await insert('user_skills', [
    { user_id: chris, skill_id: SK[8], proficiency_level: 4, source: 'self_reported' },
    { user_id: chris, skill_id: SK[11], proficiency_level: 4, source: 'self_reported' },
    { user_id: chris, skill_id: SK[10], proficiency_level: 3, source: 'course_completion' },
    { user_id: l1, skill_id: SK[0], proficiency_level: 4, source: 'assessment' },
    { user_id: l1, skill_id: SK[2], proficiency_level: 4, source: 'assessment' },
    { user_id: l1, skill_id: SK[1], proficiency_level: 3, source: 'course_completion' },
    { user_id: l1, skill_id: SK[14], proficiency_level: 2, source: 'self_reported' },
    { user_id: l2, skill_id: SK[1], proficiency_level: 4, source: 'assessment' },
    { user_id: l2, skill_id: SK[3], proficiency_level: 4, source: 'assessment' },
    { user_id: l2, skill_id: SK[4], proficiency_level: 2, source: 'self_reported' },
    { user_id: l2, skill_id: SK[13], proficiency_level: 3, source: 'course_completion' },
    { user_id: l3, skill_id: SK[4], proficiency_level: 5, source: 'assessment' },
    { user_id: l3, skill_id: SK[13], proficiency_level: 3, source: 'course_completion' },
    { user_id: l3, skill_id: SK[14], proficiency_level: 4, source: 'course_completion' },
    { user_id: l4, skill_id: SK[7], proficiency_level: 4, source: 'course_completion' },
    { user_id: l4, skill_id: SK[10], proficiency_level: 2, source: 'self_reported' },
    { user_id: l4, skill_id: SK[9], proficiency_level: 3, source: 'self_reported' },
    { user_id: l5, skill_id: SK[7], proficiency_level: 3, source: 'self_reported' },
    { user_id: l5, skill_id: SK[9], proficiency_level: 2, source: 'self_reported' },
    { user_id: l6, skill_id: SK[7], proficiency_level: 4, source: 'course_completion' },
    { user_id: l6, skill_id: SK[8], proficiency_level: 2, source: 'self_reported' },
    { user_id: l6, skill_id: SK[9], proficiency_level: 3, source: 'self_reported' },
    { user_id: l7, skill_id: SK[7], proficiency_level: 4, source: 'course_completion' },
    { user_id: l7, skill_id: SK[8], proficiency_level: 3, source: 'self_reported' },
    { user_id: l7, skill_id: SK[9], proficiency_level: 3, source: 'self_reported' },
    { user_id: mgr1, skill_id: SK[8], proficiency_level: 4, source: 'course_completion' },
    { user_id: mgr1, skill_id: SK[10], proficiency_level: 5, source: 'assessment' },
    { user_id: mgr1, skill_id: SK[14], proficiency_level: 3, source: 'course_completion' },
    { user_id: mgr1, skill_id: SK[1], proficiency_level: 3, source: 'self_reported' },
    { user_id: mgr2, skill_id: SK[8], proficiency_level: 4, source: 'course_completion' },
    { user_id: mgr2, skill_id: SK[7], proficiency_level: 5, source: 'assessment' },
    { user_id: mgr2, skill_id: SK[11], proficiency_level: 3, source: 'self_reported' },
  ]);

  // ===================== 11. USER CERTIFICATIONS =====================
  // Schema: user_id, certification_id, issued_at, expires_at, status, certificate_url, metadata
  console.log('🎓 User certifications...');
  await insert('user_certifications', [
    { user_id: chris, certification_id: CERT.cyber, issued_at: daysAgo(20), expires_at: daysFromNow(345), status: 'active' },
    { user_id: l1, certification_id: CERT.safety, issued_at: daysAgo(10), expires_at: daysFromNow(355), status: 'active' },
    { user_id: l2, certification_id: CERT.cyber, issued_at: daysAgo(12), expires_at: daysFromNow(353), status: 'active' },
    { user_id: l3, certification_id: CERT.cyber, issued_at: daysAgo(30), expires_at: daysFromNow(335), status: 'active' },
    { user_id: l4, certification_id: CERT.safety, issued_at: daysAgo(30), expires_at: daysFromNow(335), status: 'active' },
    { user_id: l7, certification_id: CERT.safety, issued_at: daysAgo(30), expires_at: daysFromNow(335), status: 'active' },
    { user_id: mgr1, certification_id: CERT.lead, issued_at: daysAgo(40), expires_at: daysFromNow(325), status: 'active' },
    { user_id: mgr2, certification_id: CERT.lead, issued_at: daysAgo(50), expires_at: daysFromNow(315), status: 'active' },
    { user_id: inst1, certification_id: CERT.cyber, issued_at: daysAgo(60), expires_at: daysFromNow(305), status: 'active' },
    { user_id: inst2, certification_id: CERT.lead, issued_at: daysAgo(70), expires_at: daysFromNow(295), status: 'active' },
  ]);

  // ===================== 12. ENROLLMENT APPROVALS =====================
  // Schema: enrollment_id, course_id, learner_id, approver_id, status, requested_at, decided_at, reason, rejection_reason, notes
  console.log('✅ Enrollment approvals...');
  await insert('enrollment_approvals', [
    { course_id: C.pm, learner_id: l4, approver_id: mgr2, status: 'pending', requested_at: daysAgo(2), reason: 'Need PM skills for upcoming client project.' },
    { course_id: C.lead, learner_id: l5, approver_id: mgr2, status: 'pending', requested_at: daysAgo(1), reason: 'Developing leadership skills for potential promotion.' },
    { course_id: C.cloud, learner_id: l1, approver_id: mgr1, status: 'approved', requested_at: daysAgo(10), decided_at: daysAgo(9), reason: 'Need cloud skills for infrastructure migration.' },
    { course_id: C.python, learner_id: l2, approver_id: mgr1, status: 'approved', requested_at: daysAgo(22), decided_at: daysAgo(21), reason: 'Improve Python for backend work.' },
    { course_id: C.cyber, learner_id: l3, approver_id: mgr1, status: 'approved', requested_at: daysAgo(18), decided_at: daysAgo(17), reason: 'Security knowledge critical for DevOps.' },
    { course_id: C.ds, learner_id: l6, status: 'pending', requested_at: daysAgo(3), reason: 'Want to learn data analysis for marketing analytics.' },
  ]);

  // ===================== 13. AUDIT LOGS =====================
  // Schema: user_id, action, entity_type, entity_id, old_values (JSONB), new_values (JSONB), ip_address, user_agent, created_at
  console.log('📋 Audit logs...');
  await insert('audit_logs', [
    { user_id: chris, action: 'login', entity_type: 'auth', entity_id: chris, new_values: { method: 'password' }, ip_address: '192.168.1.100', created_at: daysAgo(0) },
    { user_id: admin, action: 'create', entity_type: 'user', entity_id: l1, new_values: { email: 'alex.kumar@learnhub.demo', role: 'learner' }, ip_address: '192.168.1.101', created_at: daysAgo(55) },
    { user_id: admin, action: 'create', entity_type: 'user', entity_id: l2, new_values: { email: 'jessica.lee@learnhub.demo', role: 'learner' }, ip_address: '192.168.1.101', created_at: daysAgo(50) },
    { user_id: admin, action: 'update', entity_type: 'course', entity_id: C.ds, old_values: { status: 'draft' }, new_values: { status: 'published' }, ip_address: '192.168.1.101', created_at: daysAgo(90) },
    { user_id: admin, action: 'update', entity_type: 'settings', new_values: { company_name: 'LearnHub' }, ip_address: '192.168.1.101', created_at: daysAgo(80) },
    { user_id: mgr1, action: 'approve', entity_type: 'enrollment_approval', new_values: { learner: 'Alex Kumar', course: 'Cloud Architecture' }, ip_address: '192.168.1.102', created_at: daysAgo(9) },
    { user_id: mgr1, action: 'approve', entity_type: 'enrollment_approval', new_values: { learner: 'Jessica Lee', course: 'Advanced Python' }, ip_address: '192.168.1.102', created_at: daysAgo(21) },
    { user_id: chris, action: 'login', entity_type: 'auth', entity_id: chris, new_values: { method: 'password' }, ip_address: '192.168.1.100', created_at: daysAgo(1) },
    { user_id: admin, action: 'login', entity_type: 'auth', entity_id: admin, new_values: { method: 'password' }, ip_address: '192.168.1.101', created_at: daysAgo(1) },
    { user_id: admin, action: 'create', entity_type: 'course', entity_id: C.cloud, new_values: { title: 'Cloud Architecture Fundamentals' }, ip_address: '192.168.1.101', created_at: daysAgo(5) },
    { user_id: admin, action: 'update', entity_type: 'user', entity_id: mgr1, old_values: { role: 'learner' }, new_values: { role: 'manager' }, ip_address: '192.168.1.101', created_at: daysAgo(70) },
    { user_id: chris, action: 'update', entity_type: 'settings', new_values: { gamification_enabled: true }, ip_address: '192.168.1.100', created_at: daysAgo(4) },
  ]);

  // ===================== 14. UPDATE FOREIGN KEYS =====================
  console.log('\n🔗 Updating foreign keys...');

  // ILT sessions -> instructors
  await patch('ilt_sessions', `id=eq.${ILT[0]}`, { instructor_id: inst1 });
  await patch('ilt_sessions', `id=eq.${ILT[1]}`, { instructor_id: inst2 });
  console.log('  ✓ ILT sessions updated with instructors');

  // Courses -> created_by
  const courseCreators = [[C.ds, inst1],[C.lead, inst2],[C.safety, admin],[C.python, inst1],
    [C.comm, inst2],[C.pm, inst2],[C.cyber, inst1],[C.design, admin],
    [C.finance, admin],[C.agile, inst1],[C.dei, admin],[C.cloud, inst1]];
  for (const [cid, uid] of courseCreators) await patch('courses', `id=eq.${cid}`, { created_by: uid });
  console.log('  ✓ Courses updated with created_by');

  // KB articles -> author_id
  const articles = await supabaseGet('kb_articles?select=id');
  if (articles) {
    const authors = [admin, inst1, inst2, chris];
    for (let i = 0; i < articles.length; i++) await patch('kb_articles', `id=eq.${articles[i].id}`, { author_id: authors[i % authors.length] });
    console.log(`  ✓ ${articles.length} KB articles updated with authors`);
  }

  // Documents -> uploaded_by
  const docs = await supabaseGet('documents?select=id');
  if (docs) {
    for (const d of docs) await patch('documents', `id=eq.${d.id}`, { uploaded_by: admin });
    console.log(`  ✓ ${docs.length} documents updated with uploaded_by`);
  }

  // Learning paths -> created_by
  const pathCreators = [['60000000-0000-0000-0000-000000000001',inst1],['60000000-0000-0000-0000-000000000002',inst2],
    ['60000000-0000-0000-0000-000000000003',admin],['60000000-0000-0000-0000-000000000004',inst1],['60000000-0000-0000-0000-000000000005',admin]];
  for (const [pid, uid] of pathCreators) await patch('learning_paths', `id=eq.${pid}`, { created_by: uid });
  console.log('  ✓ Learning paths updated with created_by');

  // Scheduled reports -> created_by
  const reports = await supabaseGet('scheduled_reports?select=id');
  if (reports) {
    for (const r of reports) await patch('scheduled_reports', `id=eq.${r.id}`, { created_by: admin });
    console.log(`  ✓ ${reports.length} scheduled reports updated with created_by`);
  }

  // ===================== 15. ILT ATTENDANCE =====================
  console.log('\n📋 ILT attendance...');
  await insert('ilt_attendance', [
    { session_id: ILT[0], user_id: l4, registration_status: 'registered' },
    { session_id: ILT[0], user_id: l5, registration_status: 'registered' },
    { session_id: ILT[0], user_id: mgr2, registration_status: 'registered' },
    { session_id: ILT[1], user_id: mgr1, registration_status: 'registered' },
    { session_id: ILT[1], user_id: l6, registration_status: 'registered' },
    { session_id: ILT[1], user_id: l7, registration_status: 'registered' },
    { session_id: ILT[1], user_id: chris, registration_status: 'registered' },
  ]);

  console.log('\n✅ Seed complete!');
  console.log('\nDemo login credentials (all use password "Demo1234!"):');
  console.log('  Super Admin: chris.cancialosi@gothamculture.com');
  console.log('  Admin:       admin@learnhub.demo');
  console.log('  Managers:    mgr.engineering@learnhub.demo, mgr.sales@learnhub.demo');
  console.log('  Instructors: instructor.tech@learnhub.demo, instructor.lead@learnhub.demo');
  console.log('  Learners:    alex.kumar@learnhub.demo, jessica.lee@learnhub.demo, ryan.garcia@learnhub.demo');
  console.log('               nina.jackson@learnhub.demo, tom.baker@learnhub.demo');
  console.log('               sophia.wright@learnhub.demo, marcus.brown@learnhub.demo');
}

main().catch(console.error);
