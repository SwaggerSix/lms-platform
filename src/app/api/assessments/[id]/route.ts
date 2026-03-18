import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const isAdmin = auth.user.role === "admin";
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await service
    .from("assessments")
    .select("*, questions(*)")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }
    console.error("Assessments API error:", error.message);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }

  if (!isAdmin && data) {
    data.questions = (data.questions ?? []).map((q: Record<string, unknown>) => ({
      ...q,
      options: Array.isArray(q.options)
        ? (q.options as Record<string, unknown>[]).map(({ is_correct, ...opt }: Record<string, unknown>) => opt)
        : q.options,
    }));
  }

  return NextResponse.json(data);
}
