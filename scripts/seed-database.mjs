/**
 * Seed the Supabase database with LMS data via the REST API.
 *
 * This script was previously used to populate the database with demo/test data.
 * All test data has been removed in preparation for production use.
 *
 * To seed real data, configure your Supabase credentials in .env.local
 * and add your organization's data below.
 *
 * Run: node scripts/seed-database.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function seed() {
  console.log('No seed data configured. Add your organization data to this script.');
}

seed().catch(console.error);
