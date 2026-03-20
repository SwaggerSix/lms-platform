#!/bin/bash
# Seed script to create demo users in Supabase Auth + public.users table
set -e

cd "$(dirname "$0")/.."
source .env.local

API="$NEXT_PUBLIC_SUPABASE_URL"
KEY="$SUPABASE_SERVICE_ROLE_KEY"

CHRIS_ID="15c13083-5558-4b42-a461-9547957fde23"

create_user() {
  local email="$1" first="$2" last="$3" role="$4" org="$5" manager="$6" title="$7" hire="$8"

  # Create auth user
  local auth_result=$(curl -s -X POST \
    -H "apikey: $KEY" \
    -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"Demo1234!\",\"email_confirm\":true}" \
    "$API/auth/v1/admin/users")

  local auth_id=$(echo "$auth_result" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])" 2>/dev/null)

  if [ -z "$auth_id" ] || [ "$auth_id" = "None" ]; then
    echo "SKIP: $email (may already exist)"
    return
  fi

  # Build profile JSON
  local manager_field=""
  if [ -n "$manager" ] && [ "$manager" != "null" ]; then
    manager_field="\"manager_id\":\"$manager\","
  fi

  local profile_result=$(curl -s -X POST \
    -H "apikey: $KEY" \
    -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{
      \"auth_id\":\"$auth_id\",
      \"email\":\"$email\",
      \"first_name\":\"$first\",
      \"last_name\":\"$last\",
      \"role\":\"$role\",
      \"status\":\"active\",
      \"organization_id\":\"$org\",
      $manager_field
      \"job_title\":\"$title\",
      \"hire_date\":\"$hire\"
    }" \
    "$API/rest/v1/users")

  local user_id=$(echo "$profile_result" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])" 2>/dev/null)
  echo "CREATED: $email -> auth=$auth_id profile=$user_id"
  echo "$user_id"
}

echo "=== Creating Demo Users ==="

# Admin
ADMIN_ID=$(create_user "admin@learnhub.demo" "Sarah" "Mitchell" "admin" "00000000-0000-0000-0000-000000000001" "null" "LMS Administrator" "2023-06-01")

# Managers
MGR1_ID=$(create_user "mgr.engineering@learnhub.demo" "David" "Chen" "manager" "00000000-0000-0000-0000-000000000002" "null" "Engineering Manager" "2023-03-15")
MGR2_ID=$(create_user "mgr.sales@learnhub.demo" "Maria" "Rodriguez" "manager" "00000000-0000-0000-0000-000000000003" "null" "Sales Director" "2023-01-10")

# Instructors
INST1_ID=$(create_user "instructor.tech@learnhub.demo" "James" "Wilson" "instructor" "00000000-0000-0000-0000-000000000002" "null" "Senior Technical Trainer" "2023-08-20")
INST2_ID=$(create_user "instructor.lead@learnhub.demo" "Emily" "Patel" "instructor" "00000000-0000-0000-0000-000000000005" "null" "Leadership Coach" "2023-05-12")

# Learners in Engineering (report to David Chen)
L1_ID=$(create_user "alex.kumar@learnhub.demo" "Alex" "Kumar" "learner" "00000000-0000-0000-0000-000000000007" "MGR1_PLACEHOLDER" "Frontend Developer" "2024-02-01")
L2_ID=$(create_user "jessica.lee@learnhub.demo" "Jessica" "Lee" "learner" "00000000-0000-0000-0000-000000000008" "MGR1_PLACEHOLDER" "Backend Developer" "2024-03-15")
L3_ID=$(create_user "ryan.garcia@learnhub.demo" "Ryan" "Garcia" "learner" "00000000-0000-0000-0000-000000000009" "MGR1_PLACEHOLDER" "DevOps Engineer" "2024-01-20")

# Learners in Sales (report to Maria Rodriguez)
L4_ID=$(create_user "nina.jackson@learnhub.demo" "Nina" "Jackson" "learner" "00000000-0000-0000-0000-000000000010" "MGR2_PLACEHOLDER" "Account Executive" "2024-04-01")
L5_ID=$(create_user "tom.baker@learnhub.demo" "Tom" "Baker" "learner" "00000000-0000-0000-0000-000000000011" "MGR2_PLACEHOLDER" "Sales Representative" "2024-05-15")

# Learner in Marketing
L6_ID=$(create_user "sophia.wright@learnhub.demo" "Sophia" "Wright" "learner" "00000000-0000-0000-0000-000000000004" "null" "Marketing Specialist" "2024-06-01")

# Learner in HR
L7_ID=$(create_user "marcus.brown@learnhub.demo" "Marcus" "Brown" "learner" "00000000-0000-0000-0000-000000000005" "null" "HR Coordinator" "2024-07-10")

echo ""
echo "=== User IDs ==="
echo "CHRIS=$CHRIS_ID"
echo "ADMIN=$ADMIN_ID"
echo "MGR1=$MGR1_ID"
echo "MGR2=$MGR2_ID"
echo "INST1=$INST1_ID"
echo "INST2=$INST2_ID"
echo "L1=$L1_ID"
echo "L2=$L2_ID"
echo "L3=$L3_ID"
echo "L4=$L4_ID"
echo "L5=$L5_ID"
echo "L6=$L6_ID"
echo "L7=$L7_ID"
echo "=== Done ==="
