#!/usr/bin/env node
/**
 * Cleanup script to remove all demo/test data from the Supabase database.
 * This deletes data seeded by the old seed scripts (Acme Corporation, demo users, etc.)
 *
 * IMPORTANT: This is destructive. It will delete ALL data from the listed tables.
 * Only run this when you're ready to start fresh with real data.
 *
 * Run: node scripts/cleanup-test-data.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const TABLES_TO_CLEAN = [
  // User activity data (delete first due to foreign keys)
  'audit_logs',
  'points_ledger',
  'user_badges',
  'user_skills',
  'user_certifications',
  'assessment_attempts',
  'lesson_progress',
  'enrollment_approvals',
  'ilt_attendance',
  'enrollments',
  'notifications',
  'messages',
  'conversations',
  'discussion_posts',
  'discussion_threads',
  'scheduled_reports',

  // Content data
  'assessment_questions',
  'assessments',
  'lessons',
  'modules',
  'learning_path_items',
  'learning_paths',
  'course_skills',
  'compliance_requirements',
  'certifications',
  'documents',
  'document_folders',
  'kb_articles',
  'kb_categories',
  'ilt_sessions',
  'badges',
  'competency_frameworks',
  'courses',
  'skills',
  'categories',

  // Org structure (delete last)
  'users',
  'organizations',
];

async function cleanup() {
  console.log('🧹 Cleaning up all test/demo data from the database...\n');
  console.log('⚠️  This will delete ALL data from the following tables:');
  console.log(`   ${TABLES_TO_CLEAN.join(', ')}\n`);

  for (const table of TABLES_TO_CLEAN) {
    // Delete all rows (gte id '' matches everything for uuid columns)
    const { error, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .gte('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      // Some tables might not exist or have different PK structure
      console.log(`  ⚠ ${table}: ${error.message}`);
    } else {
      console.log(`  ✓ ${table}: ${count ?? 0} rows deleted`);
    }
  }

  console.log('\n📊 Verification (should all be 0):');
  for (const table of TABLES_TO_CLEAN) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    const c = count ?? 0;
    console.log(`  ${c === 0 ? '✓' : '✗'} ${table}: ${c} rows`);
  }

  console.log('\n✅ Cleanup complete! The database is ready for real data.');
}

cleanup().catch(console.error);
