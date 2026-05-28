import { authorize } from "@/lib/auth/authorize";
import { NextResponse } from "next/server";
import { getMentorOnboardingStatus } from "@/lib/mentorship/onboarding";

// Returns the current user's mentor-onboarding gate status so the Mentor
// Profile UI can show the right banner.
export async function GET() {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const status = await getMentorOnboardingStatus(auth.user.id);
  return NextResponse.json(status);
}
