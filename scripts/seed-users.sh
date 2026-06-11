#!/bin/bash
# Seed script to create users in Supabase Auth + public.users table.
#
# This script was previously used to create demo users.
# All test user data has been removed in preparation for production use.
#
# To create real users, add them below and run:
#   bash scripts/seed-users.sh

set -e
cd "$(dirname "$0")/.."
source .env.local

echo "No users to seed. Add real user data to this script."
