import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { swapAssignmentAction } from "@/lib/nudges/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";

// Public: swap link from an email. Swaps the action then redirects to the
// employee-facing nudge page (the response_token is unchanged).
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const rl = await rateLimit(`nudge-swap-link-${token}`, 15, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const service = createServiceClient();
  const { data: assignment } = await service
    .from("nudge_assignments")
    .select("id")
    .eq("response_token", token)
    .single();

  if (assignment) {
    await swapAssignmentAction(service, assignment.id, null, true, false);
  }

  const base = APP_URL || new URL(request.url).origin;
  return NextResponse.redirect(`${base}/nudge/${token}`);
}
