import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { swapAssignmentAction } from "@/lib/nudges/server";

// POST: swap an assignment's action for a different one in the same category.
export async function POST(request: NextRequest) {
  const auth = await authorize("manager", "admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { assignmentId?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.assignmentId) return NextResponse.json({ error: "assignmentId required" }, { status: 400 });

  const service = createServiceClient();
  const isAdmin = ["admin", "super_admin"].includes(auth.user.role);
  const result = await swapAssignmentAction(service, body.assignmentId, auth.user.id, isAdmin);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ success: true, action: result.action });
}
