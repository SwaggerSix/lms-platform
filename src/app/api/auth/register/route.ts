import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { auth_id, email, first_name, last_name } = body;

    if (!auth_id || !email || !first_name || !last_name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate auth_id matches a real Supabase auth user
    const supabase = createServiceClient();
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(auth_id);
    if (authError || !authUser?.user) {
      return NextResponse.json({ error: "Invalid auth user" }, { status: 403 });
    }

    // Verify the email matches the auth user
    if (authUser.user.email !== email) {
      return NextResponse.json({ error: "Email mismatch" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("users")
      .upsert(
        {
          auth_id,
          email,
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          role: "learner",
          status: "active",
        },
        { onConflict: "auth_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("Registration profile error:", error.message);
      return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
