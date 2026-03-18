import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function GET() {
  // Verify the user is authenticated via their session cookie
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Use service client to bypass RLS (avoids infinite recursion in users policy)
  const service = createServiceClient();
  const { data, error } = await service
    .from("users")
    .select("*, organization:organizations(*)")
    .eq("auth_id", user.id)
    .single();

  if (error) {
    console.error("Profile fetch error:", error.message);
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
