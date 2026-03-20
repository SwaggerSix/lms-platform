import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP: 5 registrations per minute
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { success } = await rateLimit(`register:${ip}`, 5, 60000);
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const { auth_id, email, first_name, last_name } = body;

    if (!auth_id || !email || !first_name || !last_name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate auth_id matches a real Supabase auth user
    const service = createServiceClient();
    const { data: authUser, error: authError } = await service.auth.admin.getUserById(auth_id);
    if (authError || !authUser?.user) {
      return NextResponse.json({ error: "Invalid auth user" }, { status: 403 });
    }

    // Verify the email matches the auth user
    if (authUser.user.email !== email) {
      return NextResponse.json({ error: "Email mismatch" }, { status: 403 });
    }

    const { data, error } = await service
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
