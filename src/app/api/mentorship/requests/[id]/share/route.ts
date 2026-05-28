import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

// Mentee toggles whether their direct manager can view this mentorship.
// Only the mentee on the request can change this flag.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: requestId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.share_with_manager !== "boolean") {
    return NextResponse.json({ error: "share_with_manager must be a boolean" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: existing } = await service
    .from("mentorship_requests")
    .select("mentee_id")
    .eq("id", requestId)
    .single();
  if (!existing) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (existing.mentee_id !== auth.user.id) {
    return NextResponse.json({ error: "Only the mentee can change this setting" }, { status: 403 });
  }

  const { error } = await service
    .from("mentorship_requests")
    .update({ share_with_manager: body.share_with_manager })
    .eq("id", requestId);

  if (error) {
    console.error("Share toggle error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ share_with_manager: body.share_with_manager });
}
