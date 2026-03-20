import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  const service = createServiceClient();

  const { data, count, error } = await service
    .from("integration_sync_logs")
    .select("*", { count: "exact" })
    .eq("integration_id", id)
    .order("started_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Sync logs GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    logs: data,
    total: count,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
