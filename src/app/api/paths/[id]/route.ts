import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await service
    .from("learning_paths")
    .select("*, items:learning_path_items(*, course:courses(*))")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Learning path not found" }, { status: 404 });
    }
    console.error("Paths API error:", error.message);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }

  return NextResponse.json(data);
}
