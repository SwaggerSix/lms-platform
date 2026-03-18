import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data, error } = await service
    .from("courses")
    .select("*, category:categories(name), modules(*, lessons(*))")
    .eq("slug", slug)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    console.error("Courses API error:", error.message);
    return NextResponse.json({ error: "An internal error occurred" }, { status: 500 });
  }

  return NextResponse.json(data);
}
