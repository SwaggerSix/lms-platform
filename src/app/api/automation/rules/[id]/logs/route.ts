import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

// GET: Get execution logs for a rule with pagination
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "25");
  const status = searchParams.get("status");
  const offset = (page - 1) * limit;

  const service = createServiceClient();

  // Verify rule exists
  const { data: rule } = await service
    .from("enrollment_rules")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!rule) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  let query = service
    .from("enrollment_rule_logs")
    .select("*, user:users(id, first_name, last_name, email)", { count: "exact" })
    .eq("rule_id", id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("Rule logs API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    logs: data ?? [],
    total: count ?? 0,
    page,
    rule_name: rule.name,
  });
}
